/**
 * krxEtf.js — KRX ETF 종목 수집기
 *
 * 1차: 네이버 PC etfItemList.nhn API (sosok=0, pageSize=100 페이징)
 * 2차: 네이버 모바일 API 폴백 (1차 실패 시)
 *
 * exchange=KRX_ETF, type=ETF, category=DOMESTIC
 */
import { fromNaverEtf } from './normalize.js'

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer':    'https://finance.naver.com',
  'Accept':     'application/json, text/plain',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

/**
 * Naver API 응답은 Content-Type: text/plain;charset=EUC-KR 로 반환됨.
 * res.json()은 UTF-8로 디코딩하여 한글이 깨지므로,
 * ArrayBuffer → TextDecoder('euc-kr') → JSON.parse 순서로 처리.
 */
async function fetchNaverJson(url, signal) {
  const res = await fetch(url, { headers: NAVER_HEADERS, signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = await res.arrayBuffer()
  const text   = new TextDecoder('euc-kr').decode(buffer)
  return JSON.parse(text)
}

/**
 * 네이버 PC API — etfItemList.nhn 페이징 수집
 */
async function fetchNaverPc() {
  const stocks = []
  const PAGE_SIZE = 100

  for (let page = 1; page <= 20; page++) {
    const url =
      `https://finance.naver.com/api/sise/etfItemList.nhn` +
      `?etfType=0&sosok=0&page=${page}&pageSize=${PAGE_SIZE}`
    try {
      const json = await fetchNaverJson(url, AbortSignal.timeout(8000))
      const items = json.result?.etfItemList || json.etfItemList || []
      if (items.length === 0) break

      for (const item of items) {
        const ticker = (item.itemcode || item.itemCode || '').trim()
        const name   = (item.itemname || item.itemName || '').trim()
        if (ticker && name) stocks.push(fromNaverEtf(item))
      }

      if (items.length < PAGE_SIZE) break
    } catch (err) {
      console.warn(`[StockMaster] 네이버 ETF PC p${page} 실패:`, err.message)
      break
    }
  }
  return stocks
}

/**
 * 네이버 모바일 API 폴백
 */
async function fetchNaverMobile() {
  const stocks = []
  try {
    const res = await fetch(
      'https://m.stock.naver.com/api/stocks?category=ETF&pageSize=100&page=1',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          'Referer':    'https://m.stock.naver.com',
        },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return []
    const json = await res.json()
    for (const item of (json.stocks || [])) {
      const ticker = (item.itemCode || item.stockCode || '').trim()
      const name   = (item.itemName || item.stockName || '').trim()
      if (ticker && name) {
        stocks.push(fromNaverEtf({ itemcode: ticker, itemname: name }))
      }
    }
  } catch { /* 무시 */ }
  return stocks
}

/**
 * KRX ETF 종목 수집 (PC API + 모바일 폴백)
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchKrxEtfList() {
  let stocks = await fetchNaverPc()

  if (stocks.length === 0) {
    console.warn('[StockMaster] 네이버 PC ETF 실패, 모바일 폴백 사용')
    stocks = await fetchNaverMobile()
  }

  // ticker 기준 중복 제거
  const seen = new Set()
  const unique = stocks.filter(s => {
    if (seen.has(s.ticker)) return false
    seen.add(s.ticker)
    return true
  })

  console.log(`[StockMaster] KRX_ETF: ${unique.length}개 수집`)
  return unique
}
