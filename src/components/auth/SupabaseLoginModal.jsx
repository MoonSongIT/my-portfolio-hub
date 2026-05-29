// 서버 계정 로그인/가입 모달
import { useState } from 'react'
import { authService } from '@/services/authService'

export function SupabaseLoginModal({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forgotSent, setForgotSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        await authService.signInWithEmail(email, password)
        onClose()
      } else if (mode === 'signup') {
        await authService.signUpWithEmail(email, password)
        onClose()
      } else if (mode === 'forgot') {
        await authService.resetPasswordForEmail(email)
        setForgotSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const titles = { login: '서버 계정 로그인', signup: '서버 계정 만들기', forgot: '비밀번호 찾기' }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4">{titles[mode]}</h2>

        {/* 비밀번호 찾기 — 전송 완료 상태 */}
        {mode === 'forgot' && forgotSent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{email}</span>로 비밀번호 재설정 링크를 전송했습니다.
              Gmail을 확인해 주세요.
            </p>
            <button
              onClick={() => { setMode('login'); setForgotSent(false) }}
              className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700"
            >
              로그인으로 돌아가기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              required
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                required
              />
            )}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '가입하기' : '재설정 링크 전송'}
            </button>
          </form>
        )}

        {/* Google 로그인 — login/signup 모드에서만 */}
        {mode !== 'forgot' && (
          <button
            onClick={() => authService.signInWithGoogle()}
            className="mt-3 w-full border rounded-lg py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm dark:text-gray-300 dark:border-gray-600"
          >
            Google로 계속하기
          </button>
        )}

        {/* 모드 전환 링크 */}
        <div className="mt-4 flex flex-col items-center gap-1">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('forgot'); setError(null) }}
                className="text-sm text-gray-500 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null) }}
                className="text-sm text-blue-600 hover:underline"
              >
                계정이 없으신가요? 가입하기
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="text-sm text-blue-600 hover:underline"
            >
              이미 계정이 있으신가요? 로그인
            </button>
          )}
          {mode === 'forgot' && !forgotSent && (
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="text-sm text-blue-600 hover:underline"
            >
              로그인으로 돌아가기
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
