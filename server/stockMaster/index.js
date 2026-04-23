/**
 * index.js — /api/stock-master 라우터 + HTTP 핸들러
 *
 * 엔드포인트:
 *   GET /api/stock-master?exchange=KOSPI|KOSDAQ|NXT|KRX_ETF|NYSE|NASDAQ|US_ETF
 *   GET /api/stock-master?category=DOMESTIC|OVERSEAS|ALL
 *   GET /api/stock-master/manifest  — 카운트 / last-modified 요약 (rows 없음)
 *
 * 응답 포맷 (exchange 단위):
 *   { exchange, category, rows, count, errors, collectedAt, durationMs }
 *
 * 수집 전략 (Sprint 7.3):
 *   KOSPI/KOSDAQ : DART API → NXT tradableOn 병합
 *   NXT          : KOSPI+KOSDAQ 전체 rows에서 NXT 플래그가 있는 종목만 반환
 *   KRX_ETF      : 네이버 PC API + 모바일 폴백
 *   NYSE/NASDAQ  : NASDAQ Trader FTP → Yahoo screener/quote 부스트
 *   US_ETF       : NASDAQ Trader ETF=Y → FALLBACK_US_ETF quote 보완
 *
 * 설계 원칙:
 *   · 에러 시 5xx 대신 200 + errors 배열 (UI 복원력 확보)
 *   · 기존 /api/stock-update 엔드포인트는 하위호환 유지 (stockUpdateHandler.js)
 */
import { loadEnv } from 'vite'
import { fetchDartListByCls } from './dart.js'
import { fetchKrxEtfList }   from './krxEtf.js'
import { fetchYahooStocks, fetchUsEtf, FALLBACK_NASDAQ_STOCKS, FALLBACK_NYSE_STOCKS, FALLBACK_US_ETF } from './yahooUs.js'
import { categoryOf } from './normalize.js'
import { fetchNxtTradableSet, mergeNxtFlags } from './nxt.js'
import { fetchAllFromNasdaqTrader } from './nasdaqTrader.js'

const DOMESTIC_EXCHANGES = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF']
const OVERSEAS_EXCHANGES = ['NYSE', 'NASDAQ', 'US_ETF']
const ALL_EXCHANGES      = [...DOMESTIC_EXCHANGES, ...OVERSEAS_EXCHANGES]

/** category 파라미터 → exchange 목록 */
function exchangesForCategory(category) {
  if (category === 'DOMESTIC') return DOMESTIC_EXCHANGES
  if (category === 'OVERSEAS') return OVERSEAS_EXCHANGES
  return ALL_EXCHANGES
}

// ── 캐시: 동일 요청 반복 시 중복 수집 방지 ────────────────────────────────
// (프로세스 생존 기간 동안만 유효, 개발 서버 재시작 시 초기화)
const cache = new Map()  // exchange → { rows, collectedAt, durationMs }
const CACHE_TTL_MS = 30 * 60 * 1000  // 30분

function getCached(exchange) {
  const hit = cache.get(exchange)
  if (!hit) return null
  if (Date.now() - new Date(hit.collectedAt).getTime() > CACHE_TTL_MS) {
    cache.delete(exchange)
    return null
  }
  return hit
}

function setCached(exchange, data) {
  cache.set(exchange, data)
}

// ── 수집기 ────────────────────────────────────────────────────────────────

/**
 * KOSPI 또는 KOSDAQ 수집 + NXT 플래그 병합
 * @param {'KOSPI'|'KOSDAQ'} exchange
 * @param {string} dartKey
 * @returns {Promise<StockMasterRow[]>}
 */
async function fetchKrxWithNxt(exchange, dartKey) {
  const corpCls = exchange === 'KOSPI' ? 'Y' : 'K'
  const dartRows = await fetchDartListByCls(dartKey, corpCls)

  // NXT 플래그 병합 (실패해도 DART 결과는 반환)
  try {
    const nxtSet = await fetchNxtTradableSet()
    return mergeNxtFlags(dartRows, nxtSet)
  } catch (err) {
    console.warn('[StockMaster] NXT 플래그 병합 실패, DART 결과만 반환:', err.message)
    return dartRows
  }
}

/**
 * NXT 전용 수집: KOSPI + KOSDAQ 캐시 결과(NXT 플래그 포함)에서 NXT 종목만 필터
 *
 * collectExchange('KOSPI'/'KOSDAQ')를 통해 캐시를 재사용합니다.
 * fetchKrxWithNxt()가 이미 NXT 플래그를 병합했으므로 별도 nxtSet 조회 불필요.
 *
 * @param {string} dartKey
 */
