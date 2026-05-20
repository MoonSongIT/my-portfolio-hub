// Anthropic Claude API 호출 — 서버사이드 프록시 경유
import axios from 'axios'
import useAiCredentialStore from '../store/aiCredentialStore.js'
import { routeToAgent, AGENT_LABELS } from '../agents/orchestrator.js'
import { RESEARCH_PROMPT, RESEARCH_TOOL_USE_PROMPT, buildResearchContext } from '../agents/researchAgent.js'
import { PORTFOLIO_PROMPT, buildPortfolioContext } from '../agents/portfolioAgent.js'
import { ALERT_PROMPT, buildAlertContext } from '../agents/alertAgent.js'
import { REPORT_PROMPT, WEEKLY_REPORT_PROMPT, MONTHLY_REPORT_PROMPT, buildReportContext } from '../agents/reportAgent.js'
import { buildJournalCoachPrompt, buildJournalContext, buildCompressedJournalContext } from '../agents/journalCoachAgent.js'
import { ANALYSIS_PROMPT, MARKET_BRIEF_PROMPT, PORTFOLIO_ANALYSIS_PROMPT, buildMovementContext, buildMarketBriefContext, buildPortfolioMovementContext } from '../agents/analysisAgent.js'
import { fetchNews } from './newsApi.js'
import { fetchDisclosures } from './disclosureApi.js'
import { fetchQuote } from './stockApi.js'

/**
 * axios 인스턴스 — 프록시 서버 경유
 */
const claudeApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

// request interceptor — 사용자 API 키를 X-User-Api-Key 헤더에 자동 첨부
claudeApi.interceptors.request.use((config) => {
  const { apiKey } = useAiCredentialStore.getState()
  if (apiKey) {
    config.headers['X-User-Api-Key'] = apiKey
  }
  return config
})

// response interceptor — 401 수신 시 isValid 자동 false 갱신
claudeApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAiCredentialStore.setState({ isValid: false })
    }
    return Promise.reject(error)
  }
)

/**
 * 에이전트별 시스템 프롬프트 맵
 */
const AGENT_PROMPTS = {
  analysis: ANALYSIS_PROMPT, // 종목 있으면 원인분석, 없으면 market brief로 switch에서 교체
  journal: null, // buildJournalCoachPrompt()로 동적 생성
  research: RESEARCH_PROMPT,
  portfolio: PORTFOLIO_PROMPT,
  alert: ALERT_PROMPT,
  report: REPORT_PROMPT,
}

/**
 * 에이전트별 max_tokens 설정
 * - journal / report: 긴 분석 필요 → 4096
 * - research: 중간 → 3072
 * - portfolio / alert: 짧은 요약 → 2048
 */
const AGENT_MAX_TOKENS = {
  analysis: 2048,
  journal: 4096,
  report: 4096,
  research: 3072,
  portfolio: 2048,
  alert: 2048,
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Claude API 호출 (fetch 기반, 180s timeout)
 * axios ECONNABORTED 없이 긴 응답도 안정적으로 수신
 * @param {object} payload
 * @returns {Promise<{content: [{text: string}], stop_reason: string|null}>}
 */
async function fetchClaude(payload) {
  const { apiKey } = useAiCredentialStore.getState()
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-User-Api-Key'] = apiKey

  const response = await fetch(`${API_BASE}/claude`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  })

  if (!response.ok) {
    const errText = await response.text()
    const err = new Error(errText)
    err.response = { status: response.status }
    throw err
  }

  return response.json()
}

/**
 * 에러 메시지 생성 (HTTP 상태코드별 사용자 친화적 메시지)
 * @param {object} error
 * @returns {string}
 */
