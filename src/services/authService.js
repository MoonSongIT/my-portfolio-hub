// Supabase Auth 래퍼 서비스 (로그인/가입/로그아웃/세션)
import { supabase } from '@/lib/supabaseClient'

export const authService = {
  async signUpWithEmail(email, password) {
    if (!supabase) throw new Error('Supabase 미설정')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  },

  async signInWithEmail(email, password) {
    if (!supabase) throw new Error('Supabase 미설정')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signInWithGoogle() {
    if (!supabase) throw new Error('Supabase 미설정')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) throw error
  },

  async signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  onAuthStateChange(callback) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
    return supabase.auth.onAuthStateChange(callback)
  },
}
