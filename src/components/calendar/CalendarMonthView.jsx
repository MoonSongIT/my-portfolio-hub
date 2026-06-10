// 증시 일정 월간 캘린더 뷰 (FullCalendar dayGridMonth 래퍼)

import { useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CATEGORY_COLORS } from './EventBadge'
import './calendar.css'

const IMPACT_STARS = { high: '★★★', medium: '★★', low: '★' }

export default function CalendarMonthView({ events, currentDate, onDateClick, onEventClick, onMoreLinkClick = () => {} }) {
  const calendarRef = useRef(null)

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.gotoDate(currentDate)
  }, [currentDate])

  const fcEvents = events.map(e => ({
    id: String(e.id),
    title: e.ticker ? `${e.title} (${e.ticker})` : e.title,
    start: e.date,
    end: e.endDate || undefined,
    backgroundColor: CATEGORY_COLORS[e.category]?.fc ?? '#6b7280',
    borderColor: CATEGORY_COLORS[e.category]?.fc ?? '#6b7280',
    extendedProps: e,
  }))

  return (
    <div className="bg-white dark:bg-gray-900 p-2">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={currentDate}
        locale="ko"
        headerToolbar={false}
        events={fcEvents}
        height="auto"
        dayMaxEvents={3}
        dateClick={(info) => onDateClick?.(info.dateStr)}
        eventClick={(info) => onEventClick?.(info.event.extendedProps)}
        moreLinkClick={(info) => {
          info.jsEvent?.preventDefault()
          info.jsEvent?.stopPropagation()
          const d = info.date
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const hiddenIds = (info.hiddenSegs ?? []).map(seg => seg.event.id)
          onMoreLinkClick(dateStr, hiddenIds)
          return false
        }}
        eventContent={(arg) => {
          const stars = IMPACT_STARS[arg.event.extendedProps.impact]
          return (
            <div className="flex items-center justify-between w-full overflow-hidden px-0.5">
              <span className="truncate text-[11px] leading-tight">{arg.event.title}</span>
              {stars && (
                <span className="shrink-0 ml-0.5 text-[9px] text-red-400 dark:text-red-300">{stars}</span>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}