function getErrorMessage(error) {
  // fetch AbortSignal timeout
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
  }
  // axios timeout (summarizeAndCompressHistory 경로)
  if (error.code === 'ECONNABORTED') {
    return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
  }
  // fetch 네트워크 오류 (TypeError) 또는 axios 응답 없음
  if (error instanceof TypeError || !error.response) {
    return '네트워크 연결이 끊겼습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
  }

  const status = error.response.status
  switch (status) {
    case 401:
      return 'API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.'
    case 429:
      return 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
    case 500:
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    case 503:
      return 'AI 서버를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.'
    case 529:
      return 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'
    default:
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

/**
 * 재시도 가능한 오류인지 판별
 * - 재시도 가능: 네트워크 단절, HTTP 500/503/529
 * - 재시도 불필요: timeout, 429, 401
 */
function isRetryable(error) {
  if (error.name === 'TimeoutError') return false
  if (error instanceof TypeError) return true
  const status = error.response?.status
  if (status === 429 || status === 401) return false
  if (status === 500 || status === 503 || status === 529) return true
  if (!error.response) return true
  return false
}

/**
 * Claude API 공통 호출 함수 — SSE 스트리밍 + 일시적 오류 시 자동 재시도 (최대 3회)
 * @param {object} payload
 * @param {number} [maxAttempts=3]
 * @returns {Promise<{data: {content: [{text: string}], stop_reason: string|null}}>}
 */
export async function callClaudeWithRetry(payload, maxAttempts = 3) {
  let lastError = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await fetchClaude(payload)
      return { data }
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt >= maxAttempts - 1) break
      // 지수 백오프: 1.5s → 3s
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
  throw lastError
}

/**
 * AI 에이전트에게 메시지 전송
 * @param {string} userMessage - 사용자 입력 메시지
 * @param {object} context - 컨텍스트 데이터 (holdings, watchlist, stockData 등)
 * @param {string|null} forceAgent - 강제 에이전트 지정 (null이면 자동 라우팅)
 * @returns {Promise<{text: string, agentType: string, agentInfo: object}>}
 */