async function fetchNxtOnly(dartKey) {
  // 캐시된 KOSPI/KOSDAQ 결과 재사용 (이미 fetchKrxWithNxt에서 NXT 플래그 병합됨)
  const [kospiResult, kosdaqResult] = await Promise.all([
    collectExchange('KOSPI', dartKey),
    collectExchange('KOSDAQ', dartKey),
  ])

  const allRows = [
    ...(kospiResult.rows || []),
    ...(kosdaqResult.rows || []),
  ]

  // NXT tradableOn이 있는 종목만 필터 + exchange를 NXT로 변경
  const nxtRows = allRows
    .filter(r => r.tradableOn?.includes('NXT'))
    .map(r => ({
      ...r,
      exchange: 'NXT',
      category: 'DOMESTIC',
      // id는 NXT exchange 기준으로 재생성
      id: `DOMESTIC:NXT:${r.ticker}`,
    }))

  console.log(`[StockMaster] NXT: ${nxtRows.length}개 종목`)
  return nxtRows
}

/**
 * NYSE 또는 NASDAQ 수집: NASDAQ Trader → Yahoo 부스트
 * @param {'NYSE'|'NASDAQ'} targetExchange
 */
async function fetchUsStocks(targetExchange) {
  let rows = []
  const errors = []

  // 1차: NASDAQ Trader FTP (전체 목록)
  try {
    const { nasdaq, nyse } = await fetchAllFromNasdaqTrader()
    rows = targetExchange === 'NASDAQ' ? nasdaq : nyse
    console.log(`[StockMaster] NASDAQ Trader ${targetExchange}: ${rows.length}개`)
  } catch (err) {
    console.warn(`[StockMaster] NASDAQ Trader ${targetExchange} 실패:`, err.message)
    errors.push(err.message)
  }

  // 2차: Yahoo screener/quote 부스트 (누락 보완 또는 폴백)
  try {
    const yahooRows = await fetchYahooStocks(targetExchange)
    if (rows.length === 0) {
      // NASDAQ Trader 완전 실패 → Yahoo 전체 사용
      rows = yahooRows
    } else {
      // Yahoo 결과 중 NASDAQ Trader에 없는 종목 병합
      const existing = new Set(rows.map(r => r.ticker))
      const boost = yahooRows.filter(r => !existing.has(r.ticker))
      if (boost.length > 0) {
        rows = [...rows, ...boost]
        console.log(`[StockMaster] Yahoo 부스트 ${targetExchange}: +${boost.length}개`)
      }
    }
  } catch (err) {
    console.warn(`[StockMaster] Yahoo 부스트 ${targetExchange} 실패:`, err.message)
    if (rows.length === 0) errors.push(`Yahoo fallback: ${err.message}`)
  }

  if (rows.length === 0) throw new Error(errors.join('; '))
  return rows
}

/**
 * US_ETF 수집: NASDAQ Trader ETF=Y → FALLBACK quote 보완
 */
async function fetchUsEtfStocks() {
  let rows = []

  // 1차: NASDAQ Trader ETF=Y
  try {
    const { usEtf } = await fetchAllFromNasdaqTrader()
    rows = usEtf
    console.log(`[StockMaster] NASDAQ Trader US_ETF: ${rows.length}개`)
  } catch (err) {
    console.warn('[StockMaster] NASDAQ Trader US_ETF 실패:', err.message)
  }

  // 2차: FALLBACK_US_ETF quote (누락 보완)
  try {
    const yahooEtf = await fetchUsEtf()
    const existing = new Set(rows.map(r => r.ticker))
    const boost = yahooEtf.filter(r => !existing.has(r.ticker))
    if (boost.length > 0) {
      rows = [...rows, ...boost]
      console.log(`[StockMaster] Yahoo ETF 부스트: +${boost.length}개`)
    }
  } catch (err) {
    console.warn('[StockMaster] Yahoo ETF 부스트 실패:', err.message)
    if (rows.length === 0) {
      // 완전 폴백
      rows = await fetchUsEtf()
    }
  }

  return rows
}

// exchange → 수집 함수 매핑
const FETCHER_MAP = {
  KOSPI:   (dartKey) => fetchKrxWithNxt('KOSPI', dartKey),
  KOSDAQ:  (dartKey) => fetchKrxWithNxt('KOSDAQ', dartKey),
  NXT:     (dartKey) => fetchNxtOnly(dartKey),
  KRX_ETF: ()        => fetchKrxEtfList(),
  NYSE:    ()        => fetchUsStocks('NYSE'),
  NASDAQ:  ()        => fetchUsStocks('NASDAQ'),
  US_ETF:  ()        => fetchUsEtfStocks(),
}

