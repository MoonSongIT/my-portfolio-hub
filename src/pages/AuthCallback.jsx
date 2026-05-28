// OAuth 소셜 로그인 콜백 처리 — PKCE 코드 교환 후 설정 페이지로 이동
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/store/authStore'
import { checkIsAdmin } from '@/utils/stockMasterServerApi'
import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) {
      navigate('/settings', { replace: true })
      return
    }

    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      // code 없음 — 이미 처리됐거나 잘못된 접근
      navigate('/settings', { replace: true })
      return
    }

    supabase.auth.exchangeCodeForSession(code)
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('[AuthCallback] 코드 교환 실패:', error.message)
        } else if (session) {
          useAuthStore.getState().setSupabaseSession(session)
          checkIsAdmin().then(isAdmin => {
            useAuthStore.getState().setIsAdmin(isAdmin)
          })
        }
        navigate('/settings', { replace: true })
      })
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-3 text-sm text-gray-500">로그인 처리 중...</p>
      </div>
    </div>
  )
}
