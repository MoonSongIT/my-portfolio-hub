// 증시 일정 주간 뷰 — 해당 주 월~일 이벤트 카드 7열 그리드

import { useMemo } from 'react'
import EventBadge, { CATEGORY_COLORS } from './EventBadge'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const IMPACT_ICONS = { high: '🔴', medium: '🟡', low: '🟢' }

/** Date → 로컬 'YYYY-MM-DD' 문자열 (toISOString 시간대 오차 방지) */
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** date를 포함하는 주의 월요일 반환 */
function getMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export default function CalendarWeekView({ events, currentDate, onEventClick, onDateClick }) {
  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  const today = toLocalDateStr(new Date())

  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      const key = (e.date ?? '').slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [events])

  return (
    <div className="bg-white dark:bg-gray-900">
      {/* 헤더 행 — 요일 + 날짜 숫자 */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {weekDays.map((day, i) => {
          const dateStr = toLocalDateStr(day)
          const isToday = dateStr === today
          const isSat = i === 5
          const isSun = i === 6
          return (
            <div
              key={i}
              className={`py-2 text-center border-r last:border-r-0 border-gray-200 dark:border-gray-700 ${
                isToday ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
              }`}
            >
              <div className={`text-xs font-medium ${
                isSun ? 'text-red-500 dark:text-red-400'
                : isSat ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
              }`}>
                {DAY_LABELS[i]}
              </div>
              <div className={`text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                isToday
                  ? 'bg-blue-500 text-white'
                  : isSun ? 'text-red-600 dark:text-red-400'
                  : isSat ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-800 dark:text-gray-200'
              }`}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* 이벤트 셀 영역 */}
      <div className="grid grid-cols-7 min-h-[160px]">
        {weekDays.map((day, i) => {
          const dateStr = toLocalDateStr(day)
          const isToday = dateStr === today
          const isSat = i === 5
          const isSun = i === 6
          const dayEvents = eventsByDate[dateStr] ?? []

          return (
            <div
              key={i}
              onClick={() => onDateClick?.(dateStr)}
              className={[
                'border-r last:border-r-0 border-gray-100 dark:border-gray-800',
                'p-1 space-y-1 cursor-pointer min-h-[120px] transition-colors',
                'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                isToday ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : '',
                (isSat || isSun) && !isToday ? 'bg-gray-50/50 dark:bg-gray-800/20' : '',
              ].filter(Boolean).join(' ')}
            >
              {dayEvents.map(event => {
                const color = CATEGORY_COLORS[event.category]?.fc ?? '#6b7280'
                return (
                  <div
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick?.(event) }}
                    style={{ borderLeftColor: color, backgroundColor: color + '18' }}
                    className="rounded-sm border-l-2 p-1 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-0.5 min-w-0">
                      {event.impact && (
                        <span className="text-[10px] shrink-0">
                          {IMPACT_ICONS[event.impact] ?? ''}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate">
                        {event.ticker ? event.ticker : event.title}
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <EventBadge category={event.category} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
