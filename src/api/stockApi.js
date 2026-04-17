import axios from 'axios'
import { isKorean, searchKoreanStocks } from '../utils/koreanStocks'
import { fetchNaverQuote, fetchNaverProfile, fetchNaverHistory } from './naverApi'

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

// 4. 종목 검색 (한글 → 로컬 DB, 영문 → Yahoo Finance)
export const fetchSearch = async (query) => {
  if (!query || query.length < 1) return []

  // 한글 포함 시 로컬 한국 종목 DB에서 검색
  if (isKorean(query)) {
    return searchKoreanStocks(query).map(s => ({
      ticker: s.ticker.replace('.KS', '').replace('.KQ', ''),
      name: s.name,
      type: s.type,
      exchange: s.exchange,
      market: s.market,
    }))
  }

  // 영문/티커 검색은 Yahoo Finance API 사용
  const { data } = await yahooApi.get('/v1/finance/search', {
    params: { q: query, quotesCount: 10, newsCount: 0, listsCount: 0 },
  })

  return (data.quotes || []).map(q => ({
    ticker: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    type: q.quoteType,
    exchange: q.exchange,
    market: q.exchange === 'KSC' || q.exchange === 'KOE' ? 'KRX'
          : q.exchange === 'NMS' ? 'NASDAQ'
          : q.exchange === 'NYQ' ? 'NYSE'
          : q.exchange,
  }))
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
