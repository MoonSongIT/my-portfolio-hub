// 뉴스 수집 API — Yahoo Finance + Naver 금융 통합
import axios from 'axios'
import { getCached, setCached } from './apiCache'

const yahooApi = axios.create({ baseURL: '/api/yahoo', timeout: 8000 })
const naverApi = axios.create({ baseURL: '/api/naver', timeout: 8000 })

const NEWS_COUNT = 8
// 한국 종목: Naver 뉴스가 이 개수 이상이면 Yahoo 병합을 생략(글로벌 무관 뉴스 오염 차단)
const NAVER_SUFFICIENT = 3

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

function dedupeByTitle(items) {
  const seen = new Set()
  return items.filter(n => {
    const key = n.title.slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortByDate(items) {
  return [...items].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })
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
  const cacheKey = `news:${ticker}:${market}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const isKorean = market === 'KRX' || market === 'KOSDAQ'
  const pureTicker = ticker.replace(/\.(KS|KQ)$/, '')
  let result

  if (isKorean) {
    // 1순위: Naver 종목 전용 뉴스. 충분하면 Yahoo를 병합하지 않음(글로벌 junk 차단)
    const naverNews = await fetchNewsNaver(pureTicker)
    if (naverNews.length >= NAVER_SUFFICIENT) {
      result = sortByDate(dedupeByTitle(naverNews)).slice(0, 5)
    } else {
      // Naver 부족 시에만 Yahoo 보강 — 시장별 접미사 적용 (KOSDAQ는 .KQ)
      const suffix = market === 'KOSDAQ' ? '.KQ' : '.KS'
      const yahooNews = await fetchNewsYahoo(`${pureTicker}${suffix}`)
      result = sortByDate(dedupeByTitle([...naverNews, ...yahooNews])).slice(0, 5)
    }
  } else {
    result = (await fetchNewsYahoo(ticker)).slice(0, 5)
  }

  setCached(cacheKey, result, 3 * 60 * 1000)
  return result
}
