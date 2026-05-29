import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist((set) => ({
    theme: 'light',
    language: 'ko',
    currency: 'KRW',
    benchmarkIndex: 'KOSPI', // 'KOSPI' | 'SP500'
    lastCleanupDate: null,   // 마지막 DB 자동 정리 날짜 (ISO string)
    watchlistDefaults: {
      targetPct: 20,        // 목표가 기본 % (매입가 대비 +20%)
      stopLossPct: 10,      // 손절가 기본 % (매입가 대비 -10%)
      trailingDropPct: 10,  // 고점 낙폭 모니터링 기본 %
    },
    annualTargetReturn: 10, // 연간 목표 수익률 (%)
    calendarNotification: {
      enabled: false,
      timing: 'on_day',        // 'on_day' | 'day_before' | 'week_before'
      impactFilter: 'all',     // 'all' | 'high' | 'medium' | 'low'
    },

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
    setLanguage: (language) => set({ language }),
    setCurrency: (currency) => set({ currency }),
    setBenchmark: (benchmarkIndex) => set({ benchmarkIndex }),
    setLastCleanupDate: (date) => set({ lastCleanupDate: date }),
    setWatchlistDefaults: (defaults) => set((state) => ({
      watchlistDefaults: { ...state.watchlistDefaults, ...defaults },
    })),
    setAnnualTargetReturn: (value) => set({ annualTargetReturn: value }),
    setCalendarNotification: (patch) => set((state) => ({
      calendarNotification: { ...state.calendarNotification, ...patch },
    })),

    // 동기화 활성화 / 비활성화
    syncEnabled: false,
    enableSync: () => set({ syncEnabled: true }),
    disableSync: () => set({ syncEnabled: false }),
  }),
  { name: 'settings-storage' })
)
