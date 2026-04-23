// 뉴스 수집 API — Yahoo Finance + Naver 금융 통합
import axios from 'axios'

const yahooApi = axios.create({ baseURL: '/api/yahoo', timeout: 8000 })
const naverApi = axios.create({ baseURL: '/api/naver', timeout: 8000 })

const NEWS_COUNT = 8

/** 1초 대기 유틸 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Yahoo Finance 뉴스 (글로벌 종목)
 * 기존 /api/yahoo 프록시 재활용 — 추가 서버 설정 불필요
 * 레이트 리밋(429) 발생 시 1초 대기 후 1회 재시도
 */
async function fetchNewsYahoo(ticker) {
  const params = { q: ticker, newsCount: NEWS_COUNT, quotesCount: 0, listsCount: 0 }

  const tryFetch = async () => {
    const { data } = await yahooApi.get('/v1/finance/search', { params })
    return (data.news || []).map(n => ({
      title:     n.title || '',
      publisher: n.publisher || '',
      link:      n.link || '',
      date: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString().split('T')[0]
        : null,
    })).filter(n => n.title)
  }

  try {
    return await tryFetch()
  } catch (err) {
    // 429 레이트 리밋 → 1초 대기 후 1회 재시도
    if (err?.response?.status === 429) {
      console.warn('[NewsAPI] Yahoo 429 레이트 리밋 — 1초 후 재시도')
      await sleep(1000)
      try {
        return await tryFetch()
      } catch {
        return []
      }
    }
    return []
  }
}

/**
 * Naver 금융 뉴스 (한국 종목 전용)
 * 기존 /api/naver 프록시 재활용
 */
async function fetchNewsNaver(ticker) {
  try {
    // 새 통합 API: /api/news/integration/{code}
    const { data } = await naverApi.get(`/api/news/integration/${ticker}`)
    // 응답 구조: { stockNews: [{ total, items: [{title, officeName, datetime, mobileNewsUrl}] }] }
    const allItems = (data?.stockNews || []).flatMap(group => group.items || [])
    return allItems.slice(0, 5).map(n => ({
      title:     n.title || '',
      publisher: n.officeName || '',
      link:      n.mobileNewsUrl || '',
      // datetime: "202604201732" → "2026-04-20"
      date: n.datetime?.length >= 8
        ? `${n.datetime.slice(0,4)}-${n.datetime.slice(4,6)}-${n.datetime.slice(6,8)}`
        : null,
    })).filter(n => n.title)
  } catch {
    return []
  }
}

/**
 * 종목 뉴스 통합 조회
 * - KRX/KOSDAQ: Naver 우선 + Yahoo 보강 (최대 5건)
 * - 그 외: Yahoo 단독
 *
 * @param {string} ticker - 종목 티커 (예: '005930', 'AAPL')
 * @param {string} market - 시장 (예: 'KRX', 'NASDAQ')
 * @returns {Promise<Array<{ title, publisher, link, date }>>}
 */
export async function fetchNews(ticker, market) {
  const isKorean = market === 'KRX' || market === 'KOSDAQ'
  const pureTicker = ticker.replace(/\.(KS|KQ)$/, '')

  if (isKorean) {
    const [naverNews, yahooNews] = await Promise.all([
      fetchNewsNaver(pureTicker),
      fetchNewsYahoo(`${pureTicker}.KS`),
    ])
    // Naver 우선, 부족하면 Yahoo로 보충
    const merged = [...naverNews]
    const needed = 5 - merged.length
    if (needed > 0) merged.push(...yahooNews.slice(0, needed))
    return merged.slice(0, 5)
  }

  return (await fetchNewsYahoo(ticker)).slice(0, 5)
}
