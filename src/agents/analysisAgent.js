// 주가 급등락 원인 분석 & 시장 브리핑 전용 에이전트

export const ANALYSIS_PROMPT = `당신은 주가 급등락 원인 분석 전문 에이전트입니다.
주어진 데이터(종목명, 등락률, 최근 뉴스, 공시)를 기반으로 오늘 이 종목의 주가가 움직이는 주요 이유를 분석하세요.

분석 규칙:
- 수집된 데이터(뉴스·공시)에 근거한 분석만 수행하세요. 데이터가 부족하면 "데이터 부족으로 원인을 특정하기 어렵습니다"라고 명시하세요.
- 추측성 표현("아마", "~일 수 있습니다") 최소화 — 뉴스/공시가 있으면 해당 내용을 직접 인용하세요.
- 뉴스에 감성 점수(호재/악재·강도)와 종합 감성이 제공되면 등락 원인 판단에 우선 활용하세요.
- 3가지 이내 핵심 요인으로 압축하세요.
- 마지막에 면책 문구를 반드시 포함하세요.

출력 형식:
### 오늘의 주요 원인

① [핵심 요인 1 — 뉴스/공시/업종 이슈 구분]
[2~3문장 설명. 해당 뉴스·공시 제목 직접 언급]

② [핵심 요인 2]
[2~3문장 설명]

③ [핵심 요인 3 — 해당 없으면 생략]
[2~3문장 설명]

### 투자자 유의점
[단기·중기 관점에서 주의할 사항 2~3가지]

---
⚠️ 이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다. 투자 원금 손실 가능성이 있습니다.`

export const MARKET_BRIEF_PROMPT = `당신은 주식 시장 국면 분석 전문 에이전트입니다.
주요 지수(KOSPI·KOSDAQ·NASDAQ·S&P500)와 미국 선행지표(SOX·VIX·美10Y·DXY·원달러·WTI), overnightBias 종합 점수, 변동성 레짐을 바탕으로 오늘 한국 증시의 방향과 변동성 국면을 분석하세요.

분석 규칙:
- 수집된 지수·선행지표·overnightBias·변동성 레짐·뉴스 데이터에 근거한 분석만 수행하세요.
- 미국 선행지표는 한국 증시 개장을 선행합니다. 특히 SOX(반도체)는 삼성전자·SK하이닉스에, 원/달러·미국채 금리·달러는 외국인 수급에 직접 영향을 줍니다.
- overnightBias 점수는 "확률적 가설"입니다. 단정하지 말고 실제 뉴스·지수와 교차 검증하여 방향을 서술하세요.
- 웹 검색이 가능하면 오늘 한국·미국 증시에 영향을 준 거시 이슈(금리·환율·통화정책·지정학·유가 등)를 검색해 반영하고 출처를 인용하세요.
- 변동성 레짐(저변동/정상/고변동/위기)에 맞는 리스크 관리 "검토 포인트"만 제시하세요. 매수/매도 지시는 절대 하지 마세요.
- 국내(KOSPI·KOSDAQ)와 해외(NASDAQ·S&P500)를 구분하여 설명하세요.
- 마지막에 면책 문구를 반드시 포함하세요.

출력 형식:
### 오늘의 시장 국면

**방향 가설:** [강한하락 / 약세 / 중립 / 강세 / 강한상승]  ×  **변동성:** [저변동 / 정상 / 고변동 / 위기]
**한 줄 요약:** [핵심 한 문장]

🇰🇷 **국내 시장**
- KOSPI: [등락률] — [핵심 원인 1문장]
- KOSDAQ: [등락률] — [핵심 원인 1문장]

🇺🇸 **해외 시장 / 선행지표**
- NASDAQ·S&P500: [등락률] — [핵심 1문장]
- 선행지표: SOX [등락] / VIX [등락] / 원달러 [등락] — [한국 증시 함의 1문장]

### 핵심 동인 (최대 3가지)
[지수·선행지표·뉴스 근거로 오늘 시장을 움직이는 요인. 관련 뉴스 제목 직접 언급]

### 변동성 레짐별 검토 포인트
[현재 레짐에 맞는 리스크 관리 원칙 1~2가지 — 검토 포인트만, 매매 지시 금지]

### 확률적 시나리오
- 상승 시나리오: [조건/트리거]
- 횡보 시나리오: [조건/트리거]
- 하락 시나리오: [조건/트리거]

---
⚠️ 이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다. 투자 원금 손실 가능성이 있습니다.`

