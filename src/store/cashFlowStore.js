import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  addCashFlow as dbAdd,
  updateCashFlow as dbUpdate,
  deleteCashFlow as dbDelete,
  getCashFlowsByUser,
  deleteCashFlowsByUser as dbDeleteByUser,
  deleteCashFlowsByAccount as dbDeleteByAccount,
  bumpSyncVersion,
} from '../utils/db'
import { useAuthStore } from './authStore'
import { useSyncStore } from './syncStore'

// ─── 입출금 유형 상수 ───
export const CASH_FLOW_TYPES = {
  DEPOSIT:    { code: 'deposit',    label: '입금',   color: 'text-blue-600' },
  WITHDRAWAL: { code: 'withdrawal', label: '출금',   color: 'text-orange-500' },
}

// ─── 입출금 카테고리 상수 ───
// isCapital: true  → 수익률 계산 분모(순투자원금)에 포함
// isCapital: false → 잔고에는 반영되나 수익률 분모에서 제외
export const CASH_FLOW_CATEGORIES = {
  INVESTMENT_IN:  { code: 'investment_in',  label: '투자금 입금', type: 'deposit',    isCapital: true  },
  DIVIDEND:       { code: 'dividend',       label: '배당금',      type: 'deposit',    isCapital: false },
  INTEREST:       { code: 'interest',       label: '이자/기타',   type: 'deposit',    isCapital: false },
  ADJUST_PLUS:    { code: 'adjust_plus',    label: '조정(+)',     type: 'deposit',    isCapital: false },
  INVESTMENT_OUT: { code: 'investment_out', label: '투자금 출금', type: 'withdrawal', isCapital: true  },
  FEE_TAX:        { code: 'fee_tax',        label: '수수료/세금', type: 'withdrawal', isCapital: false },
  ADJUST_MINUS:   { code: 'adjust_minus',   label: '조정(-)',     type: 'withdrawal', isCapital: false },
}

export const DEPOSIT_CATEGORIES    = Object.values(CASH_FLOW_CATEGORIES).filter(c => c.type === 'deposit')
export const WITHDRAWAL_CATEGORIES = Object.values(CASH_FLOW_CATEGORIES).filter(c => c.type === 'withdrawal')

