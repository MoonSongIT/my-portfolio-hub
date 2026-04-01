import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWatchlistStore = create(
  persist((set) => ({
    watchlist: [],

    addToWatchlist: (ticker, name) => set((state) => ({
      watchlist: [
        ...state.watchlist,
        { ticker, name, addedAt: new Date().toISOString() }
      ].filter((item, index, self) =>
        index === self.findIndex((t) => t.ticker === item.ticker)
      ),
    })),

    removeFromWatchlist: (ticker) => set((state) => ({
      watchlist: state.watchlist.filter(item => item.ticker !== ticker)
    })),

    isInWatchlist: (ticker) => (state) =>
      state.watchlist.some(item => item.ticker === ticker),
  })),
  { name: 'watchlist-storage' }
)
