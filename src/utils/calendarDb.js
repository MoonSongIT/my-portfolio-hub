// 증시 일정 이벤트 IndexedDB CRUD 헬퍼 (Dexie calendarEvents 테이블)

import { db } from './db'

export async function getEventsByMonth(userId, year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end   = `${year}-${String(month).padStart(2, '0')}-31`
  return db.calendarEvents
    .where('userId').equals(userId)
    .and(e => e.date >= start && e.date <= end)
    .toArray()
}

export async function getEventsByYear(userId, year) {
  const start = `${year}-01-01`
  const end   = `${year}-12-31`
  return db.calendarEvents
    .where('userId').equals(userId)
    .and(e => e.date >= start && e.date <= end)
    .toArray()
}

export async function getEventsByRange(userId, startDate, endDate) {
  return db.calendarEvents
    .where('userId').equals(userId)
    .and(e => e.date >= startDate && e.date <= endDate)
    .toArray()
}

export async function addEvent(userId, eventData) {
  return db.calendarEvents.add({
    ...eventData,
    userId,
    createdAt: new Date().toISOString(),
  })
}

export async function updateEvent(id, eventData) {
  return db.calendarEvents.update(id, eventData)
}

export async function deleteEvent(id) {
  return db.calendarEvents.delete(id)
}

export async function clearAllEvents(userId) {
  return db.calendarEvents.where('userId').equals(userId).delete()
}

export async function deleteEventsByRange(userId, startDate, endDate) {
  return db.calendarEvents
    .where('userId').equals(userId)
    .and(e => e.date >= startDate && e.date <= endDate)
    .delete()
}