/**
 * 단일 exchange 수집 실행 (캐시 우선)
 * @returns {{ exchange, category, rows, count, errors, collectedAt, durationMs }}
 */
async function collectExchange(exchange, dartKey) {
  // 캐시 히트
  const cached = getCached(exchange)
  if (cached) {
    console.log(`[StockMaster] ${exchange} 캐시 사용 (${cached.count}개)`)
    return { ...cached, exchange, category: categoryOf(exchange) }
  }

  const start    = Date.now()
  const category = categoryOf(exchange)
  const errors   = []
  let rows       = []

  const fetcher = FETCHER_MAP[exchange]
  if (!fetcher) {
    errors.push(`알 수 없는 exchange: ${exchange}`)
  } else {
    try {
      rows = await fetcher(dartKey)
    } catch (err) {
      console.error(`[StockMaster] ${exchange} 수집 실패:`, err.message)
      errors.push(err.message)
    }
  }

  const result = {
    exchange,
    category,
    rows,
    count:       rows.length,
    errors,
    collectedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
  }

  if (errors.length === 0 && rows.length > 0) {
    setCached(exchange, result)
  }

  return result
}

/**
 * manifest — 각 exchange 의 예상 카운트만 반환 (rows 없음)
 * 캐시에 데이터가 있으면 실제 count, 없으면 0
 */
function buildManifest() {
  const manifest = {}
  for (const ex of ALL_EXCHANGES) {
    const cached = cache.get(ex)
    manifest[ex] = {
      exchange: ex,
      category: categoryOf(ex),
      count: cached?.count ?? 0,
      collectedAt: cached?.collectedAt ?? null,
    }
  }
  return manifest
}

/**
 * Vite 미들웨어 핸들러: /api/stock-master 및 /api/stock-master/manifest
 */
export async function handleStockMaster(req, res) {
  const env     = loadEnv('development', process.cwd(), '')
  const dartKey = env.DART_API_KEY || ''

  const rawUrl = req.url || ''
  const urlObj = new URL(rawUrl, 'http://localhost')

  // ── /api/stock-master/manifest ──────────────────────────────────────────
  if (rawUrl.startsWith('/api/stock-master/manifest')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      manifest: buildManifest(),
      generatedAt: new Date().toISOString(),
    }))
  }

  // ── /api/stock-master?exchange=... ──────────────────────────────────────
  const exchangeParam = urlObj.searchParams.get('exchange')
  const categoryParam = urlObj.searchParams.get('category')

  // exchange 단일 지정
  if (exchangeParam) {
    const exchange = exchangeParam.toUpperCase()
    if (!FETCHER_MAP[exchange]) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        exchange, category: null, rows: [], count: 0,
        errors: [`지원하지 않는 exchange: ${exchange}`],
        collectedAt: new Date().toISOString(), durationMs: 0,
      }))
    }

    const result = await collectExchange(exchange, dartKey)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(result))
  }

  // category 단위 또는 전체
  const category  = (categoryParam || 'ALL').toUpperCase()
  const exchanges = exchangesForCategory(category)

  const results   = {}
  const allErrors = {}
  let totalRows   = 0

  // KOSPI/KOSDAQ 는 순차 실행 (DART rate limit), NXT는 자체적으로 KOSPI+KOSDAQ 호출하므로 별도 병렬
  const krxSeq = exchanges.filter(e => e === 'KOSPI' || e === 'KOSDAQ')
  const other  = exchanges.filter(e => !krxSeq.includes(e))

  for (const ex of krxSeq) {
    const r = await collectExchange(ex, dartKey)
    results[ex] = r
    if (r.errors.length) allErrors[ex] = r.errors
    totalRows += r.count
  }

  // 나머지는 병렬 실행 (NXT, KRX_ETF, NYSE, NASDAQ, US_ETF)
  await Promise.allSettled(
    other.map(async ex => {
      const r = await collectExchange(ex, dartKey)
      results[ex] = r
      if (r.errors.length) allErrors[ex] = r.errors
      totalRows += r.count
    })
  )

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    category,
    exchanges: results,
    totalCount: totalRows,
    errors: allErrors,
    collectedAt: new Date().toISOString(),
  }))
}
