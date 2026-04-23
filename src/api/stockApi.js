import axios from 'axios'
import { isKorean, searchKoreanStocks } from '../utils/koreanStocks'
import { fetchNaverQuote, fetchNaverProfile, fetchNaverHistory } from './naverApi'
import { searchUsStocks } from '../data/usStocks'
import { searchByQuery } from '../utils/stockMasterDb'

// ── exchange → market 변환 (fetchQuote/fetchHistory 기존 market 파라미터와 호환) ──
const EXCHANGE_TO_MARKET = {
  KOSPI:    'KRX',
  KOSDAQ:   'KOSDAQ',
  KRX_ETF:  'KRX',
  NXT:      'KRX',
  NYSE:     'NYSE',
  NASDAQ:   'NASDAQ',
  AMEX:     'NYSE',
  US_ETF:   'NASDAQ',
}

function exchangeToMarket(exchange) {
  return EXCHANGE_TO_MARKET[exchange] ?? exchange
}

// exchange 우선순위 (낮을수록 우선) — 동일 ticker가 여러 exchange에 있을 때 대표 선정
const EXCHANGE_PRIORITY = {
  KOSPI: 0, KOSDAQ: 1, KRX_ETF: 2, NXT: 3,
  NASDAQ: 4, NYSE: 5, AMEX: 6, US_ETF: 7,
}

/** StockMasterRow → fetchSearch 반환 형식으로 변환 */
function masterRowToSearchResult(row) {
  return {
    ticker:   row.ticker,
    name:     row.name,
    nameKo:   row.name,
    type:     row.type ?? 'EQUITY',
    exchange: row.exchange,
    market:   exchangeToMarket(row.exchange),
    currency: row.currency,
  }
}

/**
 * ticker 기준 중복 제거 — 같은 ticker가 KOSPI/NXT 등 복수 exchange에 있을 때
 * exchange 우선순위(KOSPI > KOSDAQ > ... > NXT)로 대표 1개만 유지
 */
function dedupeByTicker(results) {
  const best = new Map()
  for (const r of results) {
    const prev = best.get(r.ticker)
    const prevPriority = prev ? (EXCHANGE_PRIORITY[prev.exchange] ?? 99) : Infinity
    const currPriority = EXCHANGE_PRIORITY[r.exchange] ?? 99
    if (!prev || currPriority < prevPriority) {
      best.set(r.ticker, r)
    }
  }
  return Array.from(best.values())
}

const yahooApi = axios.create({
  baseURL: '/api/yahoo',
  timeout: 10000,
})

const yahooV10Api = axios.create({
  baseURL: '/api/yahoo-v10',
  timeout: 10000,
})

// 한국 종목 티커 → Yahoo Finance 티커 변환
// 이미 '.KS'/'.KQ' 등 접미사가 있으면 그대로 사용 (중복 방지)
export const toYahooTicker = (ticker, market) => {
  if (ticker.includes('.')) return ticker
  if (market === 'KRX') return `${ticker}.KS`
  if (market === 'KOSDAQ') return `${ticker}.KQ`
  return ticker
}

// 1. 실시간 시세 (단일 종목)
export const fetchQuote = async (ticker, market = 'NASDAQ') => {
  // 한국 주식은 네이버 파이낸스 사용 (KRX + KOSDAQ)
  if (market === 'KRX' || market === 'KOSDAQ') {
    const pureTicker = ticker.replace(/\.(KS|KQ)$/, '')
    return fetchNaverQuote(pureTicker)
  }

  const yahooTicker = toYahooTicker(ticker, market)
  const { data } = await yahooApi.get(`/v8/finance/chart/${yahooTicker}`, {
    params: { interval: '1d', range: '1d' },
  })

  const result = data.chart.result?.[0]
  if (!result) throw new Error(`종목을 찾을 수 없습니다: ${ticker}`)

  const meta = result.meta
  const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice
  return {
    ticker,
    yahooTicker,
    name: meta.shortName || meta.longName || ticker,
    currentPrice: meta.regularMarketPrice,
    previousClose: prevClose,
    change: meta.regularMarketPrice - prevClose,
    changePercent: prevClose ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100 : 0,
    volume: meta.regularMarketVolume,
    currency: meta.currency,
    exchangeName: meta.exchangeName,
    marketState: meta.marketState,
    timestamp: (meta.regularMarketTime || 0) * 1000,
    // v8 meta에서 직접 추출 (KRX 종목에서도 안정적으로 제공)
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    marketCap: meta.marketCap,
  }
}

// 2. 일괄 시세 조회 (포트폴리오용)
export const fetchBatchQuotes = async (holdings) => {
  const batchSize = 5
  const results = []

  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(h => fetchQuote(h.ticker, h.market))
    )
    results.push(...batchResults)
  }

  return results.map((r, idx) => ({
    ticker: holdings[idx].ticker,
    success: r.status === 'fulfilled',
    data: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason.message : null,
  }))
}

