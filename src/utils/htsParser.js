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

/**
 * 메인헤더·서브헤더 행으로 컬럼 인덱스를 동적 탐지
 * 서브헤더의 "가격" 첫 번째 → buyPrice, 두 번째 → sellPrice
 * 메인헤더의 "종목코드" → ticker
 */
function detectEugeneColumns(mainHeader, subHeader) {
  const priceCols = subHeader
    .map((v, i) => (String(v).trim() === '가격' ? i : -1))
    .filter((i) => i >= 0)

  const buyPriceCol = priceCols[0] ?? 3
  const sellPriceCol = priceCols[1] ?? 6
  const afterSell = sellPriceCol + 3

  const tickerCol = mainHeader.findIndex((v) => String(v).includes('종목코드'))

  return {
    date: 0,
    name: 1,
    type: 2,
    buyPrice: buyPriceCol,
    buyQty: buyPriceCol + 1,
    buyAmount: buyPriceCol + 2,
    sellPrice: sellPriceCol,
    sellQty: sellPriceCol + 1,
    sellAmount: sellPriceCol + 2,
    tradingCost: afterSell,
    realizedPnl: afterSell + 1,
    realizedRate: afterSell + 2,
    commission: afterSell + 3,
    tax: afterSell + 4,
    ticker: tickerCol >= 0 ? tickerCol : afterSell + 5,
  }
}

function shouldSkip(row, col) {
  const name = String(row[col.name] ?? '').trim()
  if (!name) return true
  return SKIP_PATTERNS.some((p) => p.test(name))
}

/**
 * 유진 HTS 단일 데이터 행 → 정규화된 거래 엔트리
 * buyQty > 0 → buy, 그 외 → sell
 */
export function parseEugeneRow(row, col) {
  const date = normalizeDate(row[col.date])
  const name = String(row[col.name] ?? '').trim()
  const ticker = normalizeTicker(row[col.ticker])

  const buyQty = toNumber(row[col.buyQty])
  const sellQty = toNumber(row[col.sellQty])
  const isBuy = buyQty > 0

  let price = isBuy
    ? toNumber(row[col.buyPrice])
    : toNumber(row[col.sellPrice])
  let quantity = isBuy ? buyQty : sellQty
  const amount = isBuy
    ? toNumber(row[col.buyAmount])
    : toNumber(row[col.sellAmount])

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
    commission: toNumber(row[col.commission]),
    tax: toNumber(row[col.tax]),
    tradingCost: toNumber(row[col.tradingCost]),
    realizedPnl: toNumber(row[col.realizedPnl]),
    realizedRate: toNumber(row[col.realizedRate]),
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
    const mainHeader = rows[headerIdx] ?? []
    const subHeader = rows[headerIdx + 1] ?? []
    const col = detectEugeneColumns(mainHeader, subHeader)
    const dataRows = rows.slice(headerIdx + 2) // 메인헤더 + 서브헤더 건너뜀

    const entries = []
    for (const row of dataRows) {
      if (shouldSkip(row, col)) continue
      const entry = parseEugeneRow(row, col)
      if (!entry.date || !entry.name) continue
      entries.push(entry)
    }

    results.push({ sheetName, entries, totalRows: dataRows.length })
  }

  return results
}
