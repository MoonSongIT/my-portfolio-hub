// 증시 일정 페이지 — 연간/월간/주간 캘린더 뷰 및 이벤트 CRUD 진입점

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, CloudDownload, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCalendarStore } from '../store/calendarStore'
import { useAuthStore } from '../store/authStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { usePortfolioStore } from '../store/portfolioStore'
import useAiCredentialStore from '../store/aiCredentialStore'
import { useSettingsStore } from '../store/settingsStore'
import { scheduleNotifications, cancelAll } from '../utils/calendarNotifier'
import { CATEGORY_COLORS } from '../components/calendar/EventBadge'
import AddEventModal from '../components/calendar/AddEventModal'
import EventDetailModal from '../components/calendar/EventDetailModal'
import FetchPreviewModal from '../components/calendar/FetchPreviewModal'
import { Button } from '../components/ui/button'

const CalendarMonthView = lazy(() => import('../components/calendar/CalendarMonthView'))
const CalendarWeekView  = lazy(() => import('../components/calendar/CalendarWeekView'))
const CalendarYearView  = lazy(() => import('../components/calendar/CalendarYearView'))

const VIEW_LABELS = { year: '연간', month: '월간', week: '주간' }

const PERIOD_LABELS = { this: '이번 달', next: '다음 달', '3months': '향후 3개월' }

function getDateRange(period) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (period === 'this') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return [fmt(start), fmt(end)]
  }
  if (period === 'next') {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    return [fmt(start), fmt(end)]
  }
  // 3months
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 3, 0)
  return [fmt(start), fmt(end)]
}

function currentMonthRange() {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: first,
    to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  }
}

