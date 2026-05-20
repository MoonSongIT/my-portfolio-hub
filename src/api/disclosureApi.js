// 공시 API 클라이언트 — DART(한국) / SEC EDGAR(미국)
import axios from 'axios'
import useAiCredentialStore from '../store/aiCredentialStore.js'
import { getCached, setCached } from './apiCache'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,  // DART 첫 로드 시 corpCode 다운로드 포함하여 여유 있게 설정
})

/**
 * 종목 공시 조회
 * - KRX/KOSDAQ → DART OpenAPI (/api/dart/list)
 * - NYSE/NASDAQ → SEC EDGAR  (/api/edgar/filings)
 *
 * @param {string} ticker - 종목 코드 (예: '005930', 'AAPL')
 * @param {string} market - 시장 코드 (예: 'KRX', 'KOSDAQ', 'NYSE', 'NASDAQ')
 * @param {number} [days=30] - 조회 기간 (일)
 * @returns {Promise<Array<{ date: string, title: string, url: string, kind: string }>>}
 */
// DART 일일 호출 횟수 모니터링 (일일 40,000건 제한 대응)
let dartCallCount = 0
let dartCallDate  = new Date().toDateString()

function trackDartCall() {
  const today = new Date().toDateString()
  if (dartCallDate !== today) {
    dartCallCount = 0
    dartCallDate  = today
  }
  dartCallCount++
  if (dartCallCount >= 38_000) {
    throw 'DART_DAILY_LIMIT_REACHED'
  } else if (dartCallCount >= 35_000) {
    console.warn(`[DisclosureAPI] DART 일일 호출 ${dartCallCount}건 — 40,000건 한도 근접`)
  } else {
    console.debug(`[DisclosureAPI] DART 호출 #${dartCallCount} (일일 40,000건 한도)`)
  }
}

export async function fetchDisclosures(ticker, market, days = 30) {
  const isKorean  = market === 'KRX' || market === 'KOSDAQ'
  const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')
  const cacheKey = `disclosures:${cleanTicker}:${market}:${days}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    let items
    if (isKorean) {
      trackDartCall()
      const dartKey = useAiCredentialStore.getState().dartApiKey
      const headers = dartKey ? { 'X-Dart-Api-Key': dartKey } : {}
      const res = await api.get('/dart/list', { params: { ticker: cleanTicker, days }, headers })
      items = res.data?.items ?? []
    } else {
      const res = await api.get('/edgar/filings', { params: { ticker, days } })
      items = res.data?.items ?? []
    }
    setCached(cacheKey, items, 15 * 60 * 1000)
    return items
  } catch (err) {
    if (err === 'DART_DAILY_LIMIT_REACHED') {
      return [{ title: '[공시 조회 일시 중단] DART API 일일 한도 근접 — 자정 이후 재개됩니다.', date: '', url: '', kind: '' }]
    }
    return []
  }
}
