import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { toast } from 'sonner'
import { db, addTransaction, updateTransaction, deleteTransaction, getTransactionsByUser, deleteTransactionsByUser } from '../utils/db'
import { useCashFlowStore } from './cashFlowStore'
import { useWatchlistStore } from './watchlistStore'
import { useAuthStore } from './authStore'

// ─── 심리 카테고리 상수 ───

export const BUY_PSYCHOLOGY = [
  '미래가치 투자',
  '분할매수 원칙',
  '저가 매수',
  '기술적 분석(상승추세)',
  '추격매매(모멘텀)',
  '뉴스 편승',
  '목표가 도달',
  '리밸런싱',
  'FOMO(두려움)',
  '되돌림 매수(손절후)',
  '외국인/기관 추종',
  '기타',
]

export const SELL_PSYCHOLOGY = [
  '목표가 실현',
  '수익 실현(조급)',
  '리밸런싱',
  '손절 원칙',
  '공포에 매도',
  '되돌림 손절(수익후)',
  '기술적 분석(하락추세)',
  '과신에서의 손절',
  '악재 반응',
  '외국인/기관 이탈',
  '기타',
]

export const PSYCHOLOGY_METADATA = {
  buy: {
    '기본전략': {
      emoji: '📈',
      color: 'from-blue-400 to-blue-600',
      description: '기본적 가치 투자 접근법',
      categories: [
        { value: '미래가치 투자', label: '미래가치 투자', hint: '기업 가치와 미래 성장성 중심' },
        { value: '분할매수 원칙', label: '분할매수 원칙', hint: '계획된 단계별 매수' },
        { value: '저가 매수', label: '저가 매수', hint: '저평가 종목 발굴' },
      ],
    },
    '추세전략': {
      emoji: '🚀',
      color: 'from-purple-400 to-purple-600',
      description: '추세 추종 기반 매매',
      categories: [
        { value: '기술적 분석(상승추세)', label: '기술적 분석(상승추세)', hint: '이동평균선 등 지표 활용' },
        { value: '추격매매(모멘텀)', label: '추격매매(모멘텀)', hint: '급등 추진력 추종' },
      ],
    },
    '뉴스/이벤트': {
      emoji: '📰',
      color: 'from-orange-400 to-orange-600',
      description: '뉴스 및 호재 기반 매수',
      categories: [
        { value: '뉴스 편승', label: '뉴스 편승', hint: '긍정적 뉴스 반응' },
        { value: '목표가 도달', label: '목표가 도달', hint: '애널리스트 목표가 달성' },
      ],
    },
    '리밸런싱': {
      emoji: '⚖️',
      color: 'from-cyan-400 to-cyan-600',
      description: '포트폴리오 균형 조정',
      categories: [
        { value: '리밸런싱', label: '리밸런싱', hint: '비중 조정 목적' },
      ],
    },
    '심리적요인': {
      emoji: '😌',
      color: 'from-pink-400 to-pink-600',
      description: '감정 및 심리 기반 매수',
      categories: [
        { value: 'FOMO(두려움)', label: 'FOMO(두려움)', hint: '놓칠까봐 매수' },
        { value: '되돌림 매수(손절후)', label: '되돌림 매수(손절후)', hint: '손절 후 되돌려 올라올 때 재매수' },
      ],
    },
    '패턴': {
      emoji: '🔄',
      color: 'from-indigo-400 to-indigo-600',
      description: '기관/외국인 따라하기',
      categories: [
        { value: '외국인/기관 추종', label: '외국인/기관 추종', hint: '대형 기관 움직임 추종' },
      ],
    },
    '기타': {
      emoji: '❓',
      color: 'from-gray-400 to-gray-600',
      description: '분류 불가 항목',
      categories: [
        { value: '기타', label: '기타', hint: '위 항목에 해당 사항 없음' },
      ],
    },
  },
  sell: {
    '수익실현': {
      emoji: '✅',
      color: 'from-green-400 to-green-600',
      description: '계획된 수익 실현',
      categories: [
        { value: '목표가 실현', label: '목표가 실현', hint: '목표 수익률 달성' },
        { value: '수익 실현(조급)', label: '수익 실현(조급)', hint: '충동적 조기 실현' },
        { value: '리밸런싱', label: '리밸런싱', hint: '비중 조정 목적' },
      ],
    },
    '손절': {
      emoji: '🛑',
      color: 'from-red-400 to-red-600',
      description: '손실 제한 및 손절',
      categories: [
        { value: '손절 원칙', label: '손절 원칙', hint: '계획된 손실 한도 실행' },
        { value: '공포에 매도', label: '공포에 매도', hint: '급락 시 공포심 매도' },
        { value: '되돌림 손절(수익후)', label: '되돌림 손절(수익후)', hint: '수익 후 급락하여 손절' },
      ],
    },
    '기술적매도': {
      emoji: '📉',
      color: 'from-teal-400 to-teal-600',
      description: '기술 지표 기반 매도',
      categories: [
        { value: '기술적 분석(하락추세)', label: '기술적 분석(하락추세)', hint: '지표 하락 신호 매도' },
      ],
    },
    '심리적요인': {
      emoji: '😌',
      color: 'from-pink-400 to-pink-600',
      description: '감정 및 인지 오류',
      categories: [
        { value: '과신에서의 손절', label: '과신에서의 손절', hint: '예상과 달라 급히 매도' },
      ],
    },
    '뉴스/이벤트': {
      emoji: '📰',
      color: 'from-orange-400 to-orange-600',
      description: '악재 반응 매도',
      categories: [
        { value: '악재 반응', label: '악재 반응', hint: '부정적 뉴스 반응' },
      ],
    },
    '패턴': {
      emoji: '🔄',
      color: 'from-indigo-400 to-indigo-600',
      description: '기관/외국인 따라하기',
      categories: [
        { value: '외국인/기관 이탈', label: '외국인/기관 이탈', hint: '대형 기관 이탈 추종' },
      ],
    },
    '기타': {
      emoji: '❓',
      color: 'from-gray-400 to-gray-600',
      description: '분류 불가 항목',
      categories: [
        { value: '기타', label: '기타', hint: '위 항목에 해당 사항 없음' },
      ],
    },
  },
}

