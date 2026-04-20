// SEC EDGAR 핸들러 — 미국 상장사 공시 조회
// User-Agent 필수 (SEC 정책): MyPortfolioHub/1.0 (portfolio@hub.local)

const EDGAR_UA = 'MyPortfolioHub/1.0 (portfolio@hub.local)'

// 관심 있는 SEC Form 타입
const IMPORTANT_FORMS = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K', 'DEF 14A', 'S-1'])

// ── SEC CIK 캐시 ────────────────────────────────────────────────────
/** @type {Map<string, string>|null} ticker(대문자) → CIK(10자리 패딩) */
let cikMap = null
let cikMapLoadedAt = 0
const CIK_MAP_TTL = 7 * 24 * 60 * 60 * 1000  // 7일

/**
 * SEC company_tickers.json 다운로드 후 Map으로 변환 (메모리 캐시)
 * agenticHandler.js에서도 재사용 — 동일 모듈 싱글턴으로 캐시 공유
 * @returns {Promise<Map<string, string>>}
 */
export async function getCikMap() {
  if (cikMap && Date.now() - cikMapLoadedAt < CIK_MAP_TTL) return cikMap

  console.log('[EDGAR] company_tickers.json 다운로드 중...')
  const resp = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': EDGAR_UA },
  })
  if (!resp.ok) throw new Error(`SEC company_tickers 다운로드 실패: ${resp.status}`)

  const data = await resp.json()
  const map  = new Map()
  for (const item of Object.values(data)) {
    map.set(item.ticker.toUpperCase(), String(item.cik_str).padStart(10, '0'))
  }

  cikMap          = map
  cikMapLoadedAt  = Date.now()
  console.log(`[EDGAR] CIK 맵 로드 완료: ${map.size}개 ticker`)
  return map
}

// ── 핸들러 ──────────────────────────────────────────────────────────
/**
 * GET /api/edgar/filings?ticker={ticker}&days={days}
 * 반환: { items: [{ date, title, url, kind }] }
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 */
export async function handleEdgarFilings(req, res) {
  const urlObj = new URL(req.url, 'http://localhost')
  const ticker = urlObj.searchParams.get('ticker')
  const days   = parseInt(urlObj.searchParams.get('days') || '30', 10)

  if (!ticker) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'ticker 파라미터 필요' }))
  }

  try {
    const map = await getCikMap()
    const cik = map.get(ticker.toUpperCase())

    if (!cik) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ items: [] }))
    }

    const subResp = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': EDGAR_UA },
    })
    if (!subResp.ok) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ items: [] }))
    }

    const data   = await subResp.json()
    const recent = data.filings?.recent
    if (!recent?.filingDate?.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ items: [] }))
    }

    const cutoff = Date.now() - days * 86400_000
    const cikInt = parseInt(cik, 10)
    const items  = []

    for (let i = 0; i < Math.min(recent.filingDate.length, 100); i++) {
      if (items.length >= 10) break

      const form = recent.form[i]
      if (!IMPORTANT_FORMS.has(form)) continue

      // 날짜 범위 초과 시 중단 (내림차순 정렬 가정)
      if (new Date(recent.filingDate[i]).getTime() < cutoff) break

      const accNo      = recent.accessionNumber[i]
      const accNoDash  = accNo.replace(/-/g, '')
      const primaryDoc = recent.primaryDocument?.[i] || `${accNoDash}.txt`
      const docDesc    = recent.primaryDocDescription?.[i] || primaryDoc

      items.push({
        date:  recent.filingDate[i],
        title: `${form}: ${docDesc}`,
        url:   `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDash}/${primaryDoc}`,
        kind:  form,
      })
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ items }))
  } catch (err) {
    console.error('[EDGAR] 오류:', err.message)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ items: [] }))
  }
}
