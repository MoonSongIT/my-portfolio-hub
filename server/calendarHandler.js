// 증시 캘린더 자동 탐색 핸들러 — DART (한국) + Finnhub (미국) 이벤트 수집

// ── 유틸 ──────────────────────────────────────────────────────────────

/** ISO 날짜(YYYY-MM-DD) → DART 날짜(YYYYMMDD) */
function toYYYYMMDD(iso) {
  return iso.replace(/-/g, '')
}

/** YYYYMMDD → YYYY-MM-DD */
function fromYYYYMMDD(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function jsonOk(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function jsonError(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: msg, events: [] }))
}

/** 요청 URL에서 from, to 쿼리 파라미터 추출 */
function getDateRange(req) {
  const url = new URL(req.url, 'http://localhost')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!from || !to) return null
  return { from, to }
}

/** DART corp_cls → 시장 코드 변환 */
function toMarket(corpCls) {
  if (corpCls === 'Y') return 'KRX'
  if (corpCls === 'K') return 'KOSDAQ'
  return null
}

// ── DART list.json 공통 호출 ──────────────────────────────────────────
/**
 * DART 공시 목록 API 호출
 * @param {string} dartApiKey
 * @param {string} bgnDe - YYYYMMDD
 * @param {string} endDe - YYYYMMDD
 * @param {string|null} pblntfTy - 공시 유형 코드
 * @param {number} pageCount
 * @returns {Promise<Array>}
 */
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
/**
 * GET /api/dart/calendar/dividend?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 반환: { events: [...CalendarEvent] }
 */
export async function handleDartCalendarDividend(req, res, dartApiKey) {
  if (!dartApiKey) return jsonOk(res, { events: [] })

  const dates = getDateRange(req)
  if (!dates) return jsonError(res, 400, 'from, to 파라미터 필요 (YYYY-MM-DD 형식)')

  try {
    const items = await fetchDartList(
      dartApiKey,
      toYYYYMMDD(dates.from),
      toYYYYMMDD(dates.to),
      null,
      100
    )

    // 배당·분배 관련 공시만 필터
    const dividendItems = items.filter(d =>
      d.report_nm.includes('배당') || d.report_nm.includes('분배')
    )

    const events = dividendItems.map(d => ({
      title: `[배당] ${d.corp_name}`,
      date: fromYYYYMMDD(d.rcept_dt),
      category: 'dividend',
      source: 'dart',
      ticker: d.stock_code || null,
      name: d.corp_name || null,
      market: toMarket(d.corp_cls),
      memo: d.report_nm,
    }))

    console.log(`[Calendar/DART-Dividend] ${events.length}건 조회 (${dates.from} ~ ${dates.to})`)
    jsonOk(res, { events })
  } catch (err) {
    console.error('[Calendar/DART-Dividend] 오류:', err.message)
    jsonOk(res, { events: [] })
  }
}

// ── DART 실적 공시 ────────────────────────────────────────────────────
/**
 * GET /api/dart/calendar/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 분기(A)/반기(B)/사업보고서(I) 병렬 조회 후 합산
 * 반환: { events: [...CalendarEvent] }
 */
