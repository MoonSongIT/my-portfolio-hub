// 증시 일정 전역 상태 — 뷰 모드, 현재 날짜, 이벤트 목록, 필터 관리

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  getEventsByMonth,
  getEventsByYear,
  getEventsByRange,
  addEvent as dbAddEvent,
  updateEvent as dbUpdateEvent,
  deleteEvent as dbDeleteEvent,
} from '../utils/calendarDb'

export const useCalendarStore = create(
  immer((set, get) => ({
    events: [],
    view: 'month',
    currentDate: new Date(),
    filterCategory: 'all',
    filterScope: 'all',

    setView(view) {
      set(s => { s.view = view })
    },

    setCurrentDate(date) {
      set(s => { s.currentDate = date })
    },

    setFilter(key, value) {
      set(s => { s[key] = value })
    },

    async loadEvents(userId) {
      const { view, currentDate } = get()
      const year  = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      let events
      if (view === 'year') {
        events = await getEventsByYear(userId, year)
      } else if (view === 'week') {
        // 주 경계가 월을 넘을 경우를 위해 범위 쿼리 사용
        const d = new Date(currentDate)
        const dayOffset = (d.getDay() + 6) % 7  // Mon=0
        const monday = new Date(d)
        monday.setDate(d.getDate() - dayOffset)
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        const pad = n => String(n).padStart(2, '0')
        const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
        const endStr   = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`
        events = await getEventsByRange(userId, startStr, endStr)
      } else {
        events = await getEventsByMonth(userId, year, month)
      }
      set(s => { s.events = events })
    },

    async addEvent(userId, eventData) {
      await dbAddEvent(userId, eventData)
      await get().loadEvents(userId)
    },

    async updateEvent(userId, id, eventData) {
      await dbUpdateEvent(id, eventData)
      await get().loadEvents(userId)
    },

    async deleteEvent(userId, id) {
      await dbDeleteEvent(id)
      await get().loadEvents(userId)
    },

    filteredEvents(watchlistTickers = [], portfolioTickers = []) {
      const { events, filterCategory, filterScope } = get()
      return events.filter(e => {
        if (filterCategory !== 'all' && e.category !== filterCategory) return false
        if (filterScope === 'watchlist') return watchlistTickers.includes(e.ticker)
        if (filterScope === 'portfolio') return portfolioTickers.includes(e.ticker)
        return true
      })
    },
  }))
)
