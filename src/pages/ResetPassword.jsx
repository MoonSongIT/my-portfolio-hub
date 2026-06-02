// 비밀번호 재설정 페이지 — Supabase recovery 링크 처리
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  // URL 해시에서 에러 파라미터 확인 (만료·거부 토큰 처리)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const code = params.get('error_code') || params.get('error')
      if (code === 'otp_expired') {
        setError('재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해 주세요.')
      } else {
        setError('유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해 주세요.')
      }
      setStatus('link_error')
      return
    }

    // Supabase가 URL 해시의 recovery 토큰을 세션으로 교환할 때까지 대기
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    setStatus('loading')
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setStatus('error')
    } else {
      setStatus('done')
    }
  }

  if (status === 'link_error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-sm w-full shadow text-center space-y-4">
          <p className="text-2xl">⚠️</p>
          <p className="text-gray-700 dark:text-gray-200 font-medium">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700"
          >
            비밀번호 찾기 다시 하기
          </button>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-sm w-full shadow text-center space-y-4">
          <p className="text-green-600 font-semibold text-lg">✅ 비밀번호가 변경되었습니다.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700"
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-sm w-full shadow space-y-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">새 비밀번호 설정</h1>

        {!ready && (
          <p className="text-sm text-gray-500 dark:text-gray-400">토큰 확인 중...</p>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'loading' ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
