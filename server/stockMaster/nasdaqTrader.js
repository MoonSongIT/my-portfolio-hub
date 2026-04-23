/**
 * nasdaqTrader.js — NASDAQ Trader FTP 파일 기반 미국 종목 전체 목록 수집
 *
 * 소스:
 *   - nasdaqlisted.txt  : NASDAQ 상장 전체 종목 (~4,000개)
 *   - otherlisted.txt   : NYSE / AMEX / Arca 상장 전체 종목 (~8,000개)
 *
 * 파일 포맷 (파이프 구분):
 *   nasdaqlisted : Symbol | Security Name | Market Category | Test Issue |
 *                  Financial Status | Round Lot Size | ETF | NextShares
 *   otherlisted  : ACT Symbol | Security Name | Exchange | CQS Symbol |
 *                  ETF | Round Lot Size | Test Issue | NASDAQ Symbol
 *
 * Exchange 코드 (otherlisted):
 *   A = NYSE MKT (AMEX)
 *   N = New York Stock Exchange
 *   P = NYSE ARCA
 *   Z = BATS Exchange
 *   V = Investors' Exchange (IEX)
 *
 * 반환:
 *   fetchNasdaqListed()  → exchange=NASDAQ (ETF=Y → US_ETF)
 *   fetchOtherListed()   → exchange=NYSE|AMEX|... (ETF=Y → US_ETF)
 *   fetchAllUsStocks()   → 위 두 결과 합산 + Yahoo quote 부스트
 */

import { fromNasdaqTrader } from './normalize.js'

const FTP_BASE = 'https://www.nasdaqtrader.com/dynamic/SymDir'
const TIMEOUT_MS = 20_000

// Exchange 코드 → 거래소 이름 매핑
const EXCHANGE_CODE_MAP = {
  A: 'AMEX',
  N: 'NYSE',
  P: 'NYSE',   // NYSE Arca → NYSE로 통합
  Z: 'NYSE',   // BATS → NYSE로 통합
  V: 'NYSE',   // IEX → NYSE로 통합
  Q: 'NASDAQ', // CQS 레거시 코드
}

/**
 * 파이프 구분 텍스트 파싱 → 객체 배열 반환
 * 마지막 행(File Creation Time)은 자동 제거
 * @param {string} text
 * @returns {Array<Record<string, string>>}
 */
function parsePipeDelimited(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // 마지막 행이 메타데이터 줄이면 제거
  const lastLine = lines[lines.length - 1]
  if (lastLine.startsWith('File Creation Time') || !lastLine.includes('|')) {
    lines.pop()
  }

  const headers = lines[0].split('|').map(h => h.trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|')
    const obj = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (parts[j] || '').trim()
    }
    rows.push(obj)
  }
  return rows
}

/**
 * 테스트 종목 또는 비정상 종목 필터
 * @param {{ symbol: string, 'Test Issue'?: string, testIssue?: string }} row
 */
function isValidRow(row) {
  const testIssue = row['Test Issue'] || row.testIssue || 'N'
  const symbol = (row['Symbol'] || row['ACT Symbol'] || '').trim()
  if (!symbol) return false
  if (testIssue.toUpperCase() === 'Y') return false
  // 워런트, 유닛, 권리 등 파생 종목 제외 (접미사 기반)
  if (/[+=$]/.test(symbol)) return false
  return true
}

