/**
 * yahooUs.js — NYSE / NASDAQ / US_ETF 종목 수집기
 *
 * 1단계: Yahoo Finance screener 복수 조회 → exchange 필터 → StockMasterRow
 * 2단계: 폴백 티커 목록 직접 quote → 누락 보완
 *
 * NASDAQ_ETF / NYSE_ETF 는 모두 exchange=US_ETF 로 통합 (Sprint 7.1 스키마 반영)
 */
import YahooFinanceClass from 'yahoo-finance2'
import { fromYahoo } from './normalize.js'

const yf = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

const STOCK_SCREENERS = [
  'most_actives', 'day_gainers', 'day_losers',
  'growth_technology_stocks', 'undervalued_growth_stocks',
  'undervalued_large_caps', 'aggressive_small_caps', 'small_cap_gainers',
]

const NASDAQ_CODES = new Set(['NMS', 'NGM', 'NCM', 'NAS'])
const NYSE_CODES   = new Set(['NYQ', 'NYE'])

// ── 폴백 티커 목록 (별도 상수로 분리) ──────────────────────────────────────

export const FALLBACK_NASDAQ_STOCKS = [
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','AVGO','COST',
  'NFLX','AMD','QCOM','INTC','TXN','MU','AMAT','LRCX','KLAC','MRVL',
  'PANW','CRWD','FTNT','SNPS','CDNS','ADSK','ADP','BIIB','BKNG','BMRN',
  'CMCSA','CSCO','CSX','CTAS','CTSH','DLTR','DXCM','EA','FAST','FSLR',
  'GEHC','GILD','IDXX','INCY','ISRG','KDP','KHC','LULU','MDLZ','MNST',
  'NDAQ','NTAP','OKTA','PCAR','ROST','SBUX','TEAM','TMUS','TSCO','TTD',
  'ULTA','VEEV','VRTX','WDAY','ZS','MSTR','ASML','INTU','ABNB','UBER',
  'LYFT','SNAP','RBLX','COIN','HOOD','PLTR','SOFI','RIVN','ZM','DOCU',
  'SHOP','ROKU','PYPL','BILL','AFRM','UPST','DKNG','XPEV','NIO','LI',
  'AAL','DAL','JBLU','NCLH','SIRI','WBA','WDC','ALGN','ANSS','GRMN',
  'ON','MCHP','SWKS','MPWR','ENTG','ILMN','ORLY','PAYX','VRSK','HON',
]

export const FALLBACK_NYSE_STOCKS = [
  'BRK-B','JPM','V','JNJ','XOM','WMT','PG','MA','HD','CVX',
  'MRK','ABBV','PFE','BAC','KO','PEP','TMO','MCD','ABT','ACN',
  'CRM','DHR','LIN','NKE','PM','UPS','RTX','BA','LMT','GE',
  'CAT','MMM','IBM','GS','MS','C','WFC','USB','AXP','BLK',
  'SCHW','CME','ICE','NEE','DUK','SO','AEP','EXC','SRE','D',
  'AMT','PLD','CCI','EQIX','PSA','EQR','AVB','SPG','LLY','BMY',
  'AMGN','REGN','MRNA','VRTX','HUM','CI','CVS','MCK','MDT','SYK',
  'BSX','BDX','BAX','HOLX','EW','DE','CNH','AGCO','CF','NTR',
  'ADM','BG','TSN','GM','F','T','VZ','DIS','PARA','WBD',
  'GD','NOC','LHX','TDG','HII','FCX','NEM','SHW','PPG','ECL',
  'APD','ROK','ETN','EMR','PH','ITW','CARR','OTIS','SPGI','MCO',
]

// US_ETF — NASDAQ_ETF + NYSE_ETF 폴백을 통합
export const FALLBACK_US_ETF = [
  // NASDAQ 계열
  'QQQ','QQQM','TQQQ','SQQQ','SMH','SOXX','SOXL','SOXS',
  'TLT','IEF','SHY','BND','ARKK','ARKW','ARKG',
  'IBIT','UVXY','VIXY','JEPQ','DVY','HYG','LQD',
  // NYSE/기타
  'SPY','VOO','IVV','VTI','SPXL','SPXS','SSO','SDS','IWM','DIA',
  'XLK','XLF','XLV','XLE','XLI','XLY','XLP','XLB','XLU','XLRE',
  'GLD','IAU','SLV','USO','AGG','SCHD','VIG','VYM','JEPI','XYLD',
  'QYLD','TMF','TMV','EWY','MCHI','FXI','EWJ','VEA','VWO','EEM',
  'GBTC','FBTC','BITB','SH','PSQ','BOIL',
]

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────

async function quoteBatch(tickers, batchSize = 10) {
  const results = []
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map(sym => yf.quote(sym).catch(() => null))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }
  return results
}

// ── 공개 API ─────────────────────────────────────────────────────────────

/**
 * NYSE 또는 NASDAQ 개별 주식 수집
 * @param {'NYSE'|'NASDAQ'} targetExchange
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchYahooStocks(targetExchange) {
  const stockMap = new Map()
  const isNasdaq = targetExchange === 'NASDAQ'
  const validCodes = isNasdaq ? NASDAQ_CODES : NYSE_CODES

  // 1단계: screener 조회
  for (const screenerId of STOCK_SCREENERS) {
    try {
      const result = await yf.screener(screenerId)
      for (const q of (result?.quotes || [])) {
        if (!q.symbol) continue
        if (q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND') continue
        const exch = (q.exchange || '').toUpperCase()
        if (!validCodes.has(exch) || stockMap.has(q.symbol)) continue
        stockMap.set(q.symbol, fromYahoo(q, targetExchange))
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.warn(`[StockMaster] Yahoo screener(${screenerId}) 실패:`, err.message)
    }
  }

  // 2단계: 폴백 티커 직접 quote 조회 (누락 보완)
  const fallback = isNasdaq ? FALLBACK_NASDAQ_STOCKS : FALLBACK_NYSE_STOCKS
  const missing  = fallback.filter(t => !stockMap.has(t))
  const quotes   = await quoteBatch(missing)

  for (const q of quotes) {
    if (!q.symbol || q.quoteType === 'ETF' || stockMap.has(q.symbol)) continue
    stockMap.set(q.symbol, fromYahoo(q, targetExchange))
  }

  const rows = Array.from(stockMap.values())
  console.log(`[StockMaster] Yahoo ${targetExchange} 주식: ${rows.length}개 수집`)
  return rows
}

/**
 * 미국 ETF 수집 (NASDAQ_ETF + NYSE_ETF → exchange=US_ETF 통합)
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchUsEtf() {
  const quotes = await quoteBatch(FALLBACK_US_ETF)
  const rows = []
  const seen = new Set()

  for (const q of quotes) {
    if (!q.symbol || seen.has(q.symbol)) continue
    seen.add(q.symbol)
    rows.push(fromYahoo(q, 'US_ETF'))
  }

  console.log(`[StockMaster] US_ETF: ${rows.length}개 수집`)
  return rows
}
