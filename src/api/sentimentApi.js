// 뉴스 감성 점수 산출 API — Haiku로 종목 뉴스의 호재/악재를 정량화
import useAiCredentialStore from '../store/aiCredentialStore.js'
import { getCached, setCached } from './apiCache'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const SENTIMENT_SYSTEM = `당신은 금융 뉴스 감성 분석 전문가입니다.
각 뉴스 제목이 해당 종목 주가에 미치는 영향을 분석해 JSON 배열로만 응답하세요.
형식: [{"i":0,"sentiment":-1.0,"strength":"high","reason":"15자 이내 근거"}]
- sentiment: -1.0(강한 악재) ~ 1.0(강한 호재), 0=중립
- strength: 영향 강도 "high" | "mid" | "low"
- reason: 15자 이내 한국어 근거
입력 순서(i)를 그대로 유지하고, 다른 텍스트 없이 JSON 배열만 출력하세요.`

/**
 * Haiku 응답 텍스트를 감성 배열로 파싱 (순수 함수 — 테스트 대상)
 * 코드펜스/잡텍스트가 섞여도 첫 JSON 배열만 안전 추출
 * @param {string} text
 * @returns {Array<{ i: number, sentiment: number, strength: string, reason: string }>}
 */
export function parseSentimentResponse(text) {
  if (!text || typeof text !== 'string') return []
  // 코드펜스 제거 후 첫 번째 [ ... ] 블록 추출
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []

  let parsed
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const STRENGTHS = new Set(['high', 'mid', 'low'])
  return parsed
    .filter(item => item && typeof item.i === 'number')
    .map(item => {
      const raw = Number(item.sentiment)
      const sentiment = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0
      return {
        i: item.i,
        sentiment,
        strength: STRENGTHS.has(item.strength) ? item.strength : 'low',
        reason: typeof item.reason === 'string' ? item.reason.slice(0, 30) : '',
      }
    })
}

/**
 * 종목 뉴스 묶음의 감성 점수 산출 (Haiku, 5초 타임아웃, 실패 시 빈 배열)
 * @param {Array<{ title: string }>} news
 * @param {{ name?: string, ticker?: string, market?: string }} meta
 * @returns {Promise<Array<{ i, sentiment, strength, reason }>>}
 */
export async function scoreNewsSentiment(news, meta = {}) {
  if (!Array.isArray(news) || news.length === 0) return []

  const cacheKey = `sentiment:${meta.ticker ?? ''}:${meta.market ?? ''}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const stockLabel = meta.name ? `${meta.name}(${meta.ticker ?? ''})` : meta.ticker ?? '종목'
  const titleList = news.map((n, i) => `${i}. ${n.title}`).join('\n')
  const userContent = `종목: ${stockLabel}\n\n뉴스 목록:\n${titleList}`

  const { apiKey } = useAiCredentialStore.getState()
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-User-Api-Key'] = apiKey

  try {
    const res = await fetch(`${API_BASE}/claude`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        maxTokens: 512,
        systemPrompt: SENTIMENT_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const result = parseSentimentResponse(text)
    setCached(cacheKey, result, 3 * 60 * 1000)
    return result
  } catch {
    return []
  }
}

/**
 * 감성 배열을 뉴스 객체에 인덱스 기준으로 병합
 * @param {Array} news
 * @param {Array<{ i, sentiment, strength, reason }>} sentiments
 * @returns {Array} sentiment/strength/sentimentReason 가 병합된 새 배열
 */
export function mergeSentiment(news, sentiments) {
  if (!Array.isArray(sentiments) || sentiments.length === 0) return news
  const byIndex = new Map(sentiments.map(s => [s.i, s]))
  return news.map((n, i) => {
    const s = byIndex.get(i)
    return s
      ? { ...n, sentiment: s.sentiment, strength: s.strength, sentimentReason: s.reason }
      : n
  })
}
