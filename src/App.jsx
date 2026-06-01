import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettingsStore } from './store/settingsStore'
import { runMaintenanceIfNeeded } from './utils/dbMaintenance'
import { migrateFromLegacy } from './utils/stockMasterMigrate'
import { checkIsAdmin } from './utils/stockMasterServerApi'
import { migrateLocalIdsIfNeeded } from './utils/migrateLocalIds'
import { useStockMasterStore } from './store/stockMasterStore'
import { useJournalStore } from './store/journalStore'
import { useCashFlowStore } from './store/cashFlowStore'
import { useDailyPnlStore } from './store/dailyPnlStore'
import { useAuthStore } from './store/authStore'
import useAiCredentialStore from './store/aiCredentialStore'
import { authService } from './services/authService'
import { syncService } from './services/syncService'
import { useSyncStore } from './store/syncStore'
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
import { usePendingSync } from './hooks/usePendingSync'
import { useBeforeUnloadSync } from './hooks/useBeforeUnloadSync'
import PendingUploadModal from './components/sync/PendingUploadModal'

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
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ImportHts = lazy(() => import('./pages/ImportHts'))
const MarketCalendar = lazy(() => import('./pages/MarketCalendar'))

function App() {
  const { theme, enableSync, disableSync } = useSettingsStore()
  // 자동 업로드 인터벌은 syncStore.syncEnabled(사용자 설정 토글)를 기준으로 판단
  const syncEnabled = useSyncStore(s => s.syncEnabled)
  const syncInterval = useSyncStore(s => s.syncInterval)
  const refreshCounts = useStockMasterStore(s => s.refreshCounts)
  const { loadFromDB } = useJournalStore()
  const { loadFromDB: loadCashFlowsFromDB } = useCashFlowStore()
  const { loadFromDB: loadDailyPnlFromDB } = useDailyPnlStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dialogOpen, countdown, handleConfirm, handleDismiss } = useAutoSnapshot()
  // 브라우저 탭 닫기 / 새로고침 이탈 시 미동기화 경고
  useBeforeUnloadSync()

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
    // React StrictMode 이중 실행 방지 — cleanup에서 cancelled=true 로 설정
    let cancelled = false

    authService.getSession().then(async (session) => {
      if (cancelled) return
      useAuthStore.getState().setSupabaseSession(session)
      // 관리자 권한 확인
      if (session?.user?.id) {
        checkIsAdmin().then(isAdmin => useAuthStore.getState().setIsAdmin(isAdmin))
        // M-2: 기존 user-XXXX → Supabase UUID 교정 (1회성, await 블로킹)
        const migrated = await migrateLocalIdsIfNeeded(session.user.id, session.user.email)
        if (migrated > 0) {
          // 교정 완료 → IndexedDB 재로드
          const uid = session.user.id
          useJournalStore.getState().loadFromDB(uid)
          useCashFlowStore.getState().loadFromDB(uid)
          useDailyPnlStore.getState().loadFromDB(uid)
        }
        // M-3: IDB 계좌 로드 → UI 반영 (다운로드 후 필수)
        const { useAccountStore } = await import('./store/accountStore')
        await useAccountStore.getState().loadFromDB(session.user.id)
        // IDB에 계좌가 없으면 localStorage → IDB 복사 (업로드 준비)
        const { db: idb } = await import('./utils/db')
        const idbCount = await idb.userAccounts.count()
        if (idbCount === 0) {
          await useAccountStore.getState().syncToIDB()
        }
        // S-2: 로그인 후 증분 다운로드 — lastSyncedAt 기준으로 변경분만 받음
        if (cancelled) return // 비동기 대기 후 재확인
        const { lastSyncedAt, setPendingChanges } = useSyncStore.getState()
        // since = lastSyncedAt (마진 0) — upload 완료 후 찍히는 시각이므로
        // 업로드된 레코드의 synced_at < lastSyncedAt 보장 → 재다운로드 없음
        const since = lastSyncedAt ?? null

        if (!since) {
          // 최초 기기 — 전체 다운로드
          syncService.downloadAndReload(session.user.id)
            .then(({ total }) => {
              if (cancelled) return
              if (total > 0) toast.success(`서버에서 ${total}개 항목을 받아왔습니다.`)
            })
            .catch(err => console.warn('[Sync] 자동 다운로드 실패:', err))
        } else {
          // 기존 기기 재로그인 — 증분 다운로드
          syncService.downloadDeltaAndReload(session.user.id, since)
            .then(({ total }) => {
              if (cancelled) return
              if (total > 0) toast.info(`서버에서 ${total}개 변경사항을 받아왔습니다.`)
            })
            .catch(err => console.warn('[Sync] 증분 다운로드 실패:', err))
        }

        // S-1: pendingChanges 초기화 — IDB 실제 스캔 결과로 설정
        syncService.countPendingRecords()
          .then(count => { if (!cancelled) setPendingChanges(count) })
          .catch(() => {})
        // M-6: IDB 관심종목 로드 → UI 반영 (IDB가 정식 저장소, localStorage 미사용)
        const { useWatchlistStore } = await import('./store/watchlistStore')
        await useWatchlistStore.getState().loadFromDB(session.user.id)
        // M-6: 서버에서 태그 목록 로드 (없으면 localStorage 유지)
        const { loadGroupsFromServer } = await import('./utils/groupsApi')
        const serverGroups = await loadGroupsFromServer()
        if (serverGroups && serverGroups.length > 0) {
          useWatchlistStore.setState({ groups: serverGroups })
        }
      }
    })

    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSupabaseSession(session)
      if (session?.user?.id) {
        checkIsAdmin().then(isAdmin => useAuthStore.getState().setIsAdmin(isAdmin))
        enableSync()
      } else {
        useAuthStore.getState().setIsAdmin(false)
        disableSync()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 로컬 로그인 후 Supabase 세션 자동 복원 (로그아웃 → 재로그인 시 관리자 권한 복원)
  useEffect(() => {
    if (!isLoggedIn) return
    authService.getSession().then(async (session) => {
      if (!session) return
      useAuthStore.getState().setSupabaseSession(session)
      checkIsAdmin().then(isAdmin => useAuthStore.getState().setIsAdmin(isAdmin))
    })
  }, [isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // 자동 동기화 인터벌 (syncEnabled + syncInterval 설정에 따라)
  useEffect(() => {
    if (!syncEnabled) return
    const INTERVALS = { '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000 }
    const ms = INTERVALS[syncInterval]
    if (!ms) return // 'realtime' or 'manual' — 인터벌 미등록
    const id = setInterval(() => {
      syncService.uploadAll().catch(err => console.warn('[Sync] 자동 동기화 실패:', err))
    }, ms)
    return () => clearInterval(id)
  }, [syncEnabled, syncInterval])

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
      {/* S-1: 이탈 가드 — useBlocker는 Router 내부에서만 사용 가능 */}
      <RouterContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} updateServiceWorker={updateServiceWorker} />
    </BrowserRouter>
  )
}

// Router 컨텍스트 내부에서 useBlocker(usePendingSync)를 사용하기 위한 내부 컴포넌트
function RouterContent({ sidebarOpen, setSidebarOpen }) {
  const { modalOpen, pendingCount, handleUploaded, handleLeave, handleCancel } = usePendingSync()

  return (
    <>
      <PendingUploadModal
        open={modalOpen}
        pendingCount={pendingCount}
        onUploaded={handleUploaded}
        onLeave={handleLeave}
        onCancel={handleCancel}
      />
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"><LoadingSpinner /></div>}>
        <Routes>
          {/* 로그인 페이지 (레이아웃 없음) */}
          <Route path="/login" element={<Login />} />

          {/* OAuth 콜백 (보호 없음 — 인증 전 처리) */}
          <Route path="/api/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* 비밀번호 재설정 (보호 없음 — recovery 토큰으로 접근) */}
          <Route path="/auth/reset-password" element={<ResetPassword />} />

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
    </>
  )
}

export default App
