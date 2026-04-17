import axios from 'axios'
import { getKrxParValue } from '../data/krxParValues'
import { getIndustryName, getSectorName } from '../data/naverIndustry'

const naverApi = axios.create({
  baseURL: '/api/naver',
  timeout: 10000,
})

// ─── 파싱 유틸 ─────────────────────────────────────────────────────────────

// totalInfos 배열에서 code 로 value 추출
const getInfo = (totalInfos, code) => {
  const item = totalInfos?.find(i => i.code === code)
  return item?.value ?? null
}

// "1,234" / "28,354,698" → 숫자
const parseNum = (str) => {
  if (str == null) return null
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

// "1,210조 5,660억" → 원 단위 숫자 (시가총액)
const parseKoreanCap = (str) => {
  if (str == null) return null
  let total = 0
  const joMatch  = str.match(/([\d,]+)조/)
  const eokMatch = str.match(/([\d,]+)억/)
  if (joMatch)  total += parseNum(joMatch[1])  * 1e12
  if (eokMatch) total += parseNum(eokMatch[1]) * 1e8
  return total > 0 ? total : null
}

// "31.15배" / "48.46%" / "0.81%" → 숫자만
const parseRatio = (str) => {
  if (str == null) return null
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

// ─── 액면가: Naver Finance 데스크탑 HTML 파싱 ───────────────────────────────
// 조사 결과: m.stock.naver.com 모바일 API(basic/integration) 에는 액면가 필드 없음
// finance.naver.com 데스크탑 페이지의 서버사이드 렌더링 HTML에만 존재
// 패턴: <th scope="row">액면가<span ...>...</th><td><em>500</em>원

const naverPcApi = axios.create({
  baseURL: '/api/naver-pc',
  timeout: 8000,
})

// 캐시: { ticker → parValue } (세션 중 중복 요청 방지)
const _parValueCache = {}

export const fetchNaverParValue = async (ticker) => {
  if (_parValueCache[ticker] !== undefined) return _parValueCache[ticker]

  try {
    const { data: html } = await naverPcApi.get(`/item/main.naver`, {
      params: { code: ticker },
      responseType: 'text',
    })
    // 액면가 th 이후 첫 번째 <em>숫자</em>원 추출
    const match = html.match(/액면가[\s\S]{0,200}?<em>([\d,]+)<\/em>원/)
    const val = match ? parseFloat(match[1].replace(/,/g, '')) : null
    _parValueCache[ticker] = val
    return val
  } catch {
    _parValueCache[ticker] = null
    return null
  }
}

// ─── 1. 실시간 시세 ─────────────────────────────────────────────────────────

export const fetchNaverQuote = async (ticker) => {
  const { data } = await naverApi.get(`/api/stock/${ticker}/basic`)

  const currentPrice = parseNum(data.closePrice)
  const change       = parseNum(data.compareToPreviousClosePrice)
  const prevClose    = (change != null && currentPrice != null) ? currentPrice - change : null

  // 액면가: 정적 테이블 우선, 없으면 데스크탑 HTML 파싱 (비동기, quote에서는 캐시 활용)
  const parValue = getKrxParValue(ticker) ?? await fetchNaverParValue(ticker)

  return {
    ticker,
    yahooTicker: ticker,
    name:          data.stockName || ticker,
    currentPrice,
    previousClose: prevClose,
    change,
    changePercent: parseNum(data.fluctuationsRatio),
    volume:        parseNum(data.accumulatedTradingVolume),
    currency:      'KRW',
    exchangeName:  'KRX',
    marketState:   data.marketStatus === 'OPEN' ? 'REGULAR' : 'CLOSED',
    timestamp:     Date.now(),
    fiftyTwoWeekHigh: null,   // integration API 에서 보완
    fiftyTwoWeekLow:  null,
    marketCap:        null,
    parValue,                 // 액면가 (원)
  }
}

// ─── 2. 기업 상세 + 재무 지표 ───────────────────────────────────────────────

export const fetchNaverProfile = async (ticker) => {
  // integration + finance/annual 병렬 호출
  const [integrationRes, financeRes] = await Promise.all([
    naverApi.get(`/api/stock/${ticker}/integration`),
    naverApi.get(`/api/stock/${ticker}/finance/annual`).catch(() => ({ data: null })),
  ])
  const data  = integrationRes.data
  const infos = data.totalInfos || []

  // ── finance/annual 에서 재무지표 추출 ─────────────────────────
  const finData  = financeRes.data
  const rowList  = finData?.financeInfo?.rowList || []
  const trTitles = finData?.financeInfo?.trTitleList || []

  // rowList에서 title로 row 찾기
  const getRow = (title) => rowList.find(r => r.title === title)

  // 가장 최근 실적 연도 키 찾기 (컨센서스 아닌 것 중 마지막)
  const actualYears = trTitles.filter(t => t.isConsensus === 'N').map(t => t.key)
  const latestYear  = actualYears[actualYears.length - 1]   // 예: "202512"
  const prevYear    = actualYears[actualYears.length - 2]    // 예: "202412"

  // row에서 특정 연도의 value 파싱
  const getRowValue = (title, yearKey) => {
    const row = getRow(title)
    if (!row?.columns || !yearKey) return null
    const cell = row.columns[yearKey]
    if (!cell || cell.value === '-' || cell.value == null) return null
    return parseNum(cell.value)
  }

  // 기업 개요 (corporationSummary)
  const corpSummary = finData?.corporationSummary
  const description = corpSummary
    ? [corpSummary.comment1, corpSummary.comment2, corpSummary.comment3].filter(Boolean).join(' ')
    : (data.companySummary || null)

  // ── 섹터 / 업종 (industryCode → 정적 매핑 테이블 조회) ────────
  const industryCode = data.industryCode      // 예: "278"
  const industry = getIndustryName(industryCode)   // 예: "반도체와반도체장비"
  const sector   = getSectorName(industryCode)     // 예: "정보기술"

  // ── totalInfos 확인된 필드 매핑 ─────────────────────────────
  // 가격 정보 (integration 응답의 당일 현재가 기준)
  const todayVolume       = parseNum(getInfo(infos, 'accumulatedTradingVolume'))
  const tradingValue      = parseNum(getInfo(infos, 'accumulatedTradingValue'))   // 거래대금(백만)

  // 시가총액
  const marketCap         = parseKoreanCap(getInfo(infos, 'marketValue'))

  // 52주 고저
  const fiftyTwoWeekHigh  = parseNum(getInfo(infos, 'highPriceOf52Weeks'))
  const fiftyTwoWeekLow   = parseNum(getInfo(infos, 'lowPriceOf52Weeks'))

  // 외국인 보유율: "48.46%" → 48.46
  const foreignRate       = parseRatio(getInfo(infos, 'foreignRate'))

  // 밸류에이션
  const trailingPE        = parseRatio(getInfo(infos, 'per'))       // PER
  const forwardPE         = parseRatio(getInfo(infos, 'cnsPer'))    // 추정 PER
  const priceToBook       = parseRatio(getInfo(infos, 'pbr'))       // PBR

  // 주당 지표
  const eps               = parseNum(getInfo(infos, 'eps'))         // 주당순이익
  const cnsEps            = parseNum(getInfo(infos, 'cnsEps'))      // 추정 EPS
  const bps               = parseNum(getInfo(infos, 'bps'))         // 주당순자산

  // 배당
  // dividendYieldRatio: "0.81%" → 0.81 → /100 → 0.0081 (Yahoo 형식과 일치)
  const dividendYieldRaw  = parseRatio(getInfo(infos, 'dividendYieldRatio'))
  const dividendYield     = dividendYieldRaw != null ? dividendYieldRaw / 100 : null
  const dividendPerShare  = parseNum(getInfo(infos, 'dividend'))    // 주당 배당금(원)

  // ── 평균 거래량: 최근 20거래일 히스토리 평균 ──────────────────
  let averageVolume = todayVolume   // 히스토리 실패 시 오늘 거래량으로 대체
  try {
    const history = await fetchNaverHistory(ticker, '1mo')
    if (history.length > 0) {
      const recent = history.slice(-20)
      averageVolume = Math.round(recent.reduce((s, d) => s + (d.volume || 0), 0) / recent.length)
    }
  } catch { /* 실패 시 오늘 거래량 유지 */ }

  // ── 애널리스트 컨센서스 (integration → 폴백: consensus/items 엔드포인트) ──
  let targetMeanPrice = null
  let recommendationKey = null
  let numberOfAnalystOpinions = null

  const cs = data.consensusInfo
  if (cs) {
    // integration 응답에 직접 포함된 경우
    // consensusInfo: { recommMean: "4.00", priceTargetMean: "286,000" }
    targetMeanPrice = parseNum(cs.priceTargetMean)
    const recomm = parseFloat(cs.recommMean)
    if (!isNaN(recomm)) {
      // 1=강력매도, 2=매도, 3=중립, 4=매수, 5=강력매수
      if      (recomm >= 3.5) recommendationKey = 'buy'
      else if (recomm >= 2.5) recommendationKey = 'hold'
      else                    recommendationKey = 'sell'
    }
  } else {
    // integration에 없으면 별도 컨센서스 엔드포인트 시도
    try {
      const cnsRes = await naverApi.get(`/api/stock/${ticker}/consensus`, {
        params: { page: 1, pageSize: 1 },
      })
      const cnsData = cnsRes.data

      // 응답 구조 예: { targetPrice: "286,000", opinion: "4.0", count: 12 }
      // 또는 배열 형태: [{ targetPriceMean: "286,000", opinionMean: "4.0", count: 12 }]
      const cnsItem = Array.isArray(cnsData) ? cnsData[0] : cnsData
      if (cnsItem) {
        const rawTarget = cnsItem.targetPriceMean ?? cnsItem.targetPrice ?? cnsItem.priceTargetMean
        targetMeanPrice = parseNum(rawTarget)
        const rawOpinion = cnsItem.opinionMean ?? cnsItem.opinion ?? cnsItem.recommMean
        const recomm = parseFloat(rawOpinion)
        if (!isNaN(recomm)) {
          if      (recomm >= 3.5) recommendationKey = 'buy'
          else if (recomm >= 2.5) recommendationKey = 'hold'
          else                    recommendationKey = 'sell'
        }
        numberOfAnalystOpinions = cnsItem.count ?? cnsItem.analystCount ?? null
      }
    } catch { /* 컨센서스 폴백 실패 시 null 유지 */ }
  }

  // 액면가: 정적 테이블 우선, 없으면 데스크탑 HTML 파싱 (캐시 공유)
  const parValue = getKrxParValue(ticker) ?? await fetchNaverParValue(ticker)

  // ── finance/annual 재무 비율 (최신 실적 연도 기준) ──────────────
  // ROE: "10.85" → 0.1085 (비율 형태)
  const roeRaw = getRowValue('ROE', latestYear)
  const returnOnEquity = roeRaw != null ? roeRaw / 100 : null

  // 부채비율: "29.94" → 29.94 (% 그대로)
  const debtToEquity = getRowValue('부채비율', latestYear)

  // 당좌비율 (= 유동비율 대용): "183.27" → 183.27 (%)
  const currentRatio = getRowValue('당좌비율', latestYear)

  // 영업이익률: "13.07" → 0.1307
  const operatingMarginRaw = getRowValue('영업이익률', latestYear)
  const operatingMargin = operatingMarginRaw != null ? operatingMarginRaw / 100 : null

  // 순이익률: "13.55" → 0.1355
  const netMarginRaw = getRowValue('순이익률', latestYear)
  const netMargin = netMarginRaw != null ? netMarginRaw / 100 : null

  // 매출 성장률: (최신 매출 - 전년 매출) / 전년 매출
  const latestRevenue = getRowValue('매출액', latestYear)
  const prevRevenue   = getRowValue('매출액', prevYear)
  const revenueGrowth = (latestRevenue != null && prevRevenue != null && prevRevenue > 0)
    ? (latestRevenue - prevRevenue) / prevRevenue
    : null

  // 이익 성장률: (최신 당기순이익 - 전년) / 전년
  const latestIncome = getRowValue('당기순이익', latestYear)
  const prevIncome   = getRowValue('당기순이익', prevYear)
  const earningsGrowth = (latestIncome != null && prevIncome != null && prevIncome > 0)
    ? (latestIncome - prevIncome) / prevIncome
    : null

  return {
    // 기업 개요
    sector,
    industry,
    website:       null,
    description,
    country:       'KR',
    parValue,                  // 액면가 (원)

    // 시장 정보
    marketCap,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    averageVolume,
    todayVolume,
    tradingValue,          // 거래대금 (백만원)
    foreignRate,           // 외국인 보유율 (%)

    // 배당
    dividendYield,
    dividendPerShare,      // 주당 배당금 (원)

    // 밸류에이션
    trailingPE,
    forwardPE,
    priceToBook,

    // 주당 지표
    eps,
    cnsEps,
    bps,

    // 재무 비율 (finance/annual 기준)
    returnOnEquity,        // ROE (0~1 소수)
    debtToEquity,          // 부채비율 (%)
    currentRatio,          // 당좌비율 (%)
    operatingMargin,       // 영업이익률 (0~1 소수)
    netMargin,             // 순이익률 (0~1 소수)
    revenueGrowth,         // 매출 성장률 (0~1 소수)
    earningsGrowth,        // 이익 성장률 (0~1 소수)

    // 컨센서스
    targetMeanPrice,
    recommendationKey,
    numberOfAnalystOpinions,
  }
}

// ─── 3. 가격 히스토리 ──────────────────────────────────────────────────────

// Naver price API는 pageSize (최대 60) + page 파라미터 사용
// startDateTime/endDateTime 무시됨

// range → 필요한 총 거래일수 매핑
const rangeToDays = (range) => {
  switch (range) {
    case '5d':  return 7       // 1주 (주말 포함)
    case '1mo': return 25      // 약 1개월 거래일
    case '3mo': return 65      // 약 3개월 거래일
    case '6mo': return 130     // 약 6개월 거래일
    case '1y':  return 250     // 약 1년 거래일
    case '2y':  return 500     // 약 2년 거래일
    case '5y':  return 1250    // 약 5년 거래일
    default:    return 130
  }
}

const MAX_PAGE_SIZE = 60

export const fetchNaverHistory = async (ticker, range = '6mo') => {
  const totalDays = rangeToDays(range)
  const totalPages = Math.ceil(totalDays / MAX_PAGE_SIZE)

  // 페이지별 병렬 요청
  const pagePromises = []
  for (let p = 1; p <= totalPages; p++) {
    pagePromises.push(
      naverApi.get(`/api/stock/${ticker}/price`, {
        params: { pageSize: MAX_PAGE_SIZE, page: p },
      }).then(res => res.data).catch(() => [])
    )
  }
  const pages = await Promise.all(pagePromises)

  // 전체 데이터 합치기 (각 페이지: 최신→과거 순)
  const allItems = pages.flatMap(data =>
    Array.isArray(data) ? data : (data?.priceInfos || [])
  )

  // 필요한 개수만큼만 자르기 & OHLCV 변환
  const result = allItems
    .slice(0, totalDays)
    .map(item => ({
      date:   item.localTradedAt?.slice(0, 10) || '',
      open:   parseNum(item.openPrice),
      high:   parseNum(item.highPrice),
      low:    parseNum(item.lowPrice),
      close:  parseNum(item.closePrice),
      volume: parseNum(item.accumulatedTradingVolume),
    }))
    .filter(d => d.close != null && d.date)

  // 과거→최신 순으로 정렬 (차트 라이브러리 요구사항)
  result.sort((a, b) => a.date.localeCompare(b.date))

  return result
}
