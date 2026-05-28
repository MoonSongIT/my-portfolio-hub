// 인증 상태 관리 — 로컬 auth 유지 + Supabase 계정 통합
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/authService'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── 기존 로컬 auth (변경 없음) ──
      currentUser: null,  // { id, name, email }
      isLoggedIn: false,
      users: [],          // [{ id, name, email, password }]

      // ── Supabase 계정 (신규) ──
      isSupabaseUser: false,
      supabaseSession: null,
      isAdmin: false,         // persist 하지 않음 — 로그인마다 서버에서 재검증

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

      // 이메일 + 비밀번호로 로그인 (로컬 전용)
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

      logout: async () => {
        if (get().isSupabaseUser) {
          await authService.signOut()
        }
        set({ currentUser: null, isLoggedIn: false, isSupabaseUser: false, supabaseSession: null, isAdmin: false })
      },

      setIsAdmin: (v) => set({ isAdmin: v }),

      // ── Supabase 세션 동기화 ──
      setSupabaseSession: (session) => {
        if (session) {
          set({
            isSupabaseUser: true,
            supabaseSession: session,
            isLoggedIn: true,
            currentUser: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email,
            },
          })
        } else {
          set({ isSupabaseUser: false, supabaseSession: null })
        }
      },
    }),
    {
      name: 'auth-storage',
      version: 3,
      migrate: (persisted) => ({
        currentUser: persisted?.currentUser || null,
        isLoggedIn: persisted?.isLoggedIn || false,
        users: persisted?.users || [],
        isSupabaseUser: false,
        supabaseSession: null,
      }),
    }
  )
)
