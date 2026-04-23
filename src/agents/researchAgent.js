// 종목 탐색 & 분석 에이전트 — ResearchAgent
import { searchByQuery } from '../utils/stockMasterDb'

/**
 * ResearchAgent 시스템 프롬프트 (Phase A — 프리패치 컨텍스트 주입 방식)
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
- 인용 출처: 뉴스·공시를 분석에 활용한 경우, 응답 하단 [참고 출처] 섹션에 번호와 URL을 함께 표기하세요. (예: [1] https://...)

지원 시장: KRX (한국), NYSE/NASDAQ (미국)
응답은 반드시 한국어로 작성하세요.`

/**
 * ResearchAgent 시스템 프롬프트 (Phase C — Tool Use 방식)
 * Claude가 필요한 도구만 선택적으로 호출하여 데이터 수집 후 분석
 */
export const RESEARCH_TOOL_USE_PROMPT = `당신은 주식·ETF 종목 리서치 전문 에이전트입니다.
사용 가능한 도구를 활용하여 필요한 데이터를 수집한 후 종합 분석을 제공합니다.

도구 선택 가이드:
- 종합 분석 요청 → get_quote + get_profile + get_technical + get_news + get_disclosures 모두 호출
- "뉴스만", "이슈만" 질문 → get_news만 호출
- "시세", "현재가" 질문 → get_quote만 호출
- "재무", "실적", "PER" 질문 → get_profile 호출
- "차트", "기술적" 질문 → get_technical 호출
- "공시" 질문 → get_disclosures 호출

출력 형식:
- 종합 투자 매력도: [상/중/하] + 한 줄 이유 (데이터가 충분할 때)
- 섹션별 상세 분석 (수집된 데이터 기반)
- 유사 종목 추천 2~3개 (종합 분석 시)
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."

지원 시장: KRX (한국), NYSE/NASDAQ (미국)
응답은 반드시 한국어로 작성하세요.`

/**
 * 종목 번들 데이터를 ResearchAgent 컨텍스트 문자열로 변환
 *
 * 하위호환:
 *   - 기존: buildResearchContext(stockData) — 단순 객체
 *   - 신규: buildResearchContext(bundle)    — { stockData, profile, tech, news, disclosures }
 *
 * @param {object} bundleOrStockData
 * @returns {string} 컨텍스트 문자열
 */
