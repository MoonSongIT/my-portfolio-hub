// AI 종합분석 오케스트레이터 — 병렬 데이터 수집 + 번들 조립
import { fetchQuote, fetchProfile, fetchHistory } from '../api/stockApi'
import { fetchNews } from '../api/newsApi'
import { fetchDisclosures } from '../api/disclosureApi'
import { computeIndicators } from '../api/technicalApi'

/**
 * 종목 분석 번들 조립
 * - 이미 페칭된 데이터(prefetched)가 있으면 재사용, 없으면 새로 fetch
 * - Promise.allSettled: 일부 소스 실패해도 나머지로 부분 리포트 제공
 *
 * @param {{
 *   ticker: string,
 *   market: string,
 *   prefetched?: { quote?, detail?, history? }
 * }} opts
 * @returns {Promise<{
 *   stockData: object|null,
 *   profile: object|null,
 *   tech: object,
 *   news: Array,
 *   disclosures: Array
 * }>}
 */
export async function assembleResearchBundle({ ticker, market, prefetched = {} }) {
  const { quote: preQuote, detail: preDetail, history: preHistory } = prefetched

  const [quoteRes, detailRes, historyRes, newsRes, disclosuresRes] = await Promise.allSettled([
    preQuote   ? Promise.resolve(preQuote)   : fetchQuote(ticker, market),
    preDetail  ? Promise.resolve(preDetail)  : fetchProfile(ticker, market),
    preHistory ? Promise.resolve(preHistory) : fetchHistory(ticker, market, '6mo', '1d'),
    fetchNews(ticker, market),
    fetchDisclosures(ticker, market),
  ])

  const history = historyRes.status === 'fulfilled' ? historyRes.value : (preHistory || [])

  return {
    stockData:   quoteRes.status      === 'fulfilled' ? quoteRes.value      : (preQuote  ?? null),
    profile:     detailRes.status     === 'fulfilled' ? detailRes.value     : (preDetail ?? null),
    tech:        computeIndicators(history),
    news:        newsRes.status       === 'fulfilled' ? newsRes.value       : [],
    disclosures: disclosuresRes.status === 'fulfilled' ? disclosuresRes.value : [],
  }
}
