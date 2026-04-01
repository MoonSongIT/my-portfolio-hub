import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sampleAccounts, EXCHANGE_RATE } from '../data/samplePortfolio'
import { calculateTotalValue } from '../utils/calculator'

export const usePortfolioStore = create(
  persist(
    immer((set, get) => ({
      // 현재 로그인한 사용자의 계좌 목록
      accounts: [],
      // 선택된 계좌 ID ('all' = 전체 합산)
      selectedAccountId: 'all',

      // ─── 계좌 관련 ───

      // 사용자 계좌 로드 (로그인 시 호출)
      loadUserAccounts: (userId) => set((state) => {
        state.accounts = sampleAccounts
          .filter(acc => acc.userId === userId)
          .map(acc => ({ ...acc, holdings: [...acc.holdings] }))
        state.selectedAccountId = 'all'
      }),

      // 계좌 선택 ('all' | 계좌ID)
      selectAccount: (accountId) => set((state) => {
        state.selectedAccountId = accountId
      }),

      // 계좌 초기화 (로그아웃 시 호출)
      clearAccounts: () => set((state) => {
        state.accounts = []
        state.selectedAccountId = 'all'
      }),

      // ─── 종목 관련 (accountId 필수) ───

      addHolding: (accountId, stock) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (!acc) return
        const exists = acc.holdings.find(h => h.ticker === stock.ticker)
        if (!exists) acc.holdings.push(stock)
      }),

      updateHolding: (accountId, ticker, updates) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (!acc) return
        const holding = acc.holdings.find(h => h.ticker === ticker)
        if (holding) Object.assign(holding, updates)
      }),

      removeHolding: (accountId, ticker) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (acc) acc.holdings = acc.holdings.filter(h => h.ticker !== ticker)
      }),

      updatePrice: (accountId, ticker, price) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (!acc) return
        const holding = acc.holdings.find(h => h.ticker === ticker)
        if (holding) holding.currentPrice = price
      }),

      updateCash: (accountId, krw, usd) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (!acc) return
        if (krw !== undefined) acc.cashKRW = krw
        if (usd !== undefined) acc.cashUSD = usd
      }),

      // ─── 파생 데이터 getter ───

      // 선택 범위의 holdings (전체 or 개별 계좌)
      getSelectedHoldings: () => {
        const { accounts, selectedAccountId } = get()
        if (selectedAccountId === 'all') {
          return accounts.flatMap(acc =>
            acc.holdings.map(h => ({ ...h, accountId: acc.id, accountName: acc.accountName, accountType: acc.accountType }))
          )
        }
        const acc = accounts.find(a => a.id === selectedAccountId)
        return acc ? acc.holdings.map(h => ({ ...h, accountId: acc.id, accountName: acc.accountName, accountType: acc.accountType })) : []
      },

      // 선택 계좌의 현금 합산
      getSelectedCash: () => {
        const { accounts, selectedAccountId } = get()
        if (selectedAccountId === 'all') {
          return accounts.reduce(
            (sum, acc) => ({ krw: sum.krw + acc.cashKRW, usd: sum.usd + acc.cashUSD }),
            { krw: 0, usd: 0 }
          )
        }
        const acc = accounts.find(a => a.id === selectedAccountId)
        return acc ? { krw: acc.cashKRW, usd: acc.cashUSD } : { krw: 0, usd: 0 }
      },

      // 선택 범위의 총 평가액 (KRW)
      getTotalValue: () => {
        const { getSelectedHoldings, getSelectedCash } = get()
        const holdings = getSelectedHoldings()
        const { krw, usd } = getSelectedCash()
        return calculateTotalValue(holdings, krw, usd, EXCHANGE_RATE)
      },
    })),
    {
      name: 'portfolio-storage',
      version: 3,
      migrate: () => ({
        accounts: [],
        selectedAccountId: 'all',
      }),
    }
  )
)
