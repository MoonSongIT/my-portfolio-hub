import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettingsStore } from './store/settingsStore'
import { runMaintenanceIfNeeded } from './utils/dbMaintenance'
import { migrateFromLegacy } from './utils/stockMasterMigrate'
import { useStockMasterStore } from './store/stockMasterStore'
import { useJournalStore } from './store/journalStore'
import { useCashFlowStore } from './store/cashFlowStore'
import { useDailyPnlStore } from './store/dailyPnlStore'
import { useAuthStore } from './store/authStore'
import useAiCredentialStore from './store/aiCredentialStore'
import { authService } from './services/authService'
import { getReportsByUser } from './utils/db'
import { shouldGenerateWeeklyReport } from './agents/reportAgent'
import { Toaster, toast } from 'sonner'
import Header from './components/common/Header'
import Sidebar from './components/common/Sidebar'
import OfflineBanner from './components/common/OfflineBanner'
import ProtectedRoute from './components/common/ProtectedRoute'
import LoadingSpinner from './components/common/LoadingSpinner'
import AutoSnapshotDialog from './components/common/AutoSnapshotDialog'
import { useAutoSnapshot } from './hooks/useAutoSnapshot'

// 페이지 컴포넌트 lazy 로딩 (코드 스플리팅)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const Journal   = lazy(() => import('./pages/Journal'))
const Research  = lazy(() => import('./pages/Research'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Reports   = lazy(() => import('./pages/Reports'))
const StockDetail = lazy(() => import('./pages/StockDetail'))
const AIChat    = lazy(() => import('./pages/AIChat'))
const CashFlow  = lazy(() => import('./pages/CashFlow'))
const Settings  = lazy(() => import('./pages/Settings'))
const Login     = lazy(() => import('./pages/Login'))
const ImportHts = lazy(() => import('./pages/ImportHts'))
const MarketCalendar = lazy(() => import('./pages/MarketCalendar'))

function App() {
  const { theme } = useSettingsStore()
  const refreshCounts = useStockMasterStore(s => s.refreshCounts)
  const { loadFromDB } = useJournalStore()
  const { loadFromDB: loadCashFlowsFromDB } = useCashFlowStore()
  const { loadFromDB: loadDailyPnlFromDB } = useDailyPnlStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dialogOpen, countdown, handleConfirm, handleDismiss } = useAutoSnapshot()

  // PWA 서비스 워커 등록
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r) {
      // 서비스 워커 등록 완료 (프로덕션 로그 생략)
    },
    onOfflineReady() {
      // 오프라인 준비 완료 (프로덕션 로그 생략)
    },
  })

  // 다크모드: <html> 태그에 dark 클래스 토글
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // 앱 시작 시 (또는 로그인 상태 변경 시) 사용자별 IndexedDB 데이터 로드
  useEffect(() => {
    const userId = currentUser?.id
    if (!userId) return
    loadFromDB(userId)
    loadCashFlowsFromDB(userId)
    loadDailyPnlFromDB(userId)
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 앱 시작 시 1회 DB 자동 정리 (24시간 경과 시에만 실행)
  useEffect(() => {
    runMaintenanceIfNeeded().catch(err => console.warn('[App] DB 정리 실패:', err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase 세션 복구 + 세션 변경 구독 (Supabase 미설정 시 무시)
  useEffect(() => {
    authService.getSession().then((session) => {
      useAuthStore.getState().setSupabaseSession(session)
    })

    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSupabaseSession(session)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 앱 시작 시 AI API 키 IDB → 메모리 로드
  useEffect(() => {
    useAiCredentialStore.getState().hydrate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 앱 시작 시 1회: LocalStorage(stock-db-v1) → IndexedDB(StockMasterDB) 마이그레이션
  useEffect(() => {
    migrateFromLegacy()
      .then(() => refreshCounts())   // 마이그레이션 완료 후 카운트 갱신
      .catch(err => {
        console.error('[App] 종목 마스터 DB 마이그레이션 실패:', err)
        toast.warning('종목 DB 마이그레이션 실패', {
          description: '설정 → 종목 DB 관리에서 전체 업데이트를 실행해 주세요.',
          duration: 10000,
        })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 로그인 후 주간 리포트 알림 (확인하지 않은 새 리포트가 있을 때만 1회)
  useEffect(() => {
    const userId = currentUser?.id
    if (!userId) return

    let started = false

    const checkWeeklyReport = async () => {
      try {
        const reports = await getReportsByUser(userId)
        const weeklyReports = reports.filter(r => r.type === 'weekly')
        const latest = weeklyReports[0] || null
        if (!latest) return
        if (shouldGenerateWeeklyReport(latest.generatedAt)) return

        // 이미 확인한 리포트 ID와 같으면 알림 생략
        const seenId = localStorage.getItem(`weeklyReportSeen_${userId}`)
        if (seenId === String(latest.id)) return

        // 레이스 컨디션 방지: 비동기 완료 후 한 번만 토스트 발행
        if (started) return
        started = true

        setTimeout(() => {
          toast.info('📊 지난 주간 리포트가 있습니다.', {
            description: latest.title,
            action: {
              label: '확인하기',
              onClick: () => {
                localStorage.setItem(`weeklyReportSeen_${userId}`, String(latest.id))
                window.history.pushState({}, '', '/reports')
                window.dispatchEvent(new PopStateEvent('popstate'))
              },
            },
            duration: 8000,
          })
        }, 2000) // 앱 로딩 후 2초 뒤 표시
      } catch (err) {
        console.warn('[App] 주간 리포트 확인 실패:', err)
      }
    }

    checkWeeklyReport()
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="bottom-right" richColors closeButton />
      <AutoSnapshotDialog
        open={dialogOpen}
        countdown={countdown}
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
      />
      {/* PWA 새 버전 알림 배너 */}
      {needRefresh && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-blue-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          <span>새 버전이 있습니다.</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="underline font-semibold hover:no-underline"
          >
            지금 업데이트
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="ml-1 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"><LoadingSpinner /></div>}>
        <Routes>
          {/* 로그인 페이지 (레이아웃 없음) */}
          <Route path="/login" element={<Login />} />

          {/* 보호된 페이지 (Header + Sidebar 레이아웃) */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
                  <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                    <OfflineBanner />
                    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/portfolio" element={<Portfolio />} />
                          <Route path="/journal" element={<Journal />} />
                          <Route path="/research" element={<Research />} />
                          <Route path="/research/:ticker" element={<StockDetail />} />
                          <Route path="/watchlist" element={<Watchlist />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/ai-chat" element={<AIChat />} />
                          <Route path="/cashflow" element={<CashFlow />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/import/hts" element={<ImportHts />} />
                          <Route path="/calendar" element={<MarketCalendar />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </Suspense>
                    </main>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
