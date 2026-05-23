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
import { fetchDartDividend, fetchDartEarnings, fetchFinnhubEarnings, fetchFinnhubIpo } from '../api/calendarFetchApi.js'

export const useCalendarStore = create(
  immer((set, get) => ({
    events: [],
    view: 'month',
    currentDate: new Date(),
    filterCategory: 'all',
    filterScope: 'all',
    filterImpact: 'all',
    isFetching: false,
    fetchResult: null,

    setView(view) {
      set(s => { s.view = view })
    },

    setCurrentDate(date) {
      set(s => { s.currentDate = date })
    },

    setFilter(key, value) {
      set(s => { s[key] = value })
    },

    setFilterImpact(value) {
      set(s => { s.filterImpact = value })
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

    // ── 자동 탐색 액션 ────────────────────────────────────────────────

    async fetchFromDart(startDate, endDate) {
      set(s => { s.isFetching = true })
      try {
        const [dividend, earnings] = await Promise.all([
          fetchDartDividend(startDate, endDate),
          fetchDartEarnings(startDate, endDate),
        ])
        set(s => {
          s.fetchResult = [...dividend, ...earnings]
          s.isFetching = false
        })
      } catch (err) {
        console.error('[CalendarStore] DART 탐색 오류:', err.message)
        set(s => { s.isFetching = false })
      }
    },

    async fetchFromFinnhub(startDate, endDate) {
      set(s => { s.isFetching = true })
      try {
        const [earnings, ipo] = await Promise.all([
          fetchFinnhubEarnings(startDate, endDate),
          fetchFinnhubIpo(startDate, endDate),
        ])
        set(s => {
          s.fetchResult = [...earnings, ...ipo]
          s.isFetching = false
        })
      } catch (err) {
        console.error('[CalendarStore] Finnhub 탐색 오류:', err.message)
        set(s => { s.isFetching = false })
      }
    },

    async fetchFromAll(startDate, endDate) {
      set(s => { s.isFetching = true })
      try {
        const [dividend, dartEarnings, finnhubEarnings, ipo] = await Promise.all([
          fetchDartDividend(startDate, endDate),
          fetchDartEarnings(startDate, endDate),
          fetchFinnhubEarnings(startDate, endDate),
          fetchFinnhubIpo(startDate, endDate),
        ])
        set(s => {
          s.fetchResult = [...dividend, ...dartEarnings, ...finnhubEarnings, ...ipo]
          s.isFetching = false
        })
      } catch (err) {
        console.error('[CalendarStore] 전체 탐색 오류:', err.message)
        set(s => { s.isFetching = false })
      }
    },

    clearFetchResult() {
      set(s => { s.fetchResult = null })
    },

    // 선택한 이벤트를 DB에 일괄 저장 (ticker+date+category 기준 중복 제거)
    // 반환값: 실제 저장된 건수
    async bulkAddEvents(userId, selectedEvents) {
      if (!selectedEvents.length) return 0
      const dates = selectedEvents.map(e => e.date).sort()
      const existing = await getEventsByRange(userId, dates[0], dates[dates.length - 1])
      const keys = new Set(existing.map(e => `${e.ticker}|${e.date}|${e.category}`))
      const toAdd = selectedEvents.filter(e => !keys.has(`${e.ticker}|${e.date}|${e.category}`))
      for (const ev of toAdd) {
        await dbAddEvent(userId, ev)
      }
      await get().loadEvents(userId)
      return toAdd.length
    },

    filteredEvents(watchlistTickers = [], portfolioTickers = []) {
      const { events, filterCategory, filterScope, filterImpact } = get()
      return events.filter(e => {
        if (filterCategory !== 'all' && e.category !== filterCategory) return false
        if (filterImpact !== 'all' && e.impact !== filterImpact) return false
        if (filterScope === 'watchlist') return watchlistTickers.includes(e.ticker)
        if (filterScope === 'portfolio') return portfolioTickers.includes(e.ticker)
        return true
      })
    },
  }))
)
