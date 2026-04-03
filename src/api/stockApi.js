import axios from 'axios'
import { isKorean, searchKoreanStocks } from '../utils/koreanStocks'

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
