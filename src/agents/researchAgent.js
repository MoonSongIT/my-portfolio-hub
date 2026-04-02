// 종목 탐색 & 분석 에이전트 — ResearchAgent

/**
 * ResearchAgent 시스템 프롬프트
 */
export const RESEARCH_PROMPT = `당신은 주식·ETF 종목 리서치 전문 에이전트입니다.

분석 프레임워크:
1. 기본 정보: 현재가, 52주 고/저, 시가총액, 거래량, 업종
2. 재무 건전성: PER, PBR, ROE, 부채비율, 최근 4분기 실적 트렌드
3. 기술적 분석: 이동평균선(20/60/120일), RSI, MACD, 지지/저항선
4. 리스크 요인: 업종·규제·환율 리스크, 최근 공시 및 뉴스

출력:
- 종합 투자 매력도: [상/중/하] + 한 줄 이유
- 섹션별 상세 분석
- 유사 종목 추천 2~3개
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."

지원 시장: KRX (한국), NYSE/NASDAQ (미국)
응답은 반드시 한국어로 작성하세요.`

/**
 * 종목 데이터를 기반으로 ResearchAgent 컨텍스트 빌드
 * @param {object|null} stockData - 종목 데이터 (현재가, 변동률 등)
 * @returns {string} 컨텍스트 문자열
 */
export function buildResearchContext(stockData) {
  if (!stockData) return ''

  const parts = []

  if (stockData.symbol) parts.push(`티커: ${stockData.symbol}`)
  if (stockData.name) parts.push(`종목명: ${stockData.name}`)
  if (stockData.currentPrice) parts.push(`현재가: ${stockData.currentPrice.toLocaleString()}`)
  if (stockData.changePercent !== undefined) parts.push(`변동률: ${stockData.changePercent > 0 ? '+' : ''}${stockData.changePercent}%`)
  if (stockData.marketCap) parts.push(`시가총액: ${stockData.marketCap.toLocaleString()}`)
  if (stockData.volume) parts.push(`거래량: ${stockData.volume.toLocaleString()}`)
  if (stockData.high52w) parts.push(`52주 고가: ${stockData.high52w.toLocaleString()}`)
  if (stockData.low52w) parts.push(`52주 저가: ${stockData.low52w.toLocaleString()}`)
  if (stockData.per) parts.push(`PER: ${stockData.per}`)
  if (stockData.pbr) parts.push(`PBR: ${stockData.pbr}`)
  if (stockData.market) parts.push(`시장: ${stockData.market}`)

  return parts.length > 0
    ? `\n[종목 데이터]\n${parts.join('\n')}\n`
    : ''
}
