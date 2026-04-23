// 종목 DB 업데이트 핸들러
// KOSPI/KOSDAQ : DART list.json (corp_cls=Y/K, 사업보고서 기준)
// KRX ETF      : 네이버 PC etfItemList API
// NASDAQ/NYSE  : yahoo-finance2 screener(주식) + 폴백 티커 quote
// NASDAQ ETF / NYSE ETF : yahoo-finance2 quote (폴백 티커 목록)
// 엔드포인트: GET /api/stock-update?market=KOSPI|KOSDAQ|KRX_ETF|NASDAQ|NYSE|NASDAQ_ETF|NYSE_ETF|ALL

import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { loadEnv } from 'vite'
import YahooFinanceClass from 'yahoo-finance2'

const inflateRaw = promisify(zlib.inflateRaw)
const yf = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

const NAVER_PC_BASE = 'https://finance.naver.com'
const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://finance.naver.com',
  'Accept': 'application/json, text/plain',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

// ── ZIP 파싱 유틸 (Central Directory 기반, Data Descriptor 대응) ───────────
async function extractFirstFileFromZip(buffer) {
  let eocdPos = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer[i]===0x50 && buffer[i+1]===0x4B &&
        buffer[i+2]===0x05 && buffer[i+3]===0x06) {
      eocdPos = i; break
    }
  }
  if (eocdPos === -1) throw new Error('ZIP EOCD 시그니처를 찾을 수 없습니다')
  const cdOffset = buffer.readUInt32LE(eocdPos + 16)
  if (buffer[cdOffset]!==0x50 || buffer[cdOffset+1]!==0x4B ||
      buffer[cdOffset+2]!==0x01 || buffer[cdOffset+3]!==0x02)
    throw new Error('Central Directory 엔트리를 찾을 수 없습니다')

  const compression    = buffer.readUInt16LE(cdOffset + 10)
  const compSize       = buffer.readUInt32LE(cdOffset + 20)
  const localHdrOffset = buffer.readUInt32LE(cdOffset + 42)
  const localNameLen   = buffer.readUInt16LE(localHdrOffset + 26)
  const localExtraLen  = buffer.readUInt16LE(localHdrOffset + 28)
  const dataStart      = localHdrOffset + 30 + localNameLen + localExtraLen
  const compressed     = buffer.slice(dataStart, dataStart + compSize)
  if (compression === 0) return compressed
  if (compression === 8) return inflateRaw(compressed)
  throw new Error(`지원하지 않는 ZIP 압축 방식: ${compression}`)
}

// ── DART list.json — KOSPI/KOSDAQ 분리 (corp_cls=Y/K) ───────────────────────
// list.json에는 corp_cls(Y=KOSPI, K=KOSDAQ)와 corp_code가 모두 포함
// 제약: corp_code 미지정 시 조회기간 최대 89일(3개월 미만)
// 해결: 89일 구간 4개로 나눠 약 1년치 공시에서 종목 수집 → 전체 상장사 커버
async function fetchDartListByCls(dartApiKey, corpCls) {
  if (!dartApiKey) throw new Error('DART_API_KEY 미설정 — .env 파일을 확인하세요')

  const exchange   = corpCls === 'Y' ? 'KOSPI' : 'KOSDAQ'
  const stockMap   = new Map()  // stock_code → stock 객체
  const PAGE_COUNT = 100
  const WINDOW_MS  = 89 * 86_400_000  // 89일 (3개월 제한 안전마진)
  const now        = Date.now()

  // 4개 구간 × 89일 ≈ 1년 (연·분기·반기 보고서 모두 포함)
  for (let w = 0; w < 4; w++) {
    const endMs     = now - w * WINDOW_MS
    const startMs   = endMs - WINDOW_MS
    const endDate   = new Date(endMs).toISOString().slice(0, 10).replace(/-/g, '')
    const startDate = new Date(startMs).toISOString().slice(0, 10).replace(/-/g, '')

    let page = 1
    while (true) {
      // pblntf_ty=A: 사업보고서(연간) — 기업당 연 1회 제출 → 페이지 수 최소화
      // 4구간 × 89일 = 1년 커버 → 전체 상장사 사업보고서 누락 없음
      const url =
        `https://opendart.fss.or.kr/api/list.json` +
        `?crtfc_key=${dartApiKey}` +
        `&corp_cls=${corpCls}` +
        `&pblntf_ty=A` +
        `&bgn_de=${startDate}` +
        `&end_de=${endDate}` +
        `&page_no=${page}` +
        `&page_count=${PAGE_COUNT}`

      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`DART list.json HTTP ${res.status}`)
      const json = await res.json()

      if (json.status === '013') break  // 조회 데이터 없음 (정상 종료)
      if (json.status !== '000')
        throw new Error(`DART list.json 오류 [${json.status}]: ${json.message}`)

      for (const item of (json.list || [])) {
        const code = item.stock_code?.trim()
        if (!code || !/^\d{6}$/.test(code) || stockMap.has(code)) continue
        stockMap.set(code, {
          ticker:    code,
          name:      item.corp_name?.trim() || '',
          corp_code: item.corp_code?.trim() || '',
          market:    'KRX',
          exchange,
          type:      'EQUITY',
          sector:    '',
        })
      }

      const total = parseInt(json.total_count || '0', 10)
      const totalPages = Math.ceil(total / PAGE_COUNT)
      console.log(`[StockUpdate] DART ${exchange} 구간${w+1}/4 p${page}/${totalPages} — 누적 ${stockMap.size}개`)

      if (page >= totalPages || (json.list || []).length < PAGE_COUNT) break
      page++
      await new Promise(r => setTimeout(r, 250))  // rate limit 보호
    }
  }

  console.log(`[StockUpdate] DART ${exchange} 최종: ${stockMap.size}개`)
  return Array.from(stockMap.values())
}

