// 공시 API 클라이언트 — DART(한국) / SEC EDGAR(미국)
import axios from 'axios'

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
export async function fetchDisclosures(ticker, market, days = 30) {
  const isKorean  = market === 'KRX' || market === 'KOSDAQ'
  const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')

  try {
    if (isKorean) {
      const res = await api.get('/dart/list', { params: { ticker: cleanTicker, days } })
      return res.data?.items ?? []
    } else {
      const res = await api.get('/edgar/filings', { params: { ticker, days } })
      return res.data?.items ?? []
    }
  } catch {
    return []
  }
}
