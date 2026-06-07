// 포트폴리오 종합수익률 추이 집계 (투자원금 / 손익합계 / 자산 기준)
import { CASH_FLOW_CATEGORIES } from '../store/cashFlowStore'

const CATS = Object.values(CASH_FLOW_CATEGORIES)
const isCapitalCat = (code) => {
  const c = CATS.find(x => x.code === code)
  return c ? c.isCapital : true // 카테고리 없는 레거시 레코드는 자본으로 처리
}
const usdCur = (c) => c === 'USD'
const usdMkt = (m) => m === 'NYSE' || m === 'NASDAQ'

/**
 * 종합수익률 기준 추이 집계
 * 각 날짜 d마다: 투자원금(netCapital) + 손익합계(미실현+실현+배당) = 자산
 *
 * @param {Array} snapshots    - dailyPnlStore 스냅샷 (보유주식 종가/평균가/수량)
 * @param {number} period      - 필터 일수 (7 | 30 | 90)
 * @param {number} exchangeRate- KRW/USD 환율
 * @param {Array} cashFlows    - 입출금 내역 (투자원금/실현/배당 누계용)
 * @param {Array} entries      - 매매 일지 (실현손익 누계용)
 * @returns {Array<{date, totalValue, investedValue, returnRate, dailyReturn}>}
 *   investedValue=투자원금, totalValue=자산(투자원금+손익합계), returnRate=종합수익률 %
 */
export function aggregatePortfolioHistory(snapshots, period, exchangeRate, cashFlows = [], entries = []) {
  if (!snapshots || snapshots.length === 0) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filtered = snapshots.filter(s => s.date >= cutoffStr)
  if (filtered.length === 0) return []

  // 날짜별 스냅샷 그룹핑 (미실현손익 계산용)
  const byDate = new Map()
  for (const s of filtered) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date).push(s)
  }
  const dates = [...byDate.keys()].sort()

  // cashFlow / 일지 환율 환산 헬퍼
  const cfAmt = (f) => usdCur(f.currency) ? f.amount * exchangeRate : f.amount
  const activeCf = cashFlows.filter(f => !f.deletedAt)
  const sellEntries = entries.filter(e => !e.deletedAt && e.action === 'sell' && e.pnl != null)

  // 날짜별 종합수익률 구성요소 계산
  const computed = dates.map(date => {
    // ① 미실현손익(d) — 해당일 스냅샷 보유주식
    let unrealized = 0
    for (const s of byDate.get(date)) {
      const rate = usdMkt(s.market) ? exchangeRate : 1
      unrealized += (s.closePrice - s.avgBuyPrice) * s.quantity * rate
    }

    // ②③④ date 이하 누계: 투자원금 / 실현손익(현금) / 배당
    let netCapital = 0, realizedCash = 0, dividend = 0
    for (const f of activeCf) {
      if (f.date > date) continue
      const amt = cfAmt(f)
      if (!f.isAuto && isCapitalCat(f.category)) {
        netCapital += f.type === 'deposit' ? amt : -amt
      }
      if (f.type === 'deposit' && !f.isAuto && f.category === 'realized_gain') realizedCash += amt
      if (f.type === 'deposit' && !f.isAuto && f.category === 'dividend') dividend += amt
    }

    // ② 실현손익(일지) — date 이하 sell pnl 누계
    let realizedJournal = 0
    for (const e of sellEntries) {
      if (e.date > date) continue
      realizedJournal += usdCur(e.currency) ? e.pnl * exchangeRate : e.pnl
    }

    const realized = realizedJournal + realizedCash
    const pnlTotal = unrealized + realized + dividend
    const investedValue = netCapital
    const totalValue = netCapital + pnlTotal
    const returnRate = netCapital > 0 ? (pnlTotal / netCapital) * 100 : 0
    const portfolioReturnRate = investedValue > 0 ? (unrealized / investedValue) * 100 : 0

    return { date, totalValue, investedValue, returnRate, unrealized, realized, dividend, portfolioReturnRate }
  })

  // forward-fill: 누락 날짜(주말 등)에 마지막 유효값 채우기
  const filled = forwardFill(computed)

  // dailyReturn: 전일 대비 returnRate 차이 (보조 지표)
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
