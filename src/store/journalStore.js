import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { db, addTransaction, updateTransaction, deleteTransaction, getTransactionsByUser, deleteTransactionsByUser } from '../utils/db'
import { useCashFlowStore } from './cashFlowStore'
import { useAuthStore } from './authStore'

// ─── 심리 카테고리 상수 ───

export const BUY_PSYCHOLOGY = [
  '미래가치 투자',
  '분할매수 원칙',
  '추격매매',
  '뉴스 편승',
  '저가 매수',
  '목표가 도달',
  '기타',
]

export const SELL_PSYCHOLOGY = [
  '목표가 실현',
  '손절 원칙',
  '공포에 매도',
  '수익 실현 (조급)',
  '리밸런싱',
  '기타',
]

// ─── 스토어 ───

export const useJournalStore = create(
  persist(
    immer((set, get) => ({
      entries: [],

      // ─── 액션 ───

      addEntry: (entry) => {
        const userId = useAuthStore.getState().currentUser?.id
        const newEntry = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          fee: 0,
          pnl: null,
          memo: '',
          linkedCashFlowId: null,
          userId,
          ...entry,
        }

        // 매도 시 실현손익 자동 계산 (사용자가 직접 입력하지 않은 경우)
        if (newEntry.action === 'sell' && newEntry.pnl === null) {
          const currentHoldings = get().computeHoldings(newEntry.accountId)
          const holding = currentHoldings.find(h => h.ticker === newEntry.ticker)
          if (holding && holding.avgPrice > 0) {
            // pnl은 해당 종목의 원화폐 단위로 저장 (USD → KRW 변환은 집계 시 처리)
            newEntry.pnl = Math.round((newEntry.price - holding.avgPrice) * newEntry.quantity)
          }
        }

        // 매수/매도 시 현금 흐름 자동 연동
        // 매수: price*qty + fee (수수료 포함 실제 출금액)
        // 매도: price*qty       (수수료는 실현손익에 이미 반영)
        if (newEntry.accountId && newEntry.price && newEntry.quantity) {
          const fee = newEntry.action === 'buy' ? (newEntry.fee || 0) : 0
          const amount = newEntry.price * newEntry.quantity + fee
          const cashFlowType = newEntry.action === 'buy' ? 'withdrawal' : 'deposit'
          const label = newEntry.action === 'buy'
            ? `매수: ${newEntry.name || newEntry.ticker}`
            : `매도: ${newEntry.name || newEntry.ticker}`

          const cashFlowId = useCashFlowStore.getState().addAutoFlow({
            accountId: newEntry.accountId,
            type: cashFlowType,
            amount,
            currency: newEntry.market === 'NYSE' || newEntry.market === 'NASDAQ' ? 'USD' : 'KRW',
            date: newEntry.date,
            memo: label,
            linkedJournalId: newEntry.id,
          })
          newEntry.linkedCashFlowId = cashFlowId
        }

        set((state) => { state.entries.push(newEntry) })
        // IndexedDB에도 저장 (비동기, 실패해도 로컬스토리지 백업 유지)
        addTransaction(newEntry).catch(err => console.warn('[DB] addTransaction failed:', err))
      },

      updateEntry: (id, updates) => {
        set((state) => {
          const entry = state.entries.find(e => e.id === id)
          if (entry) Object.assign(entry, updates)
        })
        updateTransaction(id, updates).catch(err => console.warn('[DB] updateTransaction failed:', err))
      },

      deleteEntry: (id) => {
        // 연결된 자동 현금 흐름도 함께 삭제
        const entry = get().entries.find(e => e.id === id)
        if (entry?.linkedCashFlowId) {
          useCashFlowStore.getState().deleteCashFlow(entry.linkedCashFlowId)
        }
        set((state) => {
          state.entries = state.entries.filter(e => e.id !== id)
        })
        deleteTransaction(id).catch(err => console.warn('[DB] deleteTransaction failed:', err))
      },

      clearEntries: () => {
        const userId = useAuthStore.getState().currentUser?.id
        set((state) => { state.entries = [] })
        if (userId) {
          deleteTransactionsByUser(userId).catch(err => console.warn('[DB] clearEntries failed:', err))
        }
      },

      // 앱 시작 시 IndexedDB에서 사용자별 데이터 로드
      loadFromDB: async (userId) => {
        if (!userId) return
        try {
          const dbEntries = await getTransactionsByUser(userId)
          set((state) => { state.entries = dbEntries })
        } catch (err) {
          console.warn('[DB] loadFromDB failed, using localStorage:', err)
        }
      },

      // ─── 포트폴리오 파생 셀렉터 ───

      // 특정 계좌의 현재 보유 현황 (거래내역에서 계산)
      computeHoldings: (accountId) => {
        const entries = get().entries
          .filter(e => e.accountId === accountId)
          .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

        const map = {}

        for (const e of entries) {
          if (!map[e.ticker]) {
            map[e.ticker] = {
              ticker: e.ticker,
              name: e.name,
              market: e.market || 'KRX',
              quantity: 0,
              totalCost: 0,
              accountId: e.accountId,
            }
          }
          const pos = map[e.ticker]
          if (e.action === 'buy') {
            pos.totalCost += e.price * e.quantity + (e.fee || 0)
            pos.quantity += e.quantity
          } else {
            // 매도: 평균단가 기준으로 총원가 감소
            if (pos.quantity > 0) {
              const avgPrice = pos.totalCost / pos.quantity
              pos.totalCost -= avgPrice * e.quantity
              pos.quantity -= e.quantity
            }
          }
        }

        return Object.values(map)
          .filter(p => p.quantity > 0)
          .map(p => ({
            ...p,
            avgPrice: p.quantity > 0 ? Math.round(p.totalCost / p.quantity) : 0,
          }))
      },

      // 전체 계좌 보유 현황 (계좌별 분리, 합산 안 함)
      computeAllHoldings: () => {
        const { entries } = get()
        const accountIds = [...new Set(entries.map(e => e.accountId).filter(Boolean))]

        const allHoldings = []
        for (const accountId of accountIds) {
          const holdings = get().computeHoldings(accountId)
          allHoldings.push(...holdings)
        }
        return allHoldings
      },

      // ─── 기존 셀렉터 (accountId 필터 추가) ───

      getEntriesByTicker: (ticker) => {
        return get().entries.filter(e => e.ticker === ticker)
      },

      getEntriesByPsychology: (psychology) => {
        return get().entries.filter(e => e.psychology === psychology)
      },

      getEntriesByDateRange: (start, end) => {
        return get().entries.filter(e => e.date >= start && e.date <= end)
      },

      // 심리 유형별 수익률 집계 (선택적 accountId 필터, 환율 적용)
      getProfitByPsychology: (accountId, exchangeRate = 1350) => {
        let entries = get().entries
        if (accountId) entries = entries.filter(e => e.accountId === accountId)

        const map = {}
        entries.forEach(e => {
          if (!map[e.psychology]) {
            map[e.psychology] = { psychology: e.psychology, count: 0, pnlCount: 0, totalPnl: 0 }
          }
          map[e.psychology].count += 1
          if (e.pnl !== null && e.pnl !== undefined) {
            map[e.psychology].pnlCount += 1
            // USD 종목 pnl은 KRW로 환산
            const pnlKRW = (e.market !== 'KRX') ? e.pnl * exchangeRate : e.pnl
            map[e.psychology].totalPnl += pnlKRW
          }
        })

        return Object.values(map)
          .map(item => ({
            ...item,
            avgPnl: item.pnlCount > 0 ? Math.round(item.totalPnl / item.pnlCount) : null,
          }))
          .sort((a, b) => (b.avgPnl ?? -Infinity) - (a.avgPnl ?? -Infinity))
      },

      // 기존 매도 항목의 pnl이 null인 경우 소급 계산
      recalculateSellPnl: () => {
        const entries = [...get().entries].sort(
          (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
        )

        // account+ticker별 누적 매수 원가 추적
        const costMap = {}
        const updates = []

        for (const entry of entries) {
          const key = `${entry.accountId}_${entry.ticker}`
          if (!costMap[key]) costMap[key] = { totalCost: 0, quantity: 0 }
          const pos = costMap[key]

          if (entry.action === 'buy') {
            pos.totalCost += entry.price * entry.quantity + (entry.fee || 0)
            pos.quantity += entry.quantity
          } else if (entry.action === 'sell') {
            if (pos.quantity > 0 && (entry.pnl === null || entry.pnl === undefined)) {
              const avgPrice = pos.totalCost / pos.quantity
              updates.push({ id: entry.id, pnl: Math.round((entry.price - avgPrice) * entry.quantity) })
            }
            // 매도 후 원가 감소
            if (pos.quantity > 0) {
              const avgPrice = pos.totalCost / pos.quantity
              pos.totalCost -= avgPrice * entry.quantity
              pos.quantity -= entry.quantity
            }
          }
        }

        if (updates.length === 0) return 0

        set((state) => {
          updates.forEach(({ id, pnl }) => {
            const e = state.entries.find(e => e.id === id)
            if (e) e.pnl = pnl
          })
        })
        updates.forEach(({ id, pnl }) => {
          updateTransaction(id, { pnl }).catch(err => console.warn('[DB] recalculate pnl failed:', err))
        })
        return updates.length
      },

      // 전체 통계 요약 (선택적 accountId 필터)
      getSummaryStats: (accountId) => {
        let entries = get().entries
        if (accountId) entries = entries.filter(e => e.accountId === accountId)

        const buyCount = entries.filter(e => e.action === 'buy').length
        const sellCount = entries.filter(e => e.action === 'sell').length
        const pnlEntries = entries.filter(e => e.pnl !== null && e.pnl !== undefined)
        const totalPnl = pnlEntries.reduce((sum, e) => sum + e.pnl, 0)

        return {
          totalCount: entries.length,
          buyCount,
          sellCount,
          totalPnl,
          pnlCount: pnlEntries.length,
        }
      },
    })),
    {
      name: 'journal-storage',
      version: 5,
      migrate: () => ({ entries: [] }),
      // IndexedDB가 정식 저장소이므로 localStorage에는 아무것도 저장하지 않음
      partialize: () => ({}),
    }
  )
)
