// AI 오케스트레이터 — 사용자 요청을 분석하여 적절한 에이전트로 라우팅
import useAiCredentialStore from '../store/aiCredentialStore.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const VALID_AGENTS = ['analysis', 'journal', 'research', 'portfolio', 'alert', 'report']

/**
 * 에이전트 라우팅 규칙
 * keywords 배열에 포함된 키워드가 사용자 메시지에 있으면 해당 에이전트로 라우팅
 */
export const ROUTING_RULES = [
  {
    agent: 'analysis',
    keywords: ['왜', '이유', '원인', '어떻게 된', '무슨 일', '급락', '급등', '폭락', '폭등', '하락 이유', '상승 이유', '오늘 시장', '시장 왜', '코스피 왜', '나스닥 왜', '장 전망', '증시 전망', '시장 국면', '선행지표', '변동성', '오늘 장'],
  },
  {
    agent: 'journal',
    keywords: ['내 패턴', '매매 패턴', '실수', '심리', '일지', '매매 스타일', '반복', '잘한', '아쉬운', '코치', '내 거래', '내 매매', '추격매매', '공포에'],
  },
  {
    // portfolio를 research보다 먼저 배치 — "포트폴리오 분석해줘" 등이 research로 잘못 라우팅되는 것 방지
    agent: 'portfolio',
    keywords: ['포트폴리오', '내 종목', '수익률', '현황', '보유', '평가', '비중', '리밸런싱', '자산', '총액'],
  },
  {
    agent: 'research',
    keywords: ['분석', '어때', '살까', '팔까', '전망', '목표가', '적정가', '재무', 'PER', 'PBR', 'ROE', '실적', '매출', '영업이익', '차트', '기술적', '이평선', 'RSI', 'MACD'],
  },
  {
    agent: 'alert',
    keywords: ['관심종목', '오늘 시장', '알림', '체크', '모니터링', '브리핑', '뉴스', '공시', '급등', '급락', '신호'],
  },
  {
    agent: 'report',
    keywords: ['리포트', '성과', '이번달', '결산', '주간', '월간', '연간', '보고서', '거래내역', '수익 분석'],
  },
]

/**
 * 사용자 메시지를 분석하여 적절한 에이전트 타입을 반환
 * @param {string} userMessage - 사용자 입력 메시지
 * @returns {string} 에이전트 타입 ('research' | 'portfolio' | 'alert' | 'report')
 */
export function routeToAgent(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return 'portfolio'

  const msg = userMessage.toLowerCase()

  // compound 조건 (최우선): 포트폴리오·보유 종목 + 뉴스·시장·등락 → analysis
  const hasPortfolio = msg.includes('포트폴리오') || msg.includes('내 종목') || msg.includes('보유')
  const hasMarketEvent = msg.includes('뉴스') || msg.includes('시장') || msg.includes('등락') || msg.includes('급등') || msg.includes('급락')
  if (hasPortfolio && hasMarketEvent) return 'analysis'

  for (const rule of ROUTING_RULES) {
    for (const keyword of rule.keywords) {
      if (msg.includes(keyword.toLowerCase())) {
        return rule.agent
      }
    }
  }

  // 기본 fallback → portfolio
  return 'portfolio'
}

/**
 * 메시지에 portfolio 규칙 키워드가 실제로 포함되어 있는지 (폴백과 구분용)
 * @param {string} message
 * @returns {boolean}
 */
function hasPortfolioKeyword(message) {
  const msg = message.toLowerCase()
  const rule = ROUTING_RULES.find(r => r.agent === 'portfolio')
  return !!rule && rule.keywords.some(kw => msg.includes(kw.toLowerCase()))
}

const INTENT_SYSTEM = `당신은 주식 투자 앱의 의도 분류기입니다.
사용자 메시지를 아래 6개 중 하나로만 분류하고, 그 단어 하나만 출력하세요.
- analysis: 주가 급등락 원인, 오늘 시장/종목이 왜 움직였는지
- journal: 내 매매 패턴·실수·심리·일지 회고
- research: 특정 종목 분석·전망·매수 검토·재무/기술적 지표
- portfolio: 내 보유 종목·수익률·자산 현황·비중·리밸런싱
- alert: 관심종목 모니터링·오늘 시장 브리핑·알림·신호
- report: 성과 리포트·결산·주간/월간 보고서
다른 텍스트 없이 영문 소문자 한 단어만 출력하세요.`

/**
 * Haiku 응답에서 유효한 에이전트 타입 추출 (순수 함수 — 테스트 대상)
 * @param {string} text
 * @returns {string|null}
 */
