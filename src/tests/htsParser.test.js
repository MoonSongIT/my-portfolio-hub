import { describe, it, expect } from 'vitest'
import {
  normalizeDate,
  normalizeTicker,
  toNumber,
  parseEugeneRow,
} from '../utils/htsParser'

// 유진 HTS 컬럼 순서: date(0) name(1) type(2) buyPrice(3) buyQty(4) buyAmount(5)
//   sellPrice(6) sellQty(7) sellAmount(8) tradingCost(9) realizedPnl(10)
//   realizedRate(11) commission(12) tax(13) ticker(14)
function makeRow({
  date = '2026-04-01',
  name = '삼성전자',
  type = '현금',
  buyPrice = 0,
  buyQty = 0,
  buyAmount = 0,
  sellPrice = 0,
  sellQty = 0,
  sellAmount = 0,
  tradingCost = 0,
  realizedPnl = 0,
  realizedRate = 0,
  commission = 0,
  tax = 0,
  ticker = 'A005930',
} = {}) {
  return [
    date, name, type,
    buyPrice, buyQty, buyAmount,
    sellPrice, sellQty, sellAmount,
    tradingCost, realizedPnl, realizedRate,
    commission, tax, ticker,
  ]
}

describe('normalizeDate', () => {
  it('"2026-04-01" 형식 → 그대로 반환', () => {
    expect(normalizeDate('2026-04-01')).toBe('2026-04-01')
  })

  it('"20260401" 형식 → "2026-04-01"', () => {
    expect(normalizeDate('20260401')).toBe('2026-04-01')
  })

  it('"2026.04.01" 형식 → "2026-04-01"', () => {
    expect(normalizeDate('2026.04.01')).toBe('2026-04-01')
  })

  it('빈 값 → null', () => {
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate(null)).toBeNull()
  })
})

describe('normalizeTicker', () => {
  it('"A005930     " → "005930"', () => {
    expect(normalizeTicker('A005930     ')).toBe('005930')
  })

  it('"A463250" → "463250"', () => {
    expect(normalizeTicker('A463250')).toBe('463250')
  })

  it('소문자 접두사 제거', () => {
    expect(normalizeTicker('a005930')).toBe('005930')
  })

  it('빈 값 → 빈 문자열', () => {
    expect(normalizeTicker('')).toBe('')
    expect(normalizeTicker(null)).toBe('')
  })
})

describe('toNumber', () => {
  it('숫자 → 그대로', () => {
    expect(toNumber(72000)).toBe(72000)
  })

  it('"72,000" → 72000', () => {
    expect(toNumber('72,000')).toBe(72000)
  })

  it('빈 값 → 0', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
  })
})

describe('parseEugeneRow', () => {
  it('매수 행 파싱', () => {
    const row = makeRow({
      date: '2026-04-01',
      name: '삼성전자  ',
      buyPrice: 72000,
      buyQty: 10,
      buyAmount: 720000,
      commission: 360,
      tax: 0,
      tradingCost: 100,
      ticker: 'A005930     ',
    })

    const entry = parseEugeneRow(row)

    expect(entry.date).toBe('2026-04-01')
    expect(entry.name).toBe('삼성전자')
    expect(entry.ticker).toBe('005930')
    expect(entry.action).toBe('buy')
    expect(entry.price).toBe(72000)
    expect(entry.quantity).toBe(10)
    expect(entry.amount).toBe(720000)
    expect(entry.commission).toBe(360)
    expect(entry.tax).toBe(0)
    expect(entry.tradingCost).toBe(100)
    expect(entry.market).toBe('KRX')
    expect(entry.source).toBe('eugene-hts')
  })

  it('매도 행 파싱', () => {
    const row = makeRow({
      date: '2026-04-02',
      name: 'SK하이닉스',
      sellPrice: 185000,
      sellQty: 5,
      sellAmount: 925000,
      realizedPnl: 50000,
      realizedRate: 5.7,
      commission: 462,
      tax: 1387,
      ticker: 'A000660',
    })

    const entry = parseEugeneRow(row)

    expect(entry.action).toBe('sell')
    expect(entry.price).toBe(185000)
    expect(entry.quantity).toBe(5)
    expect(entry.amount).toBe(925000)
    expect(entry.realizedPnl).toBe(50000)
    expect(entry.realizedRate).toBe(5.7)
    expect(entry.ticker).toBe('000660')
  })

  it('trailing spaces 있는 종목명 trim', () => {
    const row = makeRow({ name: '카카오   ', buyQty: 1, buyPrice: 50000 })
    expect(parseEugeneRow(row).name).toBe('카카오')
  })

  it('콤마 포함 금액 처리', () => {
    const row = makeRow({ buyPrice: '1,234,000', buyQty: 2, buyAmount: '2,468,000' })
    const entry = parseEugeneRow(row)
    expect(entry.price).toBe(1234000)
    expect(entry.amount).toBe(2468000)
  })
})
