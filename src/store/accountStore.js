import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { deleteCashFlowsByAccount as dbDeleteByAccount } from '../utils/db'
import { useCashFlowStore } from './cashFlowStore'

// 계좌 유형 정의
export const ACCOUNT_TYPES = [
  { code: 'GENERAL', name: '일반(위탁)', description: '일반 주식 매매 계좌' },
  { code: 'IRP', name: 'IRP', description: '개인형 퇴직연금' },
  { code: 'ISA', name: 'ISA', description: '개인종합자산관리' },
  { code: 'PENSION', name: '연금저축', description: '연금저축펀드/ETF' },
  { code: 'ETC', name: '기타', description: '기타 계좌' },
]

export const useAccountStore = create(
  persist(
    immer((set, get) => ({
      accounts: [],

      // ─── 액션 ───

      addAccount: (account) => set((state) => {
        if (state.accounts.find(a => a.id === account.id)) return
        state.accounts.push({
          id: account.id || crypto.randomUUID(),
          name: account.name,
          broker: account.broker || '',
          type: account.type || 'GENERAL',
          currency: account.currency || 'KRW',
          initialBalance: account.initialBalance ?? 0,
          memo: account.memo || '',
          createdAt: new Date().toISOString(),
        })
      }),

      updateAccount: (id, updates) => set((state) => {
        const account = state.accounts.find(a => a.id === id)
        if (account) Object.assign(account, updates)
      }),

      deleteAccount: (id) => {
        set((state) => {
          state.accounts = state.accounts.filter(a => a.id !== id)
        })
        // 연결된 입출금 내역 cascade 삭제 (cashFlowStore + IndexedDB)
        useCashFlowStore.getState().deleteCashFlowsByAccount(id)
        dbDeleteByAccount(id).catch(err => console.warn('[DB] cascade deleteCashFlows failed:', err))
      },

      clearAccounts: () => set((state) => {
        state.accounts = []
      }),

      // ─── 셀렉터 ───

      getAccountById: (id) => {
        return get().accounts.find(a => a.id === id) || null
      },

      getAccountLabel: (id) => {
        const account = get().accounts.find(a => a.id === id)
        if (!account) return '알 수 없는 계좌'
        const typeName = ACCOUNT_TYPES.find(t => t.code === account.type)?.name || account.type
        return `${account.name} (${typeName})`
      },
    })),
    {
      name: 'account-storage',
      version: 2,
      migrate: (persisted, version) => {
        if (version === 1) {
          // v1 → v2: initialBalance 필드 추가
          const accounts = persisted?.accounts || []
          return {
            accounts: accounts.map(a => ({
              ...a,
              initialBalance: a.initialBalance ?? 0,
            })),
          }
        }
        return { accounts: [] }
      },
    }
  )
)
