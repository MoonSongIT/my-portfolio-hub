// 증시 캘린더 이벤트 자동 탐색 API — DART(한국) + Finnhub(미국) 호출 클라이언트

import axios from 'axios'
import useAiCredentialStore from '../store/aiCredentialStore.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

/**
 * DART 배당·분배 일정 조회
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array>} CalendarEvent 배열
 */
export async function fetchDartDividend(startDate, endDate) {
  const dartKey = useAiCredentialStore.getState().dartApiKey
  if (!dartKey) return []
  try {
    const res = await api.get('/dart/calendar/dividend', {
      params: { from: startDate, to: endDate },
      headers: { 'x-dart-api-key': dartKey },
    })
    return res.data?.events ?? []
  } catch (err) {
    console.error('[CalendarFetchApi] DART 배당 오류:', err.message)
    return []
  }
}

/**
 * DART 실적 공시 일정 조회 (분기·반기·사업보고서)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array>} CalendarEvent 배열
 */
export async function fetchDartEarnings(startDate, endDate) {
  const dartKey = useAiCredentialStore.getState().dartApiKey
  if (!dartKey) return []
  try {
    const res = await api.get('/dart/calendar/earnings', {
      params: { from: startDate, to: endDate },
      headers: { 'x-dart-api-key': dartKey },
    })
    return res.data?.events ?? []
  } catch (err) {
    console.error('[CalendarFetchApi] DART 실적 오류:', err.message)
    return []
  }
}

/**
 * Finnhub 미국 실적 발표 일정 조회
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array>} CalendarEvent 배열
 */
export async function fetchFinnhubEarnings(startDate, endDate) {
  const finnhubKey = useAiCredentialStore.getState().finnhubApiKey
  if (!finnhubKey) return []
  try {
    const res = await api.get('/finnhub/calendar/earnings', {
      params: { from: startDate, to: endDate },
      headers: { 'x-finnhub-api-key': finnhubKey },
    })
    return res.data?.events ?? []
  } catch (err) {
    console.error('[CalendarFetchApi] Finnhub 실적 오류:', err.message)
    return []
  }
}

/**
 * Finnhub 미국 IPO 일정 조회
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array>} CalendarEvent 배열
 */
export async function fetchFinnhubIpo(startDate, endDate) {
  const finnhubKey = useAiCredentialStore.getState().finnhubApiKey
  if (!finnhubKey) return []
  try {
    const res = await api.get('/finnhub/calendar/ipo', {
      params: { from: startDate, to: endDate },
      headers: { 'x-finnhub-api-key': finnhubKey },
    })
    return res.data?.events ?? []
  } catch (err) {
    console.error('[CalendarFetchApi] Finnhub IPO 오류:', err.message)
    return []
  }
}