export function buildResearchContext(bundleOrStockData) {
  if (!bundleOrStockData) return ''

  // 번들 여부 판별: bundle 키 중 하나라도 있으면 번들로 처리
  const isBundle = (
    'stockData' in bundleOrStockData ||
    'profile'   in bundleOrStockData ||
    'tech'      in bundleOrStockData ||
    'news'      in bundleOrStockData
  )

  const stockData   = isBundle ? (bundleOrStockData.stockData ?? null) : bundleOrStockData
  const profile     = isBundle ? (bundleOrStockData.profile ?? null) : null
  const tech        = isBundle ? (bundleOrStockData.tech ?? null) : null
  const news        = isBundle ? (bundleOrStockData.news ?? []) : []
  const disclosures = isBundle ? (bundleOrStockData.disclosures ?? []) : []

  const sections = []

  // ── 기본 시세 섹션 ─────────────────────────────────────────────
  const base = []
  if (stockData?.symbol)        base.push(`티커: ${stockData.symbol}`)
  if (stockData?.name)          base.push(`종목명: ${stockData.name}`)
  if (stockData?.market)        base.push(`시장: ${stockData.market}`)
  if (stockData?.currentPrice)  base.push(`현재가: ${stockData.currentPrice.toLocaleString()}`)
  if (stockData?.changePercent != null) {
    const sign = stockData.changePercent >= 0 ? '+' : ''
    base.push(`변동률: ${sign}${Number(stockData.changePercent).toFixed(2)}%`)
  }
  // 시가총액 (stockData 또는 profile)
  const cap = stockData?.marketCap ?? profile?.marketCap
  if (cap)                      base.push(`시가총액: ${cap.toLocaleString()}`)
  // 거래량
  const vol = stockData?.volume ?? profile?.averageVolume
  if (vol)                      base.push(`거래량(평균): ${vol.toLocaleString()}`)
  // 52주 고저 (stockData 또는 profile)
  const high52 = stockData?.high52w ?? stockData?.fiftyTwoWeekHigh ?? profile?.fiftyTwoWeekHigh
  const low52  = stockData?.low52w  ?? stockData?.fiftyTwoWeekLow  ?? profile?.fiftyTwoWeekLow
  if (high52)                   base.push(`52주 고가: ${high52.toLocaleString()}`)
  if (low52)                    base.push(`52주 저가: ${low52.toLocaleString()}`)
  // PER / PBR
  const per = stockData?.per ?? profile?.trailingPE
  const pbr = stockData?.pbr ?? profile?.priceToBook
  if (per)                      base.push(`PER: ${per}`)
  if (pbr)                      base.push(`PBR: ${pbr}`)

  if (base.length > 0) sections.push(`[기본 시세]\n${base.join('\n')}`)

  // ── 재무 지표 섹션 (profile) ────────────────────────────────────
  if (profile) {
    const fin = []
    if (profile.sector)               fin.push(`섹터: ${profile.sector}`)
    if (profile.industry)             fin.push(`업종: ${profile.industry}`)
    if (profile.forwardPE != null)    fin.push(`추정 PER: ${profile.forwardPE}`)
    if (profile.returnOnEquity != null)
      fin.push(`ROE: ${(profile.returnOnEquity * 100).toFixed(1)}%`)
    if (profile.debtToEquity != null)
      fin.push(`부채비율: ${profile.debtToEquity}%`)
    if (profile.operatingMargin != null)
      fin.push(`영업이익률: ${(profile.operatingMargin * 100).toFixed(1)}%`)
    if (profile.netMargin != null)
      fin.push(`순이익률: ${(profile.netMargin * 100).toFixed(1)}%`)
    if (profile.revenueGrowth != null)
      fin.push(`매출 성장률: ${(profile.revenueGrowth * 100).toFixed(1)}%`)
    if (profile.earningsGrowth != null)
      fin.push(`이익 성장률: ${(profile.earningsGrowth * 100).toFixed(1)}%`)
    if (profile.dividendYield != null)
      fin.push(`배당수익률: ${(profile.dividendYield * 100).toFixed(2)}%`)
    if (profile.targetMeanPrice)
      fin.push(`목표주가: ${profile.targetMeanPrice.toLocaleString()}`)
    if (profile.recommendationKey) {
      const keyMap = { buy: '매수', hold: '중립', sell: '매도' }
      fin.push(`애널리스트 추천: ${keyMap[profile.recommendationKey] ?? profile.recommendationKey}`)
    }
    if (fin.length > 0) sections.push(`[재무 지표]\n${fin.join('\n')}`)
  }

  // ── 기술적 지표 섹션 ────────────────────────────────────────────
  if (tech) {
    const t = []
    if (tech.ma20  != null) t.push(`MA20: ${Math.round(tech.ma20).toLocaleString()}`)
    if (tech.ma60  != null) t.push(`MA60: ${Math.round(tech.ma60).toLocaleString()}`)
    if (tech.ma120 != null) t.push(`MA120: ${Math.round(tech.ma120).toLocaleString()}`)
    if (tech.rsi   != null) t.push(`RSI(14): ${tech.rsi}`)
    if (tech.macd  != null) {
      const sigStr = tech.signal != null ? ` (Signal: ${tech.signal})` : ''
      t.push(`MACD: ${tech.macd}${sigStr}`)
    }
    if (tech.support    != null) t.push(`지지선: ${Math.round(tech.support).toLocaleString()}`)
    if (tech.resistance != null) t.push(`저항선: ${Math.round(tech.resistance).toLocaleString()}`)
    if (t.length > 0) sections.push(`[기술적 지표]\n${t.join('\n')}`)
  }

  // ── 최근 뉴스 섹션 (source_url 필드 보장) ───────────────────────
  const newsSlice = news.slice(0, 5)
  if (newsSlice.length > 0) {
    const newsParts = newsSlice.map((n, i) => {
      const date = n.date ? `[${n.date}] ` : ''
      const pub  = n.publisher ? ` — ${n.publisher}` : ''
      return `${i + 1}) ${date}${n.title}${pub}`
    })
    sections.push(`[최근 뉴스]\n${newsParts.join('\n')}`)
  }

  // ── 공시자료 섹션 (source_url 필드 보장) ─────────────────────────
  const discSlice = disclosures.slice(0, 5)
  if (discSlice.length > 0) {
    const discParts = discSlice.map((d, i) =>
      `${i + 1}) [${d.date}] ${d.title} (${d.kind})`
    )
    sections.push(`[최근 공시]\n${discParts.join('\n')}`)
  }

  // ── 출처 링크 섹션 — 뉴스·공시 URL 인용 (Claude가 [참고 출처]로 활용) ──
  const sourceLinks = [
    ...newsSlice
      .filter(n => n.link || n.source_url)
      .map((n, i) => `[뉴스${i + 1}] ${n.link || n.source_url}`),
    ...discSlice
      .filter(d => d.url || d.source_url)
      .map((d, i) => `[공시${i + 1}] ${d.url || d.source_url}`),
  ]
  if (sourceLinks.length > 0) {
    sections.push(`[출처 링크]\n${sourceLinks.join('\n')}`)
  }

  return sections.length > 0 ? `\n${sections.join('\n\n')}\n` : ''
}

