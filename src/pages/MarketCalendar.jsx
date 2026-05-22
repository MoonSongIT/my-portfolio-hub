// 증시 일정 페이지 — 연간/월간/주간 캘린더 뷰 및 이벤트 CRUD 진입점

import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { useCalendarStore } from '../store/calendarStore'
import { useAuthStore } from '../store/authStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { usePortfolioStore } from '../store/portfolioStore'
import { CATEGORY_COLORS } from '../components/calendar/EventBadge'
import AddEventModal from '../components/calendar/AddEventModal'
import EventDetailModal from '../components/calendar/EventDetailModal'
import { Button } from '../components/ui/button'

const CalendarMonthView = lazy(() => import('../components/calendar/CalendarMonthView'))

const VIEW_LABELS = { year: '연간', month: '월간', week: '주간' }

const CATEGORY_FILTERS = [
  { value: 'all', label: '전체' },
  ...Object.entries(CATEGORY_COLORS).map(([value, c]) => ({ value, label: c.label })),
]
const SCOPE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'watchlist', label: '내 관심종목' },
  { value: 'portfolio', label: '보유종목' },
]

export default function MarketCalendar() {
  const {
    events, view, currentDate, filterCategory, filterScope,
    setView, setCurrentDate, setFilter, loadEvents,
  } = useCalendarStore()

  const currentUser = useAuthStore(s => s.currentUser)
  const watchlist = useWatchlistStore(s => s.watchlist)
  const getSelectedHoldings = usePortfolioStore(s => s.getSelectedHoldings)

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const watchlistTickers = useMemo(() => watchlist.map(w => w.ticker), [watchlist])
  const portfolioTickers = useMemo(() => {
    try { return getSelectedHoldings().map(h => h.ticker) } catch { return [] }
  }, [getSelectedHoldings])

  useEffect(() => {
    if (!currentUser?.id) return
    loadEvents(currentUser.id)
  }, [currentUser?.id, view, currentDate, loadEvents])

  const displayedEvents = useMemo(() => {
    return events.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (filterScope === 'watchlist') return watchlistTickers.includes(e.ticker)
      if (filterScope === 'portfolio') return portfolioTickers.includes(e.ticker)
      return true
    })
  }, [events, filterCategory, filterScope, watchlistTickers, portfolioTickers])

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'year') d.setFullYear(d.getFullYear() + dir)
    else if (view === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + 7 * dir)
    setCurrentDate(d)
  }

  const navLabel = () => {
    if (view === 'year') return `${currentDate.getFullYear()}년`
    if (view === 'month') {
      return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
    }
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    end.setDate(end.getDate() + 6)
    return `${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`
  }

  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr)
    setShowAddModal(true)
  }

  const handleAddModalClose = () => {
    setShowAddModal(false)
    setSelectedDate(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">증시 일정</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {Object.entries(VIEW_LABELS).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" />일정 추가
          </Button>
        </div>
      </div>

      {/* 네비게이션 바 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold text-gray-800 dark:text-gray-200 min-w-[150px] text-center">
          {navLabel()}
        </span>
        <button
          onClick={() => navigate(1)}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="ml-1 px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          오늘
        </button>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter('filterCategory', f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex flex-wrap gap-1">
          {SCOPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter('filterScope', f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterScope === f.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 캘린더 뷰 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {view === 'month' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              캘린더 로딩 중...
            </div>
          }>
            <CalendarMonthView
              events={displayedEvents}
              currentDate={currentDate}
              onDateClick={handleDateClick}
              onEventClick={(event) => setSelectedEvent(event)}
            />
          </Suspense>
        )}
        {view === 'year' && (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
            연간 히트맵 뷰 — Step 5에서 구현 예정
          </div>
        )}
        {view === 'week' && (
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
            주간 뷰 — Step 4에서 구현 예정
          </div>
        )}
      </div>

      {/* 모달 */}
      <AddEventModal
        open={showAddModal}
        onClose={handleAddModalClose}
        initialDate={selectedDate}
      />
      <EventDetailModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </div>
  )
}
