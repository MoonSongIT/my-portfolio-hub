// 증시 일정 전역 상태 — 뷰 모드, 현재 날짜, 이벤트 목록, 필터 관리

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  getEventsByMonth,
  getEventsByYear,
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
      const events = view === 'year'
        ? await getEventsByYear(userId, year)
        : await getEventsByMonth(userId, year, month)
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
