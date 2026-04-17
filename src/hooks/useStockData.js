import { useQuery, useQueries } from '@tanstack/react-query'
import {
  fetchQuote,
  fetchBatchQuotes,
  fetchHistory,
  fetchSearch,
  fetchProfile,
  fetchExchangeRate,
} from '../api/stockApi'

// 장중 여부 판단
const isKRXOpen = () => {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = kst.getDay()
  const time = kst.getHours() * 60 + kst.getMinutes()
  return day >= 1 && day <= 5 && time >= 540 && time <= 930
}

const isUSMarketOpen = () => {
  const now = new Date()
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = est.getDay()
  const time = est.getHours() * 60 + est.getMinutes()
  return day >= 1 && day <= 5 && time >= 570 && time <= 960
}

export const isAnyMarketOpen = () => isKRXOpen() || isUSMarketOpen()

// 1. 단일 종목 실시간 시세
export function useStockPrice(ticker, market, options = {}) {
  return useQuery({
    queryKey: ['stockPrice', ticker, market],
    queryFn: () => fetchQuote(ticker, market),
    enabled: !!ticker,
    refetchInterval: isAnyMarketOpen() ? 30_000 : 300_000,
    ...options,
  })
}

// 2. 포트폴리오 일괄 시세 조회
export function useBatchQuotes(holdings, options = {}) {
  const tickers = holdings.map(h => `${h.ticker}:${h.market}`).join(',')
  return useQuery({
    queryKey: ['batchQuotes', tickers],
    queryFn: () => fetchBatchQuotes(holdings),
    enabled: holdings.length > 0,
    refetchInterval: isAnyMarketOpen() ? 60_000 : 300_000,
    ...options,
  })
}

// 3. 종목 검색
export function useStockSearch(query, options = {}) {
  return useQuery({
    queryKey: ['stockSearch', query],
    queryFn: () => fetchSearch(query),
    enabled: !!query && query.length >= 1,
    staleTime: 60 * 1000,
    ...options,
  })
}

// 4. 가격 히스토리
export function useStockHistory(ticker, market, range = '6mo', options = {}) {
  return useQuery({
    queryKey: ['stockHistory', ticker, market, range],
    queryFn: () => fetchHistory(ticker, market, range),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

// 5. 종목 상세 프로필 + 재무
export function useStockDetail(ticker, market, options = {}) {
  return useQuery({
    queryKey: ['stockDetail', ticker, market],
    queryFn: () => fetchProfile(ticker, market),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
    ...options,
  })
}

// 6. 관심종목 스파크라인 — 1개월 히스토리 병렬 페칭 (1시간 캐시)
export function useWatchlistSparklines(watchlist) {
  const queries = watchlist.map(item => ({
    queryKey: ['sparkline', item.ticker, item.market],
    queryFn: () => fetchHistory(item.ticker, item.market, '1mo'),
    staleTime: 60 * 60 * 1000, // 1시간 캐시 (스파크라인은 자주 새로고침 불필요)
    retry: 1,
  }))

  const results = useQueries({ queries })

  // ticker → history 데이터 맵 반환
  const sparklineMap = {}
  results.forEach((result, i) => {
    if (result.data && watchlist[i]) {
      sparklineMap[watchlist[i].ticker] = result.data
    }
  })

  return sparklineMap
}

// 7. 환율 (USD/KRW)
export function useExchangeRate(options = {}) {
  return useQuery({
    queryKey: ['exchangeRate'],
    queryFn: fetchExchangeRate,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60_000,
    ...options,
  })
}
