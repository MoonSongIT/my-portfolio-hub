// 관심종목·알림·그룹·알림이력 상태를 관리하는 Zustand 스토어
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sampleWatchlistByUser } from '../data/sampleWatchlist'
import { getByTicker } from '../utils/stockMasterDb'

export const useWatchlistStore = create(
  persist((set, get) => ({
    // 관심종목 목록
    watchlist: [],

    // 가격 알림 목록
    alerts: [],

    // 태그/그룹 목록 [{ id, name, color, createdAt }]
    groups: [],

    // 알림 발동 이력 (최대 100건)
    alertHistory: [],

    // 현재 로드된 사용자 ID
    watchlistUserId: null,

    // 사용자별 관심종목 로드 (로그인 시 호출)
    loadUserWatchlist: (userId) => {
      const { watchlistUserId, watchlist } = get()
      if (watchlistUserId === userId && watchlist.length > 0) return
      set({
        watchlistUserId: userId,
        watchlist: sampleWatchlistByUser[userId]
          ? [...sampleWatchlistByUser[userId]]
          : [],
        alerts: [],
      })
    },

    // 관심종목 추가 (중복 방지, priceAtAdded 스냅샷 포함)
    addToWatchlist: (item) => set((state) => ({
      watchlist: [...state.watchlist, {
        ...item,
        addedAt: new Date().toISOString(),
        priceAtAdded: item.currentPrice ?? null,
        groupIds: item.groupIds ?? [],
        targetPrice: item.targetPrice ?? null,
        stopLoss: item.stopLoss ?? null,
        entryPrice: item.entryPrice ?? null,
      }].filter((v, i, a) => a.findIndex(t => t.ticker === v.ticker) === i),
    })),

    /**
     * 마스터 DB 검증 후 관심종목 추가
     * @returns {{ added: boolean, warn: boolean, message?: string }}
     */
    addToWatchlistValidated: async (item) => {
      // 마스터 DB에서 티커 존재 확인 (IDB 미준비 시 warn 없이 추가)
      let warn = false
      try {
        const found = await getByTicker(item.ticker)
        if (!found) warn = true
      } catch { /* IDB 미준비 — 검증 스킵 */ }

      const { watchlist } = useWatchlistStore.getState()
      const alreadyExists = watchlist.some(w => w.ticker === item.ticker)
      if (alreadyExists) {
        return { added: false, warn: false, message: '이미 관심종목에 추가된 종목입니다.' }
      }

      useWatchlistStore.getState().addToWatchlist(item)

      if (warn) {
        return {
          added: true,
          warn: true,
          message: '마스터 DB에 없는 종목입니다. 설정 페이지에서 종목 DB를 업데이트하면 더 정확한 정보를 제공합니다.',
        }
      }
      return { added: true, warn: false }
    },

    // 관심종목 삭제 (연결 알림도 함께 삭제)
    removeFromWatchlist: (ticker) => set((state) => ({
      watchlist: state.watchlist.filter(item => item.ticker !== ticker),
      alerts: state.alerts.filter(a => a.ticker !== ticker),
    })),

    // 초기화 (로그아웃 시 호출)
    clearWatchlist: () => set({ watchlist: [], alerts: [] }),

    // 관심종목 메모 업데이트
    updateWatchlistMemo: (ticker, memo) => set((state) => ({
      watchlist: state.watchlist.map(item =>
        item.ticker === ticker ? { ...item, memo } : item
      ),
    })),

    // 관심종목 태그 업데이트
    updateWatchlistGroups: (ticker, groupIds) => set((state) => ({
      watchlist: state.watchlist.map(item =>
        item.ticker === ticker ? { ...item, groupIds } : item
      ),
    })),

    // 목표가·손절가·매입가 업데이트 (알림과 독립)
    updateWatchlistTargets: (ticker, { targetPrice, stopLoss, entryPrice }) => set((state) => ({
      watchlist: state.watchlist.map(item =>
        item.ticker === ticker
          ? { ...item, targetPrice, stopLoss, entryPrice }
          : item
      ),
    })),

    // DnD 재정렬
    reorderWatchlist: (newOrder) => set({ watchlist: newOrder }),

    // ─── 태그(그룹) CRUD ───

    addGroup: (name, color) => set((state) => {
      if (state.groups.length >= 10) return state
      return {
        groups: [...state.groups, {
          id: crypto.randomUUID(),
          name,
          color,
          createdAt: new Date().toISOString(),
        }],
      }
    }),

    renameGroup: (id, name) => set((state) => ({
      groups: state.groups.map(g => g.id === id ? { ...g, name } : g),
    })),

    removeGroup: (id) => set((state) => ({
      groups: state.groups.filter(g => g.id !== id),
      watchlist: state.watchlist.map(item => ({
        ...item,
        groupIds: (item.groupIds ?? []).filter(gid => gid !== id),
      })),
    })),

    // ─── 알림 CRUD ───

    addAlert: (alert) => set((state) => ({
      alerts: [
        ...state.alerts,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          triggered: false,
          paused: false,
          ...alert,
        },
      ],
    })),

    removeAlert: (alertId) => set((state) => ({
      alerts: state.alerts.filter(a => a.id !== alertId),
    })),

    toggleAlertPaused: (alertId) => set((state) => ({
      alerts: state.alerts.map(a =>
        a.id === alertId ? { ...a, paused: !a.paused } : a
      ),
    })),

    // 현재 가격과 알림 조건 체크 → 조건 충족 알림 배열 반환 (paused 건너뜀)
    checkAlerts: (priceMap) => {
      const { alerts } = get()
      const triggered = []

      alerts.forEach(alert => {
        if (alert.paused) return
        const price = priceMap[alert.ticker]?.currentPrice
        if (price == null) return

        const hit =
          (alert.condition === 'above' && price >= alert.targetPrice) ||
          (alert.condition === 'below' && price <= alert.targetPrice)

        if (hit) triggered.push({ ...alert, currentPrice: price })
      })

      return triggered
    },

    // ─── 알림 이력 ───

    addAlertHistory: (entry) => set((state) => {
      const next = [
        { id: crypto.randomUUID(), firedAt: new Date().toISOString(), read: false, ...entry },
        ...state.alertHistory,
      ]
      return { alertHistory: next.slice(0, 100) }
    }),

    markAlertHistoryRead: (id) => set((state) => ({
      alertHistory: state.alertHistory.map(h => h.id === id ? { ...h, read: true } : h),
    })),

    markAllAlertHistoryRead: () => set((state) => ({
      alertHistory: state.alertHistory.map(h => ({ ...h, read: true })),
    })),

    clearAlertHistory: () => set({ alertHistory: [] }),
  }),
  {
    name: 'watchlist-storage',
    version: 6,
    migrate: (persisted) => ({
      watchlist: (persisted?.watchlist ?? []).map(item => ({
        priceAtAdded: null,
        groupIds: [],
        targetPrice: null,
        stopLoss: null,
        entryPrice: null,
        ...item,
      })),
      alerts: (persisted?.alerts ?? []).map(a => ({
        paused: false,
        ...a,
      })),
      groups: persisted?.groups ?? [],
      alertHistory: persisted?.alertHistory ?? [],
      watchlistUserId: persisted?.watchlistUserId ?? null,
    }),
  })
)
