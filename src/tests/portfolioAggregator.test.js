import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { aggregatePortfolioHistory } from '../utils/portfolioAggregator'

const FIXED_TODAY = '2026-04-27'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_TODAY))
})

afterEach(() => {
  vi.useRealTimers()
})

const snap = (date, ticker, { closePrice = 100, avgBuyPrice = 80, quantity = 10, market = 'KRX' } = {}) => ({
  ticker, date, accountId: 'acc1', name: ticker, market,
  closePrice, avgBuyPrice, quantity,
})

describe('aggregatePortfolioHistory', () => {
  it('빈 snapshots → 빈 배열 반환', () => {
    expect(aggregatePortfolioHistory([], 30, 1350)).toEqual([])
    expect(aggregatePortfolioHistory(null, 30, 1350)).toEqual([])
  })

  it('단일 KRX 종목 단일 날짜 → returnRate 계산 정확성 검증', () => {
    // closePrice=110, avgBuyPrice=100, quantity=10 → returnRate=10%
    const snapshots = [snap('2026-04-27', 'A', { closePrice: 110, avgBuyPrice: 100, quantity: 10, market: 'KRX' })]
    const result = aggregatePortfolioHistory(snapshots, 7, 1350)

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-27')
    expect(result[0].returnRate).toBeCloseTo(10, 5)
    expect(result[0].totalValue).toBeCloseTo(1100, 5)
    expect(result[0].investedValue).toBeCloseTo(1000, 5)
  })

  it('USD 종목 포함 → exchangeRate 적용 확인 (환율 1300 기준)', () => {
    // NASDAQ: closePrice=100, avgBuyPrice=80, quantity=1, exchangeRate=1300
    // totalValue = 100 * 1 * 1300 = 130000
    // investedValue = 80 * 1 * 1300 = 104000
    // returnRate = (130000 - 104000) / 104000 * 100 = 25%
    const snapshots = [snap('2026-04-27', 'AAPL', { closePrice: 100, avgBuyPrice: 80, quantity: 1, market: 'NASDAQ' })]
    const result = aggregatePortfolioHistory(snapshots, 7, 1300)

    expect(result).toHaveLength(1)
    expect(result[0].totalValue).toBeCloseTo(130000, 5)
    expect(result[0].investedValue).toBeCloseTo(104000, 5)
    expect(result[0].returnRate).toBeCloseTo(25, 5)
  })

  it('period=7 필터 → 7일 초과 데이터 제외', () => {
    // FIXED_TODAY = 2026-04-27, cutoff = 2026-04-20
    // 2026-04-19(8일 전) → 제외, 2026-04-21(6일 전) → 포함
    const snapshots = [
      snap('2026-04-19', 'A', { closePrice: 110, avgBuyPrice: 100 }),
      snap('2026-04-21', 'A', { closePrice: 110, avgBuyPrice: 100 }),
      snap('2026-04-27', 'A', { closePrice: 120, avgBuyPrice: 100 }),
    ]
    const result = aggregatePortfolioHistory(snapshots, 7, 1350)

    const dates = result.map(r => r.date)
    expect(dates).not.toContain('2026-04-19')
    expect(dates).toContain('2026-04-21')
    expect(dates).toContain('2026-04-27')
  })

  it('forward-fill → 중간 날짜 누락 시 이전 값으로 채워짐', () => {
    // 2026-04-21(월)과 2026-04-25(금) 사이 22~24일 누락
    const snapshots = [
      snap('2026-04-21', 'A', { closePrice: 110, avgBuyPrice: 100 }),
      snap('2026-04-25', 'A', { closePrice: 120, avgBuyPrice: 100 }),
    ]
    const result = aggregatePortfolioHistory(snapshots, 30, 1350)
    const byDate = Object.fromEntries(result.map(r => [r.date, r]))

    expect(byDate['2026-04-22']).toBeDefined()
    expect(byDate['2026-04-22'].returnRate).toBeCloseTo(byDate['2026-04-21'].returnRate, 5)
    expect(byDate['2026-04-23'].returnRate).toBeCloseTo(byDate['2026-04-21'].returnRate, 5)
    expect(byDate['2026-04-24'].returnRate).toBeCloseTo(byDate['2026-04-21'].returnRate, 5)
    expect(byDate['2026-04-25'].returnRate).toBeGreaterThan(byDate['2026-04-21'].returnRate)
  })
})
