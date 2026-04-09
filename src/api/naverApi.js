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

// ─── 1. 실시간 시세 ─────────────────────────────────────────────────────────

export const fetchNaverQuote = async (ticker) => {
  const { data } = await naverApi.get(`/api/stock/${ticker}/basic`)

  const currentPrice = parseNum(data.closePrice)
  const change       = parseNum(data.compareToPreviousClosePrice)
  const prevClose    = (change != null && currentPrice != null) ? currentPrice - change : null

  // 액면가: basic API에 있으면 사용, 없으면 정적 테이블 폴백
  const parValueFromApi = data.parValue != null ? parseNum(data.parValue) : null
  const parValue = parValueFromApi ?? getKrxParValue(ticker)

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
  const { data } = await naverApi.get(`/api/stock/${ticker}/integration`)
  const infos = data.totalInfos || []

  // 개발 모드 디버깅 (배포 시 자동 제거)
  if (import.meta.env.DEV) {
    console.log('[Naver] industryCode:', data.industryCode)
    console.log('[Naver] totalInfos:', infos.map(i => `${i.code}="${i.value}"`).join(' | '))
  }

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

  // ── 애널리스트 컨센서스 (integration 응답에 포함됨) ─────────────
  let targetMeanPrice = null
  let recommendationKey = null
  let numberOfAnalystOpinions = null
  const cs = data.consensusInfo
  if (cs) {
    // consensusInfo: { recommMean: "4.00", priceTargetMean: "286,000" }
    targetMeanPrice = parseNum(cs.priceTargetMean)
    const recomm = parseFloat(cs.recommMean)
    if (!isNaN(recomm)) {
      // 1=강력매도, 2=매도, 3=중립, 4=매수, 5=강력매수
      if      (recomm >= 3.5) recommendationKey = 'buy'
      else if (recomm >= 2.5) recommendationKey = 'hold'
      else                    recommendationKey = 'sell'
    }
  }

  // 액면가: integration API 혹은 totalInfos에 있으면 사용, 없으면 정적 테이블
  const parValueFromInfos = parseNum(getInfo(infos, 'parValue') ?? getInfo(infos, 'faceValue'))
  const parValue = parValueFromInfos ?? getKrxParValue(ticker)

  return {
    // 기업 개요
    sector,
    industry,
    website:       null,
    description:   data.companySummary || null,
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

    // 아래는 Naver 기본 API에서 미제공 (항상 null)
    returnOnEquity:          null,
    debtToEquity:            null,
    revenueGrowth:           null,
    earningsGrowth:          null,
    currentRatio:            null,

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
