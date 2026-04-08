import { fetchQuote, fetchHistory, toYahooTicker } from './stockApi'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { useJournalStore } from '../store/journalStore'
import { useAccountStore } from '../store/accountStore'

const today = () => new Date().toISOString().split('T')[0]

// ─── 내부 유틸 ───

// 매수 히스토리 기준으로 특정 날짜의 보유 수량·평균매수가 계산
function calcHoldingAtDate(entries, ticker, accountId, targetDate) {
  const sorted = entries
    .filter(e => e.ticker === ticker && e.accountId === accountId && e.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  let quantity  = 0
  let totalCost = 0

  for (const e of sorted) {
    if (e.action === 'buy') {
      totalCost += e.price * e.quantity + (e.fee || 0)
      quantity  += e.quantity
    } else {
      if (quantity > 0) {
        const avg = totalCost / quantity
        totalCost -= avg * e.quantity
        quantity  -= e.quantity
      }
    }
  }

  return {
    quantity:    Math.max(0, quantity),
    avgBuyPrice: quantity > 0 ? totalCost / quantity : 0,
  }
}

// 최초 매수일 조회
function getInvestedAt(entries, ticker, accountId) {
  const buys = entries
    .filter(e => e.ticker === ticker && e.accountId === accountId && e.action === 'buy')
    .sort((a, b) => a.date.localeCompare(b.date))
  return buys[0]?.date || today()
}

// ─── Public API ───

/**
 * 오늘 보유 종목 전체 스냅샷 저장
 * - journalStore의 현재 보유 현황 조회
 * - 각 종목의 현재가(fetchQuote) → dailyPnl 계산 → 저장
 */
export async function snapshotToday(accountId) {
  const journalStore   = useJournalStore.getState()
  const dailyPnlStore  = useDailyPnlStore.getState()
  const accountStore   = useAccountStore.getState()

  const accounts = accountId && accountId !== 'all'
    ? [accountStore.accounts.find(a => a.id === accountId)].filter(Boolean)
    : accountStore.accounts

  const todayStr = today()
  const results  = []

  for (const account of accounts) {
    const holdings = journalStore.computeHoldings(account.id)
    if (holdings.length === 0) continue

    for (const holding of holdings) {
      // 이미 오늘 스냅샷 있으면 스킵
      if (dailyPnlStore.hasSnapshotToday(holding.ticker, account.id)) continue

      try {
        const quote = await fetchQuote(holding.ticker, holding.market || 'KRX')

        // 전일 스냅샷으로 dailyPnl 계산
        const prev        = dailyPnlStore.getLatestSnapshot(holding.ticker, account.id)
        const prevClose   = prev?.closePrice ?? holding.avgPrice
        const dailyPnl    = (quote.currentPrice - prevClose) * holding.quantity
        const dailyPnlRate = prevClose > 0 ? ((quote.currentPrice - prevClose) / prevClose) * 100 : 0

        const cumulativePnl     = (quote.currentPrice - holding.avgPrice) * holding.quantity
        const cumulativePnlRate = holding.avgPrice > 0
          ? ((quote.currentPrice - holding.avgPrice) / holding.avgPrice) * 100
          : 0

        const snapshot = {
          ticker:            holding.ticker,
          date:              todayStr,
          accountId:         account.id,
          name:              holding.name,
          market:            holding.market || 'KRX',
          closePrice:        quote.currentPrice,
          quantity:          holding.quantity,
          avgBuyPrice:       holding.avgPrice,
          investedAt:        getInvestedAt(journalStore.entries, holding.ticker, account.id),
          dailyPnl:          Math.round(dailyPnl),
          dailyPnlRate:      Math.round(dailyPnlRate * 100) / 100,
          cumulativePnl:     Math.round(cumulativePnl),
          cumulativePnlRate: Math.round(cumulativePnlRate * 100) / 100,
          createdAt:         new Date().toISOString(),
        }

        dailyPnlStore.saveSnapshot(snapshot)
        results.push(snapshot)
      } catch (err) {
        console.warn(`[dailyPnlService] snapshotToday failed for ${holding.ticker}:`, err.message)
      }
    }
  }

  return results
}

/**
 * 투자 시점부터 오늘까지 과거 데이터 백필
 * - fetchHistory로 일별 종가 조회
 * - 날짜별 보유 수량 계산 → 일별 손익 계산 → 저장
 */
export async function backfillHistory(ticker, accountId, market = 'KRX') {
  const journalStore  = useJournalStore.getState()
  const dailyPnlStore = useDailyPnlStore.getState()
  const accountStore  = useAccountStore.getState()

  const account   = accountStore.accounts.find(a => a.id === accountId)
  const name      = journalStore.entries.find(e => e.ticker === ticker)?.name || ticker
  const fromDate  = getInvestedAt(journalStore.entries, ticker, accountId)
  const todayStr  = today()

  // Yahoo range 결정 (투자 기간에 따라 적절한 range 선택)
  const daysDiff = Math.ceil(
    (new Date(todayStr) - new Date(fromDate)) / (1000 * 60 * 60 * 24)
  )
  const range = daysDiff <= 30  ? '1mo'
              : daysDiff <= 90  ? '3mo'
              : daysDiff <= 180 ? '6mo'
              : daysDiff <= 365 ? '1y'
              : '2y'

  try {
    const history = await fetchHistory(ticker, market, range, '1d')

    // 투자 시점 이후 데이터만 필터
    const relevant = history.filter(h => h.date >= fromDate && h.date <= todayStr)
    if (relevant.length === 0) return []

    const snapshots = []
    let prevClose   = null

    for (const h of relevant) {
      const { quantity, avgBuyPrice } = calcHoldingAtDate(
        journalStore.entries, ticker, accountId, h.date
      )
      if (quantity <= 0) { prevClose = h.close; continue }

      const dailyPnl    = prevClose != null ? (h.close - prevClose) * quantity : 0
      const dailyPnlRate = prevClose != null && prevClose > 0
        ? ((h.close - prevClose) / prevClose) * 100 : 0
      const cumulativePnl     = (h.close - avgBuyPrice) * quantity
      const cumulativePnlRate = avgBuyPrice > 0
        ? ((h.close - avgBuyPrice) / avgBuyPrice) * 100 : 0

      snapshots.push({
        ticker,
        date:              h.date,
        accountId,
        name,
        market,
        closePrice:        h.close,
        quantity,
        avgBuyPrice,
        investedAt:        fromDate,
        dailyPnl:          Math.round(dailyPnl),
        dailyPnlRate:      Math.round(dailyPnlRate * 100) / 100,
        cumulativePnl:     Math.round(cumulativePnl),
        cumulativePnlRate: Math.round(cumulativePnlRate * 100) / 100,
        createdAt:         new Date().toISOString(),
      })
      prevClose = h.close
    }

    if (snapshots.length > 0) dailyPnlStore.bulkSave(snapshots)
    return snapshots
  } catch (err) {
    console.warn(`[dailyPnlService] backfillHistory failed for ${ticker}:`, err.message)
    return []
  }
}

/**
 * 특정 종목의 데이터 존재 여부 확인 — 없으면 백필 실행
 */
export async function ensureHistory(ticker, accountId, market = 'KRX') {
  const dailyPnlStore = useDailyPnlStore.getState()
  const existing = dailyPnlStore.getSnapshotsByTicker(ticker, accountId)
  if (existing.length === 0) {
    return backfillHistory(ticker, accountId, market)
  }
  return existing
}