// ── exchange → market 변환 (fetchQuote 파라미터 호환) ────────────────────────
const EXCHANGE_TO_MARKET = {
  KOSPI: 'KRX', KOSDAQ: 'KOSDAQ', KRX_ETF: 'KRX', NXT: 'KRX',
  NYSE: 'NYSE', NASDAQ: 'NASDAQ', AMEX: 'NYSE', US_ETF: 'NASDAQ',
}

/**
 * 사용자 메시지에서 종목 티커를 추출합니다.
 *
 * 우선순위:
 *  1) 정규식 — 6자리 숫자(한국) 또는 대문자 1~5자(해외)
 *  2) 마스터 DB 검색 (IDB) — 종목명으로 검색 후 최상위 결과 사용
 *
 * @param {string} message
 * @returns {Promise<{ ticker: string, exchange: string, market: string } | null>}
 */
export async function extractTicker(message) {
  if (!message) return null

  // 1순위: 6자리 숫자 티커 (한국 종목)
  const krMatch = message.match(/\b(\d{6})\b/)
  if (krMatch) {
    return { ticker: krMatch[1], exchange: 'KOSPI', market: 'KRX' }
  }

  // 2순위: 대문자 알파벳 1~5자 티커 (해외 종목, 단어 경계)
  const usMatch = message.match(/\b([A-Z]{1,5})\b/)
  if (usMatch) {
    return { ticker: usMatch[1], exchange: 'NASDAQ', market: 'NASDAQ' }
  }

  // 3순위: 마스터 DB 검색 — 종목명으로 텍스트 추출
  try {
    // 메시지를 단어로 분리해 2글자 이상 어절로 검색
    const words = message
      .replace(/[^\w가-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)

    for (const word of words) {
      const rows = await searchByQuery(word, { limit: 3 })
      if (rows.length === 0) continue

      // exchange 우선순위: KOSPI > KOSDAQ > NASDAQ > NYSE > 나머지
      const PRIORITY = { KOSPI: 0, KOSDAQ: 1, KRX_ETF: 2, NASDAQ: 3, NYSE: 4, AMEX: 5, US_ETF: 6, NXT: 7 }
      const sorted = [...rows].sort(
        (a, b) => (PRIORITY[a.exchange] ?? 99) - (PRIORITY[b.exchange] ?? 99)
      )
      const best = sorted[0]
      return {
        ticker:   best.ticker,
        exchange: best.exchange,
        market:   EXCHANGE_TO_MARKET[best.exchange] ?? best.exchange,
      }
    }
  } catch { /* IDB 미준비 — null 반환 */ }

  return null
}
