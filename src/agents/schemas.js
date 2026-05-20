// 에이전트별 구조화 응답 스키마 정의

/**
 * 각 에이전트가 응답 끝에 삽입할 JSON 블록의 스키마.
 *
 * research  → attractiveness: '상'|'중'|'하', reason: string
 * portfolio → riskLevel: '낮음'|'보통'|'높음', topHolding: string
 * report    → period: string, returnRate: number
 * alert     → urgent: number, caution: number, info: number
 */
export const AGENT_SCHEMAS = {
  research: {
    attractiveness: '', // '상' | '중' | '하'
    reason: '',         // 한 줄 이유
  },
  portfolio: {
    riskLevel: '',      // '낮음' | '보통' | '높음'
    topHolding: '',     // 비중 1위 종목명
  },
  report: {
    period: '',         // 리포트 기간 (예: '2026-05 월간')
    returnRate: 0,      // 기간 수익률 (숫자, 단위: %)
  },
  alert: {
    urgent: 0,          // 🔴 긴급 건수
    caution: 0,         // 🟡 주의 건수
    info: 0,            // 🟢 참고 건수
  },
}
