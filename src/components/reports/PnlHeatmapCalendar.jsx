// 날짜별 수익/손실 히트맵 캘린더 — 수익 빨강, 손실 파랑 (한국 컨벤션)
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay() // 0=일, 6=토
}

function getPnlColor(pnl) {
  if (pnl == null) return 'bg-gray-100 dark:bg-gray-800'
  if (pnl === 0) return 'bg-gray-100 dark:bg-gray-800'
  const abs = Math.abs(pnl)
  if (pnl > 0) {
    if (abs >= 500000) return 'bg-red-500 text-white'
    if (abs >= 200000) return 'bg-red-400 text-white'
    if (abs >= 50000)  return 'bg-red-300 text-gray-900'
    return 'bg-red-100 text-gray-900'
  } else {
    if (abs >= 500000) return 'bg-blue-500 text-white'
    if (abs >= 200000) return 'bg-blue-400 text-white'
    if (abs >= 50000)  return 'bg-blue-300 text-gray-900'
    return 'bg-blue-100 text-gray-900'
  }
}

function formatPnl(pnl) {
  if (pnl == null || pnl === 0) return null
  const abs = Math.abs(pnl)
  const str = abs >= 10000
    ? `${(abs / 10000).toFixed(0)}만`
    : `${Math.round(abs).toLocaleString('ko-KR')}`
  return (pnl > 0 ? '+' : '-') + str
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function PnlHeatmapCalendar({ entries, year, month, onMonthChange }) {
  const pnlByDate = useMemo(() => {
    const map = {}
    entries.forEach((e) => {
      if (!e.date || e.pnl == null) return
      const [y, m] = e.date.split('-').map(Number)
      if (y !== year || m - 1 !== month) return
      map[e.date] = (map[e.date] ?? 0) + e.pnl
    })
    return map
  }, [entries, year, month])

  const totalDays = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  const pad = (v) => String(v).padStart(2, '0')

  const goPrev = () => {
    if (month === 0) onMonthChange(year - 1, 11)
    else onMonthChange(year, month - 1)
  }
  const goNext = () => {
    if (month === 11) onMonthChange(year + 1, 0)
    else onMonthChange(year, month + 1)
  }

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={goPrev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {year}년 {month + 1}월
        </span>
        <button onClick={goNext} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}

        {/* 날짜 셀 */}
        {cells.map((day, idx) => {
          if (day == null) return <div key={`empty-${idx}`} />
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
          const pnl = pnlByDate[dateStr] ?? null
          const colorClass = getPnlColor(pnl)
          const label = formatPnl(pnl)

          return (
            <div
              key={dateStr}
              title={label ? `${dateStr}: ${label}원` : dateStr}
              className={`rounded text-center py-1 text-xs font-medium transition-opacity hover:opacity-80 ${colorClass}`}
            >
              <div>{day}</div>
              {label && <div className="text-[9px] leading-none mt-0.5 truncate px-0.5">{label}</div>}
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300 inline-block" />수익</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-300 inline-block" />손실</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" />거래 없음</span>
      </div>
    </div>
  )
}
