import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export const usePortfolioStore = create(
  persist(
    immer((set) => ({
      holdings: [],
      cash: 10000000,
      currency: 'KRW',

      // 액션 메서드
      addHolding: (stock) => set((state) => {
        state.holdings.push(stock)
      }),

      updatePrice: (ticker, price) => set((state) => {
        const holding = state.holdings.find(h => h.ticker === ticker)
        if (holding) {
          holding.current_price = price
        }
      }),

      removeHolding: (ticker) => set((state) => {
        state.holdings = state.holdings.filter(h => h.ticker !== ticker)
      }),

      updateCash: (amount) => set((state) => {
        state.cash = amount
      }),
    })),
    { name: 'portfolio-storage' }
  )
)
