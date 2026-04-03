import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sampleWatchlistByUser } from '../data/sampleWatchlist'

export const useWatchlistStore = create(
  persist((set, get) => ({
    // 현재 사용자의 관심종목 목록
    watchlist: [],

    // 가격 알림 목록 [{ id, ticker, name, condition: 'above'|'below', targetPrice }]
    alerts: [],

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

    // 관심종목 삭제 (연결 알림도 함께 삭제)
    removeFromWatchlist: (ticker) => set((state) => ({
      watchlist: state.watchlist.filter(item => item.ticker !== ticker),
      alerts: state.alerts.filter(a => a.ticker !== ticker),
    })),

    // 초기화 (로그아웃 시 호출)
    clearWatchlist: () => set({ watchlist: [], alerts: [] }),

    // ─── 알림 CRUD ───

    addAlert: (alert) => set((state) => ({
      alerts: [
        ...state.alerts,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          triggered: false,
          ...alert,
        },
      ],
    })),

    removeAlert: (alertId) => set((state) => ({
      alerts: state.alerts.filter(a => a.id !== alertId),
    })),

    // 현재 가격과 알림 조건 체크 → 조건 충족 알림 배열 반환
    checkAlerts: (priceMap) => {
      const { alerts } = get()
      const triggered = []

      alerts.forEach(alert => {
        const price = priceMap[alert.ticker]?.currentPrice
        if (price == null) return

        const hit =
          (alert.condition === 'above' && price >= alert.targetPrice) ||
          (alert.condition === 'below' && price <= alert.targetPrice)

        if (hit) triggered.push({ ...alert, currentPrice: price })
      })

      return triggered
    },
  }),
  {
    name: 'watchlist-storage',
    version: 4,
    migrate: (persisted) => ({
      watchlist: persisted?.watchlist || [],
      alerts: persisted?.alerts || [],
    }),
  })
)
