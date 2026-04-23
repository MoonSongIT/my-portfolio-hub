/**
 * normalize.js — 각 소스의 raw 데이터 → StockMasterRow 통일 매핑
 *
 * 각 수집기(dart/krxEtf/yahooUs)는 고유 포맷을 반환하고,
 * 이 모듈에서 StockMasterRow 스키마로 정규화합니다.
 */

/** exchange → category 매핑 (클라이언트 stockMasterDb.js 와 동일 로직) */
const DOMESTIC_EXCHANGES = new Set(['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF'])

export function categoryOf(exchange) {
  return DOMESTIC_EXCHANGES.has(exchange) ? 'DOMESTIC' : 'OVERSEAS'
}

/** 복합 PK 생성 */
export function makeId(category, exchange, ticker) {
  return `${category}:${exchange}:${ticker}`
}

/** 공통 기본값 적용 */
function base(exchange, extra = {}) {
  const category = categoryOf(exchange)
  const now = new Date().toISOString()
  return {
    category,
    exchange,
    isCustom:    false,
    isActive:    true,
    firstSeenAt: now,
    updatedAt:   now,
    ...extra,
  }
}

// ── DART → StockMasterRow ──────────────────────────────────────────────────

/**
 * DART list.json 항목 → StockMasterRow
 * @param {{ stock_code: string, corp_name: string, corp_code: string }} item
 * @param {'Y'|'K'} corpCls - Y=KOSPI, K=KOSDAQ
 * @returns {import('../../src/utils/stockMasterDb').StockMasterRow}
 */
export function fromDart(item, corpCls) {
  const exchange = corpCls === 'Y' ? 'KOSPI' : 'KOSDAQ'
  const ticker   = item.stock_code?.trim() || ''
  const category = 'DOMESTIC'
  return {
    ...base(exchange),
    id:         makeId(category, exchange, ticker),
    ticker,
    name:       item.corp_name?.trim() || ticker,
    category,
    exchange,
    type:       'EQUITY',
    country:    'KR',
    currency:   'KRW',
    corpCode:   item.corp_code?.trim() || undefined,
    tradableOn: [exchange],
    source:     'DART',
  }
}

// ── 네이버 ETF → StockMasterRow ───────────────────────────────────────────

/**
 * 네이버 etfItemList 항목 → StockMasterRow
 * @param {{ itemcode: string, itemname: string }} item
 */
export function fromNaverEtf(item) {
  const ticker   = (item.itemcode || item.itemCode || '').trim()
  const name     = (item.itemname || item.itemName || '').trim()
  const exchange = 'KRX_ETF'
  const category = 'DOMESTIC'
  return {
    ...base(exchange),
    id:         makeId(category, exchange, ticker),
    ticker,
    name,
    category,
    exchange,
    type:       'ETF',
    country:    'KR',
    currency:   'KRW',
    sector:     'ETF',
    tradableOn: ['KRX_ETF'],
    source:     'NAVER',
  }
}

// ── Yahoo Finance → StockMasterRow ────────────────────────────────────────

/**
 * Yahoo Finance quote 객체 → StockMasterRow
 * @param {object} quote - yahoo-finance2 quote 결과
 * @param {'NYSE'|'NASDAQ'|'US_ETF'} targetExchange
 */
export function fromYahoo(quote, targetExchange) {
  const ticker   = (quote.symbol || '').trim()
  const category = 'OVERSEAS'
  const isEtf    = targetExchange === 'US_ETF' || quote.quoteType === 'ETF'
  const exchange = isEtf ? 'US_ETF' : targetExchange
  return {
    ...base(exchange),
    id:         makeId(category, exchange, ticker),
    ticker,
    name:       quote.shortName || quote.longName || ticker,
    category,
    exchange,
    type:       isEtf ? 'ETF' : 'EQUITY',
    country:    'US',
    currency:   'USD',
    sector:     quote.sector || (isEtf ? 'ETF' : undefined),
    tradableOn: [exchange],
    source:     'YAHOO',
  }
}

/**
 * NASDAQ Trader 파일 행 → StockMasterRow (Sprint 7.3 용, 여기서 시그니처만 정의)
 * @param {{ symbol: string, securityName: string, etf: string }} row
 * @param {'NYSE'|'NASDAQ'|'AMEX'} rawExchange
 */
export function fromNasdaqTrader(row, rawExchange) {
  const ticker   = (row.symbol || '').trim()
  const isEtf    = (row.etf || '').toUpperCase() === 'Y'
  const exchange = isEtf ? 'US_ETF' : rawExchange
  const category = 'OVERSEAS'
  return {
    ...base(exchange),
    id:         makeId(category, exchange, ticker),
    ticker,
    name:       (row.securityName || ticker).trim(),
    category,
    exchange,
    type:       isEtf ? 'ETF' : 'EQUITY',
    country:    'US',
    currency:   'USD',
    tradableOn: [exchange],
    source:     'SEC',
  }
}
