import { useState, useMemo } from 'react'
import { Sun, Moon, Menu, LogOut, Bot } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { useJournalStore } from '../../store/journalStore'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { useDailyPnlStore } from '../../store/dailyPnlStore'
import { useUserAccounts } from '../../store/accountStore'
import { Button } from '../ui/button'
import ChatPanel from '../chat/ChatPanel'

export default function Header({ onToggleSidebar }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useSettingsStore()
  const { currentUser, logout } = useAuthStore()
  const { clearAccounts } = usePortfolioStore()
  const { clearWatchlist } = useWatchlistStore()
  const { clearEntries } = useJournalStore()
  const { clearCashFlows } = useCashFlowStore()
  const { clearAll: clearDailyPnl } = useDailyPnlStore()
  const [chatOpen, setChatOpen] = useState(false)

  // AI 채팅 컨텍스트 (포트폴리오 + 관심종목 + 매매일지)
  const { getSelectedHoldings, exchangeRate, accounts: portfolioAccounts } = usePortfolioStore()
  const { watchlist } = useWatchlistStore()
  const { entries: journalEntries } = useJournalStore()
  const userAccounts = useUserAccounts()
  const holdings = useMemo(() => getSelectedHoldings(), [portfolioAccounts])
  const chatContext = useMemo(() => ({
    holdings: holdings.map(h => ({
      ticker: h.ticker, name: h.name, quantity: h.quantity,
      avgPrice: h.avgPrice, currentPrice: h.currentPrice, market: h.market,
    })),
    exchangeRate,
    watchlist: watchlist.map(w => ({ ticker: w.ticker, name: w.name, market: w.market })),
    journalEntries,
    accounts: userAccounts,
  }), [holdings, exchangeRate, watchlist, journalEntries, userAccounts])

  const handleLogout = () => {
    clearAccounts()
    clearWatchlist()
    clearEntries()
    clearCashFlows()
    clearDailyPnl()
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
        {/* AI 분석 버튼 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChatOpen(true)}
          className="gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">AI 분석</span>
        </Button>

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
      {/* AI 채팅 패널 */}
      <ChatPanel open={chatOpen} onOpenChange={setChatOpen} context={chatContext} />
    </header>
  )
}
