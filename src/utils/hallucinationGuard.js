// 환각(Hallucination) 의심 패턴 감지 유틸리티

// 환각 감지 패턴 — AI가 실제로 출력하는 표현 기준으로 작성
const HALLUCINATION_PATTERNS = [
  {
    // "2025년 3월 15일 공시", "2024년 12월 실적" 등
    pattern: /\d{4}년\s*\d{1,2}월(?:\s*\d{1,2}일)?\s*(?:공시|발표|보고서|공개|실적)/,
    label: '특정 날짜·시점 공시 언급',
  },
  {
    // "영업이익은 12조 원", "매출액 4,500억 원" 등 (조사 없이도 허용)
    pattern: /(?:영업이익|순이익|매출액|영업손실|당기순이익)\s*(?:은|이|는|가|:)?\s*[\d,]+\s*(?:억|조)\s*원/,
    label: '구체적 재무 수치 제시',
  },
  {
    // "목표주가 90,000원", "목표 330,000원", "목표 33만원", "적정주가 85,000원"
    pattern: /(?:목표주가|적정주가|목표가|목표)\s*[\d,]+\s*(?:만\s*원|원)/,
    label: '구체적 목표주가 언급',
  },
  {
    // "30만원 돌파", "28만원 박스권", "27만원 지지선" 등 구체 주가 수준
    pattern: /[\d.]+\s*만\s*원\s*(?:돌파|박스권|지지선|저항선|근접|수준|선)/,
    label: '구체적 주가 수준 제시',
  },
  {
    // "다음 분기 실적", "이번 달 배당 발표" 등 미래 단정
    pattern: /(?:다음\s*달|이번\s*달|다음\s*분기|이번\s*분기|내년)\s*(?:실적|배당|공시|발표)/,
    label: '미래 실적·배당 단정',
  },
]

// 환각 경고를 표시할 에이전트 (journal, analysis 제외)
const GUARDED_AGENTS = ['research', 'alert', 'report', 'portfolio']

/**
 * 응답 텍스트에서 환각 의심 패턴 감지
 * @param {string} text - AI 응답 텍스트
 * @param {string} agentType - 에이전트 타입
 * @returns {string[] | null} 감지된 경고 레이블 배열 또는 null
 */
export function detectHallucination(text, agentType) {
  if (!text || !GUARDED_AGENTS.includes(agentType)) return null
  const triggered = HALLUCINATION_PATTERNS.filter(({ pattern }) => pattern.test(text))
  return triggered.length > 0 ? triggered.map(t => t.label) : null
}
