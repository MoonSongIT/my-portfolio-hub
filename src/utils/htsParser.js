import * as XLSX from 'xlsx'

const SKIP_PATTERNS = [/합계/, /소계/, /total/i, /subtotal/i]

/** Date 객체 | "2026-04-28" | "20260428" | "2026.04.28" → 'YYYY-MM-DD' */
export function normalizeDate(value) {
  if (!value && value !== 0) return null

  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${date.y}-${m}-${d}`
    }
  }

  const s = String(value).trim()

  // "20260428" → "2026-04-28"
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }

  // "2026.04.28" → "2026-04-28"
  const dotMatch = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  if (dotMatch) return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`

  // already "2026-04-28"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  return null
}

/** "A463250     " → "463250" */
export function normalizeTicker(value) {
  if (!value) return ''
  const s = String(value).trim()
  // 유진 HTS: A + 6자리 코드
  return s.replace(/^[A-Za-z]/, '').padStart(6, '0')
}

/** 콤마 제거 후 Number 변환 (비어있으면 0) */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const n = Number(String(value).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}

// 유진투자증권 HTS 고정 컬럼 인덱스 (row0: 메인헤더, row1: 서브헤더, row2~: 데이터)
const EUGENE_COL = {
  date: 0,
  name: 1,
  type: 2,
  buyPrice: 3,
  buyQty: 4,
  buyAmount: 5,
  sellPrice: 6,
  sellQty: 7,
  sellAmount: 8,
  tradingCost: 9,
  realizedPnl: 10,
  realizedRate: 11,
  commission: 12,
  tax: 13,
  ticker: 14,
}

function shouldSkip(row) {
  const name = String(row[EUGENE_COL.name] ?? '').trim()
  if (!name) return true
  return SKIP_PATTERNS.some((p) => p.test(name))
}

/**
 * 유진 HTS 단일 데이터 행 → 정규화된 거래 엔트리
 * buyQty > 0 → buy, 그 외 → sell
 */
export function parseEugeneRow(row) {
  const date = normalizeDate(row[EUGENE_COL.date])
  const name = String(row[EUGENE_COL.name] ?? '').trim()
  const ticker = normalizeTicker(row[EUGENE_COL.ticker])

  const buyQty = toNumber(row[EUGENE_COL.buyQty])
  const sellQty = toNumber(row[EUGENE_COL.sellQty])
  const isBuy = buyQty > 0

  let price = isBuy
    ? toNumber(row[EUGENE_COL.buyPrice])
    : toNumber(row[EUGENE_COL.sellPrice])
  let quantity = isBuy ? buyQty : sellQty
  const amount = isBuy
    ? toNumber(row[EUGENE_COL.buyAmount])
    : toNumber(row[EUGENE_COL.sellAmount])

  // price=0이고 amount·qty가 모두 양수이면 단가를 역산 (금액/수량)
  if (price === 0 && quantity > 0 && amount > 0) {
    price = Math.round(amount / quantity)
  }
  // qty가 실제로 금액값인 경우: qty ≈ amount (단가 > 0) → qty = round(amount/price)
  if (price > 0 && quantity > 0 && amount > 0 && quantity === amount) {
    quantity = Math.round(amount / price)
  }

  return {
    date,
    name,
    ticker,
    action: isBuy ? 'buy' : 'sell',
    price,
    quantity,
    amount,
    commission: toNumber(row[EUGENE_COL.commission]),
    tax: toNumber(row[EUGENE_COL.tax]),
    tradingCost: toNumber(row[EUGENE_COL.tradingCost]),
    realizedPnl: toNumber(row[EUGENE_COL.realizedPnl]),
    realizedRate: toNumber(row[EUGENE_COL.realizedRate]),
    market: 'KRX',
    source: 'eugene-hts',
  }
}

/**
 * 헤더 행 인덱스 탐지: "일자" 포함 행 찾기
 * 유진 HTS는 0번이 메인헤더, 1번이 서브헤더 → 데이터는 2번째 행부터
 */
function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (row && String(row[0] ?? '').includes('일자')) return i
  }
  return 0
}

/**
 * File 객체 → Promise<{ sheetName: string, entries: object[], totalRows: number }[]>
 */
export async function parseHtsWorkbook(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const results = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const headerIdx = findHeaderRowIndex(rows)
    const dataRows = rows.slice(headerIdx + 2) // 메인헤더 + 서브헤더 건너뜀

    const entries = []
    for (const row of dataRows) {
      if (shouldSkip(row)) continue
      const entry = parseEugeneRow(row)
      if (!entry.date || !entry.name) continue
      entries.push(entry)
    }

    results.push({ sheetName, entries, totalRows: dataRows.length })
  }

  return results
}
