import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'
import { syncService } from '../services/syncService'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { useJournalStore } from '../store/journalStore'
import { useCashFlowStore } from '../store/cashFlowStore'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { db } from '../utils/db'
import { DEMO_USER, seedDemoData } from '../utils/demoData'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BarChart2, Eye, EyeOff, Play } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuthStore()
  const { loadUserAccounts } = usePortfolioStore()
  const { loadUserWatchlist } = useWatchlistStore()
  const { loadFromDB: loadJournal, clearEntries } = useJournalStore()
  const { loadFromDB: loadCashFlows, clearCashFlows } = useCashFlowStore()
  const { loadFromDB: loadDailyPnl, clearAll: clearDailyPnl } = useDailyPnlStore()

  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  // 이미 로그인된 상태이고 로딩 중이 아니면 홈으로 리다이렉트
  if (isLoggedIn && !loading) return <Navigate to="/" replace />

  const clearError = () => setError('')

  const afterLogin = async () => {
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
    // 새 기기 감지 — IDB에 거래 내역이 없으면 서버에서 자동 다운로드
    const txCount = await db.transactions.count()
    if (txCount === 0) {
      syncService.downloadAndReload(userId).catch(err =>
        console.warn('[Sync] 로그인 후 자동 다운로드 실패:', err)
      )
    }
  }

  const handleLogin = async () => {
    if (!email.trim()) { setError('이메일을 입력하세요'); return }
    if (!password) { setError('비밀번호를 입력하세요'); return }

    setLoading(true)
    setError('')

    try {
      const result = await signIn(email.trim(), password)
      if (!result.ok) {
        setError(result.error || '이메일 또는 비밀번호가 올바르지 않습니다')
        setLoading(false)
        return
      }
      setLoading(false)
      afterLogin()
    } catch (err) {
      setError(err?.message || '로그인 중 오류가 발생했습니다')
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!name.trim()) { setError('이름을 입력하세요'); return }
    if (!email.trim()) { setError('이메일을 입력하세요'); return }
    if (!password) { setError('비밀번호를 입력하세요'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다'); return }

    setLoading(true)
    setError('')

    try {
      const result = await signUp(email.trim(), password, name.trim())
      setLoading(false)
      if (!result.ok) { setError('가입 중 오류가 발생했습니다'); return }
      // 이메일 인증이 필요한 경우 session이 null일 수 있음
      if (!result.session) {
        setError('가입 확인 이메일을 확인해 주세요')
        return
      }
      afterLogin()
    } catch (err) {
      setError(err?.message || '가입 중 오류가 발생했습니다')
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      mode === 'login' ? handleLogin() : handleRegister()
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    setError('')

    try {
      // Supabase 데모 계정 로그인
      const result = await signIn(DEMO_USER.email, DEMO_USER.password)
      if (!result.ok) {
        setError('데모 계정을 찾을 수 없습니다. 관리자에게 문의하세요.')
        setLoading(false)
        return
      }

      // 3. 기존 데이터 초기화 + 로드
      const userId = useAuthStore.getState().currentUser.id
      clearEntries()
      clearCashFlows()
      clearDailyPnl()
      loadUserAccounts(userId)
      loadUserWatchlist(userId)
      await loadJournal(userId)
      await loadCashFlows(userId)
      await loadDailyPnl(userId)

      // 4. 데모 데이터 시드 (최초 1회)
      await seedDemoData()

      // 5. 시드 후 데이터 리로드 (IndexedDB 반영)
      await loadJournal(userId)
      await loadCashFlows(userId)

      setLoading(false)
      navigate('/')
    } catch (err) {
      console.error('[Demo] 데모 로그인 실패:', err)
      setError('데모 데이터 생성 중 오류가 발생했습니다')
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (!email.trim()) { setError('이메일을 입력하세요'); return }
    setLoading(true)
    setError('')
    try {
      await authService.resetPasswordForEmail(email.trim())
      setForgotSent(true)
    } catch (err) {
      const msg = err?.message || ''
      if (msg.includes('rate') || msg.includes('limit')) {
        setError('잠시 후 다시 시도해 주세요. (1시간에 최대 3회 발송 가능)')
      } else if (msg.includes('redirect') || msg.includes('not allowed')) {
        setError('설정 오류: Supabase redirect URL을 확인해 주세요.')
      } else {
        setError(`메일 발송 실패: ${msg || '이메일 주소를 확인해 주세요.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setForgotSent(false)
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
              {mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '비밀번호 찾기'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            {/* 비밀번호 찾기 — 메일 발송 완료 */}
            {mode === 'forgot' && forgotSent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">{email}</span>으로<br />재설정 링크를 보냈습니다.<br />받은 편지함(스팸함)을 확인해 주세요.
                </p>
                <Button variant="outline" className="w-full" onClick={() => { setMode('login'); setForgotSent(false) }}>
                  로그인으로 돌아가기
                </Button>
              </div>
            ) : mode === 'forgot' ? (
              /* 비밀번호 찾기 — 이메일 입력 */
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">이메일</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError() }}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgot()}
                    placeholder="user@example.com"
                    className="mt-1"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <Button onClick={handleForgot} disabled={loading} className="w-full">
                  {loading ? '전송 중...' : '재설정 링크 보내기'}
                </Button>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                  <button type="button" onClick={() => { setMode('login'); setError('') }} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    로그인으로 돌아가기
                  </button>
                </p>
              </>
            ) : (
              /* 로그인 / 회원가입 */
              <>
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

                {/* 비밀번호 찾기 링크 (로그인 모드에서만) */}
                {mode === 'login' && (
                  <div className="text-right -mt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError('') }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      비밀번호를 잊으셨나요?
                    </button>
                  </div>
                )}

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
              </>
            )}
          </CardContent>
        </Card>

        {/* 데모 로그인 */}
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full border-dashed border-2 border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Play size={16} className="mr-2" />
            {loading ? '데모 데이터 생성 중...' : '데모 계정으로 체험하기'}
          </Button>
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
            2개월간의 샘플 거래 데이터로 앱을 체험합니다
          </p>
        </div>
      </div>
    </div>
  )
}
