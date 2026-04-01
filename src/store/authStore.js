import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sampleUsers } from '../data/sampleUsers'

export const useAuthStore = create(
  persist(
    (set) => ({
      currentUser: null,  // { id, name, email }
      isLoggedIn: false,

      // 이메일 + 비밀번호로 로그인 (MVP: 샘플 데이터 대조)
      login: (email, password) => {
        const user = sampleUsers.find(
          (u) => u.email === email && u.password === password
        )
        if (!user) return false
        set({
          currentUser: { id: user.id, name: user.name, email: user.email },
          isLoggedIn: true,
        })
        return true
      },

      // 샘플 계정(홍길동)으로 자동 로그인
      loginAsDemo: () => {
        const user = sampleUsers[0]
        set({
          currentUser: { id: user.id, name: user.name, email: user.email },
          isLoggedIn: true,
        })
      },

      logout: () => set({ currentUser: null, isLoggedIn: false }),
    }),
    { name: 'auth-storage' }
  )
)