export const PSYCHOLOGY_MIGRATION_MAP = {
  buy: {
    '미래가치 투자': '미래가치 투자',
    '분할매수 원칙': '분할매수 원칙',
    '추격매매': '추격매매(모멘텀)',
    '뉴스 편승': '뉴스 편승',
    '저가 매수': '저가 매수',
    '목표가 도달': '목표가 도달',
    '기술적 분석(20일상승)': '기술적 분석(상승추세)',
    '기타': '기타',
  },
  sell: {
    '목표가 실현': '목표가 실현',
    '손절 원칙': '손절 원칙',
    '공포에 매도': '공포에 매도',
    '수익 실현 (조급)': '수익 실현(조급)',
    '수익 실현(조급)': '수익 실현(조급)',
    '리밸런싱': '리밸런싱',
    '기술적 분석(20일하락)': '기술적 분석(하락추세)',
    '기타': '기타',
  },
}

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
            newEntry.pnl = Math.round(
              (newEntry.price - holding.avgPrice) * newEntry.quantity - (newEntry.fee || 0)
            )
          }
        }

        // 매수/매도 시 현금 흐름 자동 연동
        // 매수: price*qty + fee (수수료 포함 실제 출금액)
        // 매도: price*qty - fee (수수료 차감 실제 입금액)
        if (newEntry.accountId && newEntry.price && newEntry.quantity) {
          const buyFee  = newEntry.action === 'buy'  ? (newEntry.fee || 0) : 0
          const sellFee = newEntry.action === 'sell' ? (newEntry.fee || 0) : 0
          const amount = newEntry.price * newEntry.quantity + buyFee - sellFee
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
        addTransaction(newEntry).catch(err => {
          console.warn('[DB] addTransaction failed:', err)
          toast.warning('로컬 DB 저장 실패 — 앱 데이터는 보존됩니다.')
        })

        // 매수 종목은 관심종목에 자동 등록 (중복은 watchlistStore에서 방지)
        if (newEntry.action === 'buy' && newEntry.ticker) {
          useWatchlistStore.getState().addToWatchlist({
            ticker: newEntry.ticker,
            name: newEntry.name || newEntry.ticker,
            market: newEntry.market || 'KRX',
          })
        }
      },

      updateEntry: (id, updates) => {
        const entry = get().entries.find(e => e.id === id)

        // 연결된 자동 현금 흐름도 함께 동기화
        if (entry?.linkedCashFlowId) {
          const cashFlowUpdates = {}

          if (updates.accountId !== undefined && updates.accountId !== entry.accountId) {
            cashFlowUpdates.accountId = updates.accountId
          }

          const newAction  = updates.action   ?? entry.action
          const newPrice   = updates.price    ?? entry.price
          const newQty     = updates.quantity ?? entry.quantity
          const newFee     = updates.fee      ?? entry.fee
          const newMarket  = updates.market   ?? entry.market
          const newBuyFee  = newAction === 'buy'  ? (newFee || 0) : 0
          const newSellFee = newAction === 'sell' ? (newFee || 0) : 0
          const newAmount  = newPrice * newQty + newBuyFee - newSellFee
          // 실제 저장된 cashFlow 금액과 비교 (재계산 비교 시 이전 버그와 일치해 버리는 문제 방지)
          const storedCashFlow = useCashFlowStore.getState().cashFlows.find(f => f.id === entry.linkedCashFlowId)
          const oldAmount  = storedCashFlow?.amount ?? newAmount

          if (newAmount !== oldAmount || newAction !== entry.action || newMarket !== entry.market) {
            cashFlowUpdates.amount   = newAmount
            cashFlowUpdates.type     = newAction === 'buy' ? 'withdrawal' : 'deposit'
            cashFlowUpdates.currency = newMarket === 'NYSE' || newMarket === 'NASDAQ' ? 'USD' : 'KRW'
          }

          if (Object.keys(cashFlowUpdates).length > 0) {
            useCashFlowStore.getState().updateCashFlow(entry.linkedCashFlowId, cashFlowUpdates)
          }
        }

        set((state) => {
          const e = state.entries.find(e => e.id === id)
          if (e) Object.assign(e, updates)
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

      // 매매일지 accountId 기준으로 연결된 cashFlow accountId를 강제 동기화
      // linkedCashFlowId가 있는 항목만 대상, 계좌 불일치 건만 업데이트
      syncCashFlowsToJournals: () => {
        const entries = get().entries
        const cashFlowStore = useCashFlowStore.getState()
        let synced = 0
        entries.forEach(entry => {
          if (!entry.linkedCashFlowId) return
          const flow = cashFlowStore.cashFlows.find(f => f.id === entry.linkedCashFlowId)
          if (flow && flow.accountId !== entry.accountId) {
            cashFlowStore.updateCashFlow(entry.linkedCashFlowId, { accountId: entry.accountId })
            synced++
          }
        })
        return synced
      },

      // 특정 계좌의 모든 거래 내역을 다른 계좌로 이동
      moveEntriesByAccount: (fromAccountId, toAccountId) => {
        const ids = get().entries
          .filter(e => e.accountId === fromAccountId)
          .map(e => e.id)
        set((state) => {
          state.entries.forEach(e => {
            if (e.accountId === fromAccountId) e.accountId = toAccountId
          })
        })
        ids.forEach(id => updateTransaction(id, { accountId: toAccountId })
          .catch(err => console.warn('[DB] moveEntries failed:', err)))
        return ids.length
      },

      // 메모리만 초기화 (로그아웃/사용자 전환 시 사용)
      clearEntries: () => {
        set((state) => { state.entries = [] })
      },

      // 메모리 + IndexedDB 모두 삭제 (설정 > 데이터 초기화 전용)
      deleteAllEntries: () => {
        const userId = useAuthStore.getState().currentUser?.id
        set((state) => { state.entries = [] })
        if (userId) {
          deleteTransactionsByUser(userId).catch(err => console.warn('[DB] deleteAllEntries failed:', err))
        }
      },

      // 앱 시작 시 IndexedDB에서 사용자별 데이터 로드
      loadFromDB: async (userId) => {
        if (!userId) return
        try {
          const dbEntries = await getTransactionsByUser(userId)
          set((state) => { state.entries = dbEntries })

          // 매수 이력이 있는 종목을 관심종목에 동기화 (중복 방지는 watchlistStore에서 처리)
          const addToWatchlist = useWatchlistStore.getState().addToWatchlist
          const seen = new Set()
          for (const e of dbEntries) {
            if (e.action === 'buy' && e.ticker && !seen.has(e.ticker)) {
              seen.add(e.ticker)
              addToWatchlist({
                ticker: e.ticker,
                name: e.name || e.ticker,
                market: e.market || 'KRX',
              })
            }
          }
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
              sector: e.sector || 'ETC',
              quantity: 0,
              totalCost: 0,
              accountId: e.accountId,
            }
          }
          const pos = map[e.ticker]
          if (e.action === 'buy') {
            pos.totalCost += e.price * e.quantity + (e.fee || 0)
            pos.quantity += e.quantity
            pos.sector = e.sector || pos.sector
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
      // baseEntries: 날짜 필터 등 외부 사전 필터 배열. 미전달 시 스토어 전체 사용
      getProfitByPsychology: (accountId, exchangeRate = 1350, baseEntries) => {
        let entries = baseEntries ?? get().entries
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

      // ─── HTS import 전용 ───

      // externalId로 기존 엔트리 조회 (중복 감지용)
      findEntryByExternalId: (externalId) => {
        return get().entries.find((e) => e.externalId === externalId) ?? null
      },

      // 복수 엔트리 일괄 추가 (HTS import용, 현금흐름 자동 연동 제외)
      addEntriesBulk: (entries) => {
        const userId = useAuthStore.getState().currentUser?.id
        const now = new Date().toISOString()

        const newEntries = entries
          .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
          .map((entry) => ({
            id: crypto.randomUUID(),
            createdAt: now,
            pnl: null,
            memo: '',
            linkedCashFlowId: null,
            userId,
            source: 'eugene-hts',
            importedAt: now,
            ...entry,
          }))

        // 기존 보유 현황을 계좌별 평균단가 맵으로 초기화
        const holdingMap = {}
        for (const e of get().entries) {
          if (!e.accountId) continue
          const key = `${e.accountId}__${e.ticker}`
          if (!holdingMap[key]) holdingMap[key] = { quantity: 0, totalCost: 0 }
          const pos = holdingMap[key]
          if (e.action === 'buy') {
            pos.totalCost += e.price * e.quantity + (e.fee || 0)
            pos.quantity += e.quantity
          } else if (e.action === 'sell' && pos.quantity > 0) {
            const avg = pos.totalCost / pos.quantity
            pos.totalCost -= avg * Math.min(e.quantity, pos.quantity)
            pos.quantity = Math.max(0, pos.quantity - e.quantity)
          }
        }

        // 신규 항목을 날짜순으로 처리: 매도 시 pnl 계산 후 맵 갱신
        for (const e of newEntries) {
          if (!e.accountId) continue
          const key = `${e.accountId}__${e.ticker}`
          if (!holdingMap[key]) holdingMap[key] = { quantity: 0, totalCost: 0 }
          const pos = holdingMap[key]

          if (e.action === 'buy') {
            pos.totalCost += e.price * e.quantity + (e.fee || 0)
            pos.quantity += e.quantity
          } else if (e.action === 'sell') {
            if (e.pnl === null && pos.quantity > 0) {
              const avgPrice = pos.totalCost / pos.quantity
              e.pnl = Math.round((e.price - avgPrice) * e.quantity - (e.fee || 0))
            }
            if (pos.quantity > 0) {
              const avg = pos.totalCost / pos.quantity
              pos.totalCost -= avg * Math.min(e.quantity, pos.quantity)
              pos.quantity = Math.max(0, pos.quantity - e.quantity)
            }
          }
        }

        set((state) => {
          state.entries.push(...newEntries)
        })

        newEntries.forEach((e) => {
          addTransaction(e).catch((err) =>
            console.warn('[DB] addEntriesBulk failed:', err)
          )
        })

        return newEntries.length
      },

      // 전체 통계 요약 (선택적 accountId 필터)
      // baseEntries: 날짜 필터 등 외부 사전 필터 배열. 미전달 시 스토어 전체 사용
      getSummaryStats: (accountId, baseEntries) => {
        let entries = baseEntries ?? get().entries
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
