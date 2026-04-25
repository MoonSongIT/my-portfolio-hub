/**
 * OHLCV 배열 병합 — 기존 데이터 우선, 날짜 오름차순 정렬
 *
 * @param {Array<{date:string,open,high,low,close,volume}>} existing 기존 데이터
 * @param {Array<{date:string,open,high,low,close,volume}>} incoming 신규 데이터
 * @returns {Array} 중복 없는 OHLCV 배열 (날짜 오름차순)
 */
export function mergeOhlcvArrays(existing, incoming) {
  const map = new Map()

  // incoming 먼저 채운 뒤 existing으로 덮어씀 → 기존 데이터 우선
  for (const item of incoming) {
    if (item?.date) map.set(item.date, item)
  }
  for (const item of existing) {
    if (item?.date) map.set(item.date, item)
  }

  const result = Array.from(map.values())
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}
