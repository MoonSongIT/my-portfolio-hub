// 보유 자산 & 최적화 에이전트 — PortfolioAgent

/**
 * PortfolioAgent 시스템 프롬프트
 */
export const PORTFOLIO_PROMPT = `당신은 개인 투자 포트폴리오 관리 전문 에이전트입니다.

핵심 산출 지표:
1. 포트폴리오 요약: 총 평가금액, 총 수익률, 오늘 수익/손실
2. 종목별 성과: 수익률 순위, 비중 분석 (종목별/업종별/국가별)
3. 리스크 분석: 집중도 위험 (단일 종목 30% 초과 시 경고)
4. 최적화 제안: 리밸런싱 필요 종목, 손절/익절 검토 포인트

응답 규칙:
- 매도/매수 직접 추천 금지, 검토 포인트만 제시
- 모든 금액: 원화(KRW) / 달러(USD) 구분 표시
- 수익: (+) 표시, 손실: (-) 표시
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."

응답은 반드시 한국어로 작성하세요.`

/**
 * 보유 종목 데이터를 기반으로 PortfolioAgent 컨텍스트 빌드
 * @param {Array} holdings - 보유 종목 배열
 * @param {number|null} exchangeRate - USD/KRW 환율
 * @returns {string} 컨텍스트 문자열
 */
export function buildPortfolioContext(holdings, exchangeRate) {
  if (!holdings || holdings.length === 0) {
    return '\n[보유 종목 없음]\n'
  }

  const lines = holdings.map((h) => {
    const currentValue = (h.currentPrice || 0) * (h.quantity || 0)
    const investedValue = (h.avgPrice || 0) * (h.quantity || 0)
    const profitLoss = currentValue - investedValue
    const profitRate = investedValue > 0
      ? ((profitLoss / investedValue) * 100).toFixed(2)
      : '0.00'

    return [
      `  - ${h.name || h.ticker} (${h.ticker})`,
      `    수량: ${h.quantity}주 | 평균단가: ${(h.avgPrice || 0).toLocaleString()} | 현재가: ${(h.currentPrice || 0).toLocaleString()}`,
      `    평가금액: ${currentValue.toLocaleString()} | 손익: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString()} (${profitRate}%)`,
      `    시장: ${h.market || 'KRX'}`,
    ].join('\n')
  })

  // 총 평가금액, 총 투자금액 산출
  const totalCurrent = holdings.reduce((sum, h) => sum + (h.currentPrice || 0) * (h.quantity || 0), 0)
  const totalInvested = holdings.reduce((sum, h) => sum + (h.avgPrice || 0) * (h.quantity || 0), 0)
  const totalPL = totalCurrent - totalInvested
  const totalRate = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : '0.00'

  const summary = [
    `\n[포트폴리오 데이터]`,
    `총 보유 종목: ${holdings.length}개`,
    `총 투자금액: ${totalInvested.toLocaleString()}`,
    `총 평가금액: ${totalCurrent.toLocaleString()}`,
    `총 손익: ${totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString()} (${totalRate}%)`,
    exchangeRate ? `환율(USD/KRW): ${exchangeRate.toLocaleString()}` : '',
    '',
    '[종목별 상세]',
    ...lines,
    '',
  ]

  return summary.filter(Boolean).join('\n')
}
