// AI 오케스트레이터 — 사용자 요청을 분석하여 적절한 에이전트로 라우팅

/**
 * 에이전트 라우팅 규칙
 * keywords 배열에 포함된 키워드가 사용자 메시지에 있으면 해당 에이전트로 라우팅
 */
export const ROUTING_RULES = [
  {
    agent: 'research',
    keywords: ['분석', '어때', '살까', '팔까', '전망', '목표가', '적정가', '재무', 'PER', 'PBR', 'ROE', '실적', '매출', '영업이익', '차트', '기술적', '이평선', 'RSI', 'MACD'],
  },
  {
    agent: 'portfolio',
    keywords: ['포트폴리오', '내 종목', '수익률', '현황', '보유', '평가', '비중', '리밸런싱', '자산', '총액'],
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
 * 에이전트 라벨 정보 (UI 배지 표시용)
 */
export const AGENT_LABELS = {
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
- 종목명/티커 + "분석", "어때", "살까" → ResearchAgent
- "포트폴리오", "내 종목", "수익률", "현황" → PortfolioAgent
- "관심종목", "오늘 시장", "알림", "체크" → AlertAgent
- "리포트", "성과", "이번달", "결산" → ReportAgent

응답 형식:
- 핵심 지표: 수치 + 변동폭 표시
- 분석 요약: 3줄 이내
- 행동 제안: 최대 3가지, 우선순위 명시
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."`
