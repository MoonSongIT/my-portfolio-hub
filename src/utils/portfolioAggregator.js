/**
 * 포트폴리오 전체 수익률 추이 집계
 *
 * @param {Array} snapshots     - dailyPnlStore의 전체 스냅샷 배열
 * @param {number} period       - 필터 일수 (7 | 30 | 90)
 * @param {number} exchangeRate - KRW/USD 환율 (예: 1350)
 * @returns {Array<{date:string, totalValue:number, investedValue:number, returnRate:number, dailyReturn:number}>}
 */
export function aggregatePortfolioHistory(snapshots, period, exchangeRate) {
  if (!snapshots || snapshots.length === 0) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filtered = snapshots.filter(s => s.date >= cutoffStr)
  if (filtered.length === 0) return []

  // 날짜별 그룹핑
  const byDate = new Map()
  for (const s of filtered) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date).push(s)
  }

  const isUsd = (market) => market === 'NYSE' || market === 'NASDAQ'

  // 날짜별 합산
  const entries = []
  for (const [date, list] of byDate) {
    let totalValue = 0
    let investedValue = 0

    for (const s of list) {
      const rate = isUsd(s.market) ? exchangeRate : 1
      totalValue += s.closePrice * s.quantity * rate
      investedValue += s.avgBuyPrice * s.quantity * rate
    }

    const returnRate = investedValue > 0
      ? ((totalValue - investedValue) / investedValue) * 100
      : 0

    entries.push({ date, totalValue, investedValue, returnRate })
  }

  entries.sort((a, b) => a.date.localeCompare(b.date))

  // forward-fill: 누락 날짜(주말 등)에 마지막 유효값 채우기
  const filled = forwardFill(entries)

  // dailyReturn: 전일 대비 returnRate 차이
  return filled.map((entry, i) => ({
    ...entry,
    dailyReturn: i === 0 ? 0 : entry.returnRate - filled[i - 1].returnRate,
  }))
}

/**
 * @param {Array<{date:string, totalValue:number, investedValue:number, returnRate:number}>} entries
 * @returns {Array}
 */
function forwardFill(entries) {
  if (entries.length === 0) return []

  const result = []
  const current = new Date(entries[0].date)
  const end = new Date(entries[entries.length - 1].date)

  let entryIdx = 0
  let prev = null

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]

    if (entryIdx < entries.length && entries[entryIdx].date === dateStr) {
      prev = entries[entryIdx]
      entryIdx++
    }

    if (prev) result.push({ ...prev, date: dateStr })

    current.setDate(current.getDate() + 1)
  }

  return result
}