/**
 * NASDAQ 상장 종목 수집 (nasdaqlisted.txt)
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchNasdaqListed() {
  const url = `${FTP_BASE}/nasdaqlisted.txt`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`nasdaqlisted.txt HTTP ${res.status}`)

  const text = await res.text()
  const raw = parsePipeDelimited(text)

  const rows = []
  const seen = new Set()

  for (const r of raw) {
    if (!isValidRow(r)) continue
    const symbol = (r['Symbol'] || '').trim()
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)

    const isEtf = (r['ETF'] || '').toUpperCase() === 'Y'
    rows.push(fromNasdaqTrader(
      {
        symbol,
        securityName: r['Security Name'] || symbol,
        etf: r['ETF'] || 'N',
      },
      isEtf ? 'US_ETF' : 'NASDAQ',
    ))
  }

  console.log(`[StockMaster] nasdaqlisted.txt: ${rows.length}개 파싱`)
  return rows
}

/**
 * 기타 거래소 상장 종목 수집 (otherlisted.txt)
 * NYSE / AMEX / NYSE Arca 등
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchOtherListed() {
  const url = `${FTP_BASE}/otherlisted.txt`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`otherlisted.txt HTTP ${res.status}`)

  const text = await res.text()
  const raw = parsePipeDelimited(text)

  const rows = []
  const seen = new Set()

  for (const r of raw) {
    // otherlisted 헤더: 'ACT Symbol', 'Test Issue'
    const symbol = (r['ACT Symbol'] || r['NASDAQ Symbol'] || '').trim()
    if (!symbol) continue

    const testIssue = (r['Test Issue'] || 'N').toUpperCase()
    if (testIssue === 'Y') continue
    if (/[+=$]/.test(symbol)) continue
    if (seen.has(symbol)) continue
    seen.add(symbol)

    const exchCode = (r['Exchange'] || 'N').toUpperCase()
    const isEtf = (r['ETF'] || '').toUpperCase() === 'Y'
    const rawExchange = isEtf ? 'US_ETF' : (EXCHANGE_CODE_MAP[exchCode] || 'NYSE')

    rows.push(fromNasdaqTrader(
      {
        symbol,
        securityName: r['Security Name'] || symbol,
        etf: r['ETF'] || 'N',
      },
      rawExchange,
    ))
  }

  console.log(`[StockMaster] otherlisted.txt: ${rows.length}개 파싱`)
  return rows
}

/**
 * NASDAQ + Other 종목 전체 수집 → exchange별 Map 반환
 * 실패 시 각 거래소별 빈 배열 (Yahoo 폴백에서 처리)
 *
 * @returns {Promise<{
 *   nasdaq: StockMasterRow[],
 *   nyse:   StockMasterRow[],
 *   usEtf:  StockMasterRow[],
 *   errors: string[],
 * }>}
 */
export async function fetchAllFromNasdaqTrader() {
  const errors = []
  let nasdaqRows = []
  let otherRows  = []

  const [nasdaqResult, otherResult] = await Promise.allSettled([
    fetchNasdaqListed(),
    fetchOtherListed(),
  ])

  if (nasdaqResult.status === 'fulfilled') {
    nasdaqRows = nasdaqResult.value
  } else {
    console.error('[StockMaster] nasdaqlisted.txt 실패:', nasdaqResult.reason?.message)
    errors.push(`nasdaqlisted: ${nasdaqResult.reason?.message}`)
  }

  if (otherResult.status === 'fulfilled') {
    otherRows = otherResult.value
  } else {
    console.error('[StockMaster] otherlisted.txt 실패:', otherResult.reason?.message)
    errors.push(`otherlisted: ${otherResult.reason?.message}`)
  }

  // exchange 별로 분리
  const nasdaq = nasdaqRows.filter(r => r.exchange === 'NASDAQ')
  const nasdaqEtf = nasdaqRows.filter(r => r.exchange === 'US_ETF')

  const nyse = otherRows.filter(r => r.exchange === 'NYSE' || r.exchange === 'AMEX')
  const otherEtf = otherRows.filter(r => r.exchange === 'US_ETF')

  // ETF 통합 (NASDAQ ETF + NYSE/AMEX ETF → US_ETF)
  const etfMap = new Map()
  for (const r of [...nasdaqEtf, ...otherEtf]) {
    if (!etfMap.has(r.ticker)) etfMap.set(r.ticker, r)
  }

  return {
    nasdaq,
    nyse,
    usEtf: Array.from(etfMap.values()),
    errors,
  }
}
