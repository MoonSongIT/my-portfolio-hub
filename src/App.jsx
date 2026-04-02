import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSettingsStore } from './store/settingsStore'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Research from './pages/Research'
import Watchlist from './pages/Watchlist'
import Reports from './pages/Reports'
import StockDetail from './pages/StockDetail'
import AIChat from './pages/AIChat'
import Login from './pages/Login'
import Header from './components/common/Header'
import Sidebar from './components/common/Sidebar'
import ProtectedRoute from './components/common/ProtectedRoute'

function App() {
  const { theme } = useSettingsStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 다크모드: <html> 태그에 dark 클래스 토글
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <BrowserRouter>
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
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/research" element={<Research />} />
                      <Route path="/research/:ticker" element={<StockDetail />} />
                      <Route path="/watchlist" element={<Watchlist />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/ai-chat" element={<AIChat />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
