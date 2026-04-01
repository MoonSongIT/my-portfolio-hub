import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist((set) => ({
    theme: 'light',
    language: 'ko',
    currency: 'KRW',
    benchmarkIndex: 'KOSPI', // 'KOSPI' | 'SP500'

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
    setLanguage: (language) => set({ language }),
    setCurrency: (currency) => set({ currency }),
    setBenchmark: (benchmarkIndex) => set({ benchmarkIndex }),
  }),
  { name: 'settings-storage' })
)
