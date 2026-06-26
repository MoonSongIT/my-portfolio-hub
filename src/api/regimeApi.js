// 변동성 레짐·변동성 지표·미국 선행지표 bias 계산 — 순수 함수, 외부 의존성 없음
// 입력은 항상 "현재 시점까지의 데이터"만 사용 (look-ahead bias 회피)
// 근거 문서: docs/15.01.01·15.01.02 (미국 선행지표 → 한국 증시 예측)

// ─── 변동성 지표 ──────────────────────────────────────────────────

/**
 * ATR (Average True Range) — Wilder 평활
 * @param {Array<{high:number, low:number, close:number}>} history - 과거→최신 정렬
 * @param {number} period - 기본 14
 * @returns {{ atr: number|null, atrPercent: number|null }}
 */
export function computeAtr(history, period = 14) {
  if (!Array.isArray(history) || history.length < period + 1) {
    return { atr: null, atrPercent: null }
  }

  // True Range 배열 (i=1부터)
  const trs = []
  for (let i = 1; i < history.length; i++) {
    const { high, low } = history[i]
    const prevClose = history[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trs.push(tr)
  }

  if (trs.length < period) return { atr: null, atrPercent: null }

  // 첫 ATR = 첫 period개 TR의 단순평균
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  // 이후 Wilder 평활
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }

  const lastClose = history[history.length - 1].close
  const atrPercent = lastClose ? (atr / lastClose) * 100 : null

  return { atr, atrPercent }
}

/**
 * 볼린저밴드 — 마지막 종가 기준
 * @param {number[]} closes - 종가 배열 (과거→최신)
 * @param {number} period - 기본 20
 * @param {number} mult - 표준편차 배수, 기본 2
 * @returns {{ upper:number|null, lower:number|null, middle:number|null, bandwidth:number|null, percentB:number|null }}
 */
export function computeBollinger(closes, period = 20, mult = 2) {
  const empty = { upper: null, lower: null, middle: null, bandwidth: null, percentB: null }
  if (!Array.isArray(closes) || closes.length < period) return empty

  const slice = closes.slice(-period)
  const middle = slice.reduce((s, v) => s + v, 0) / period
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period
  const std = Math.sqrt(variance)

  const upper = middle + mult * std
  const lower = middle - mult * std
  const lastClose = slice[slice.length - 1]
  const band = upper - lower

  return {
    upper,
    lower,
    middle,
    bandwidth: middle ? (band / middle) * 100 : null,
    percentB: band ? ((lastClose - lower) / band) * 100 : null,
  }
}

// ─── 변동성 레짐 (VIX 백분위) ─────────────────────────────────────

export const VIX_REGIME = {
  P_LOW: 33,            // 33 백분위 미만 → low
  P_HIGH: 67,           // 67 백분위 초과 → high
  CRISIS_LEVEL: 35,     // 절대 임계 (VIX≥35 → crisis)
  CRISIS_SPIKE: 20,     // 1일 급변(+%) 임계 (≥+20% → crisis)
  MIN_HISTORY: 30,      // 백분위 산출 최소 표본
}

/** 정렬된 오름차순 배열에서 백분위(0~100) 값 */
function percentileValue(sorted, p) {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

/**
 * VIX 변동성 레짐 분류 — 252일 trailing 분포의 33/67 백분위 기준
 * @param {number[]} vixHistory - 과거 VIX 종가 배열 (과거→최신), 252일 초과 시 최근 252일만 사용
 * @param {number} currentVix - 현재 VIX
 * @param {number} [dayChangePercent] - VIX 1일 등락률(%) — crisis 급변 판정용 (옵션)
 * @returns {{ regime:'low'|'normal'|'high'|'crisis', percentile:number|null, p33:number|null, p67:number|null }}
 */
export function computeVixRegime(vixHistory, currentVix, dayChangePercent = null) {
  // crisis 절대조건은 히스토리 유무와 무관하게 최우선 판정
  const isCrisis =
    currentVix >= VIX_REGIME.CRISIS_LEVEL ||
    (dayChangePercent != null && dayChangePercent >= VIX_REGIME.CRISIS_SPIKE)

  const trailing = Array.isArray(vixHistory) ? vixHistory.slice(-252) : []

  if (trailing.length < VIX_REGIME.MIN_HISTORY) {
    return { regime: isCrisis ? 'crisis' : 'normal', percentile: null, p33: null, p67: null }
  }

  const sorted = [...trailing].sort((a, b) => a - b)
  const below = sorted.filter(v => v < currentVix).length
  const percentile = (below / sorted.length) * 100
  const p33 = percentileValue(sorted, VIX_REGIME.P_LOW)
  const p67 = percentileValue(sorted, VIX_REGIME.P_HIGH)

  let regime
  if (isCrisis) regime = 'crisis'
  else if (percentile < VIX_REGIME.P_LOW) regime = 'low'
  else if (percentile > VIX_REGIME.P_HIGH) regime = 'high'
  else regime = 'normal'

  return { regime, percentile, p33, p67 }
}

// ─── 선행지표 종합 bias (overnightBias) ───────────────────────────

/**
 * 선행지표별 가중치 — 현 장세(고환율·외국인 매도 진앙) 반영: 거시 자금 채널 최우선
 * (결정 ③ 확정 2026-06-23)
 */
export const BIAS_WEIGHTS = {
  us10y: 2, dxy: 2, usdkrw: 2, // 거시 자금 채널 (최우선)
  sox: 1.5, sp500: 1.5,        // 위험선호·반도체 선행
  nasdaq: 1, vix: 1,           // 성장주·변동성
  wti: 0.5,                    // 유가 (양면성 → 최소 가중)
}

/** 값 상승이 한국 증시에 음(-)의 신호인 지표 */
const INVERTED = new Set(['vix', 'us10y', 'dxy', 'usdkrw', 'wti'])

/** bias 점수 → 5단계 라벨 임계 */
export const BIAS_THRESHOLD = { STRONG: 5, MILD: 2 }

function biasLabel(score) {
  if (score >= BIAS_THRESHOLD.STRONG) return '강한상승'
  if (score >= BIAS_THRESHOLD.MILD) return '강세'
  if (score > -BIAS_THRESHOLD.MILD) return '중립'
  if (score > -BIAS_THRESHOLD.STRONG) return '약세'
  return '강한하락'
}

/**
 * 선행지표 등락 스냅샷 → 가중 bias 스코어 (한국 개장 방향 가설)
 * @param {{ sox?:number, sp500?:number, nasdaq?:number, vix?:number, us10y?:number, dxy?:number, usdkrw?:number, wti?:number }} snapshot
 *        각 값은 changePercent(%). 누락 키는 0 기여.
 * @returns {{ score:number, label:string, contributions:Record<string, number> }}
 */
export function computeOvernightBias(snapshot = {}) {
  const contributions = {}
  let score = 0

  for (const key of Object.keys(BIAS_WEIGHTS)) {
    const change = snapshot[key]
    const weight = BIAS_WEIGHTS[key]
    const direction = INVERTED.has(key) ? -1 : 1
    const contribution = change == null ? 0 : Math.sign(change) * weight * direction
    contributions[key] = contribution
    score += contribution
  }

  // 부동소수 합산 오차 정리
  score = parseFloat(score.toFixed(4))

  return { score, label: biasLabel(score), contributions }
}
