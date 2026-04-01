import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sampleWatchlistByUser } from '../data/sampleWatchlist'

export const useWatchlistStore = create(
  persist((set) => ({
    // 현재 사용자의 관심종목 목록
    watchlist: [],

    // 사용자별 관심종목 로드 (로그인 시 호출)
    loadUserWatchlist: (userId) => set({
      watchlist: sampleWatchlistByUser[userId]
        ? [...sampleWatchlistByUser[userId]]
        : [],
    }),

    // 관심종목 추가 (중복 방지)
    addToWatchlist: (item) => set((state) => ({
      watchlist: [...state.watchlist, { ...item, addedAt: new Date().toISOString() }]
        .filter((v, i, a) => a.findIndex(t => t.ticker === v.ticker) === i),
    })),

    // 관심종목 삭제
    removeFromWatchlist: (ticker) => set((state) => ({
      watchlist: state.watchlist.filter(item => item.ticker !== ticker),
    })),

    // 초기화 (로그아웃 시 호출)
    clearWatchlist: () => set({ watchlist: [] }),
  }),
  {
    name: 'watchlist-storage',
    version: 3,
    migrate: () => ({ watchlist: [] }),
  })
)