const IMPACT_FILTERS = [
  { value: 'all',    label: '전체' },
  { value: 'high',   label: '높음 ★★★' },
  { value: 'medium', label: '중간 ★★' },
  { value: 'low',    label: '낮음 ★' },
]

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
    events, view, currentDate, filterCategory, filterScope, filterImpact,
    setView, setCurrentDate, setFilter, setFilterImpact, loadEvents,
    isFetching, fetchResult,
    fetchFromDart, fetchFromFinnhub, fetchFromAll,
    bulkAddEvents, clearFetchResult, deleteEventsByRange,
  } = useCalendarStore()

  const currentUser = useAuthStore(s => s.currentUser)
  const watchlist = useWatchlistStore(s => s.watchlist)
  const getSelectedHoldings = usePortfolioStore(s => s.getSelectedHoldings)
  const dartApiKey    = useAiCredentialStore(s => s.dartApiKey)
  const finnhubApiKey = useAiCredentialStore(s => s.finnhubApiKey)
  const calendarNotification = useSettingsStore(s => s.calendarNotification)

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showFetchDropdown, setShowFetchDropdown] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearRange, setClearRange] = useState({ from: '', to: '' })
  const fetchDropdownRef = useRef(null)

  const watchlistTickers = useMemo(() => watchlist.map(w => w.ticker), [watchlist])
  const portfolioTickers = useMemo(() => {
    try { return getSelectedHoldings().map(h => h.ticker) } catch { return [] }
  }, [getSelectedHoldings])

  useEffect(() => {
    if (!currentUser?.id) return
    loadEvents(currentUser.id)
  }, [currentUser?.id, view, currentDate, loadEvents])

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (fetchDropdownRef.current && !fetchDropdownRef.current.contains(e.target)) {
        setShowFetchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // fetchResult가 세팅되면 미리보기 모달 열기
  useEffect(() => {
    if (fetchResult !== null) setPreviewOpen(true)
  }, [fetchResult])

  // 증시 일정 알림 스케줄링 — events 또는 알림 설정 변경 시 재등록
  useEffect(() => {
    const ids = scheduleNotifications(events, calendarNotification)
    return () => cancelAll(ids)
  }, [events, calendarNotification])

  const handleFetch = async (source, period) => {
    setShowFetchDropdown(false)
    if (source === 'dart' && !dartApiKey) {
      toast.error('DART API 키가 설정되지 않았습니다. 설정 > API 키 메뉴에서 입력해 주세요.')
      return
    }
    if (source === 'finnhub' && !finnhubApiKey) {
      toast.error('Finnhub API 키가 설정되지 않았습니다. 설정 > API 키 메뉴에서 입력해 주세요.')
      return
    }
    if (source === 'all' && !dartApiKey && !finnhubApiKey) {
      toast.error('DART 또는 Finnhub API 키가 필요합니다. 설정 > API 키 메뉴에서 입력해 주세요.')
      return
    }
    const [startDate, endDate] = getDateRange(period)
    if (source === 'dart')    await fetchFromDart(startDate, endDate)
    else if (source === 'finnhub') await fetchFromFinnhub(startDate, endDate)
    else await fetchFromAll(startDate, endDate)
  }

  const handlePreviewConfirm = async (selectedEvents) => {
    setPreviewOpen(false)
    clearFetchResult()
    if (!selectedEvents.length) return
    const userId = currentUser?.id
    if (!userId) { toast.error('로그인이 필요합니다'); return }
    const { added, updated } = await bulkAddEvents(userId, selectedEvents)
    const parts = []
    if (added > 0)   parts.push(`${added}건 추가`)
    if (updated > 0) parts.push(`${updated}건 업데이트`)
    toast.success(parts.length > 0 ? `${parts.join(', ')}되었습니다.` : '처리할 항목이 없습니다.')
  }

  const handlePreviewClose = () => {
    setPreviewOpen(false)
    clearFetchResult()
  }

  const openClearDialog = () => {
    setClearRange(currentMonthRange())
    setShowClearConfirm(true)
  }

  const handleClearByRange = async () => {
    const userId = currentUser?.id
    if (!userId) return
    if (!clearRange.from || !clearRange.to) { toast.error('날짜 범위를 선택해 주세요.'); return }
    const count = await deleteEventsByRange(userId, clearRange.from, clearRange.to)
    toast.success(`${count}건의 일정이 삭제되었습니다.`)
    setShowClearConfirm(false)
  }

  const displayedEvents = useMemo(() => {
    return events.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false
      if (filterImpact !== 'all' && e.impact !== filterImpact) return false
      if (filterScope === 'watchlist') return watchlistTickers.includes(e.ticker)
      if (filterScope === 'portfolio') return portfolioTickers.includes(e.ticker)
      return true
    })
  }, [events, filterCategory, filterImpact, filterScope, watchlistTickers, portfolioTickers])

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
    // 주간 뷰: 항상 월요일 기준으로 표시
    const d = new Date(currentDate)
    const dayOffset = (d.getDay() + 6) % 7  // Mon=0
    const monday = new Date(d)
    monday.setDate(d.getDate() - dayOffset)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return `${monday.getMonth() + 1}월 ${monday.getDate()}일 ~ ${sunday.getMonth() + 1}월 ${sunday.getDate()}일`
  }

  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr)
    setShowAddModal(true)
  }

  const handleAddModalClose = () => {
    setShowAddModal(false)
    setSelectedDate(null)
  }

  const handleYearCellClick = (date) => {
    setView('month')
    setCurrentDate(date)
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
          {/* 자동 탐색 드롭다운 */}
          <div className="relative" ref={fetchDropdownRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFetchDropdown(prev => !prev)}
              disabled={isFetching}
            >
              {isFetching
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <CloudDownload className="h-4 w-4 mr-1" />
              }
              자동 탐색
            </Button>
            {showFetchDropdown && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20 overflow-hidden">
                {['dart', 'finnhub', 'all'].map(source => (
                  <div key={source}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-900/50">
                      {source === 'dart' ? 'DART (한국)' : source === 'finnhub' ? 'Finnhub (미국)' : '전체'}
                    </div>
                    {Object.entries(PERIOD_LABELS).map(([period, label]) => (
                      <button
                        key={period}
                        onClick={() => handleFetch(source, period)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" />일정 추가
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={openClearDialog}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
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

      {/* 임팩트 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        {IMPACT_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilterImpact(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterImpact === f.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
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
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              히트맵 로딩 중...
            </div>
          }>
            <CalendarYearView
              events={displayedEvents}
              currentDate={currentDate}
              onCellClick={handleYearCellClick}
            />
          </Suspense>
        )}
        {view === 'week' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              주간 뷰 로딩 중...
            </div>
          }>
            <CalendarWeekView
              events={displayedEvents}
              currentDate={currentDate}
              onEventClick={(event) => setSelectedEvent(event)}
              onDateClick={handleDateClick}
            />
          </Suspense>
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
      <FetchPreviewModal
        open={previewOpen}
        onClose={handlePreviewClose}
        onConfirm={handlePreviewConfirm}
        results={fetchResult ?? []}
      />

      {/* 날짜 범위 삭제 다이얼로그 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">일정 삭제</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              선택한 기간의 증시 일정을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">시작일</label>
                <input
                  type="date"
                  value={clearRange.from}
                  onChange={e => setClearRange(r => ({ ...r, from: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">종료일</label>
                <input
                  type="date"
                  value={clearRange.to}
                  onChange={e => setClearRange(r => ({ ...r, to: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>취소</Button>
              <Button variant="destructive" size="sm" onClick={handleClearByRange}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
