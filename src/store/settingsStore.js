import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettingsStore = create(
  persist((set) => ({
    theme: 'light',
    language: 'ko',
    currency: 'KRW',
    marketStart: '09:00',
    marketEnd: '15:30',

    setTheme: (theme) => set({ theme }),

    setLanguage: (language) => set({ language }),

    setCurrency: (currency) => set({ currency }),

    setMarketHours: (start, end) => set({
      marketStart: start,
      marketEnd: end,
    }),
  })),
  { name: 'settings-storage' }
)
