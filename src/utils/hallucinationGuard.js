// 환각(Hallucination) 의심 패턴 감지 유틸리티

// 환각 감지 패턴 (최소 3개 유지)
const HALLUCINATION_PATTERNS = [
  {
    pattern: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:공시|발표|보고서|공개)/,
    label: '특정 공시 날짜 언급',
  },
  {
    pattern: /(?:영업이익|순이익|매출액|영업손실|당기순이익)(?:은|이|는|가)\s*[\d,]+\s*(?:억|조)\s*원/,
    label: '구체적 재무 수치 제시',
  },
  {
    pattern: /(?:목표주가|적정주가)\s*[\d,]+\s*원/,
    label: '구체적 목표주가 언급',
  },
  {
    pattern: /(?:다음\s*달|이번\s*달|다음\s*분기|이번\s*분기)\s*(?:실적|배당|공시|발표)/,
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
