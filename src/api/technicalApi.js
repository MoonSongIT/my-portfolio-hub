// 기술적 지표 계산 — MA / RSI / MACD / 지지·저항
// 순수 함수, 외부 의존성 없음
// 입력: fetchHistory() 반환 배열 [{date, open, high, low, close, volume}] (과거→최신 정렬)

/**
 * 지수이동평균 (EMA)
 * @param {number[]} values - 종가 배열 (과거→최신)
 * @param {number} period
 * @returns {number[]} EMA 배열 (length = values.length - period + 1)
 */
function computeEMA(values, period) {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  // 첫 EMA = 첫 period개의 SMA
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period
  const result = [ema]
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

/**
 * 단순이동평균 (현재 시점 단일 값)
 * @param {number[]} closes - 종가 배열
 * @param {number} period
 * @returns {number|null}
 */
export function computeMA(closes, period) {
  if (!closes || closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / period
}

/**
 * RSI (Relative Strength Index) — Wilder 평활법
 * @param {number[]} closes - 종가 배열 (과거→최신)
 * @param {number} period - 기본 14
 * @returns {number|null} RSI 값 (0~100)
 */
export function computeRSI(closes, period = 14) {
  if (!closes || closes.length <= period) return null

  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  // Wilder 평활
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1))
}

/**
 * MACD (12, 26, 9)
 * @param {number[]} closes - 종가 배열 (과거→최신), 최소 35개 필요
 * @returns {{ macd: number|null, signal: number|null, histogram: number|null }}
 */
export function computeMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow + signal) {
    return { macd: null, signal: null, histogram: null }
  }

  const emaFast = computeEMA(closes, fast)   // length = closes.length - fast + 1
  const emaSlow = computeEMA(closes, slow)   // length = closes.length - slow + 1

  // 두 EMA는 끝이 같은 시점 → 짧은 쪽(emaSlow) 길이에 맞춰 끝에서 정렬
  const len = Math.min(emaFast.length, emaSlow.length)
  const macdLine = []
  for (let i = 0; i < len; i++) {
    macdLine.push(emaFast[emaFast.length - len + i] - emaSlow[emaSlow.length - len + i])
  }

  if (macdLine.length < signal) {
    return { macd: null, signal: null, histogram: null }
  }

  const signalLine = computeEMA(macdLine, signal)
  const lastMACD   = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]

  return {
    macd:      parseFloat(lastMACD.toFixed(2)),
    signal:    parseFloat(lastSignal.toFixed(2)),
    histogram: parseFloat((lastMACD - lastSignal).toFixed(2)),
  }
}

/**
 * 지지선 / 저항선 (최근 N일 최저·최고)
 * @param {Array<{high: number, low: number}>} history
 * @param {number} lookback - 기본 20 (거래일)
 * @returns {{ support: number|null, resistance: number|null }}
 */
export function computeSupportResistance(history, lookback = 20) {
  if (!history || history.length < lookback) return { support: null, resistance: null }
  const recent = history.slice(-lookback)
  const lows  = recent.map(d => d.low).filter(v => v != null)
  const highs = recent.map(d => d.high).filter(v => v != null)
  return {
    support:    lows.length  > 0 ? Math.min(...lows)  : null,
    resistance: highs.length > 0 ? Math.max(...highs) : null,
  }
}

/**
 * 기술적 지표 통합 계산
 * @param {Array<{date, open, high, low, close, volume}>} history - 과거→최신 정렬
 * @returns {{ ma20, ma60, ma120, rsi, macd, signal, histogram, support, resistance }}
 */
export function computeIndicators(history) {
  const empty = {
    ma20: null, ma60: null, ma120: null,
    rsi: null, macd: null, signal: null, histogram: null,
    support: null, resistance: null,
  }

  if (!history || history.length === 0) return empty

  const closes = history.map(d => d.close).filter(v => v != null)
  const { macd, signal, histogram } = computeMACD(closes)
  const { support, resistance }     = computeSupportResistance(history)

  return {
    ma20:      computeMA(closes, 20),
    ma60:      computeMA(closes, 60),
    ma120:     computeMA(closes, 120),
    rsi:       computeRSI(closes),
    macd,
    signal,
    histogram,
    support,
    resistance,
  }
}
