import { describe, it, expect } from 'vitest'
import {
  calculateSMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
} from './technicalIndicators.js'

// 테스트용 OHLCV 데이터 생성 헬퍼
function makeCandles(closes) {
  return closes.map((close, i) => ({
    time: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 100000,
  }))
}

// ─── SMA ────────────────────────────────────────────────────────────────────

describe('calculateSMA', () => {
  it('기간보다 데이터가 적으면 빈 배열 반환', () => {
    const data = makeCandles([10, 20])
    expect(calculateSMA(data, 5)).toEqual([])
  })

  it('period=3, 단순 평균 정확성 검증', () => {
    // closes: 10, 20, 30, 40, 50
    // SMA(3): i=2 → (10+20+30)/3=20, i=3 → (20+30+40)/3=30, i=4 → (30+40+50)/3=40
    const data = makeCandles([10, 20, 30, 40, 50])
    const result = calculateSMA(data, 3)
    expect(result).toHaveLength(3)
    expect(result[0].value).toBeCloseTo(20, 5)
    expect(result[1].value).toBeCloseTo(30, 5)
    expect(result[2].value).toBeCloseTo(40, 5)
  })

  it('결과에 time 필드가 포함되어야 함', () => {
    const data = makeCandles([10, 20, 30])
    const result = calculateSMA(data, 3)
    expect(result[0]).toHaveProperty('time')
    expect(result[0]).toHaveProperty('value')
  })
})

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

describe('calculateBollingerBands', () => {
  it('데이터가 period보다 적으면 빈 배열 반환', () => {
    const data = makeCandles([10, 20])
    expect(calculateBollingerBands(data, 20, 2)).toEqual([])
  })

  it('upper ≥ middle ≥ lower 항상 성립', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 0.5)
    const data = makeCandles(closes)
    const result = calculateBollingerBands(data, 20, 2)
    result.forEach(({ upper, middle, lower }) => {
      expect(upper).toBeGreaterThanOrEqual(middle)
      expect(middle).toBeGreaterThanOrEqual(lower)
    })
  })

  it('변동이 없는 가격에서 upper === middle === lower', () => {
    const data = makeCandles(Array(25).fill(100))
    const result = calculateBollingerBands(data, 20, 2)
    const { upper, middle, lower } = result[0]
    expect(upper).toBeCloseTo(100, 5)
    expect(middle).toBeCloseTo(100, 5)
    expect(lower).toBeCloseTo(100, 5)
  })

  it('각 포인트에 time, upper, middle, lower 필드가 있어야 함', () => {
    const data = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + i))
    const result = calculateBollingerBands(data, 20, 2)
    expect(result[0]).toHaveProperty('time')
    expect(result[0]).toHaveProperty('upper')
    expect(result[0]).toHaveProperty('middle')
    expect(result[0]).toHaveProperty('lower')
  })
})

// ─── RSI ─────────────────────────────────────────────────────────────────────

describe('calculateRSI', () => {
  it('데이터가 period+1보다 적으면 빈 배열 반환', () => {
    const data = makeCandles([10, 20, 30])
    expect(calculateRSI(data, 14)).toEqual([])
  })

  it('RSI 값은 항상 0~100 범위', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10)
    const data = makeCandles(closes)
    const result = calculateRSI(data, 14)
    result.forEach(({ value }) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    })
  })

  it('지속 상승하는 가격에서 RSI > 70 (과매수)', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2)
    const data = makeCandles(closes)
    const result = calculateRSI(data, 14)
    const lastRsi = result[result.length - 1].value
    expect(lastRsi).toBeGreaterThan(70)
  })

  it('지속 하락하는 가격에서 RSI < 30 (과매도)', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 2)
    const data = makeCandles(closes)
    const result = calculateRSI(data, 14)
    const lastRsi = result[result.length - 1].value
    expect(lastRsi).toBeLessThan(30)
  })

  it('결과에 time, value 필드가 포함되어야 함', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const data = makeCandles(closes)
    const result = calculateRSI(data, 14)
    expect(result[0]).toHaveProperty('time')
    expect(result[0]).toHaveProperty('value')
  })
})

// ─── MACD ─────────────────────────────────────────────────────────────────────

describe('calculateMACD', () => {
  it('데이터가 slowPeriod보다 적으면 빈 배열 반환', () => {
    const data = makeCandles(Array(10).fill(100))
    expect(calculateMACD(data, 12, 26, 9)).toEqual([])
  })

  it('각 포인트에 time, macd, signal, histogram 필드가 있어야 함', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5)
    const data = makeCandles(closes)
    const result = calculateMACD(data, 12, 26, 9)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('time')
    expect(result[0]).toHaveProperty('macd')
    expect(result[0]).toHaveProperty('signal')
    expect(result[0]).toHaveProperty('histogram')
  })

  it('histogram = macd - signal', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.3) * 10)
    const data = makeCandles(closes)
    const result = calculateMACD(data, 12, 26, 9)
    result.forEach(({ macd, signal, histogram }) => {
      expect(histogram).toBeCloseTo(macd - signal, 10)
    })
  })

  it('상승 추세에서 MACD > 0 (EMA12 > EMA26)', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i)
    const data = makeCandles(closes)
    const result = calculateMACD(data, 12, 26, 9)
    const lastPoint = result[result.length - 1]
    expect(lastPoint.macd).toBeGreaterThan(0)
  })
})