export const useCashFlowStore = create(
  persist(
    immer((set, get) => ({
      cashFlows: [],

      // ─── 액션 ───

      // 수동 입출금 추가
      addCashFlow: (flow) => {
        const { id: userId, email: userEmail } = useAuthStore.getState().currentUser ?? {}
        // 카테고리 미지정 시 type 기반 기본값 적용
        const defaultCategory = flow.type === 'withdrawal' ? 'investment_out' : 'investment_in'
        const newFlow = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          isAuto: false,
          memo: '',
          userId,
          userEmail: userEmail || '',
          category: defaultCategory,
          ...flow,
        }
        const syncedFlow = bumpSyncVersion(newFlow)
        set((state) => { state.cashFlows.push(syncedFlow) })
        dbAdd(syncedFlow).catch(err => console.warn('[DB] addCashFlow failed:', err))
        useSyncStore.getState().incrementPending()
        return syncedFlow.id
      },

      // 매매 연동 자동 입출금 추가 (journalStore에서 호출)
      addAutoFlow: (flow) => {
        const { id: userId, email: userEmail } = useAuthStore.getState().currentUser ?? {}
        const newFlow = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          isAuto: true,
          memo: '',
          userId,
          userEmail: userEmail || '',
          ...flow,
        }
        const syncedFlow = bumpSyncVersion(newFlow)
        set((state) => { state.cashFlows.push(syncedFlow) })
        dbAdd(syncedFlow).catch(err => console.warn('[DB] addAutoFlow failed:', err))
        useSyncStore.getState().incrementPending()
        return syncedFlow.id
      },

      updateCashFlow: (id, updates) => {
        const syncUpdates = bumpSyncVersion(updates)
        set((state) => {
          const flow = state.cashFlows.find(f => f.id === id)
          if (flow) Object.assign(flow, syncUpdates)
        })
        dbUpdate(id, syncUpdates).catch(err => console.warn('[DB] updateCashFlow failed:', err))
        useSyncStore.getState().incrementPending()
      },

      // 수동 입출금 삭제 (자동 연동 항목은 journalStore에서 삭제)
      deleteCashFlow: (id) => {
        set((state) => {
          state.cashFlows = state.cashFlows.filter(f => f.id !== id)
        })
        const softDelete = bumpSyncVersion({ deletedAt: new Date().toISOString() })
        dbUpdate(id, softDelete)
          .catch(() => dbDelete(id))
          .catch(err => console.warn('[DB] deleteCashFlow failed:', err))
        useSyncStore.getState().incrementPending()
      },

      // 특정 계좌의 모든 입출금 내역을 다른 계좌로 이동
      moveCashFlowsByAccount: (fromAccountId, toAccountId) => {
        const ids = []
        set((state) => {
          state.cashFlows.forEach(f => {
            if (f.accountId === fromAccountId) {
              f.accountId = toAccountId
              ids.push(f.id)
            }
          })
        })
        ids.forEach(id => dbUpdate(id, { accountId: toAccountId })
          .catch(err => console.warn('[DB] moveCashFlows failed:', err)))
        return ids.length
      },

      // 계좌 삭제 시 연결 입출금 내역 cascade 삭제
      deleteCashFlowsByAccount: (accountId) => {
        set((state) => {
          state.cashFlows = state.cashFlows.filter(f => f.accountId !== accountId)
        })
        dbDeleteByAccount(accountId).catch(err => console.warn('[DB] deleteCashFlowsByAccount failed:', err))
      },

      // 메모리만 초기화 (로그아웃/사용자 전환 시 사용)
      clearCashFlows: () => {
        set((state) => { state.cashFlows = [] })
      },

      // 메모리 + IndexedDB 모두 삭제 (설정 > 데이터 초기화 전용)
      deleteAllCashFlows: () => {
        const userId = useAuthStore.getState().currentUser?.id
        set((state) => { state.cashFlows = [] })
        if (userId) {
          dbDeleteByUser(userId).catch(err => console.warn('[DB] deleteAllCashFlows failed:', err))
        }
      },

      // category 필드 없는 기존 레코드에 기본 카테고리 마이그레이션
      migrateCashFlowCategories: () => {
        const ids = []
        set((state) => {
          state.cashFlows.forEach(f => {
            if (!f.category) {
              f.category = f.type === 'withdrawal' ? 'investment_out' : 'investment_in'
              ids.push({ id: f.id, category: f.category })
            }
          })
        })
        ids.forEach(({ id, category }) =>
          dbUpdate(id, { category }).catch(err => console.warn('[DB] migrateCashFlowCategories failed:', err))
        )
      },

      // 앱 시작 시 IndexedDB에서 사용자별 로드
      loadFromDB: async (userId) => {
        if (!userId) return
        try {
          const dbFlows = await getCashFlowsByUser(userId)
          set((state) => { state.cashFlows = dbFlows })
          get().migrateCashFlowCategories()
        } catch (err) {
          console.warn('[DB] cashFlow loadFromDB failed, using localStorage:', err)
        }
      },

      // ─── 셀렉터 ───

      // 계좌별 입출금 내역 (날짜 내림차순)
      getCashFlowsByAccount: (accountId) => {
        const flows = get().cashFlows
        const filtered = accountId === 'all'
          ? flows
          : flows.filter(f => f.accountId === accountId)
        return [...filtered].sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date)
          return b.createdAt.localeCompare(a.createdAt)
        })
      },

      // 계좌별 총 입금액
      // capitalOnly=true 시 isCapital 카테고리(투자금 입금)만 합산
      getTotalDeposit: (accountId, capitalOnly = false) => {
        const allCategories = Object.values(CASH_FLOW_CATEGORIES)
        const flows = get().cashFlows.filter(f => {
          if (f.type !== 'deposit' || f.isAuto) return false
          if (accountId !== 'all' && f.accountId !== accountId) return false
          if (capitalOnly) {
            const cat = allCategories.find(c => c.code === f.category)
            return cat ? cat.isCapital : true // 카테고리 없는 레거시는 자본으로 처리
          }
          return true
        })
        return flows.reduce((sum, f) => sum + (f.amount || 0), 0)
      },

      // 계좌별 총 출금액
      // capitalOnly=true 시 isCapital 카테고리(투자금 출금)만 합산
      getTotalWithdrawal: (accountId, capitalOnly = false) => {
        const allCategories = Object.values(CASH_FLOW_CATEGORIES)
        const flows = get().cashFlows.filter(f => {
          if (f.type !== 'withdrawal' || f.isAuto) return false
          if (accountId !== 'all' && f.accountId !== accountId) return false
          if (capitalOnly) {
            const cat = allCategories.find(c => c.code === f.category)
            return cat ? cat.isCapital : true
          }
          return true
        })
        return flows.reduce((sum, f) => sum + (f.amount || 0), 0)
      },

      // 순투자원금 = isCapital 입금 합계 − isCapital 출금 합계
      // 수익률 계산 분모로 사용
      getNetCapital: (accountId) => {
        const totalIn  = get().getTotalDeposit(accountId, true)
        const totalOut = get().getTotalWithdrawal(accountId, true)
        return totalIn - totalOut
      },

      // 투자 가능 금액 = 잔고누계 마지막 값
      // 매수/매도 거래(자동 포함)를 모두 반영한 실제 잔고
      getAvailableCash: (accountId) => {
        const running = get().getRunningBalance(accountId)
        return running.length > 0 ? running[running.length - 1].balance : 0
      },

      // 잔고 누계 배열 (날짜 오름차순, 수동 입출금만)
      // [{date, type, amount, balance, ...}]
      getRunningBalance: (accountId) => {
        const flows = get().cashFlows
          .filter(f =>
            (accountId === 'all' || f.accountId === accountId)
          )
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date)
            return a.createdAt.localeCompare(b.createdAt)
          })

        let balance = 0
        return flows.map(f => {
          balance += f.type === 'deposit' ? f.amount : -f.amount
          return { ...f, balance }
        })
      },
    })),
    {
      name: 'cashflow-storage',
      version: 3,
      migrate: () => ({ cashFlows: [] }),
      // IndexedDB가 정식 저장소이므로 localStorage에는 아무것도 저장하지 않음
      partialize: () => ({}),
    }
  )
)
