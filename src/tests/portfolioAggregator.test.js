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

const cf = (date, { category = 'investment_in', type = 'deposit', amount = 1000, currency = 'KRW', isAuto = false } = {}) => ({
  id: `${date}-${category}-${amount}`, date, accountId: 'acc1', category, type, amount, currency, isAuto, deletedAt: null,
})

const sell = (date, pnl, { currency = 'KRW' } = {}) => ({
  id: `s-${date}`, date, accountId: 'acc1', action: 'sell', pnl, currency, deletedAt: null,
})

describe('aggregatePortfolioHistory (종합수익률 기준)', () => {
  it('빈 snapshots → 빈 배열 반환', () => {
    expect(aggregatePortfolioHistory([], 30, 1350)).toEqual([])
    expect(aggregatePortfolioHistory(null, 30, 1350)).toEqual([])
  })

  it('투자원금 + 미실현손익 → 종합수익률(손익/투자원금) 계산', () => {
    // 미실현 = (110-100)*10 = 100, 투자원금 = 1000
    const snapshots = [snap('2026-04-27', 'A', { closePrice: 110, avgBuyPrice: 100, quantity: 10 })]
    const cashFlows = [cf('2026-04-01', { amount: 1000 })]
    const result = aggregatePortfolioHistory(snapshots, 7, 1350, cashFlows, [])

    expect(result).toHaveLength(1)
    expect(result[0].investedValue).toBeCloseTo(1000, 5)  // netCapital
    expect(result[0].totalValue).toBeCloseTo(1100, 5)     // 투자원금 + 손익합계(미실현 100)
    expect(result[0].returnRate).toBeCloseTo(10, 5)       // 100 / 1000
  })

  it('실현손익(일지+현금) + 배당 누계가 손익합계에 반영', () => {
    const snapshots = [snap('2026-04-27', 'A', { closePrice: 100, avgBuyPrice: 100, quantity: 10 })] // 미실현 0
    const cashFlows = [
      cf('2026-04-01', { category: 'investment_in', amount: 1000 }),
      cf('2026-04-10', { category: 'realized_gain', amount: 200 }),
      cf('2026-04-15', { category: 'dividend', amount: 50 }),
    ]
    const entries = [sell('2026-04-12', 100)]
    const result = aggregatePortfolioHistory(snapshots, 30, 1350, cashFlows, entries)
    const last = result[result.length - 1]

    // 손익합계 = 미실현0 + 실현(일지100 + 현금200) + 배당50 = 350
    expect(last.totalValue).toBeCloseTo(1350, 5)  // 1000 + 350
    expect(last.returnRate).toBeCloseTo(35, 5)    // 350 / 1000
  })

  it('투자금 출금(investment_out)은 투자원금에서 차감', () => {
    const snapshots = [snap('2026-04-27', 'A', { closePrice: 100, avgBuyPrice: 100, quantity: 10 })] // 미실현 0
    const cashFlows = [
      cf('2026-04-01', { category: 'investment_in', amount: 1000 }),
      cf('2026-04-05', { category: 'investment_out', type: 'withdrawal', amount: 300 }),
    ]
    const result = aggregatePortfolioHistory(snapshots, 30, 1350, cashFlows, [])
    expect(result[result.length - 1].investedValue).toBeCloseTo(700, 5) // 1000 - 300
  })

  it('이자/조정 등 비자본 입금은 투자원금·손익에 미반영', () => {
    const snapshots = [snap('2026-04-27', 'A', { closePrice: 100, avgBuyPrice: 100, quantity: 10 })] // 미실현 0
    const cashFlows = [
      cf('2026-04-01', { category: 'investment_in', amount: 1000 }),
      cf('2026-04-10', { category: 'interest', amount: 500 }),
    ]
    const result = aggregatePortfolioHistory(snapshots, 30, 1350, cashFlows, [])
    const last = result[result.length - 1]
    expect(last.investedValue).toBeCloseTo(1000, 5)  // 이자 제외
    expect(last.totalValue).toBeCloseTo(1000, 5)     // 손익 0 (이자는 손익 아님)
  })

  it('USD 종목 미실현손익에 exchangeRate 적용 (환율 1300)', () => {
    // 미실현 = (100-80)*1*1300 = 26000, 투자원금 104000
    const snapshots = [snap('2026-04-27', 'AAPL', { closePrice: 100, avgBuyPrice: 80, quantity: 1, market: 'NASDAQ' })]
    const cashFlows = [cf('2026-04-01', { amount: 104000 })]
    const result = aggregatePortfolioHistory(snapshots, 7, 1300, cashFlows, [])

    expect(result[0].totalValue).toBeCloseTo(130000, 5)  // 104000 + 26000
    expect(result[0].returnRate).toBeCloseTo(25, 5)      // 26000 / 104000
  })

  it('period=7 필터 → 7일 초과 데이터 제외', () => {
    const snapshots = [
      snap('2026-04-19', 'A', { closePrice: 110, avgBuyPrice: 100 }),
      snap('2026-04-21', 'A', { closePrice: 110, avgBuyPrice: 100 }),
      snap('2026-04-27', 'A', { closePrice: 120, avgBuyPrice: 100 }),
    ]
    const cashFlows = [cf('2026-04-01', { amount: 1000 })]
    const result = aggregatePortfolioHistory(snapshots, 7, 1350, cashFlows, [])

    const dates = result.map(r => r.date)
    expect(dates).not.toContain('2026-04-19')
    expect(dates).toContain('2026-04-21')
    expect(dates).toContain('2026-04-27')
  })

  it('forward-fill → 중간 날짜 누락 시 이전 값으로 채워짐', () => {
    const snapshots = [
      snap('2026-04-21', 'A', { closePrice: 110, avgBuyPrice: 100, quantity: 10 }),
      snap('2026-04-25', 'A', { closePrice: 120, avgBuyPrice: 100, quantity: 10 }),
    ]
    const cashFlows = [cf('2026-04-01', { amount: 1000 })]
    const result = aggregatePortfolioHistory(snapshots, 30, 1350, cashFlows, [])
    const byDate = Object.fromEntries(result.map(r => [r.date, r]))

    expect(byDate['2026-04-22']).toBeDefined()
    expect(byDate['2026-04-22'].returnRate).toBeCloseTo(byDate['2026-04-21'].returnRate, 5)
    expect(byDate['2026-04-24'].returnRate).toBeCloseTo(byDate['2026-04-21'].returnRate, 5)
    expect(byDate['2026-04-25'].returnRate).toBeGreaterThan(byDate['2026-04-21'].returnRate)
  })
})
