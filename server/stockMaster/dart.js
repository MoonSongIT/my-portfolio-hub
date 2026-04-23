/**
 * dart.js — KOSPI / KOSDAQ 종목 수집기
 *
 * DART OpenAPI list.json (corp_cls=Y/K, 사업보고서 기준) 을 이용해
 * KOSPI(Y) / KOSDAQ(K) 상장 종목을 수집하고 StockMasterRow 로 반환합니다.
 *
 * 제약: corp_code 미지정 시 조회기간 최대 89일
 * 해결: 89일 구간 4개로 나눠 약 1년치 공시에서 종목 수집 → 전체 상장사 커버
 */
import { fromDart } from './normalize.js'

const PAGE_COUNT = 100
const WINDOW_MS  = 89 * 86_400_000  // 89일

/**
 * DART list.json 에서 KOSPI 또는 KOSDAQ 종목 수집
 * @param {string} dartApiKey - DART_API_KEY
 * @param {'Y'|'K'} corpCls  - Y=KOSPI, K=KOSDAQ
 * @returns {Promise<import('../../src/utils/stockMasterDb').StockMasterRow[]>}
 */
export async function fetchDartListByCls(dartApiKey, corpCls) {
  if (!dartApiKey) {
    throw new Error('DART_API_KEY 미설정 — .env 파일을 확인하세요')
  }

  const exchange = corpCls === 'Y' ? 'KOSPI' : 'KOSDAQ'
  const stockMap = new Map()  // stock_code → StockMasterRow
  const now = Date.now()

  // 4개 구간 × 89일 ≈ 1년 (연·분기·반기 보고서 모두 포함)
  for (let w = 0; w < 4; w++) {
    const endMs     = now - w * WINDOW_MS
    const startMs   = endMs - WINDOW_MS
    const endDate   = new Date(endMs).toISOString().slice(0, 10).replace(/-/g, '')
    const startDate = new Date(startMs).toISOString().slice(0, 10).replace(/-/g, '')

    let page = 1
    while (true) {
      // pblntf_ty=A: 사업보고서(연간) — 기업당 연 1회 제출
      const url =
        `https://opendart.fss.or.kr/api/list.json` +
        `?crtfc_key=${dartApiKey}` +
        `&corp_cls=${corpCls}` +
        `&pblntf_ty=A` +
        `&bgn_de=${startDate}` +
        `&end_de=${endDate}` +
        `&page_no=${page}` +
        `&page_count=${PAGE_COUNT}`

      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`DART list.json HTTP ${res.status}`)
      const json = await res.json()

      if (json.status === '013') break  // 조회 데이터 없음 (정상 종료)
      if (json.status !== '000') {
        throw new Error(`DART list.json 오류 [${json.status}]: ${json.message}`)
      }

      for (const item of (json.list || [])) {
        const code = item.stock_code?.trim()
        // 6자리 숫자 티커만 유효 (우선주 등 포함), 중복 skip
        if (!code || !/^\d{6}$/.test(code) || stockMap.has(code)) continue
        stockMap.set(code, fromDart(item, corpCls))
      }

      const total      = parseInt(json.total_count || '0', 10)
      const totalPages = Math.ceil(total / PAGE_COUNT)
      console.log(
        `[StockMaster] DART ${exchange} 구간${w + 1}/4 p${page}/${totalPages}` +
        ` — 누적 ${stockMap.size}개`
      )

      if (page >= totalPages || (json.list || []).length < PAGE_COUNT) break
      page++
      await new Promise(r => setTimeout(r, 250))  // rate limit 보호
    }
  }

  const rows = Array.from(stockMap.values())
  console.log(`[StockMaster] DART ${exchange} 최종: ${rows.length}개`)
  return rows
}