export async function sendToAgent(userMessage, context = {}, forceAgent = null) {
  // 에이전트 라우팅
  const agentType = forceAgent || routeToAgent(userMessage)
  const agentInfo = AGENT_LABELS[agentType] || AGENT_LABELS.portfolio
  const maxTokens = AGENT_MAX_TOKENS[agentType] || 2048

  // 컨텍스트 빌드 & 시스템 프롬프트 결정
  let contextText = ''
  let systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.portfolio

  try {
    switch (agentType) {
      case 'analysis': {
        // context에서 종목 정보 추출 (researchBundle 우선, stockData 폴백)
        const sd = context.researchBundle?.stockData ?? context.stockData ?? null
        const ticker = sd?.symbol ?? sd?.ticker ?? null
        const name = sd?.name ?? ticker ?? ''
        const market = sd?.market ?? 'NASDAQ'
        const changePercent = sd?.changePercent ?? 0

        if (ticker) {
          // 경로 1: 종목이 있으면 급등락 원인 분석
          const [news, disclosures] = await Promise.all([
            fetchNews(ticker, market).catch(() => []),
            fetchDisclosures(ticker, market).catch(() => []),
          ])
          contextText = buildMovementContext({ ticker, name, changePercent, market, news, disclosures })
          systemPrompt = ANALYSIS_PROMPT
        } else if (context.holdings?.length > 0) {
          // 경로 2: changePercent 없는 종목만 quote fetch (이미 있으면 중복 fetch 방지)
          const [enrichedHoldings, news] = await Promise.all([
            Promise.all(
              context.holdings.map(async (h) => {
                if (h.changePercent !== undefined && h.changePercent !== null) return h
                try {
                  const q = await fetchQuote(h.ticker, h.market)
                  return {
                    ...h,
                    changePercent: q?.changePercent ?? null,
                    currentPrice: q?.currentPrice ?? h.currentPrice,
                  }
                } catch {
                  return { ...h, changePercent: null }
                }
              })
            ),
            fetchNews('^GSPC', 'NYSE').catch(() => []),
          ])
          contextText = buildPortfolioMovementContext({ holdings: enrichedHoldings, news })
          systemPrompt = PORTFOLIO_ANALYSIS_PROMPT
        } else {
          // 경로 3: 종목도 포트폴리오도 없으면 전체 시장 브리핑
          const BRIEF_INDICES = [
            { label: 'KOSPI',  ticker: '^KS11', market: 'NYSE' },
            { label: 'KOSDAQ', ticker: '^KQ11', market: 'NYSE' },
            { label: 'NASDAQ', ticker: '^IXIC', market: 'NASDAQ' },
            { label: 'S&P500', ticker: '^GSPC', market: 'NYSE' },
          ]
          const [quotes, news] = await Promise.all([
            Promise.all(BRIEF_INDICES.map(idx => fetchQuote(idx.ticker, idx.market).catch(() => null))),
            fetchNews('^GSPC', 'NYSE').catch(() => []),
          ])
          const indices = BRIEF_INDICES.map((idx, i) => ({
            label: idx.label,
            ticker: idx.ticker,
            price: quotes[i]?.currentPrice ?? 0,
            changePercent: quotes[i]?.changePercent ?? 0,
          }))
          contextText = buildMarketBriefContext({ indices, news })
          systemPrompt = MARKET_BRIEF_PROMPT
        }
        break
      }
      case 'journal': {
        const entries = context.journalEntries || []
        // 200건 초과 시 압축 컨텍스트 사용
        const journalContext = entries.length > 200
          ? buildCompressedJournalContext(entries, context.accounts || [])
          : buildJournalContext(entries, context.accounts || [])
        systemPrompt = buildJournalCoachPrompt(journalContext)
        break
      }
      case 'research': {
        // researchBundle(오케스트레이터 결과) 우선, 없으면 stockData 단독으로 하위호환
        const bundle = context.researchBundle
          ?? (context.stockData ? { stockData: context.stockData } : null)
        contextText = buildResearchContext(bundle)

        // 번들 없이 채팅에서 직접 질문한 경우 → Tool Use 경로로 자동 전환
        if (!bundle) {
          return sendResearchWithToolUse(userMessage)
        }
        break
      }
      case 'portfolio':
        contextText = buildPortfolioContext(context.holdings || [], context.exchangeRate || null)
        break
      case 'alert': {
        // 2-1: alert 요청 시에만 watchlist 종목 실시간 시세 병렬 fetch → quotesMap 구성
        const watchlist = context.watchlist || []
        let quotesMap = context.quotesMap || null
        if (!quotesMap && watchlist.length > 0) {
          const entries = await Promise.all(
            watchlist.map(async (w) => {
              try {
                const q = await fetchQuote(w.ticker, w.market)
                return [w.ticker, q]
              } catch {
                return [w.ticker, null]
              }
            })
          )
          quotesMap = Object.fromEntries(entries.filter(([, q]) => q !== null))
        }
        contextText = buildAlertContext(watchlist, quotesMap)
        break
      }
      case 'report': {
        // 2-5: period별 시스템 프롬프트 분기
        const period = context.period || 'monthly'
        contextText = buildReportContext(context.holdings || [], period, context.exchangeRate || null)
        if (period === 'weekly') systemPrompt = WEEKLY_REPORT_PROMPT
        else if (period === 'monthly') systemPrompt = MONTHLY_REPORT_PROMPT
        break
      }
    }
  } catch {
    contextText = ''
  }

  // 사용자 메시지 + 컨텍스트 결합
  const combinedMessage = contextText
    ? `${contextText}\n\n사용자 질문: ${userMessage}`
    : userMessage

  try {
    const response = await callClaudeWithRetry({
      systemPrompt,
      messages: [{ role: 'user', content: combinedMessage }],
      maxTokens,
    })

    const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
    // max_tokens로 잘린 응답 감지
    const incomplete = response.data?.stop_reason === 'max_tokens'
    return { text, agentType, agentInfo, incomplete }
  } catch (error) {
    return { text: getErrorMessage(error), agentType, agentInfo }
  }
}

