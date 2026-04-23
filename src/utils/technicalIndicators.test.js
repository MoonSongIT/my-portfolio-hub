import { describe, it, expect } from 'vitest'
import { resampleOHLCV } from './technicalIndicators'

describe('resampleOHLCV', () => {
  const dailyCandles = [
    { time: '2026-04-01', open: 100, high: 105, low: 99, close: 102, volume: 1000 },
    { time: '2026-04-02', open: 102, high: 108, low: 101, close: 107, volume: 1200 },
    { time: '2026-04-03', open: 107, high: 110, low: 106, close: 109, volume: 1100 },
    { time: '2026-04-04', open: 109, high: 111, low: 108, close: 110, volume: 900 },
    { time: '2026-04-05', open: 110, high: 112, low: 109, close: 111, volume: 800 },
    { time: '2026-04-08', open: 111, high: 113, low: 110, close: 112, volume: 950 },
    { time: '2026-04-09', open: 112, high: 115, low: 111, close: 114, volume: 1050 },
    { time: '2026-04-10', open: 114, high: 116, low: 113, close: 115, volume: 1150 },
    { time: '2026-04-11', open: 115, high: 118, low: 114, close: 117, volume: 1300 },
    { time: '2026-04-12', open: 117, high: 119, low: 116, close: 118, volume: 1200 },
    { time: '2026-04-15', open: 118, high: 120, low: 117, close: 119, volume: 1100 },
    { time: '2026-04-16', open: 119, high: 122, low: 118, close: 121, volume: 1250 },
    { time: '2026-04-17', open: 121, high: 123, low: 120, close: 122, volume: 1350 },
    { time: '2026-04-18', open: 122, high: 125, low: 121, close: 124, volume: 1450 },
    { time: '2026-04-19', open: 124, high: 126, low: 123, close: 125, volume: 1400 },
    { time: '2026-04-22', open: 125, high: 127, low: 124, close: 126, volume: 1300 },
    { time: '2026-04-23', open: 126, high: 128, low: 125, close: 127, volume: 1200 },
    { time: '2026-04-24', open: 127, high: 130, low: 126, close: 129, volume: 1500 },
    { time: '2026-04-25', open: 129, high: 131, low: 128, close: 130, volume: 1600 },
    { time: '2026-04-26', open: 130, high: 132, low: 129, close: 131, volume: 1550 },
  ]

  it('1W: 일봉 20일 → 주봉 4주로 리샘플링', () => {
    const result = resampleOHLCV(dailyCandles, '1W')
    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({
      time: '2026-04-01',
      open: 100,
      close: 111,
      high: 112,
      low: 99,
      volume: 5000,
    })
  })

  it('1M: 일봉 20일 → 월봉 1개', () => {
    const result = resampleOHLCV(dailyCandles, '1M')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      time: '2026-04-01',
      open: 100,
      close: 131,
      high: 132,
      low: 99,
      volume: 24350,
    })
  })

  it('1D: 일봉 그대로 반환', () => {
    const result = resampleOHLCV(dailyCandles, '1D')
    expect(result).toEqual(dailyCandles)
  })

  it('빈 배열 처리', () => {
    expect(resampleOHLCV([], '1W')).toEqual([])
  })
})
