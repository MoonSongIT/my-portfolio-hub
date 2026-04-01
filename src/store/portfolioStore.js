import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sampleAccounts } from '../data/samplePortfolio'
import { calculateTotalValue } from '../utils/calculator'

export const usePortfolioStore = create(
  persist(
    immer((set, get) => ({
      accounts: [],
      selectedAccountId: 'all',
      exchangeRate: 1350,
      lastUpdated: null,

      // ─── 계좌 관련 ───

      loadUserAccounts: (userId) => set((state) => {
        state.accounts = sampleAccounts
          .filter(acc => acc.userId === userId)
          .map(acc => ({ ...acc, holdings: [...acc.holdings] }))
        state.selectedAccountId = 'all'
      }),

      selectAccount: (accountId) => set((state) => {
        state.selectedAccountId = accountId
      }),

      clearAccounts: () => set((state) => {
        state.accounts = []
        state.selectedAccountId = 'all'
      }),

      // ─── 종목 관련 ───

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

      // 전체 종목 가격 일괄 업데이트
      updateAllPrices: (priceMap) => set((state) => {
        state.accounts.forEach(acc => {
          acc.holdings.forEach(h => {
            if (priceMap[h.ticker] !== undefined) {
              h.currentPrice = priceMap[h.ticker]
            }
          })
        })
        state.lastUpdated = new Date().toISOString()
      }),

      updateExchangeRate: (rate) => set((state) => {
        state.exchangeRate = rate
      }),

      updateCash: (accountId, krw, usd) => set((state) => {
        const acc = state.accounts.find(a => a.id === accountId)
        if (!acc) return
        if (krw !== undefined) acc.cashKRW = krw
        if (usd !== undefined) acc.cashUSD = usd
      }),

      // ─── 파생 데이터 getter ───

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

      getTotalValue: () => {
        const { getSelectedHoldings, getSelectedCash, exchangeRate } = get()
        const holdings = getSelectedHoldings()
        const { krw, usd } = getSelectedCash()
        return calculateTotalValue(holdings, krw, usd, exchangeRate)
      },
    })),
    {
      name: 'portfolio-storage',
      version: 4,
      migrate: () => ({
        accounts: [],
        selectedAccountId: 'all',
        exchangeRate: 1350,
        lastUpdated: null,
      }),
    }
  )
)
