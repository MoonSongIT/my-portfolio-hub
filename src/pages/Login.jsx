import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BarChart2 } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login, loginAsDemo } = useAuthStore()
  const { loadUserAccounts } = usePortfolioStore()
  const { loadUserWatchlist } = useWatchlistStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    if (!email.trim()) { setError('이메일을 입력하세요'); return }
    if (!password) { setError('비밀번호를 입력하세요'); return }

    setLoading(true)
    const success = login(email.trim(), password)
    setLoading(false)

    if (!success) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다')
      return
    }

    // 로그인 성공 → 사용자 데이터 로드
    const userId = useAuthStore.getState().currentUser.id
    loadUserAccounts(userId)
    loadUserWatchlist(userId)
    navigate('/')
  }

  const handleDemo = () => {
    loginAsDemo()
    const userId = useAuthStore.getState().currentUser.id
    loadUserAccounts(userId)
    loadUserWatchlist(userId)
    navigate('/')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-3">
            <BarChart2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Portfolio Hub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">자산을 스마트하게 관리하세요</p>
        </div>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-center">로그인</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="hong@example.com"
                className="mt-1"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                className="mt-1"
                autoComplete="current-password"
              />
            </div>

            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full"
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-900 px-2 text-gray-400">또는</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDemo}
              className="w-full text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
            >
              샘플 계정으로 시작 (홍길동)
            </Button>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              테스트 계정: hong@example.com / demo1234
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
