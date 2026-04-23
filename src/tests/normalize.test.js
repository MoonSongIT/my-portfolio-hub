/**
 * normalize.test.js — server/stockMaster/normalize.js 단위 테스트
 *
 * 각 수집기별 변환 함수의 출력 스냅샷 검증
 * (순수 함수이므로 mock 불필요, Node 환경에서 직접 실행)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  categoryOf,
  makeId,
  fromDart,
  fromNaverEtf,
  fromYahoo,
  fromNasdaqTrader,
} from '../../server/stockMaster/normalize.js'

// ── categoryOf ──────────────────────────────────────────────────────────────

describe('categoryOf', () => {
  it('국내 exchange → DOMESTIC', () => {
    expect(categoryOf('KOSPI')).toBe('DOMESTIC')
    expect(categoryOf('KOSDAQ')).toBe('DOMESTIC')
    expect(categoryOf('NXT')).toBe('DOMESTIC')
    expect(categoryOf('KRX_ETF')).toBe('DOMESTIC')
  })

  it('해외 exchange → OVERSEAS', () => {
    expect(categoryOf('NYSE')).toBe('OVERSEAS')
    expect(categoryOf('NASDAQ')).toBe('OVERSEAS')
    expect(categoryOf('AMEX')).toBe('OVERSEAS')
    expect(categoryOf('US_ETF')).toBe('OVERSEAS')
  })
})

// ── makeId ──────────────────────────────────────────────────────────────────

describe('makeId', () => {
  it('복합 PK 형식 category:exchange:ticker 반환', () => {
    expect(makeId('DOMESTIC', 'KOSPI', '005930')).toBe('DOMESTIC:KOSPI:005930')
    expect(makeId('OVERSEAS', 'NASDAQ', 'AAPL')).toBe('OVERSEAS:NASDAQ:AAPL')
  })
})

// ── fromDart ────────────────────────────────────────────────────────────────

describe('fromDart', () => {
  const dartItem = {
    stock_code: '005930',
    corp_name: '삼성전자',
    corp_code: '00126380',
  }

  it('KOSPI 종목 → 올바른 StockMasterRow 반환', () => {
    const row = fromDart(dartItem, 'Y')
    expect(row.ticker).toBe('005930')
    expect(row.name).toBe('삼성전자')
    expect(row.exchange).toBe('KOSPI')
    expect(row.category).toBe('DOMESTIC')
    expect(row.type).toBe('EQUITY')
    expect(row.country).toBe('KR')
    expect(row.currency).toBe('KRW')
    expect(row.corpCode).toBe('00126380')
    expect(row.source).toBe('DART')
    expect(row.isCustom).toBe(false)
    expect(row.isActive).toBe(true)
    expect(row.tradableOn).toContain('KOSPI')
    expect(row.id).toBe('DOMESTIC:KOSPI:005930')
  })

  it('KOSDAQ 종목 → exchange=KOSDAQ', () => {
    const row = fromDart({ stock_code: '247540', corp_name: '에코프로비엠', corp_code: '01234567' }, 'K')
    expect(row.exchange).toBe('KOSDAQ')
    expect(row.id).toBe('DOMESTIC:KOSDAQ:247540')
  })

  it('공백이 포함된 stock_code → trim 처리', () => {
    const row = fromDart({ stock_code: '  005930  ', corp_name: '삼성전자', corp_code: '' }, 'Y')
    expect(row.ticker).toBe('005930')
  })

  it('firstSeenAt, updatedAt 필드 ISO 형식', () => {
    const row = fromDart(dartItem, 'Y')
    expect(row.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ── fromNaverEtf ────────────────────────────────────────────────────────────

describe('fromNaverEtf', () => {
  it('기본 ETF 항목 → KRX_ETF StockMasterRow', () => {
    const row = fromNaverEtf({ itemcode: '069500', itemname: 'KODEX 200' })
    expect(row.ticker).toBe('069500')
    expect(row.name).toBe('KODEX 200')
    expect(row.exchange).toBe('KRX_ETF')
    expect(row.category).toBe('DOMESTIC')
    expect(row.type).toBe('ETF')
    expect(row.currency).toBe('KRW')
    expect(row.source).toBe('NAVER')
    expect(row.id).toBe('DOMESTIC:KRX_ETF:069500')
  })

  it('camelCase 필드(itemCode/itemName)도 처리', () => {
    const row = fromNaverEtf({ itemCode: '360750', itemName: 'TIGER 미국S&P500' })
    expect(row.ticker).toBe('360750')
    expect(row.name).toBe('TIGER 미국S&P500')
  })

  it('빈 이름 → ticker 를 name 으로 대체하지 않음 (name 빈 문자열)', () => {
    const row = fromNaverEtf({ itemcode: '069500', itemname: '' })
    expect(row.name).toBe('')
  })
})

// ── fromYahoo ───────────────────────────────────────────────────────────────

describe('fromYahoo', () => {
  const appleQuote = {
    symbol: 'AAPL',
    shortName: 'Apple Inc.',
    longName: 'Apple Incorporated',
    quoteType: 'EQUITY',
    sector: 'Technology',
  }

  it('NASDAQ 주식 → 올바른 OVERSEAS row', () => {
    const row = fromYahoo(appleQuote, 'NASDAQ')
    expect(row.ticker).toBe('AAPL')
    expect(row.name).toBe('Apple Inc.')
    expect(row.exchange).toBe('NASDAQ')
    expect(row.category).toBe('OVERSEAS')
    expect(row.type).toBe('EQUITY')
    expect(row.currency).toBe('USD')
    expect(row.sector).toBe('Technology')
    expect(row.source).toBe('YAHOO')
    expect(row.id).toBe('OVERSEAS:NASDAQ:AAPL')
  })

  it('quoteType=ETF → type=ETF, exchange=US_ETF 로 재분류', () => {
    const row = fromYahoo({ symbol: 'SPY', shortName: 'SPDR S&P 500 ETF', quoteType: 'ETF' }, 'NYSE')
    expect(row.type).toBe('ETF')
    expect(row.exchange).toBe('US_ETF')
    expect(row.id).toBe('OVERSEAS:US_ETF:SPY')
  })

  it('targetExchange=US_ETF → 항상 ETF', () => {
    const row = fromYahoo({ symbol: 'QQQ', shortName: 'Invesco QQQ', quoteType: 'ETF' }, 'US_ETF')
    expect(row.exchange).toBe('US_ETF')
    expect(row.type).toBe('ETF')
  })

  it('shortName 없을 때 longName 사용', () => {
    const row = fromYahoo({ symbol: 'TSLA', longName: 'Tesla, Inc.', quoteType: 'EQUITY' }, 'NASDAQ')
    expect(row.name).toBe('Tesla, Inc.')
  })
})

// ── fromNasdaqTrader ─────────────────────────────────────────────────────────

describe('fromNasdaqTrader', () => {
  it('NASDAQ 주식 파싱', () => {
    const row = fromNasdaqTrader(
      { symbol: 'MSFT', securityName: 'Microsoft Corporation', etf: 'N' },
      'NASDAQ'
    )
    expect(row.ticker).toBe('MSFT')
    expect(row.name).toBe('Microsoft Corporation')
    expect(row.exchange).toBe('NASDAQ')
    expect(row.type).toBe('EQUITY')
    expect(row.source).toBe('SEC')
  })

  it('etf=Y → exchange=US_ETF, type=ETF', () => {
    const row = fromNasdaqTrader(
      { symbol: 'QQQ', securityName: 'Invesco QQQ Trust', etf: 'Y' },
      'NASDAQ'
    )
    expect(row.exchange).toBe('US_ETF')
    expect(row.type).toBe('ETF')
    expect(row.id).toBe('OVERSEAS:US_ETF:QQQ')
  })

  it('NYSE AMEX 종목 파싱', () => {
    const row = fromNasdaqTrader(
      { symbol: 'BRK', securityName: 'Berkshire Hathaway', etf: 'N' },
      'AMEX'
    )
    expect(row.exchange).toBe('AMEX')
  })
})
