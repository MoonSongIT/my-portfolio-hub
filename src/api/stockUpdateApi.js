// 종목 DB 업데이트 API
// 개발 서버 미들웨어(/api/stock-update)를 통해 KRX + Yahoo 종목 목록을 가져옴

export const MARKET_LABELS = {
  KOSPI:      '코스피',
  KOSDAQ:     '코스닥',
  KRX_ETF:   'KRX ETF',
  NASDAQ:     '나스닥 주식',
  NYSE:       'NYSE 주식',
  NASDAQ_ETF: '나스닥 ETF',
  NYSE_ETF:  'NYSE ETF',
}

/**
 * 특정 시장의 종목 목록을 서버에서 다운로드
 * @param {'KOSPI'|'KOSDAQ'|'KRX_ETF'|'NASDAQ_ETF'|'NYSE_ETF'|'ALL'} market
 * @returns {Promise<{ result: Object, errors: Object, total: number, updatedAt: string }>}
 */
export async function fetchStockUpdate(market = 'ALL') {
  const res = await fetch(`/api/stock-update?market=${market}`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`서버 오류 ${res.status}`)
  return res.json()
}

/**
 * 모든 시장을 순서대로 업데이트하면서 진행 상황 콜백 호출
 * @param {(market: string, done: number, total: number) => void} onProgress
 * @returns {Promise<{ byMarket: Object, total: number, updatedAt: string }>}
 */
export async function fetchAllMarketsSequential(onProgress) {
  const markets = Object.keys(MARKET_LABELS)
  const byMarket = {}
  const errors = {}

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i]
    onProgress?.(market, i, markets.length)
    try {
      const data = await fetchStockUpdate(market)
      byMarket[market] = data.result[market] || []
      if (data.errors[market]) errors[market] = data.errors[market]
    } catch (err) {
      errors[market] = err.message
      byMarket[market] = []
    }
  }

  onProgress?.('완료', markets.length, markets.length)

  const total = Object.values(byMarket).reduce((s, arr) => s + arr.length, 0)
  return { byMarket, errors, total, updatedAt: new Date().toISOString() }
}
