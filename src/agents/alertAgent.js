// 관심종목 시장조사 & 알림 에이전트 — AlertAgent

/**
 * AlertAgent 시스템 프롬프트
 */
export const ALERT_PROMPT = `당신은 시장 모니터링 및 알림 전문 에이전트입니다.

일간 스캔 항목:
1. 가격 이상 신호
   - 전일 대비 ±5% 이상 급등락
   - 거래량 평균 대비 3배 이상 급증
   - 52주 신고가/신저가 근접 (5% 이내)
2. 뉴스 & 공시
   - 실적, 배당, 증자, 자사주 공시
   - 업종 핵심 뉴스 헤드라인
   - 애널리스트 목표주가 변경
3. 기술적 신호
   - 골든크로스/데드크로스 발생
   - 주요 지지/저항선 돌파

알림 우선순위:
- 🔴 긴급: ±10% 이상, 주요 공시 — 즉시 확인
- 🟡 주의: ±5%, 거래량 급증 — 오늘 중 확인
- 🟢 참고: 목표주가 변경, 업종 뉴스

출력: [날짜] 시장 브리핑 → 긴급/주의/참고 건수 → 종목별 상세
면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."

응답은 반드시 한국어로 작성하세요.`

/**
 * 관심종목 데이터를 기반으로 AlertAgent 컨텍스트 빌드
 * @param {Array} watchlist - 관심종목 배열
 * @param {object|null} quotesMap - 종목별 실시간 시세 맵 { ticker: { price, change, ... } }
 * @returns {string} 컨텍스트 문자열
 */
export function buildAlertContext(watchlist, quotesMap) {
  if (!watchlist || watchlist.length === 0) {
    return '\n[관심종목 없음]\n'
  }

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const lines = watchlist.map((item) => {
    const ticker = item.ticker || item.symbol
    const name = item.name || ticker
    const quote = quotesMap?.[ticker] || {}

    const parts = [`  - ${name} (${ticker})`]

    if (quote.price) parts.push(`    현재가: ${quote.price.toLocaleString()}`)
    if (quote.changePercent !== undefined) {
      const pct = quote.changePercent
      const sign = pct >= 0 ? '+' : ''
      parts.push(`    변동률: ${sign}${pct.toFixed(2)}%`)

      // 이상 신호 판별
      if (Math.abs(pct) >= 10) parts.push(`    🔴 긴급: ${Math.abs(pct).toFixed(1)}% 급${pct > 0 ? '등' : '락'}`)
      else if (Math.abs(pct) >= 5) parts.push(`    🟡 주의: ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? '상승' : '하락'}`)
    }
    if (quote.volume) parts.push(`    거래량: ${quote.volume.toLocaleString()}`)

    return parts.join('\n')
  })

  return [
    `\n[관심종목 브리핑 — ${today}]`,
    `관심종목 수: ${watchlist.length}개`,
    '',
    ...lines,
    '',
  ].join('\n')
}