// 3. 가격 히스토리
export const fetchHistory = async (ticker, market = 'NASDAQ', range = '6mo', interval = '1d') => {
  // 한국 주식은 네이버 파이낸스 사용 (KRX + KOSDAQ)
  if (market === 'KRX' || market === 'KOSDAQ') {
    const pureTicker = ticker.replace(/\.(KS|KQ)$/, '')
    return fetchNaverHistory(pureTicker, range)
  }

  const yahooTicker = toYahooTicker(ticker, market)
  const { data } = await yahooApi.get(`/v8/finance/chart/${yahooTicker}`, {
    params: { interval, range },
  })

  const result = data.chart.result?.[0]
  if (!result) throw new Error(`히스토리 데이터 없음: ${ticker}`)

  const timestamps = result.timestamp || []
  const quotes = result.indicators.quote?.[0] || {}

  return timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    open: quotes.open?.[i],
    high: quotes.high?.[i],
    low: quotes.low?.[i],
    close: quotes.close?.[i],
    volume: quotes.volume?.[i],
  })).filter(d => d.close != null)
}

// ─── 벤치마크 지수 히스토리 ─────────────────────────────────────
// KOSPI → 네이버, S&P500 → Yahoo
export const fetchBenchmarkHistory = async (range = '1mo') => {
  const naverApi = axios.create({ baseURL: '/api/naver', timeout: 10000 })

  // range → 네이버 pageSize 매핑
  const rangeToDays = { '5d': 7, '1w': 7, '1mo': 25, '3mo': 65, '6mo': 130, '1y': 250 }
  const days = rangeToDays[range] || 25
  const pageSize = Math.min(days, 60)
  const totalPages = Math.ceil(days / pageSize)

  // KOSPI: 네이버 지수 API (페이지네이션)
  const kospiPromise = (async () => {
    try {
      const pages = await Promise.all(
        Array.from({ length: totalPages }, (_, i) =>
          naverApi.get(`/api/index/KOSPI/price`, {
            params: { pageSize, page: i + 1 },
          }).then(r => r.data).catch(() => [])
        )
      )
      return pages.flat()
        .slice(0, days)
        .map(d => ({
          date: d.localTradedAt?.slice(0, 10) || '',
          close: parseFloat(String(d.closePrice).replace(/,/g, '')),
        }))
        .filter(d => d.date && !isNaN(d.close))
        .sort((a, b) => a.date.localeCompare(b.date))
    } catch { return [] }
  })()

  // S&P500: Yahoo Finance (^GSPC)
  const sp500Promise = (async () => {
    try {
      const yahooRange = range === '1w' ? '5d' : range
      const { data } = await yahooApi.get('/v8/finance/chart/%5EGSPC', {
        params: { interval: '1d', range: yahooRange },
      })
      const result = data.chart.result?.[0]
      if (!result) return []
      const ts = result.timestamp || []
      const q = result.indicators.quote?.[0] || {}
      return ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().split('T')[0],
        close: q.close?.[i],
      })).filter(d => d.close != null)
    } catch { return [] }
  })()

  const [kospi, sp500] = await Promise.all([kospiPromise, sp500Promise])
  return { KOSPI: kospi, SP500: sp500 }
}