// ── 네이버 PC API — KRX ETF 목록 ─────────────────────────────────────────
async function fetchNaverEtfList() {
  const stocks = []
  const PAGE_SIZE = 100

  for (let page = 1; page <= 20; page++) {
    const url = `${NAVER_PC_BASE}/api/sise/etfItemList.nhn?etfType=0&sosok=0&page=${page}&pageSize=${PAGE_SIZE}`
    try {
      const res = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const items = json.result?.etfItemList || json.etfItemList || []
      if (items.length === 0) break
      for (const item of items) {
        const ticker = item.itemcode || item.itemCode || ''
        const name   = item.itemname || item.itemName || ''
        if (ticker && name)
          stocks.push({ ticker, name, market: 'KRX', exchange: 'ETF', type: 'ETF', sector: 'ETF' })
      }
      if (items.length < PAGE_SIZE) break
    } catch (err) {
      console.warn(`[StockUpdate] 네이버 ETF p${page} 실패:`, err.message)
      break
    }
  }

  if (stocks.length === 0) {
    try {
      const res = await fetch('https://m.stock.naver.com/api/stocks?category=ETF&pageSize=100&page=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        for (const item of ((await res.json()).stocks || [])) {
          const ticker = item.itemCode || item.stockCode || ''
          const name   = item.itemName || item.stockName || ''
          if (ticker && name)
            stocks.push({ ticker, name, market: 'KRX', exchange: 'ETF', type: 'ETF', sector: 'ETF' })
        }
      }
    } catch { /* 무시 */ }
  }

  return stocks
}

// ── Yahoo Finance screener — 미국 개별 주식 (NASDAQ / NYSE) ──────────────
const STOCK_SCREENERS = [
  'most_actives', 'day_gainers', 'day_losers',
  'growth_technology_stocks', 'undervalued_growth_stocks',
  'undervalued_large_caps', 'aggressive_small_caps', 'small_cap_gainers',
]

const NASDAQ_CODES = new Set(['NMS', 'NGM', 'NCM', 'NAS'])
const NYSE_CODES   = new Set(['NYQ', 'NYE'])

