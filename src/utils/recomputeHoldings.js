/**
 * 거래 내역 배열로부터 현재 보유 종목을 계산한다.
 * journalStore.computeHoldings와 동일한 로직이지만 store에 의존하지 않는 순수 함수.
 *
 * @param {Array} entries - 거래 내역 배열 (날짜 순 정렬 불필요 — 내부 정렬)
 * @returns {Array} Holding[] — 수량 > 0인 종목만 반환
 */
export function recomputeHoldingsFromEntries(entries) {
  const sorted = [...entries].sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )

  const map = {}

  for (const e of sorted) {
    if (!e.ticker) continue

    if (!map[e.ticker]) {
      map[e.ticker] = {
        ticker: e.ticker,
        name: e.name || e.ticker,
        market: e.market || 'KRX',
        quantity: 0,
        totalCost: 0,
      }
    }

    const pos = map[e.ticker]

    if (e.action === 'buy') {
      pos.totalCost += e.price * e.quantity + (e.fee || 0)
      pos.quantity += e.quantity
    } else {
      if (pos.quantity > 0) {
        const avgPrice = pos.totalCost / pos.quantity
        const reduceQty = Math.min(e.quantity, pos.quantity)
        pos.totalCost -= avgPrice * reduceQty
        pos.quantity -= reduceQty
        if (pos.quantity < 0) pos.quantity = 0
        if (pos.totalCost < 0) pos.totalCost = 0
      }
    }
  }

  return Object.values(map)
    .filter((p) => p.quantity > 0)
    .map((p) => ({
      ...p,
      avgPrice: p.quantity > 0 ? Math.round(p.totalCost / p.quantity) : 0,
    }))
}
