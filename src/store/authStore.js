// Supabase UUID 단일 체계 인증 스토어 — 로컬 user-XXXX 시스템 제거
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/authService'
import { supabase } from '@/lib/supabaseClient'

// 로그인/세션 복원 시 profiles 행 자동 생성 (없으면 insert, 있으면 무시)
async function ensureProfile(user) {
  if (!supabase || !user?.id) return
  await supabase.from('profiles').upsert(
    { id: user.id, email: user.email, display_name: user.user_metadata?.full_name || user.email },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}

export const useAuthStore = create(
  persist(
    (set) => ({
      // 현재 로그인 사용자 (Supabase UUID 기반)
      currentUser: null,  // { id (UUID), email, name }
      isLoggedIn: false,
      supabaseSession: null,
      isSupabaseUser: false,  // 하위 호환성 유지
      isAdmin: false,

      // ── Supabase 가입 ──
      signUp: async (email, password, name) => {
        const data = await authService.signUpWithEmail(email, password)
        const session = data?.session
        if (session) {
          await ensureProfile(session.user)
          set({
            currentUser: {
              id: session.user.id,
              email: session.user.email,
              name: name || session.user.email,
            },
            supabaseSession: session,
            isLoggedIn: true,
            isSupabaseUser: true,
          })
        }
        return { ok: true, session }
      },

      // ── Supabase 로그인 ──
      signIn: async (email, password) => {
        const data = await authService.signInWithEmail(email, password)
        const session = data?.session
        if (!session) return { ok: false, error: '로그인에 실패했습니다' }
        await ensureProfile(session.user)
        set({
          currentUser: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email,
          },
          supabaseSession: session,
          isLoggedIn: true,
          isSupabaseUser: true,
        })
        return { ok: true, session }
      },

      // ── 로그아웃 ──
      signOut: async () => {
        await authService.signOut()
        set({
          currentUser: null,
          isLoggedIn: false,
          supabaseSession: null,
          isSupabaseUser: false,
          isAdmin: false,
        })
      },

      // ── 세션 복원 (앱 시작 시) ──
      restoreSession: async () => {
        const session = await authService.getSession()
        if (session?.user) {
          await ensureProfile(session.user)
          set({
            currentUser: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email,
            },
            supabaseSession: session,
            isLoggedIn: true,
            isSupabaseUser: true,
          })
          return true
        }
        set({ currentUser: null, isLoggedIn: false, supabaseSession: null, isSupabaseUser: false })
        return false
      },

      // ── 하위 호환성 — App.jsx onAuthStateChange 콜백에서 사용 ──
      setSupabaseSession: (session) => {
        if (session?.user) {
          // Supabase 권고: onAuthStateChange 콜백 내부에서 DB 호출 시 세션 토큰이
          // 아직 부착되지 않아 401 발생 → 다음 틱으로 미뤄 토큰 부착 후 실행
          setTimeout(() => ensureProfile(session.user), 0)  // 비동기, 오류 무시
          set({
            currentUser: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email,
            },
            supabaseSession: session,
            isLoggedIn: true,
            isSupabaseUser: true,
          })
        } else {
          set({
            currentUser: null,
            isLoggedIn: false,
            supabaseSession: null,
            isSupabaseUser: false,
          })
        }
      },

      setIsAdmin: (v) => set({ isAdmin: v }),

      // ── 하위 호환성 — logout() 호출 잔존 코드 대응 ──
      logout: async () => {
        await authService.signOut()
        set({
          currentUser: null,
          isLoggedIn: false,
          supabaseSession: null,
          isSupabaseUser: false,
          isAdmin: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      version: 4,  // v3→v4: users[] 배열 제거, 로컬 user-XXXX 시스템 폐기
      migrate: () => ({
        currentUser: null,
        isLoggedIn: false,
        supabaseSession: null,
        isSupabaseUser: false,
        isAdmin: false,
      }),
    }
  )
)
