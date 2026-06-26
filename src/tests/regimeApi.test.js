// regimeApi.test.js — 변동성 레짐·변동성 지표·선행지표 bias 순수 함수 단위 테스트
import { describe, it, expect } from 'vitest'
import {
  computeAtr,
  computeBollinger,
  computeVixRegime,
  computeOvernightBias,
  BIAS_WEIGHTS,
} from '../api/regimeApi.js'

describe('computeAtr', () => {
  it('Wilder 평활로 ATR과 atrPercent를 계산한다', () => {
    // Arrange — period=2, 3개 캔들 (TR i=1:3, i=2:3 → ATR=3)
    const history = [
      { high: 10, low: 8, close: 9 },
      { high: 12, low: 9, close: 11 },
      { high: 13, low: 10, close: 12 },
    ]
    // Act
    const { atr, atrPercent } = computeAtr(history, 2)
    // Assert
    expect(atr).toBeCloseTo(3, 5)
    expect(atrPercent).toBeCloseTo(25, 2) // 3 / 12 * 100
  })

  it('데이터가 period+1 미만이면 null을 반환한다', () => {
    expect(computeAtr([{ high: 10, low: 8, close: 9 }], 14)).toEqual({ atr: null, atrPercent: null })
    expect(computeAtr([], 14)).toEqual({ atr: null, atrPercent: null })
    expect(computeAtr(null, 14)).toEqual({ atr: null, atrPercent: null })
  })
})

describe('computeBollinger', () => {
  it('상단·하단·bandwidth·percentB를 계산한다', () => {
    // Arrange — period=3, mult=2, closes [10,12,14] → middle 12, std √(8/3)
    const closes = [10, 12, 14]
    // Act
    const r = computeBollinger(closes, 3, 2)
    // Assert
    expect(r.middle).toBeCloseTo(12, 5)
    const std = Math.sqrt(8 / 3)
    expect(r.upper).toBeCloseTo(12 + 2 * std, 4)
    expect(r.lower).toBeCloseTo(12 - 2 * std, 4)
    expect(r.bandwidth).toBeCloseTo(((4 * std) / 12) * 100, 3)
    expect(r.percentB).toBeCloseTo(((14 - (12 - 2 * std)) / (4 * std)) * 100, 3)
  })

  it('데이터가 period 미만이면 null을 반환한다', () => {
    const r = computeBollinger([10, 12], 3)
    expect(r).toEqual({ upper: null, lower: null, middle: null, bandwidth: null, percentB: null })
  })
})

describe('computeVixRegime', () => {
  // 현실적 VIX 분포 10~30 균등 (절대 임계 35 미만이라 백분위 분류만 검증)
  const hist = Array.from({ length: 100 }, (_, i) => 10 + (i * 20) / 99)

  it('33 백분위 미만이면 low', () => {
    expect(computeVixRegime(hist, 13).regime).toBe('low')
  })

  it('33~67 백분위면 normal', () => {
    expect(computeVixRegime(hist, 20).regime).toBe('normal')
  })

  it('67 백분위 초과면 high', () => {
    expect(computeVixRegime(hist, 28).regime).toBe('high')
  })

  it('절대 임계(VIX≥35)면 백분위와 무관하게 crisis', () => {
    expect(computeVixRegime(hist, 40).regime).toBe('crisis')
  })

  it('1일 급변(+20% 이상)이면 crisis', () => {
    expect(computeVixRegime(hist, 25, 25).regime).toBe('crisis')
  })

  it('p33·p67 경계값과 percentile을 함께 반환한다', () => {
    const r = computeVixRegime(hist, 20)
    expect(r.percentile).toBeGreaterThan(0)
    expect(r.percentile).toBeLessThan(100)
    expect(r.p33).toBeGreaterThan(0)
    expect(r.p67).toBeGreaterThan(r.p33)
  })

  it('히스토리가 부족하면 percentile은 null이지만 crisis 절대조건은 유지된다', () => {
    expect(computeVixRegime([], 20)).toMatchObject({ regime: 'normal', percentile: null })
    expect(computeVixRegime([], 40).regime).toBe('crisis')
  })
})

describe('computeOvernightBias', () => {
  it('모든 선행지표가 한국 증시에 우호적이면 강한상승', () => {
    // sox·sp500·nasdaq 상승(우호), vix·us10y·dxy·usdkrw·wti 하락(우호, invert)
    const snapshot = {
      sox: 2, sp500: 1.5, nasdaq: 1,
      vix: -3, us10y: -1, dxy: -0.5, usdkrw: -0.4, wti: -1,
    }
    const r = computeOvernightBias(snapshot)
    expect(r.label).toBe('강한상승')
    expect(r.score).toBeGreaterThanOrEqual(5)
  })

  it('모든 선행지표가 악재면 강한하락', () => {
    const snapshot = {
      sox: -2, sp500: -1.5, nasdaq: -1,
      vix: 3, us10y: 1, dxy: 0.5, usdkrw: 0.4, wti: 1,
    }
    const r = computeOvernightBias(snapshot)
    expect(r.label).toBe('강한하락')
    expect(r.score).toBeLessThanOrEqual(-5)
  })

  it('변화가 모두 0이면 중립(score 0)', () => {
    const r = computeOvernightBias({ sox: 0, sp500: 0, nasdaq: 0, vix: 0, us10y: 0, dxy: 0, usdkrw: 0, wti: 0 })
    expect(r.score).toBe(0)
    expect(r.label).toBe('중립')
  })

  it('invert 지표(VIX) 상승은 음의 기여를 만든다', () => {
    const r = computeOvernightBias({ vix: 5 })
    expect(r.contributions.vix).toBe(-BIAS_WEIGHTS.vix)
  })

  it('비invert 지표(SOX) 상승은 양의 기여를 만든다', () => {
    const r = computeOvernightBias({ sox: 5 })
    expect(r.contributions.sox).toBe(BIAS_WEIGHTS.sox)
  })

  it('거시 자금 채널(금리+달러) 악재만으로 약세가 된다', () => {
    // us10y+ (×2×-1=-2), dxy+ (×2×-1=-2) → score -4 → 약세
    const r = computeOvernightBias({ us10y: 1, dxy: 1 })
    expect(r.score).toBe(-4)
    expect(r.label).toBe('약세')
  })

  it('누락된 지표는 0 기여로 처리한다', () => {
    const r = computeOvernightBias({ sox: 1 })
    expect(r.contributions.vix).toBe(0)
    expect(r.score).toBe(BIAS_WEIGHTS.sox)
  })
})
