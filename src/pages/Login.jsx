import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { useJournalStore } from '../store/journalStore'
import { useCashFlowStore } from '../store/cashFlowStore'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BarChart2, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login, register } = useAuthStore()
  const { loadUserAccounts } = usePortfolioStore()
  const { loadUserWatchlist } = useWatchlistStore()
  const { loadFromDB: loadJournal, clearEntries } = useJournalStore()
  const { loadFromDB: loadCashFlows, clearCashFlows } = useCashFlowStore()
  const { loadFromDB: loadDailyPnl, clearAll: clearDailyPnl } = useDailyPnlStore()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const clearError = () => setError('')

  const afterLogin = () => {
    const userId = useAuthStore.getState().currentUser.id
    // 이전 사용자 데이터 초기화 후 현재 사용자 데이터 로드
    clearEntries()
    clearCashFlows()
    clearDailyPnl()
    loadUserAccounts(userId)
    loadUserWatchlist(userId)
    loadJournal(userId)
    loadCashFlows(userId)
    loadDailyPnl(userId)
    navigate('/')
  }

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
    afterLogin()
  }

  const handleRegister = () => {
    if (!name.trim()) { setError('이름을 입력하세요'); return }
    if (!email.trim()) { setError('이메일을 입력하세요'); return }
    if (!password) { setError('비밀번호를 입력하세요'); return }
    if (password.length < 4) { setError('비밀번호는 4자 이상이어야 합니다'); return }

    setLoading(true)
    const result = register(name.trim(), email.trim(), password)
    setLoading(false)

    if (!result.ok) { setError(result.error); return }

    // 가입 후 자동 로그인
    login(email.trim(), password)
    afterLogin()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      mode === 'login' ? handleLogin() : handleRegister()
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
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
            <CardTitle className="text-lg text-center">
              {mode === 'login' ? '로그인' : '회원가입'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            {/* 이름 (회원가입 모드) */}
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">이름</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError() }}
                  onKeyDown={handleKeyDown}
                  placeholder="홍길동"
                  className="mt-1"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError() }}
                onKeyDown={handleKeyDown}
                placeholder="user@example.com"
                className="mt-1"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="pr-10"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              className="w-full"
            >
              {loading
                ? (mode === 'login' ? '로그인 중...' : '가입 중...')
                : (mode === 'login' ? '로그인' : '회원가입')
              }
            </Button>

            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