// 4. 종목 검색 — 마스터 DB(IDB) 우선, 부족 시 로컬 번들 + Yahoo 보완
export const fetchSearch = async (query, downloadedStocks = []) => {
  if (!query || query.length < 1) return []

  const q = query.trim()

  // ── 1순위: 마스터 DB (IndexedDB) ─────────────────────────────────
  let masterResults = []
  try {
    // limit을 넉넉히 잡아 ticker 중복 제거 후에도 충분한 결과 확보
    const rows = await searchByQuery(q, { limit: 60 })
    masterResults = dedupeByTicker(rows.map(masterRowToSearchResult))
  } catch { /* IDB 미준비(최초 설치) 시 폴백으로 계속 */ }

  if (masterResults.length >= 5) return masterResults.slice(0, 20)

  // ── 2순위: 기존 로컬 번들 + Yahoo 보완 ──────────────────────────
  const isKo = isKorean(q)
  const seen = new Set(masterResults.map(s => s.ticker))
  const merged = [...masterResults]

  const addIfNew = (s) => {
    if (!seen.has(s.ticker)) { seen.add(s.ticker); merged.push(s) }
  }

  if (isKo) {
    // 한글: 내장 한국 종목 DB
    searchKoreanStocks(q).forEach(s => addIfNew({
      ticker:   s.ticker.replace('.KS', '').replace('.KQ', ''),
      name:     s.name,
      type:     s.type,
      exchange: s.exchange,
      market:   s.market,
    }))
    // 구형 downloadedStocks (stockDbStore) 폴백
    downloadedStocks
      .filter(s => (s.market === 'KRX' || s.exchange === 'KOSPI' || s.exchange === 'KOSDAQ')
                && s.name?.includes(q))
      .forEach(s => addIfNew({
        ticker:   s.ticker,
        name:     s.name,
        type:     s.type || 'EQUITY',
        exchange: s.exchange || 'KOSPI',
        market:   'KRX',
      }))
  } else {
    // 영문/티커: 내장 미국 종목 DB
    const ql = q.toLowerCase()
    searchUsStocks(q, 10).forEach(s => addIfNew({
      ticker:   s.ticker,
      name:     s.name,
      nameKo:   s.nameKo,
      type:     s.type,
      exchange: s.market,
      market:   s.market,
    }))
    // 구형 downloadedStocks 폴백
    downloadedStocks
      .filter(s => (s.market === 'NASDAQ' || s.market === 'NYSE')
                && (s.ticker?.toLowerCase().startsWith(ql)
                 || s.name?.toLowerCase().includes(ql)))
      .slice(0, 10)
      .forEach(s => addIfNew({
        ticker:   s.ticker,
        name:     s.name,
        type:     s.type || 'ETF',
        exchange: s.market,
        market:   s.market,
      }))
  }

  if (merged.length >= 8) return merged.slice(0, 15)

  // ── 3순위: Yahoo Finance 원격 보완 ──────────────────────────────
  try {
    const { data } = await yahooApi.get('/v1/finance/search', {
      params: { q, quotesCount: 10, newsCount: 0, listsCount: 0 },
    })
    ;(data.quotes || []).forEach(yq => addIfNew({
      ticker:   yq.symbol,
      name:     yq.shortname || yq.longname || yq.symbol,
      type:     yq.quoteType,
      exchange: yq.exchange,
      market:   yq.exchange === 'KSC' || yq.exchange === 'KOE' ? 'KRX'
              : yq.exchange === 'NMS' ? 'NASDAQ'
              : yq.exchange === 'NYQ' ? 'NYSE'
              : yq.exchange,
    }))
  } catch { /* Yahoo 실패 시 현재까지 결과 반환 */ }

  return merged.slice(0, 15)
}

// 5. 기업 상세 + 재무 지표
export const fetchProfile = async (ticker, market = 'NASDAQ') => {
  // 한국 주식은 네이버 파이낸스 사용 (KRX + KOSDAQ)
  if (market === 'KRX' || market === 'KOSDAQ') {
    try {
      const pureTicker = ticker.replace(/\.(KS|KQ)$/, '')
      return await fetchNaverProfile(pureTicker)
    } catch {
      return {}
    }
  }

  const yahooTicker = toYahooTicker(ticker, market)

  try {
    const { data } = await axios.get('/api/yf2/quoteSummary', {
      params: { ticker: yahooTicker },
      timeout: 15000,
    })

    if (data._error) return {}  // 서버 측 오류

    const profile   = data.summaryProfile   || {}
    const detail    = data.summaryDetail    || {}
    const stats     = data.defaultKeyStatistics || {}
    const financial = data.financialData    || {}

    // PER: Yahoo가 직접 제공하지 않는 KRX 종목은 순이익/발행주식수로 계산
    let trailingPE = detail.trailingPE ?? null
    if (trailingPE == null && stats.netIncomeToCommon && stats.sharesOutstanding && financial.currentPrice) {
      const eps = stats.netIncomeToCommon / stats.sharesOutstanding
      if (eps > 0) trailingPE = parseFloat((financial.currentPrice / eps).toFixed(2))
    }

    return {
      sector:       profile.sector       || null,
      industry:     profile.industry     || null,
      website:      profile.website      || null,
      description:  profile.longBusinessSummary || null,
      country:      profile.country      || null,
      marketCap:    detail.marketCap     ?? null,
      fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow:  detail.fiftyTwoWeekLow  ?? null,
      dividendYield:    detail.dividendYield     ?? null,
      averageVolume:    detail.averageVolume      ?? null,
      trailingPE,
      forwardPE:    stats.forwardPE      ?? null,
      priceToBook:  stats.priceToBook    ?? null,
      returnOnEquity:   financial.returnOnEquity   ?? null,
      debtToEquity:     financial.debtToEquity     ?? null,
      revenueGrowth:    financial.revenueGrowth    ?? null,
      earningsGrowth:   financial.earningsGrowth   ?? null,
      currentRatio:     financial.currentRatio     ?? null,
      targetMeanPrice:  financial.targetMeanPrice  ?? null,
      recommendationKey: financial.recommendationKey || null,
      numberOfAnalystOpinions: financial.numberOfAnalystOpinions ?? null,
    }
  } catch {
    return {}
  }
}

// 6. 환율 조회 (USD/KRW)
export const fetchExchangeRate = async () => {
  try {
    const { data } = await yahooApi.get('/v8/finance/chart/USDKRW=X', {
      params: { interval: '1d', range: '1d' },
    })
    const meta = data.chart.result?.[0]?.meta
    return {
      rate: meta?.regularMarketPrice || 1350,
      timestamp: (meta?.regularMarketTime || 0) * 1000,
    }
  } catch {
    return { rate: 1350, timestamp: Date.now() }
  }
}