const FALLBACK_NASDAQ_STOCKS = [
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

const FALLBACK_NYSE_STOCKS = [
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

async function fetchYahooStocks(targetExchange) {
  const stockMap = new Map()
  const isNasdaq = targetExchange === 'NASDAQ'

  // 1단계: 여러 screener 조회 후 exchange 필터
  for (const screenerId of STOCK_SCREENERS) {
    try {
      const result = await yf.screener(screenerId)
      for (const q of (result?.quotes || [])) {
        if (!q.symbol || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND') continue
        const exch = (q.exchange || '').toUpperCase()
        const belongs = isNasdaq ? NASDAQ_CODES.has(exch) : NYSE_CODES.has(exch)
        if (!belongs || stockMap.has(q.symbol)) continue
        stockMap.set(q.symbol, {
          ticker:   q.symbol,
          name:     q.shortName || q.longName || q.symbol,
          market:   targetExchange,
          exchange: targetExchange,
          type:     'EQUITY',
          sector:   q.sector || '',
        })
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.warn(`[StockUpdate] Yahoo screener(${screenerId}) 실패:`, err.message)
    }
  }

  // 2단계: 폴백 티커 직접 quote 조회 (screener 누락 보완)
  const fallback = isNasdaq ? FALLBACK_NASDAQ_STOCKS : FALLBACK_NYSE_STOCKS
  const missing  = fallback.filter(t => !stockMap.has(t))
  const BATCH    = 10

  for (let i = 0; i < missing.length; i += BATCH) {
    const settled = await Promise.allSettled(
      missing.slice(i, i + BATCH).map(sym => yf.quote(sym).catch(() => null))
    )
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value) continue
      const q = r.value
      if (!q.symbol || q.quoteType === 'ETF' || stockMap.has(q.symbol)) continue
      stockMap.set(q.symbol, {
        ticker:   q.symbol,
        name:     q.shortName || q.longName || q.symbol,
        market:   targetExchange,
        exchange: targetExchange,
        type:     'EQUITY',
        sector:   q.sector || '',
      })
    }
  }

  console.log(`[StockUpdate] Yahoo ${targetExchange} 주식: ${stockMap.size}개 수집`)
  return Array.from(stockMap.values())
}

// ── Yahoo Finance — 미국 ETF (폴백 티커 quote) ───────────────────────────
const FALLBACK_ETF_TICKERS = {
  NASDAQ_ETF: [
    'QQQ','QQQM','TQQQ','SQQQ','SMH','SOXX','SOXL','SOXS',
    'TLT','IEF','SHY','BND','ARKK','ARKW','ARKG',
    'IBIT','UVXY','VIXY','JEPQ','DVY','HYG','LQD',
  ],
  NYSE_ETF: [
    'SPY','VOO','IVV','VTI','SPXL','SPXS','SSO','SDS','IWM','DIA',
    'XLK','XLF','XLV','XLE','XLI','XLY','XLP','XLB','XLU','XLRE',
    'GLD','IAU','SLV','USO','AGG','SCHD','VIG','VYM','JEPI','XYLD',
    'QYLD','TMF','TMV','EWY','MCHI','FXI','EWJ','VEA','VWO','EEM',
    'GBTC','FBTC','BITB','SH','PSQ','BOIL',
  ],
}

async function fetchYahooEtfByTickers(marketKey) {
  const market  = marketKey === 'NASDAQ_ETF' ? 'NASDAQ' : 'NYSE'
  const tickers = FALLBACK_ETF_TICKERS[marketKey] || []
  const results = []
  const BATCH   = 10
  for (let i = 0; i < tickers.length; i += BATCH) {
    const settled = await Promise.allSettled(
      tickers.slice(i, i + BATCH).map(sym => yf.quote(sym).catch(() => null))
    )
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value) continue
      const q = r.value
      if (!q.symbol) continue
      results.push({
        ticker: q.symbol, name: q.shortName || q.longName || q.symbol,
        market, exchange: market, type: 'ETF', sector: 'ETF',
      })
    }
  }
  return results.filter(s => s.ticker && s.name)
}

// ── 시장별 라우팅 ──────────────────────────────────────────────────────────
export async function fetchByMarket(market, dartApiKey) {
  switch (market) {
    case 'KOSPI':      return fetchDartListByCls(dartApiKey, 'Y')
    case 'KOSDAQ':     return fetchDartListByCls(dartApiKey, 'K')
    case 'KRX_ETF':   return fetchNaverEtfList()
    case 'NASDAQ':     return fetchYahooStocks('NASDAQ')
    case 'NYSE':       return fetchYahooStocks('NYSE')
    case 'NASDAQ_ETF': return fetchYahooEtfByTickers('NASDAQ_ETF')
    case 'NYSE_ETF':   return fetchYahooEtfByTickers('NYSE_ETF')
    default: throw new Error(`알 수 없는 market: ${market}`)
  }
}

// ── Vite 미들웨어 엔트리 ───────────────────────────────────────────────────
export async function handleStockUpdate(req, res) {
  const env        = loadEnv('development', process.cwd(), '')
  const dartApiKey = env.DART_API_KEY || ''

  const url    = new URL(req.url, 'http://localhost')
  const market = url.searchParams.get('market') || 'ALL'

  const markets = market === 'ALL'
    ? ['KOSPI', 'KOSDAQ', 'KRX_ETF', 'NASDAQ', 'NYSE', 'NASDAQ_ETF', 'NYSE_ETF']
    : [market]

  const result = {}
  const errors = {}

  // KOSPI/KOSDAQ: DART API rate limit 때문에 순차 실행
  const krxMarkets   = markets.filter(m => m === 'KOSPI' || m === 'KOSDAQ')
  const otherMarkets = markets.filter(m => m !== 'KOSPI' && m !== 'KOSDAQ')

  for (const m of krxMarkets) {
    try {
      result[m] = await fetchByMarket(m, dartApiKey)
      console.log(`[StockUpdate] ${m}: ${result[m].length}개 수집`)
    } catch (err) {
      console.error(`[StockUpdate] ${m} 실패:`, err.message)
      errors[m] = err.message
      result[m] = []
    }
    console.log(`[StockUpdate] 완료 — 총 ${result[m]?.length ?? 0}개`)
  }

  await Promise.allSettled(
    otherMarkets.map(async (m) => {
      try {
        result[m] = await fetchByMarket(m, dartApiKey)
        console.log(`[StockUpdate] ${m}: ${result[m].length}개 수집`)
      } catch (err) {
        console.error(`[StockUpdate] ${m} 실패:`, err.message)
        errors[m] = err.message
        result[m] = []
      }
      console.log(`[StockUpdate] 완료 — 총 ${result[m]?.length ?? 0}개`)
    })
  )

  const total = Object.values(result).reduce((s, arr) => s + arr.length, 0)
  console.log(`[StockUpdate] 전체 완료 — 총 ${total}개`)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ result, errors, total, updatedAt: new Date().toISOString() }))
}