export async function handleDartCalendarEarnings(req, res, dartApiKey) {
  if (!dartApiKey) return jsonOk(res, { events: [] })

  const dates = getDateRange(req)
  if (!dates) return jsonError(res, 400, 'from, to 파라미터 필요 (YYYY-MM-DD 형식)')

  try {
    const bgnDe = toYYYYMMDD(dates.from)
    const endDe = toYYYYMMDD(dates.to)

    // 분기/반기/사업보고서 병렬 조회
    const [quarterly, semiAnnual, annual] = await Promise.all([
      fetchDartList(dartApiKey, bgnDe, endDe, 'A', 50),
      fetchDartList(dartApiKey, bgnDe, endDe, 'B', 50),
      fetchDartList(dartApiKey, bgnDe, endDe, 'I', 50),
    ])

    // rcept_no 기준 중복 제거
    const seen = new Set()
    const unique = [...quarterly, ...semiAnnual, ...annual].filter(d => {
      if (seen.has(d.rcept_no)) return false
      seen.add(d.rcept_no)
      return true
    })

    const events = unique.map(d => ({
      title: `[실적] ${d.corp_name}`,
      date: fromYYYYMMDD(d.rcept_dt),
      category: 'earnings',
      source: 'dart',
      ticker: d.stock_code || null,
      name: d.corp_name || null,
      market: toMarket(d.corp_cls),
      memo: d.report_nm,
    }))

    console.log(`[Calendar/DART-Earnings] ${events.length}건 조회 (${dates.from} ~ ${dates.to})`)
    jsonOk(res, { events })
  } catch (err) {
    console.error('[Calendar/DART-Earnings] 오류:', err.message)
    jsonOk(res, { events: [] })
  }
}

// ── Finnhub 실적 캘린더 ───────────────────────────────────────────────
/**
 * GET /api/finnhub/calendar/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Finnhub API 키는 x-finnhub-api-key 헤더로 전달
 * 반환: { events: [...CalendarEvent] }
 */
export async function handleFinnhubCalendarEarnings(req, res, finnhubApiKey) {
  if (!finnhubApiKey) return jsonOk(res, { events: [] })

  const dates = getDateRange(req)
  if (!dates) return jsonError(res, 400, 'from, to 파라미터 필요 (YYYY-MM-DD 형식)')

  try {
    const resp = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${dates.from}&to=${dates.to}&token=${finnhubApiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    )

    if (!resp.ok) {
      console.warn(`[Calendar/Finnhub-Earnings] API 오류 ${resp.status}`)
      return jsonOk(res, { events: [] })
    }

    const data = await resp.json()
    const earnings = data.earningsCalendar || []

    const events = earnings.map(e => {
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

    console.log(`[Calendar/Finnhub-Earnings] ${events.length}건 조회 (${dates.from} ~ ${dates.to})`)
    jsonOk(res, { events })
  } catch (err) {
    console.error('[Calendar/Finnhub-Earnings] 오류:', err.message)
    jsonOk(res, { events: [] })
  }
}

// ── Finnhub IPO 캘린더 ────────────────────────────────────────────────
/**
 * GET /api/finnhub/calendar/ipo?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Finnhub API 키는 x-finnhub-api-key 헤더로 전달
 * 반환: { events: [...CalendarEvent] }
 */
export async function handleFinnhubCalendarIpo(req, res, finnhubApiKey) {
  if (!finnhubApiKey) return jsonOk(res, { events: [] })

  const dates = getDateRange(req)
  if (!dates) return jsonError(res, 400, 'from, to 파라미터 필요 (YYYY-MM-DD 형식)')

  try {
    const resp = await fetch(
      `https://finnhub.io/api/v1/calendar/ipo?from=${dates.from}&to=${dates.to}&token=${finnhubApiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    )

    if (!resp.ok) {
      console.warn(`[Calendar/Finnhub-IPO] API 오류 ${resp.status}`)
      return jsonOk(res, { events: [] })
    }

    const data = await resp.json()
    const ipos = data.ipoCalendar || []

    const events = ipos.map(e => ({
      title: `[IPO] ${e.name || e.symbol}`,
      date: e.date,
      category: 'ipo',
      source: 'finnhub',
      ticker: e.symbol || null,
      market: e.exchange || null,
      memo: e.price ? `공모가: ${e.price}` : null,
    }))

    console.log(`[Calendar/Finnhub-IPO] ${events.length}건 조회 (${dates.from} ~ ${dates.to})`)
    jsonOk(res, { events })
  } catch (err) {
    console.error('[Calendar/Finnhub-IPO] 오류:', err.message)
    jsonOk(res, { events: [] })
  }
}
