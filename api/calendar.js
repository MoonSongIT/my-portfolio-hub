// 증시 캘린더 자동 탐색 통합 서버리스 함수 — DART(한국) + Finnhub(미국)
// Hobby 플랜 함수 12개 제한 때문에 4개 엔드포인트를 ?type= 파라미터로 통합
// vercel.json rewrite로 매핑:
//   /api/dart/calendar/dividend     → ?type=dart-dividend
//   /api/dart/calendar/earnings     → ?type=dart-earnings
//   /api/finnhub/calendar/earnings  → ?type=finnhub-earnings
//   /api/finnhub/calendar/ipo       → ?type=finnhub-ipo
import { setCors, handlePreflight } from './_cors.js'

// ── 유틸 ──────────────────────────────────────────────────────────────
/** ISO 날짜(YYYY-MM-DD) → DART 날짜(YYYYMMDD) */
function toYYYYMMDD(iso) {
  return iso.replace(/-/g, '')
}

/** YYYYMMDD → YYYY-MM-DD */
function fromYYYYMMDD(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/** DART corp_cls → 시장 코드 변환 */
function toMarket(corpCls) {
  if (corpCls === 'Y') return 'KRX'
  if (corpCls === 'K') return 'KOSDAQ'
  return null
}

// ── DART list.json 공통 호출 ──────────────────────────────────────────
async function fetchDartList(dartApiKey, bgnDe, endDe, pblntfTy, pageCount = 100) {
  const params = new URLSearchParams({
    crtfc_key: dartApiKey,
    bgn_de: bgnDe,
    end_de: endDe,
    page_count: String(pageCount),
  })
  if (pblntfTy) params.set('pblntf_ty', pblntfTy)

  const resp = await fetch(
    `https://opendart.fss.or.kr/api/list.json?${params}`,
    { headers: { 'User-Agent': 'MyPortfolioHub/1.0' }, signal: AbortSignal.timeout(15_000) }
  )
  if (!resp.ok) return []
  const data = await resp.json()
  if (data.status !== '000') return []
  return data.list || []
}

// ── DART 배당 일정 ───────────────────────────────────────────────────
async function getDartDividend(dartApiKey, from, to) {
  const items = await fetchDartList(dartApiKey, toYYYYMMDD(from), toYYYYMMDD(to), null, 100)
  const dividendItems = items.filter(d =>
    d.report_nm.includes('배당') || d.report_nm.includes('분배')
  )
  return dividendItems.map(d => ({
    title: `[배당] ${d.corp_name}`,
    date: fromYYYYMMDD(d.rcept_dt),
    category: 'dividend',
    source: 'dart',
    ticker: d.stock_code || null,
    name: d.corp_name || null,
    market: toMarket(d.corp_cls),
    memo: d.report_nm,
  }))
}

// ── DART 실적 공시 (분기 A / 반기 B / 사업보고서 I 병렬) ──────────────
async function getDartEarnings(dartApiKey, from, to) {
  const bgnDe = toYYYYMMDD(from)
  const endDe = toYYYYMMDD(to)
  const [quarterly, semiAnnual, annual] = await Promise.all([
    fetchDartList(dartApiKey, bgnDe, endDe, 'A', 50),
    fetchDartList(dartApiKey, bgnDe, endDe, 'B', 50),
    fetchDartList(dartApiKey, bgnDe, endDe, 'I', 50),
  ])

  const seen = new Set()
  const unique = [...quarterly, ...semiAnnual, ...annual].filter(d => {
    if (seen.has(d.rcept_no)) return false
    seen.add(d.rcept_no)
    return true
  })

  return unique.map(d => ({
    title: `[실적] ${d.corp_name}`,
    date: fromYYYYMMDD(d.rcept_dt),
    category: 'earnings',
    source: 'dart',
    ticker: d.stock_code || null,
    name: d.corp_name || null,
    market: toMarket(d.corp_cls),
    memo: d.report_nm,
  }))
}

// ── Finnhub 실적 캘린더 ───────────────────────────────────────────────
async function getFinnhubEarnings(finnhubApiKey, from, to) {
  const resp = await fetch(
    `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${finnhubApiKey}`,
    { signal: AbortSignal.timeout(10_000) }
  )
  if (!resp.ok) return []
  const data = await resp.json()
  const earnings = data.earningsCalendar || []
  return earnings.map(e => {
    const timing = e.hour === 'bmo' ? '장전' : e.hour === 'amc' ? '장후' : '장중'
    const eps = e.epsEstimate != null ? `EPS 예상: ${e.epsEstimate} (${timing})` : null
    return {
      title: `[실적] ${e.symbol}`,
      date: e.date,
      category: 'earnings',
      source: 'finnhub',
      ticker: e.symbol,
      market: null,
      memo: eps,
    }
  })
}

// ── Finnhub IPO 캘린더 ────────────────────────────────────────────────
async function getFinnhubIpo(finnhubApiKey, from, to) {
  const resp = await fetch(
    `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${finnhubApiKey}`,
    { signal: AbortSignal.timeout(10_000) }
  )
  if (!resp.ok) return []
  const data = await resp.json()
  const ipos = data.ipoCalendar || []
  return ipos.map(e => ({
    title: `[IPO] ${e.name || e.symbol}`,
    date: e.date,
    category: 'ipo',
    source: 'finnhub',
    ticker: e.symbol || null,
    market: e.exchange || null,
    memo: e.price ? `공모가: ${e.price}` : null,
  }))
}

// ── 핸들러 ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const { type, from, to } = req.query
  if (!from || !to) {
    return res.status(400).json({ error: 'from, to 파라미터 필요 (YYYY-MM-DD 형식)', events: [] })
  }

  const dartKey = req.headers['x-dart-api-key'] || process.env.DART_API_KEY || ''
  const finnhubKey = req.headers['x-finnhub-api-key'] || process.env.FINNHUB_API_KEY || ''

  try {
    let events = []
    switch (type) {
      case 'dart-dividend':
        if (dartKey) events = await getDartDividend(dartKey, from, to)
        break
      case 'dart-earnings':
        if (dartKey) events = await getDartEarnings(dartKey, from, to)
        break
      case 'finnhub-earnings':
        if (finnhubKey) events = await getFinnhubEarnings(finnhubKey, from, to)
        break
      case 'finnhub-ipo':
        if (finnhubKey) events = await getFinnhubIpo(finnhubKey, from, to)
        break
      default:
        return res.status(400).json({ error: `알 수 없는 type: ${type}`, events: [] })
    }
    res.status(200).json({ events })
  } catch (err) {
    console.error(`[Calendar/${type}] 오류:`, err.message)
    res.status(200).json({ events: [] })
  }
}
