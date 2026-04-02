import axios from 'axios'
import { hasKorean, searchKrxStocks } from '../data/krxStocks'

const yahooApi = axios.create({
  baseURL: '/api/yahoo',
  timeout: 10000,
})

const yahooV10Api = axios.create({
  baseURL: '/api/yahoo-v10',
  timeout: 10000,
})

// 네이버 금융 자동완성 API (한글 종목 검색)
const naverApi = axios.create({
  baseURL: '/api/naver',
  timeout: 8000,
})

// 한국 종목 티커 → Yahoo Finance 티커 변환
export const toYahooTicker = (ticker, market) => {
  if (market === 'KRX') return `${ticker}.KS`
  return ticker
}

// 1. 실시간 시세 (단일 종목)
export const fetchQuote = async (ticker, market = 'NASDAQ') => {
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
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
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

// 네이버 모바일 주식 검색 API로 한국 종목 검색
// GET /api/search/all?query=삼성&page=1&pageSize=10
const fetchNaverSearch = async (query) => {
  const { data } = await naverApi.get('/api/search/all', {
    params: { query, page: 1, pageSize: 10 },
  })

  // 응답 구조: { stocks: [...] } 또는 { result: { d: [...] } }
  const stocks = data?.stocks
    || data?.result?.stocks
    || data?.result?.d
    || []

  return stocks.map(s => {
    // 필드명이 다를 수 있으므로 여러 키 시도
    const code    = s.itemcode   || s.code       || s.cd || ''
    const name    = s.itemname   || s.name       || s.nm || ''
    const exType  = s.stockExchangeType?.code
                 || s.market     || s.ex         || ''
    const isEtf   = name.includes('ETF') || name.includes('KODEX') || name.includes('TIGER')
    const isKosdaq = exType?.toUpperCase().includes('KOSDAQ')
    return {
      ticker: code,
      name,
      type: isEtf ? 'ETF' : 'EQUITY',
      exchange: isKosdaq ? 'KOE' : 'KSC',
      market: 'KRX',
    }
  }).filter(s => s.ticker).slice(0, 10)
}

// 4. 종목 검색
// - 한글·숫자코드: 네이버 금융 API → 실패 시 로컬 KRX DB fallback
// - 영문·티커: Yahoo Finance API
export const fetchSearch = async (query) => {
  if (!query || query.length < 1) return []

  const isKorean = hasKorean(query)
  const isNumericCode = /^\d+$/.test(query.trim())

  // 한글 또는 숫자 코드: 네이버 금융 API 우선 사용
  if (isKorean || isNumericCode) {
    try {
      const results = await fetchNaverSearch(query)
      if (results.length > 0) return results
    } catch {
      // 네이버 API 실패 시 로컬 KRX DB로 fallback
    }
    // fallback: 로컬 KRX DB
    return searchKrxStocks(query).map(s => ({
      ticker: s.ticker,
      name: s.name,
      type: s.type,
      exchange: 'KSC',
      market: 'KRX',
    }))
  }

  // 영문·티커: Yahoo Finance API
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
  const yahooTicker = toYahooTicker(ticker, market)
  const modules = 'summaryProfile,summaryDetail,defaultKeyStatistics,financialData'

  const { data } = await yahooV10Api.get(`/v10/finance/quoteSummary/${yahooTicker}`, {
    params: { modules },
  })

  const result = data.quoteSummary?.result?.[0]
  if (!result) throw new Error(`기업 정보를 찾을 수 없습니다: ${ticker}`)

  const profile = result.summaryProfile || {}
  const detail = result.summaryDetail || {}
  const stats = result.defaultKeyStatistics || {}
  const financial = result.financialData || {}

  return {
    sector: profile.sector,
    industry: profile.industry,
    website: profile.website,
    description: profile.longBusinessSummary,
    country: profile.country,
    marketCap: detail.marketCap?.raw,
    fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh?.raw,
    fiftyTwoWeekLow: detail.fiftyTwoWeekLow?.raw,
    dividendYield: detail.dividendYield?.raw,
    averageVolume: detail.averageVolume?.raw,
    trailingPE: detail.trailingPE?.raw,
    forwardPE: stats.forwardPE?.raw,
    priceToBook: stats.priceToBook?.raw,
    returnOnEquity: financial.returnOnEquity?.raw,
    debtToEquity: financial.debtToEquity?.raw,
    revenueGrowth: financial.revenueGrowth?.raw,
    earningsGrowth: financial.earningsGrowth?.raw,
    currentRatio: financial.currentRatio?.raw,
    targetMeanPrice: financial.targetMeanPrice?.raw,
    recommendationKey: financial.recommendationKey,
    numberOfAnalystOpinions: financial.numberOfAnalystOpinions?.raw,
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
