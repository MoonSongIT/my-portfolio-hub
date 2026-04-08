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
} from '../utils/db'
import { useAuthStore } from './authStore'

// ─── 입출금 유형 상수 ───
export const CASH_FLOW_TYPES = {
  DEPOSIT:    { code: 'deposit',    label: '입금',   color: 'text-blue-600' },
  WITHDRAWAL: { code: 'withdrawal', label: '출금',   color: 'text-orange-500' },
}

export const useCashFlowStore = create(
  persist(
    immer((set, get) => ({
      cashFlows: [],

      // ─── 액션 ───

      // 수동 입출금 추가
      addCashFlow: (flow) => {
        const userId = useAuthStore.getState().currentUser?.id
        const newFlow = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          isAuto: false,
          memo: '',
          userId,
          ...flow,
        }
        set((state) => { state.cashFlows.push(newFlow) })
        dbAdd(newFlow).catch(err => console.warn('[DB] addCashFlow failed:', err))
        return newFlow.id
      },

      // 매매 연동 자동 입출금 추가 (journalStore에서 호출)
      addAutoFlow: (flow) => {
        const userId = useAuthStore.getState().currentUser?.id
        const newFlow = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          isAuto: true,
          memo: '',
          userId,
          ...flow,
        }
        set((state) => { state.cashFlows.push(newFlow) })
        dbAdd(newFlow).catch(err => console.warn('[DB] addAutoFlow failed:', err))
        return newFlow.id
      },

      updateCashFlow: (id, updates) => {
        set((state) => {
          const flow = state.cashFlows.find(f => f.id === id)
          if (flow) Object.assign(flow, updates)
        })
        dbUpdate(id, updates).catch(err => console.warn('[DB] updateCashFlow failed:', err))
      },

      // 수동 입출금 삭제 (자동 연동 항목은 journalStore에서 삭제)
      deleteCashFlow: (id) => {
        set((state) => {
          state.cashFlows = state.cashFlows.filter(f => f.id !== id)
        })
        dbDelete(id).catch(err => console.warn('[DB] deleteCashFlow failed:', err))
      },

      // 계좌 삭제 시 연결 입출금 내역 cascade 삭제
      deleteCashFlowsByAccount: (accountId) => {
        set((state) => {
          state.cashFlows = state.cashFlows.filter(f => f.accountId !== accountId)
        })
        dbDeleteByAccount(accountId).catch(err => console.warn('[DB] deleteCashFlowsByAccount failed:', err))
      },

      clearCashFlows: () => {
        const userId = useAuthStore.getState().currentUser?.id
        set((state) => { state.cashFlows = [] })
        if (userId) {
          dbDeleteByUser(userId).catch(err => console.warn('[DB] clearCashFlows failed:', err))
        }
      },

      // 앱 시작 시 IndexedDB에서 사용자별 로드
      loadFromDB: async (userId) => {
        if (!userId) return
        try {
          const dbFlows = await getCashFlowsByUser(userId)
          set((state) => { state.cashFlows = dbFlows })
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
      getTotalDeposit: (accountId) => {
        const flows = get().cashFlows.filter(f =>
          f.type === 'deposit' &&
          !f.isAuto &&
          (accountId === 'all' || f.accountId === accountId)
        )
        return flows.reduce((sum, f) => sum + (f.amount || 0), 0)
      },

      // 계좌별 총 출금액
      getTotalWithdrawal: (accountId) => {
        const flows = get().cashFlows.filter(f =>
          f.type === 'withdrawal' &&
          !f.isAuto &&
          (accountId === 'all' || f.accountId === accountId)
        )
        return flows.reduce((sum, f) => sum + (f.amount || 0), 0)
      },

      // 투자 가능 금액 계산
      // = 총 입금 - 총 출금 - 현재 보유 종목 매수 원가 합산
      // holdingsTotalCost: journalStore.computeHoldings(accountId) 결과의 totalCost 합산 (외부에서 전달)
      getAvailableCash: (accountId, holdingsTotalCost = 0) => {
        const totalDeposit    = get().getTotalDeposit(accountId)
        const totalWithdrawal = get().getTotalWithdrawal(accountId)
        return totalDeposit - totalWithdrawal - holdingsTotalCost
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
