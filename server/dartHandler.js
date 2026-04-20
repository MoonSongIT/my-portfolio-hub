// DART OpenAPI 핸들러 — 한국 상장사 공시 조회
// Node.js 내장 모듈(zlib)만 사용 — 외부 ZIP 라이브러리 불필요
import { inflateRawSync } from 'node:zlib'

// ── ZIP 파서 (내장 zlib 기반) ──────────────────────────────────────
/**
 * ZIP 버퍼에서 특정 파일 항목을 추출
 * @param {Buffer} buf - ZIP 파일 바이너리
 * @param {string} filename - 추출할 파일명 (예: 'CORPCODE.xml')
 * @returns {Buffer} 압축 해제된 데이터
 */
function extractZipEntry(buf, filename) {
  // EOCD(End of Central Directory) 시그니처: PK\x05\x06
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('ZIP: EOCD 레코드를 찾을 수 없습니다')

  const numEntries = buf.readUInt16LE(eocdOffset + 10)
  const cdOffset   = buf.readUInt32LE(eocdOffset + 16)

  let pos = cdOffset
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break  // Central Dir 시그니처 검사

    const comprMethod  = buf.readUInt16LE(pos + 10)
    const compSize     = buf.readUInt32LE(pos + 20)
    const fnLen        = buf.readUInt16LE(pos + 28)
    const extraLen     = buf.readUInt16LE(pos + 30)
    const commentLen   = buf.readUInt16LE(pos + 32)
    const localOffset  = buf.readUInt32LE(pos + 42)
    const entryName    = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf-8')

    if (entryName === filename) {
      // Local file header 읽기
      const lFnLen    = buf.readUInt16LE(localOffset + 26)
      const lExtraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + lFnLen + lExtraLen
      const compressed = buf.slice(dataStart, dataStart + compSize)

      if (comprMethod === 0) return compressed         // 무압축 (stored)
      if (comprMethod === 8) return inflateRawSync(compressed)  // DEFLATE
      throw new Error(`ZIP: 지원하지 않는 압축 방식 (${comprMethod})`)
    }

    pos += 46 + fnLen + extraLen + commentLen
  }
  throw new Error(`ZIP: '${filename}' 항목을 찾을 수 없습니다`)
}

// ── DART corp_code 캐시 ───────────────────────────────────────────
/** @type {Map<string, string>|null} stockCode → corpCode */
let corpMap = null
let corpMapLoadedAt = 0
const CORP_MAP_TTL = 7 * 24 * 60 * 60 * 1000  // 7일

/**
 * DART corp_code 맵 반환 (최초 1회 다운로드 후 메모리 캐시)
 * agenticHandler.js에서도 재사용 — 동일 모듈 싱글턴으로 캐시 공유
 * @param {string} apiKey - DART API 키
 * @returns {Promise<Map<string, string>>}
 */
export async function getCorpMap(apiKey) {
  if (corpMap && Date.now() - corpMapLoadedAt < CORP_MAP_TTL) return corpMap

  console.log('[DART] corpCode.xml 다운로드 중...')
  const resp = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`,
    { headers: { 'User-Agent': 'MyPortfolioHub/1.0' } }
  )
  if (!resp.ok) throw new Error(`DART corpCode 다운로드 실패: ${resp.status}`)

  const buf = Buffer.from(await resp.arrayBuffer())
  const xml = extractZipEntry(buf, 'CORPCODE.xml').toString('utf-8')

  const map = new Map()
  const re  = /<list>([\s\S]*?)<\/list>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const block    = m[1]
    const stockRaw = (/<stock_code>\s*(.*?)\s*<\/stock_code>/.exec(block) || [])[1]
    const corpCode = (/<corp_code>\s*(.*?)\s*<\/corp_code>/.exec(block) || [])[1]
    const stockCode = stockRaw?.trim()
    if (stockCode && stockCode.length > 0 && corpCode) {
      map.set(stockCode, corpCode.trim())
    }
  }

  corpMap          = map
  corpMapLoadedAt  = Date.now()
  console.log(`[DART] corp_code 맵 로드 완료: ${map.size}개사`)
  return map
}

// ── 유틸 ────────────────────────────────────────────────────────────
function toYYYYMMDD(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// ── 핸들러 ──────────────────────────────────────────────────────────
/**
 * GET /api/dart/list?ticker={ticker}&days={days}
 * 반환: { items: [{ date, title, url, kind }] }
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @param {string} dartApiKey
 */
export async function handleDartList(req, res, dartApiKey) {
  // DART 키 미설정 시 빈 배열 반환 (분석은 계속)
  if (!dartApiKey) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ items: [] }))
  }

  const urlObj  = new URL(req.url, 'http://localhost')
  const ticker  = urlObj.searchParams.get('ticker')
  const days    = parseInt(urlObj.searchParams.get('days') || '30', 10)

  if (!ticker) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'ticker 파라미터 필요' }))
  }

  try {
    const map        = await getCorpMap(dartApiKey)
    const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')
    const corpCode   = map.get(cleanTicker)

    if (!corpCode) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ items: [] }))
    }

    const bgn_de = toYYYYMMDD(new Date(Date.now() - days * 86400_000))
    const end_de = toYYYYMMDD(new Date())

    const dartResp = await fetch(
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${dartApiKey}&corp_code=${corpCode}&bgn_de=${bgn_de}&end_de=${end_de}&page_count=10`,
      { headers: { 'User-Agent': 'MyPortfolioHub/1.0' } }
    )

    const data = await dartResp.json()

    if (data.status !== '000') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ items: [] }))
    }

    const items = (data.list || []).slice(0, 10).map(d => ({
      date:  `${d.rcept_dt.slice(0, 4)}-${d.rcept_dt.slice(4, 6)}-${d.rcept_dt.slice(6, 8)}`,
      title: d.report_nm,
      url:   `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      kind:  d.corp_cls,  // Y:유가증권, K:코스닥, N:코넥스, E:기타
    }))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ items }))
  } catch (err) {
    console.error('[DART] 오류:', err.message)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ items: [] }))
  }
}
