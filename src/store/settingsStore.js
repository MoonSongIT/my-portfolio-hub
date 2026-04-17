import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist((set) => ({
    theme: 'light',
    language: 'ko',
    currency: 'KRW',
    benchmarkIndex: 'KOSPI', // 'KOSPI' | 'SP500'
    lastCleanupDate: null,   // 마지막 DB 자동 정리 날짜 (ISO string)

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
    setLanguage: (language) => set({ language }),
    setCurrency: (currency) => set({ currency }),
    setBenchmark: (benchmarkIndex) => set({ benchmarkIndex }),
    setLastCleanupDate: (date) => set({ lastCleanupDate: date }),
  }),
  { name: 'settings-storage' })
)
