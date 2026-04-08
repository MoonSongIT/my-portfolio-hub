import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null,  // { id, name, email }
      isLoggedIn: false,
      users: [],          // [{ id, name, email, password }]

      // 회원가입
      register: (name, email, password) => {
        const { users } = get()
        if (users.some((u) => u.email === email)) return { ok: false, error: '이미 등록된 이메일입니다' }

        const newUser = {
          id: `user-${crypto.randomUUID().slice(0, 8)}`,
          name,
          email,
          password,
          createdAt: new Date().toISOString(),
        }
        set({ users: [...users, newUser] })
        return { ok: true, user: newUser }
      },

      // 이메일 + 비밀번호로 로그인
      login: (email, password) => {
        const { users } = get()
        const user = users.find(
          (u) => u.email === email && u.password === password
        )
        if (!user) return false
        set({
          currentUser: { id: user.id, name: user.name, email: user.email },
          isLoggedIn: true,
        })
        return true
      },

      logout: () => set({ currentUser: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
      version: 2,
      migrate: (persisted) => ({
        currentUser: persisted?.currentUser || null,
        isLoggedIn: persisted?.isLoggedIn || false,
        users: persisted?.users || [],
      }),
    }
  )
)