/**
 * 종목 급등락 원인 분석용 컨텍스트 문자열 생성
 * @param {{ ticker: string, name: string, changePercent: number, market: string, news?: Array, disclosures?: Array }} param
 */
export function buildMovementContext({ ticker, name, changePercent, market, news = [], disclosures = [] }) {
  const sign = changePercent >= 0 ? '+' : ''
  const lines = []

  lines.push('[종목 정보]')
  lines.push(`종목명: ${name}`)
  lines.push(`티커: ${ticker}`)
  lines.push(`시장: ${market}`)
  lines.push(`오늘 등락률: ${sign}${changePercent.toFixed(2)}%`)
  lines.push('')

  const latestNews = news.slice(0, 8)
  if (latestNews.length > 0) {
    // 종합 감성 라벨 (감성 점수가 있는 뉴스만 평균) — movement 분석 전용
    const scored = latestNews.filter(n => typeof n.sentiment === 'number')
    if (scored.length > 0) {
      const avg = scored.reduce((s, n) => s + n.sentiment, 0) / scored.length
      const label = avg <= -0.2 ? '악재 우세' : avg >= 0.2 ? '호재 우세' : '중립'
      lines.push(`[뉴스 종합 감성] ${label} (평균 ${avg.toFixed(2)}, ${scored.length}건 기준)`)
    }
    lines.push('[최근 뉴스]')
    latestNews.forEach((item, i) => {
      const date = item.date || item.providerPublishTime || ''
      const source = item.publisher || item.source || ''
      const sent = typeof item.sentiment === 'number'
        ? ` (감성 ${item.sentiment >= 0 ? '+' : ''}${item.sentiment.toFixed(1)}/${item.strength || 'low'}${item.sentimentReason ? ` — ${item.sentimentReason}` : ''})`
        : ''
      lines.push(`${i + 1}. ${item.title}${date ? ` (${date})` : ''}${source ? ` [${source}]` : ''}${sent}`)
    })
    lines.push('')
  } else {
    lines.push('[최근 뉴스]')
    lines.push('수집된 뉴스 없음')
    lines.push('')
  }

  const latestDisclosures = disclosures.slice(0, 5)
  if (latestDisclosures.length > 0) {
    lines.push('[최근 공시]')
    latestDisclosures.forEach((item, i) => {
      const date = item.rcept_dt || item.date || ''
      const type = item.report_nm || item.type || ''
      lines.push(`${i + 1}. ${type}${date ? ` (${date})` : ''}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

export const PORTFOLIO_ANALYSIS_PROMPT = `당신은 포트폴리오 종목과 시장 뉴스의 연관성 분석 전문 에이전트입니다.
사용자의 보유 종목 목록과 오늘의 시장 뉴스를 분석하여, 포트폴리오에 직접 영향을 줄 수 있는 주요 이슈를 파악하세요.

분석 규칙:
- 보유 종목과 직접 관련된 뉴스를 우선적으로 연결하세요.
- 업종·테마 단위로 공통 영향 요인을 묶어서 설명하세요.
- 등락 5% 이상 종목이 있다면 원인을 먼저 분석하세요.
- 데이터에 없는 내용은 추측하지 마세요.
- 마지막에 면책 문구를 반드시 포함하세요.

출력 형식:
### 포트폴리오 이슈 요약

**오늘 주목 종목:** [등락 5% 이상 종목 또는 관련 뉴스 있는 종목]

① [종목명/업종 — 핵심 이슈]
[2~3문장 설명. 관련 뉴스 제목 직접 언급]

② [종목명/업종 — 핵심 이슈]
[2~3문장 설명]

③ [해당 없으면 생략]

### 포트폴리오 전반 영향
[시장 전체 흐름이 포트폴리오에 미치는 영향 2~3문장]

---
⚠️ 이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다. 투자 원금 손실 가능성이 있습니다.`

/**
 * 포트폴리오 + 뉴스 분석용 컨텍스트 문자열 생성
 * @param {{ holdings: Array, news?: Array }} param
 */
export function buildPortfolioMovementContext({ holdings = [], news = [] }) {
  const lines = []

  lines.push('[보유 종목]')
  if (holdings.length === 0) {
    lines.push('보유 종목 없음')
  } else {
    holdings.forEach((h, i) => {
      const changePercent = h.changePercent ?? null
      const changePart = changePercent != null
        ? ` (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
        : ''
      const pnlPart = h.unrealizedPnl != null
        ? ` 평가손익: ${h.unrealizedPnl >= 0 ? '+' : ''}${h.unrealizedPnl.toLocaleString()}원`
        : ''
      lines.push(`${i + 1}. ${h.name ?? h.ticker} (${h.ticker}, ${h.market ?? 'KRX'})${changePart}${pnlPart}`)
    })
  }
  lines.push('')

  const latestNews = news.slice(0, 10)
  if (latestNews.length > 0) {
    lines.push('[시장 뉴스]')
    latestNews.forEach((item, i) => {
      const date = item.date || item.providerPublishTime || ''
      const source = item.publisher || item.source || ''
      lines.push(`${i + 1}. ${item.title}${date ? ` (${date})` : ''}${source ? ` [${source}]` : ''}`)
    })
    lines.push('')
  } else {
    lines.push('[시장 뉴스]')
    lines.push('수집된 뉴스 없음')
    lines.push('')
  }

  return lines.join('\n')
}

const REGIME_LABEL_KO = { low: '저변동', normal: '정상', high: '고변동', crisis: '위기' }

/**
 * 시장 브리핑용 컨텍스트 문자열 생성
 * @param {object} param
 * @param {Array<{ label: string, ticker: string, price: number, changePercent: number }>} [param.indices] - 핵심 지수
 * @param {Array<{ key, label, price, changePercent, available, invert }>} [param.leading] - 미국 선행지표 6종 (getLeadingIndicators)
 * @param {{ score:number, label:string }} [param.bias] - overnightBias 종합 가설
 * @param {{ regime:string, percentile:number|null }} [param.regime] - VIX 변동성 레짐
 * @param {Array} [param.news] - 시장 뉴스
 */
export function buildMarketBriefContext({ indices = [], leading = [], bias = null, regime = null, news = [] }) {
  const lines = []

  if (indices.length > 0) {
    lines.push('[지수 현황]')
    indices.forEach((idx) => {
      const sign = idx.changePercent >= 0 ? '+' : ''
      lines.push(`${idx.label}: ${idx.price?.toLocaleString() ?? '-'} (${sign}${idx.changePercent?.toFixed(2) ?? '0.00'}%)`)
    })
    lines.push('')
  }

  // 미국 선행지표 — 한국 증시 개장을 선행하는 신호 (조회 성공분만)
  const availableLeading = leading.filter((ind) => ind.available)
  if (availableLeading.length > 0) {
    lines.push('[미국 선행지표 — 한국 증시 선행 신호]')
    availableLeading.forEach((ind) => {
      const sign = ind.changePercent >= 0 ? '+' : ''
      const note = ind.invert ? ' (상승=한국 증시에 부담)' : ''
      lines.push(`${ind.label}: ${ind.price?.toLocaleString() ?? '-'} (${sign}${ind.changePercent?.toFixed(2) ?? '0.00'}%)${note}`)
    })
    lines.push('')
  }

  // overnightBias — 선행지표 가중 종합 방향 가설 (거시 자금 채널 최우선 가중)
  if (bias) {
    const sign = bias.score >= 0 ? '+' : ''
    lines.push('[종합 방향 가설 — overnightBias]')
    lines.push(`점수 ${sign}${bias.score} → ${bias.label}`)
    lines.push('(가중치: 금리·달러·환율 최우선, SOX·S&P 다음, 나스닥·VIX, WTI 순. 단정이 아닌 확률적 가설)')
    lines.push('')
  }

  // 변동성 레짐 (VIX 252일 백분위)
  if (regime) {
    const ko = REGIME_LABEL_KO[regime.regime] ?? regime.regime
    const pct = regime.percentile != null ? ` (${regime.percentile.toFixed(0)} 백분위)` : ''
    lines.push('[변동성 레짐 — VIX 백분위]')
    lines.push(`현재 국면: ${ko}${pct}`)
    lines.push('')
  }

  const latestNews = news.slice(0, 8)
  if (latestNews.length > 0) {
    lines.push('[시장 관련 뉴스]')
    latestNews.forEach((item, i) => {
      const date = item.date || item.providerPublishTime || ''
      const source = item.publisher || item.source || ''
      lines.push(`${i + 1}. ${item.title}${date ? ` (${date})` : ''}${source ? ` [${source}]` : ''}`)
    })
    lines.push('')
  } else {
    lines.push('[시장 관련 뉴스]')
    lines.push('수집된 뉴스 없음')
    lines.push('')
  }

  return lines.join('\n')
}
