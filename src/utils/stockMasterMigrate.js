/**
 * 기존 LocalStorage(stockDbStore, key='stock-db-v1') →
 * IndexedDB(StockMasterDB) 마이그레이션
 *
 * 실행 조건:
 *   1) 'stock-db-v1-migrated' 플래그 미설정 (첫 실행)
 *   2) localStorage에 'stock-db-v1' 존재
 *   3) StockMasterDB.stocks 테이블이 비어있음
 *
 * 성공 시: 'stock-db-v1-migrated' 에 ISO 타임스탬프 저장
 * 실패 시: 오류 throw → App.jsx 에서 catch 후 사용자 알림
 */
import { stockMasterDb, makeId, categoryOf } from './stockMasterDb'

const LEGACY_KEY   = 'stock-db-v1'
const MIGRATED_FLAG = 'stock-db-v1-migrated'

/** 기존 market 키 → exchange 정규화 */
function normalizeExchange(market) {
  const map = {
    KOSPI:      'KOSPI',
    KOSDAQ:     'KOSDAQ',
    KRX_ETF:    'KRX_ETF',
    NASDAQ:     'NASDAQ',
    NYSE:       'NYSE',
    NASDAQ_ETF: 'US_ETF',
    NYSE_ETF:   'US_ETF',
    US_ETF:     'US_ETF',
    AMEX:       'AMEX',
  }
  return map[market] || null
}

/** 단일 legacy stock 객체 → StockMasterRow */
function convertRow(s, exchange, category, now) {
  return {
    id:          makeId({ category, exchange, ticker: s.ticker }),
    ticker:      s.ticker,
    name:        s.name || s.corp_name || s.ticker,
    nameEn:      s.nameEn || undefined,
    category,
    exchange,
    type:        s.type || (exchange.includes('ETF') ? 'ETF' : 'EQUITY'),
    country:     category === 'DOMESTIC' ? 'KR' : 'US',
    currency:    category === 'DOMESTIC' ? 'KRW' : 'USD',
    sector:      s.sector || undefined,
    industry:    s.industry || undefined,
    isin:        s.isin || undefined,
    corpCode:    s.corp_code || s.corpCode || undefined,
    tradableOn:  s.tradableOn || [exchange],
    isCustom:    s.isCustom ?? false,
    isActive:    true,
    source:      s.source || 'DART',
    firstSeenAt: now,
    updatedAt:   now,
  }
}

/**
 * 마이그레이션 실행
 * @returns {Promise<{ skipped: boolean, migrated: number }>}
 */
export async function migrateFromLegacy() {
  // 이미 마이그레이션 완료
  if (localStorage.getItem(MIGRATED_FLAG)) {
    return { skipped: true, migrated: 0 }
  }

  // 기존 데이터 없음 → 신규 사용자
  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) {
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString())
    return { skipped: true, migrated: 0 }
  }

  let legacy
  try {
    legacy = JSON.parse(raw)
  } catch {
    console.warn('[StockMasterMigrate] localStorage 파싱 실패, 마이그레이션 건너뜀')
    return { skipped: true, migrated: 0 }
  }

  // IDB 가 이미 채워져 있으면 skip (수동 sync 후 재기동 케이스)
  const existingCount = await stockMasterDb.stocks.count()
  if (existingCount > 0) {
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString())
    return { skipped: true, migrated: 0 }
  }

  const stocksByMarket = legacy?.state?.stocksByMarket || {}
  const customStocks   = legacy?.state?.customStocks   || []
  const now = new Date().toISOString()
  const rows = []

  // ── 시장별 종목 변환 ──────────────────────────────────────────────────
  for (const [market, stocks] of Object.entries(stocksByMarket)) {
    if (!Array.isArray(stocks) || stocks.length === 0) continue
    const exchange = normalizeExchange(market)
    if (!exchange) continue
    const category = categoryOf(exchange)

    for (const s of stocks) {
      if (!s.ticker) continue
      rows.push(convertRow(s, exchange, category, now))
    }
  }

  // ── 커스텀 종목 변환 ──────────────────────────────────────────────────
  for (const s of customStocks) {
    if (!s.ticker || !s.exchange) continue
    const exchange = normalizeExchange(s.exchange) || s.exchange
    const category = categoryOf(exchange)
    rows.push({
      ...convertRow(s, exchange, category, now),
      isCustom: true,
      source:   'MANUAL',
    })
  }

  if (rows.length > 0) {
    await stockMasterDb.stocks.bulkPut(rows)
  }

  // 완료 플래그 (LocalStorage 원본은 1주일간 보관 — 자동 제거 없음)
  localStorage.setItem(MIGRATED_FLAG, now)
  console.info(`[StockMasterMigrate] 완료: ${rows.length}개 종목 이전`)

  return { skipped: false, migrated: rows.length }
}
