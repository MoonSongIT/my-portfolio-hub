// Anthropic Claude API 호출 — 서버사이드 프록시 경유
import axios from 'axios'
import { routeToAgent, AGENT_LABELS } from '../agents/orchestrator.js'
import { RESEARCH_PROMPT, buildResearchContext } from '../agents/researchAgent.js'
import { PORTFOLIO_PROMPT, buildPortfolioContext } from '../agents/portfolioAgent.js'
import { ALERT_PROMPT, buildAlertContext } from '../agents/alertAgent.js'
import { REPORT_PROMPT, buildReportContext } from '../agents/reportAgent.js'

/**
 * axios 인스턴스 — 프록시 서버 경유
 */
const claudeApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * 에이전트별 시스템 프롬프트 맵
 */
const AGENT_PROMPTS = {
  research: RESEARCH_PROMPT,
  portfolio: PORTFOLIO_PROMPT,
  alert: ALERT_PROMPT,
  report: REPORT_PROMPT,
}

/**
 * 에이전트별 컨텍스트 빌더 맵
 */
const CONTEXT_BUILDERS = {
  research: buildResearchContext,
  portfolio: buildPortfolioContext,
  alert: buildAlertContext,
  report: buildReportContext,
}

/**
 * 에러 메시지 생성 (HTTP 상태코드별)
 * @param {object} error - axios 에러 객체
 * @returns {string} 사용자 친화적 에러 메시지
 */
function getErrorMessage(error) {
  if (error.code === 'ECONNABORTED') {
    return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
  }

  if (!error.response) {
    return '네트워크 연결을 확인해주세요.'
  }

  const status = error.response.status
  switch (status) {
    case 401:
      return 'API 키 오류가 발생했습니다. 관리자에게 문의해주세요.'
    case 429:
      return 'AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
    case 500:
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    default:
      return `오류가 발생했습니다. (${status})`
  }
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
  const systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.portfolio
  const agentInfo = AGENT_LABELS[agentType] || AGENT_LABELS.portfolio

  // 컨텍스트 빌드
  let contextText = ''
  const builder = CONTEXT_BUILDERS[agentType]
  if (builder) {
    try {
      switch (agentType) {
        case 'research':
          contextText = builder(context.stockData || null)
          break
        case 'portfolio':
          contextText = builder(context.holdings || [], context.exchangeRate || null)
          break
        case 'alert':
          contextText = builder(context.watchlist || [], context.quotesMap || null)
          break
        case 'report':
          contextText = builder(context.holdings || [], context.period || 'monthly', context.exchangeRate || null)
          break
      }
    } catch {
      contextText = ''
    }
  }

  // 사용자 메시지 + 컨텍스트 결합
  const combinedMessage = contextText
    ? `${contextText}\n\n사용자 질문: ${userMessage}`
    : userMessage

  // API 호출 (최대 2회 retry — 500 에러 시)
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await claudeApi.post('/claude', {
        systemPrompt,
        messages: [{ role: 'user', content: combinedMessage }],
      })

      const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
      return { text, agentType, agentInfo }
    } catch (error) {
      lastError = error
      const status = error.response?.status

      // 429는 재시도 불필요 (한도 초과)
      if (status === 429 || status === 401) break

      // 500 에러만 재시도
      if (status === 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }

      break
    }
  }

  // 에러 반환
  return {
    text: getErrorMessage(lastError),
    agentType,
    agentInfo,
  }
}

/**
 * 대화 히스토리 포함 메시지 전송
 * @param {Array<{role: string, content: string}>} messages - 대화 히스토리
 * @param {string} systemPrompt - 시스템 프롬프트
 * @returns {Promise<{text: string}>}
 */
export async function sendWithHistory(messages, systemPrompt) {
  try {
    const response = await claudeApi.post('/claude', {
      systemPrompt,
      messages,
    })

    const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
    return { text }
  } catch (error) {
    return { text: getErrorMessage(error) }
  }
}

export default claudeApi
