import { describe, it, expect } from 'vitest'
import { recomputeHoldingsFromEntries } from '../utils/recomputeHoldings'

const buy = (overrides) => ({
  ticker: '005930',
  name: '삼성전자',
  market: 'KRX',
  action: 'buy',
  price: 70000,
  quantity: 10,
  fee: 0,
  date: '2026-01-02',
  createdAt: '2026-01-02T09:00:00.000Z',
  ...overrides,
})

const sell = (overrides) => ({
  ticker: '005930',
  name: '삼성전자',
  market: 'KRX',
  action: 'sell',
  price: 75000,
  quantity: 5,
  fee: 0,
  date: '2026-01-10',
  createdAt: '2026-01-10T09:00:00.000Z',
  ...overrides,
})

describe('recomputeHoldingsFromEntries', () => {
  it('매수 1회 → holding 1건', () => {
    const result = recomputeHoldingsFromEntries([buy()])
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('005930')
    expect(result[0].quantity).toBe(10)
    expect(result[0].avgPrice).toBe(70000)
  })

  it('매수 후 부분 매도 → 수량 감소', () => {
    const result = recomputeHoldingsFromEntries([buy(), sell()])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(5)
  })

  it('매수/매도 수량 일치 → holding 0건', () => {
    const result = recomputeHoldingsFromEntries([buy(), sell({ quantity: 10 })])
    expect(result).toHaveLength(0)
  })

  it('매도 수량이 보유 수량 초과해도 음수 방지', () => {
    const result = recomputeHoldingsFromEntries([buy({ quantity: 3 }), sell({ quantity: 10 })])
    expect(result).toHaveLength(0)
  })

  it('가중평균 단가 계산', () => {
    const entries = [
      buy({ price: 60000, quantity: 10, date: '2026-01-02' }),
      buy({ price: 70000, quantity: 10, date: '2026-01-05' }),
    ]
    const result = recomputeHoldingsFromEntries(entries)
    expect(result[0].quantity).toBe(20)
    expect(result[0].avgPrice).toBe(65000)
  })

  it('종목이 다르면 별도 holding', () => {
    const entries = [
      buy({ ticker: '005930', name: '삼성전자' }),
      buy({ ticker: '000660', name: 'SK하이닉스' }),
    ]
    const result = recomputeHoldingsFromEntries(entries)
    expect(result).toHaveLength(2)
  })

  it('빈 배열 → 빈 결과', () => {
    expect(recomputeHoldingsFromEntries([])).toHaveLength(0)
  })
})
