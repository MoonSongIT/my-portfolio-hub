// Anthropic Claude API 호출 — 서버사이드 프록시 경유
import axios from 'axios'
import { routeToAgent, AGENT_LABELS } from '../agents/orchestrator.js'
import { RESEARCH_PROMPT, buildResearchContext } from '../agents/researchAgent.js'
import { PORTFOLIO_PROMPT, buildPortfolioContext } from '../agents/portfolioAgent.js'
import { ALERT_PROMPT, buildAlertContext } from '../agents/alertAgent.js'
import { REPORT_PROMPT, buildReportContext } from '../agents/reportAgent.js'
import { buildJournalCoachPrompt, buildJournalContext, buildCompressedJournalContext } from '../agents/journalCoachAgent.js'

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
  journal: 4096,
  report: 4096,
  research: 3072,
  portfolio: 2048,
  alert: 2048,
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
    case 529:
      return 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'
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
  const agentInfo = AGENT_LABELS[agentType] || AGENT_LABELS.portfolio
  const maxTokens = AGENT_MAX_TOKENS[agentType] || 2048

  // 컨텍스트 빌드 & 시스템 프롬프트 결정
  let contextText = ''
  let systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.portfolio

  try {
    switch (agentType) {
      case 'journal': {
        const entries = context.journalEntries || []
        // 200건 초과 시 압축 컨텍스트 사용
        const journalContext = entries.length > 200
          ? buildCompressedJournalContext(entries, context.accounts || [])
          : buildJournalContext(entries, context.accounts || [])
        systemPrompt = buildJournalCoachPrompt(journalContext)
        break
      }
      case 'research':
        contextText = buildResearchContext(context.stockData || null)
        break
      case 'portfolio':
        contextText = buildPortfolioContext(context.holdings || [], context.exchangeRate || null)
        break
      case 'alert':
        contextText = buildAlertContext(context.watchlist || [], context.quotesMap || null)
        break
      case 'report':
        contextText = buildReportContext(context.holdings || [], context.period || 'monthly', context.exchangeRate || null)
        break
    }
  } catch {
    contextText = ''
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
        maxTokens,
      })

      const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
      return { text, agentType, agentInfo }
    } catch (error) {
      lastError = error
      const status = error.response?.status

      // 429, 401은 재시도 불필요 (한도 초과 / 인증 오류)
      if (status === 429 || status === 401) break

      // 500, 529(과부하) 에러 재시도
      if ((status === 500 || status === 529) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
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
 * 대화 히스토리 포함 멀티턴 메시지 전송
 * @param {Array<{role: string, content: string}>} messages - 대화 히스토리
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} [agentType='journal'] - 에이전트 타입 (max_tokens 결정용)
 * @returns {Promise<{text: string}>}
 */
export async function sendWithHistory(messages, systemPrompt, agentType = 'journal') {
  const maxTokens = AGENT_MAX_TOKENS[agentType] || 4096
  try {
    const response = await claudeApi.post('/claude', {
      systemPrompt,
      messages,
      maxTokens,
    })

    const text = response.data?.content?.[0]?.text || '응답을 받지 못했습니다.'
    return { text }
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
    const response = await claudeApi.post('/claude', {
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

export default claudeApi