/**
 * 대화 히스토리 포함 멀티턴 메시지 전송
 * @param {Array<{role: string, content: string}>} messages - 대화 히스토리
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} [agentType='journal'] - 에이전트 타입 (max_tokens 결정용)
 * @returns {Promise<{text: string}>}
 */
export async function sendWithHistory(messages, systemPrompt, agentType = 'journal') {
  const maxTokens = AGENT_MAX_TOKENS[agentType] || 4096
  // system 역할 메시지는 별도 system 파라미터로 전달되므로 messages에서 제거 (중복 방지)
  const filteredMessages = messages.filter(m => m.role !== 'system')
  try {
    const response = await callClaudeWithRetry({ systemPrompt, messages: filteredMessages, maxTokens })
    const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
    const incomplete = response.data?.stop_reason === 'max_tokens'
    return { text, incomplete }
  } catch (error) {
    return { text: getErrorMessage(error) }
  }
}

/**
 * 10턴 초과 시 이전 대화를 요약하여 압축된 컨텍스트 반환
 * @param {Array<{role: string, content: string}>} messages - 전체 대화 기록
 * @param {string} systemPrompt - 현재 에이전트 시스템 프롬프트
 * @returns {Promise<Array<{role: string, content: string}>>} 압축된 메시지 배열
 */
export async function summarizeAndCompressHistory(messages, systemPrompt) {
  // 10턴(메시지 20개) 미만이면 그대로 반환
  if (messages.length <= 20) return messages

  // 요약할 이전 대화 (최근 4개 메시지 제외)
  const toSummarize = messages.slice(0, -4)
  const recent = messages.slice(-4)

  const summaryPrompt = `다음은 AI 투자 코치와의 대화 기록입니다.
핵심 내용만 3~5줄로 요약해주세요. 투자 패턴, 분석 결과, 개선 제안 위주로 작성하세요.

대화 기록:
${toSummarize.map(m => `[${m.role === 'user' ? '사용자' : 'AI'}] ${m.content}`).join('\n\n')}

위 대화의 핵심 요약:`

  try {
    const response = await callClaudeWithRetry({
      systemPrompt,
      messages: [{ role: 'user', content: summaryPrompt }],
      maxTokens: 512,
    })
    const summary = response.data?.content?.[0]?.text || ''

    // 요약 + 최근 4개 메시지로 압축
    return [
      { role: 'user', content: `[이전 대화 요약]\n${summary}` },
      { role: 'assistant', content: '이전 대화 내용을 확인했습니다. 계속 도움드리겠습니다.' },
      ...recent,
    ]
  } catch {
    // 요약 실패 시 최근 10개만 반환
    return messages.slice(-10)
  }
}

/**
 * Tool Use 방식 종목 분석 (Phase C)
 * Claude가 필요한 데이터를 도구로 직접 조회 — 프리패치 없이 선택적 fetch
 *
 * @param {string} userMessage - 사용자 질문
 * @param {string} [ticker]    - 티커 힌트 (옵션 — 프롬프트에 포함)
 * @param {string} [market]    - 시장 힌트 (옵션)
 * @returns {Promise<{text: string, agentType: string, agentInfo: object}>}
 */
export async function sendResearchWithToolUse(userMessage, ticker, market) {
  const agentInfo = AGENT_LABELS.research || AGENT_LABELS.portfolio
  const maxTokens = AGENT_MAX_TOKENS.research

  // 티커/시장 정보를 메시지 앞에 힌트로 제공
  const messageWithHint = ticker && market
    ? `분석 대상: ${ticker} (시장: ${market})\n\n${userMessage}`
    : userMessage

  try {
    const response = await callClaudeWithRetry({
      systemPrompt: RESEARCH_TOOL_USE_PROMPT,
      messages:     [{ role: 'user', content: messageWithHint }],
      maxTokens,
    })

    const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
    return { text, agentType: 'research', agentInfo }
  } catch (error) {
    return { text: getErrorMessage(error), agentType: 'research', agentInfo }
  }
}

export default claudeApi
