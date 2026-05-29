// 증시 일정 이벤트 IndexedDB CRUD 헬퍼 (Dexie calendarEvents 테이블)

import { db, bumpSyncVersion } from './db'
import { useSyncStore } from '../store/syncStore'

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
  const record = bumpSyncVersion({
    ...eventData,
    userId,
    createdAt: new Date().toISOString(),
  })
  const result = await db.calendarEvents.add(record)
  useSyncStore.getState().incrementPending()
  return result
}

export async function updateEvent(id, eventData) {
  const syncUpdates = bumpSyncVersion(eventData)
  const result = await db.calendarEvents.update(id, syncUpdates)
  useSyncStore.getState().incrementPending()
  return result
}

export async function deleteEvent(id) {
  const softDelete = bumpSyncVersion({ deletedAt: new Date().toISOString() })
  try {
    await db.calendarEvents.update(id, softDelete)
  } catch {
    await db.calendarEvents.delete(id)
  }
  useSyncStore.getState().incrementPending()
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
