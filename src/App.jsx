import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettingsStore } from './store/settingsStore'
import { useJournalStore } from './store/journalStore'
import Header from './components/common/Header'
import Sidebar from './components/common/Sidebar'
import ProtectedRoute from './components/common/ProtectedRoute'
import LoadingSpinner from './components/common/LoadingSpinner'

// 페이지 컴포넌트 lazy 로딩 (코드 스플리팅)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const Journal   = lazy(() => import('./pages/Journal'))
const Research  = lazy(() => import('./pages/Research'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Reports   = lazy(() => import('./pages/Reports'))
const StockDetail = lazy(() => import('./pages/StockDetail'))
const AIChat    = lazy(() => import('./pages/AIChat'))
const Login     = lazy(() => import('./pages/Login'))

function App() {
  const { theme } = useSettingsStore()
  const { loadFromDB } = useJournalStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // PWA 서비스 워커 등록
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[SW] 서비스 워커 등록 완료:', r)
    },
    onOfflineReady() {
      console.log('[SW] 오프라인 준비 완료')
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

  // 앱 시작 시 IndexedDB에서 매매 일지 데이터 로드
  useEffect(() => {
    loadFromDB()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
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