export function parseIntentResponse(text) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()
  return VALID_AGENTS.find(agent => lower.includes(agent)) ?? null
}

/**
 * Haiku로 메시지 의도를 분류 (2초 타임아웃, 실패 시 null)
 * @param {string} message
 * @returns {Promise<string|null>}
 */
export async function classifyIntentLLM(message) {
  if (!message) return null
  const { apiKey } = useAiCredentialStore.getState()
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-User-Api-Key'] = apiKey

  try {
    const res = await fetch(`${API_BASE}/claude`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        maxTokens: 16,
        systemPrompt: INTENT_SYSTEM,
        messages: [{ role: 'user', content: message }],
      }),
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return parseIntentResponse(data.content?.[0]?.text ?? '')
  } catch {
    return null
  }
}

/**
 * 하이브리드 라우팅 — 정적 규칙 우선, 기본 폴백(portfolio) 케이스에서만 LLM 보정
 * 명확한 키워드 메시지는 LLM 호출 없이 즉시 라우팅(지연 0)
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function routeToAgentSmart(message) {
  if (!message || typeof message !== 'string') return 'portfolio'

  const staticResult = routeToAgent(message)
  // 정적 결과가 명확하면(portfolio 외) 그대로 사용
  if (staticResult !== 'portfolio') return staticResult
  // portfolio 키워드가 실제로 있으면 신뢰, 없으면 기본 폴백 → LLM 보정
  if (hasPortfolioKeyword(message)) return 'portfolio'

  const llmResult = await classifyIntentLLM(message)
  return llmResult || 'portfolio'
}

/**
 * 복합 의도 패턴 — 두 그룹이 모두 매칭될 때 에이전트 파이프라인 실행
 */
export const COMPOUND_PATTERNS = [
  {
    agents: ['research', 'portfolio'],
    keywords: [['분석', '종목', '살만', '어때', '전망'], ['포트폴리오', '비중', '담아야', '영향']],
  },
  {
    agents: ['alert', 'journal'],
    keywords: [['급등', '급락', '관심종목'], ['패턴', '실수', '일지', '내 매매']],
  },
  {
    agents: ['report', 'journal'],
    keywords: [['리포트', '결산', '성과'], ['일지', '비교', '되돌아']],
  },
]

/**
 * 복합 의도 감지 — 두 에이전트 영역이 모두 포함된 메시지인지 판별
 * @param {string} message
 * @returns {string[]|null} 에이전트 타입 배열 또는 null (단순 의도)
 */
export function detectCompoundIntent(message) {
  if (!message) return null
  const msg = message.toLowerCase()
  for (const { agents, keywords } of COMPOUND_PATTERNS) {
    const matched = keywords.every(group => group.some(kw => msg.includes(kw)))
    if (matched) return agents
  }
  return null
}

/**
 * 에이전트 라벨 정보 (UI 배지 표시용)
 */
export const AGENT_LABELS = {
  analysis: {
    label: '원인 분석',
    icon: '🔎',
    color: 'indigo',
  },
  journal: {
    label: '매매 코치',
    icon: '📔',
    color: 'orange',
  },
  research: {
    label: '종목 리서치',
    icon: '🔍',
    color: 'blue',
  },
  portfolio: {
    label: '포트폴리오',
    icon: '💼',
    color: 'green',
  },
  alert: {
    label: '시장 알림',
    icon: '🔔',
    color: 'yellow',
  },
  report: {
    label: '성과 리포트',
    icon: '📊',
    color: 'purple',
  },
}

/**
 * 오케스트레이터 시스템 프롬프트
 */
export const ORCHESTRATOR_PROMPT = `당신은 개인 주식·ETF 자산관리 Web App의 핵심 AI 오케스트레이터입니다.
사용자 요청을 분석하여 아래 4개 전문 에이전트 중 적절한 에이전트로 라우팅합니다.

라우팅 규칙:
- "내 패턴", "실수", "심리", "일지", "매매 스타일" → JournalCoachAgent (최우선)
- 종목명/티커 + "분석", "어때", "살까" → ResearchAgent
- "포트폴리오", "내 종목", "수익률", "현황" → PortfolioAgent
- "관심종목", "오늘 시장", "알림", "체크" → AlertAgent
- "리포트", "성과", "이번달", "결산" → ReportAgent

응답 형식:
- 핵심 지표: 수치 + 변동폭 표시
- 분석 요약: 3줄 이내
- 행동 제안: 최대 3가지, 우선순위 명시
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."`
