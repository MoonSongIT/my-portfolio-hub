// 증시 일정 월간 캘린더 뷰 (FullCalendar dayGridMonth 래퍼)

import { useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CATEGORY_COLORS } from './EventBadge'
import './calendar.css'

export default function CalendarMonthView({ events, currentDate, onDateClick, onEventClick }) {
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
      />
    </div>
  )
}
