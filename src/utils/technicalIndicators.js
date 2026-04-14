/**
 * 기술적 지표 계산 유틸리티
 * Bollinger Bands, RSI, MACD 계산
 */

// ─── SMA (단순이동평균) ──────────────────────────────────────────────────────

/**
 * SMA(Simple Moving Average) 계산
 * @param {Array<{time, close}>} data - OHLCV 배열
 * @param {number} period - 기간
 * @returns {Array<{time, value}>}
 */
export function calculateSMA(data, period) {
  if (data.length < period) return []

  return data
    .map((candle, index) => {
      if (index < period - 1) return null
      const sum = data
        .slice(index - period + 1, index + 1)
        .reduce((acc, c) => acc + c.close, 0)
      return { time: candle.time, value: sum / period }
    })
    .filter(Boolean)
}

// ─── 표준편차 (SMA 기반) ────────────────────────────────────────────────────

function calcStdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

/**
 * 볼린저 밴드 계산 (SMA20 ± multiplier × σ)
 * @param {Array<{time, close}>} data
 * @param {number} period - SMA 기간 (기본 20)
 * @param {number} multiplier - 표준편차 배수 (기본 2)
 * @returns {Array<{time, upper, middle, lower}>}
 */
export function calculateBollingerBands(data, period = 20, multiplier = 2) {
  if (data.length < period) return []

  return data
    .map((candle, index) => {
      if (index < period - 1) return null
      const window = data.slice(index - period + 1, index + 1)
      const closes = window.map(c => c.close)
      const middle = closes.reduce((a, b) => a + b, 0) / closes.length
      const stdDev = calcStdDev(closes)
      return {
        time: candle.time,
        upper: middle + multiplier * stdDev,
        middle,
        lower: middle - multiplier * stdDev,
      }
    })
    .filter(Boolean)
}

// ─── EMA (지수이동평균) ──────────────────────────────────────────────────────

/**
 * EMA(Exponential Moving Average) 계산
 * @param {number[]} closes - 종가 배열
 * @param {number} period - 기간
 * @returns {number[]} EMA 배열 (closes와 같은 길이, 초기 값은 null)
 */
function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  const result = new Array(closes.length).fill(null)

  // 초기 SMA로 시작
  const initialSMA = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = initialSMA

  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

// ─── RSI (상대강도지수) ──────────────────────────────────────────────────────

/**
 * RSI(Relative Strength Index) 계산 - Wilder's Smoothing Method
 * @param {Array<{time, close}>} data
 * @param {number} period - 기간 (기본 14)
 * @returns {Array<{time, value}>}
 */
export function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return []

  const closes = data.map(c => c.close)
  const result = []

  // 첫 번째 RS 계산 (단순 평균)
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += -change
  }
  avgGain /= period
  avgLoss /= period

  const firstRSI = (avgGain === 0 && avgLoss === 0) ? 50
    : avgLoss === 0 ? 100
    : 100 - 100 / (1 + avgGain / avgLoss)
  result.push({ time: data[period].time, value: firstRSI })

  // Wilder's smoothing으로 이후 RSI 계산
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    const rsi = (avgGain === 0 && avgLoss === 0) ? 50
      : avgLoss === 0 ? 100
      : 100 - 100 / (1 + avgGain / avgLoss)
    result.push({ time: data[i].time, value: rsi })
  }

  return result
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * MACD(Moving Average Convergence Divergence) 계산
 * MACD = EMA(fast) - EMA(slow)
 * Signal = EMA(MACD, signal)
 * Histogram = MACD - Signal
 *
 * @param {Array<{time, close}>} data
 * @param {number} fastPeriod - 단기 EMA (기본 12)
 * @param {number} slowPeriod - 장기 EMA (기본 26)
 * @param {number} signalPeriod - 시그널 EMA (기본 9)
 * @returns {Array<{time, macd, signal, histogram}>}
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length < slowPeriod) return []

  const closes = data.map(c => c.close)
  const fastEMA = calcEMA(closes, fastPeriod)
  const slowEMA = calcEMA(closes, slowPeriod)

  // MACD 라인 (slowPeriod-1 이후부터 유효)
  const macdLine = []
  for (let i = slowPeriod - 1; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) continue
    macdLine.push({
      time: data[i].time,
      value: fastEMA[i] - slowEMA[i],
    })
  }

  if (macdLine.length < signalPeriod) return []

  // Signal 라인 = EMA(MACD, signalPeriod)
  const macdValues = macdLine.map(d => d.value)
  const signalEMA = calcEMA(macdValues, signalPeriod)

  const result = []
  for (let i = 0; i < macdLine.length; i++) {
    const signal = signalEMA[i]
    if (signal === null) continue
    const macd = macdLine[i].value
    result.push({
      time: macdLine[i].time,
      macd,
      signal,
      histogram: macd - signal,
    })
  }

  return result
}
