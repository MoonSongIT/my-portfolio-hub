// DART OpenAPI 공시 목록 프록시 — GET /api/dart/list?ticker=&days=
// server/dartHandler.js 로직을 Vercel 서버리스 함수로 포팅
import { inflateRawSync } from 'node:zlib'
import { setCors, handlePreflight } from '../_cors.js'

// ── ZIP 파서 ──────────────────────────────────────────────────────────
function extractZipEntry(buf, filename) {
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) {
      eocdOffset = i; break
    }
  }
  if (eocdOffset === -1) throw new Error('ZIP: EOCD 레코드를 찾을 수 없습니다')
  const numEntries = buf.readUInt16LE(eocdOffset + 10)
  const cdOffset   = buf.readUInt32LE(eocdOffset + 16)
  let pos = cdOffset
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break
    const comprMethod = buf.readUInt16LE(pos + 10)
    const compSize    = buf.readUInt32LE(pos + 20)
    const fnLen       = buf.readUInt16LE(pos + 28)
    const extraLen    = buf.readUInt16LE(pos + 30)
    const commentLen  = buf.readUInt16LE(pos + 32)
    const localOffset = buf.readUInt32LE(pos + 42)
    const entryName   = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf-8')
    if (entryName === filename) {
      const lFnLen    = buf.readUInt16LE(localOffset + 26)
      const lExtraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + lFnLen + lExtraLen
      const compressed = buf.slice(dataStart, dataStart + compSize)
      if (comprMethod === 0) return compressed
      if (comprMethod === 8) return inflateRawSync(compressed)
      throw new Error(`ZIP: 지원하지 않는 압축 방식 (${comprMethod})`)
    }
    pos += 46 + fnLen + extraLen + commentLen
  }
  throw new Error(`ZIP: '${filename}' 항목을 찾을 수 없습니다`)
}

// ── corp_code 맵 (인스턴스 캐시 — cold start 시 재다운로드) ──────────
let corpMap = null
let corpMapLoadedAt = 0
const CORP_MAP_TTL = 6 * 60 * 60 * 1000  // 6시간

async function getCorpMap(apiKey) {
  if (corpMap && Date.now() - corpMapLoadedAt < CORP_MAP_TTL) return corpMap
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
    if (stockCode && stockCode.length > 0 && corpCode) map.set(stockCode, corpCode.trim())
  }
  corpMap = map
  corpMapLoadedAt = Date.now()
  return map
}

function toYYYYMMDD(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

// ── 핸들러 ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const dartApiKey = process.env.DART_API_KEY
  if (!dartApiKey) {
    return res.status(200).json({ items: [] })
  }

  const { ticker, days: daysStr } = req.query
  const days = parseInt(daysStr || '30', 10)

  if (!ticker) return res.status(400).json({ error: 'ticker 파라미터 필요' })

  try {
    const map         = await getCorpMap(dartApiKey)
    const cleanTicker = ticker.replace(/\.(KS|KQ)$/i, '')
    const corpCode    = map.get(cleanTicker)

    if (!corpCode) return res.status(200).json({ items: [] })

    const bgn_de = toYYYYMMDD(new Date(Date.now() - days * 86400_000))
    const end_de = toYYYYMMDD(new Date())

    const dartResp = await fetch(
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${dartApiKey}&corp_code=${corpCode}&bgn_de=${bgn_de}&end_de=${end_de}&page_count=10`,
      { headers: { 'User-Agent': 'MyPortfolioHub/1.0' } }
    )
    const data = await dartResp.json()

    if (data.status !== '000') return res.status(200).json({ items: [] })

    const items = (data.list || []).slice(0, 10).map(d => ({
      date:  `${d.rcept_dt.slice(0, 4)}-${d.rcept_dt.slice(4, 6)}-${d.rcept_dt.slice(6, 8)}`,
      title: d.report_nm,
      url:   `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      kind:  d.corp_cls,
    }))

    res.status(200).json({ items })
  } catch (err) {
    res.status(200).json({ items: [] })
  }
}
