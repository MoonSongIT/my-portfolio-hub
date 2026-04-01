import { Sun, Moon, Menu, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { Button } from '../ui/button'

export default function Header({ onToggleSidebar }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useSettingsStore()
  const { currentUser, logout } = useAuthStore()
  const { clearAccounts } = usePortfolioStore()
  const { clearWatchlist } = useWatchlistStore()

  const handleLogout = () => {
    clearAccounts()
    clearWatchlist()
    logout()
    navigate('/login')
  }

  // 이름 이니셜 (예: 홍길동 → 홍)
  const initials = currentUser?.name ? currentUser.name[0] : '?'

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* 모바일 햄버거 메뉴 */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Portfolio Hub</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* 다크모드 토글 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-600 dark:text-gray-300"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </Button>

        {/* 사용자 아바타 + 이름 */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentUser.name}
            </span>
          </div>
        )}

        {/* 로그아웃 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
          title="로그아웃"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
