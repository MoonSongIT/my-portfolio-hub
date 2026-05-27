// 서버 계정 로그인/가입 모달
import { useState } from 'react'
import { authService } from '@/services/authService'

export function SupabaseLoginModal({ onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        await authService.signInWithEmail(email, password)
      } else {
        await authService.signUpWithEmail(email, password)
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4">
          {mode === 'login' ? '서버 계정 로그인' : '서버 계정 만들기'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>
        <button
          onClick={() => authService.signInWithGoogle()}
          className="mt-3 w-full border rounded-lg py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
        >
          Google로 계속하기
        </button>
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-4 text-sm text-blue-600 hover:underline w-full text-center"
        >
          {mode === 'login' ? '계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
        </button>
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
