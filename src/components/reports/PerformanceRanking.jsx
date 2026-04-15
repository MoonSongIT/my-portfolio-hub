import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { EXCHANGE_RATE } from '../../data/samplePortfolio'

// 종목별 실현 손익 집계 (매도 일지 기준)
function calcRealizedByTicker(entries) {
  const map = {}
  entries.forEach(e => {
    if (e.action !== 'sell' || e.pnl == null) return
    if (!map[e.ticker]) {
      map[e.ticker] = { ticker: e.ticker, name: e.name || e.ticker, realizedPnl: 0, tradeCount: 0, psychologyMap: {} }
    }
    map[e.ticker].realizedPnl += e.pnl
    map[e.ticker].tradeCount += 1
    const ps = e.psychology || '기타'
    map[e.ticker].psychologyMap[ps] = (map[e.ticker].psychologyMap[ps] || 0) + 1
  })
  return Object.values(map).map(item => ({
    ...item,
    topPsychology: Object.entries(item.psychologyMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
  }))
}

// 종목별 미실현 손익 (보유 종목 기준)
function calcUnrealizedByTicker(holdings) {
  return holdings.map(h => {
    const pnl = (h.currentPrice - h.avgPrice) * h.quantity
    const pnlKRW = h.currency === 'USD' ? pnl * EXCHANGE_RATE : pnl
    const returnRate = h.avgPrice > 0 ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0
    return { ticker: h.ticker, name: h.name || h.ticker, unrealizedPnl: pnlKRW, returnRate }
  })
}

function RankCard({ rank, ticker, name, value, rate, topPsychology, isPositive }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      isPositive
        ? 'border-emerald-100 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10'
        : 'border-red-100 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10'
    }`}>
      <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{name}</p>
        <p className="text-xs text-gray-400">{ticker}</p>
        {topPsychology && (
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded mt-0.5 inline-block">
            {topPsychology}
          </span>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {rate != null && (
          <p className={`text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {isPositive ? '+' : ''}{rate.toFixed(2)}%
          </p>
        )}
        <p className={`text-xs ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {value >= 0 ? '+' : ''}{value.toLocaleString()}원
        </p>
      </div>
    </div>
  )
}

export default function PerformanceRanking({ entries = [], holdings = [] }) {
  const realized = useMemo(() => calcRealizedByTicker(entries), [entries])
  const unrealized = useMemo(() => calcUnrealizedByTicker(holdings), [holdings])

  // 실현+미실현 통합 (ticker 기준 merge)
  const merged = useMemo(() => {
    const map = {}
    realized.forEach(r => {
      map[r.ticker] = { ticker: r.ticker, name: r.name, totalPnl: r.realizedPnl, topPsychology: r.topPsychology }
    })
    unrealized.forEach(u => {
      if (map[u.ticker]) {
        map[u.ticker].totalPnl += u.unrealizedPnl
        map[u.ticker].returnRate = u.returnRate
      } else {
        map[u.ticker] = { ticker: u.ticker, name: u.name, totalPnl: u.unrealizedPnl, returnRate: u.returnRate }
      }
    })
    return Object.values(map).sort((a, b) => b.totalPnl - a.totalPnl)
  }, [realized, unrealized])

  const top3 = merged.slice(0, 3)
  const bottom3 = [...merged].reverse().slice(0, 3)

  if (merged.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
        보유 종목 또는 매도 일지 데이터가 있으면 성과 순위가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* TOP3 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">상위 3종목</h4>
        </div>
        <div className="space-y-2">
          {top3.map((item, i) => (
            <RankCard
              key={item.ticker}
              rank={i + 1}
              ticker={item.ticker}
              name={item.name}
              value={item.totalPnl}
              rate={item.returnRate}
              topPsychology={item.topPsychology}
              isPositive={item.totalPnl >= 0}
            />
          ))}
        </div>
      </div>

      {/* BOTTOM3 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">하위 3종목</h4>
        </div>
        <div className="space-y-2">
          {bottom3.map((item, i) => (
            <RankCard
              key={item.ticker}
              rank={merged.length - i}
              ticker={item.ticker}
              name={item.name}
              value={item.totalPnl}
              rate={item.returnRate}
              topPsychology={item.topPsychology}
              isPositive={item.totalPnl >= 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
