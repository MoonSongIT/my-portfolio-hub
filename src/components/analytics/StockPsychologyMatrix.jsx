// 종목-심리 2D 매트릭스 테이블 — 종목(행) × 심리(열) 평균손익 히트맵
import { usePsychologyInsight } from '../../hooks/usePsychologyInsight'
import { formatCurrencyShort } from '../../utils/formatters'

const MAX_TICKERS = 8
const MAX_PSYCHOLOGIES = 6

export default function StockPsychologyMatrix() {
  const { matrix } = usePsychologyInsight()

  const tickerEntries = Object.entries(matrix)
  if (tickerEntries.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        매매 기록이 없습니다.
      </p>
    )
  }

  // 거래 빈도 내림차순으로 상위 종목/심리만 선택
  const tickersByFreq = tickerEntries
    .map(([ticker, psyMap]) => ({
      ticker,
      total: Object.values(psyMap).reduce((s, v) => s + v.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_TICKERS)
    .map(t => t.ticker)

  const psychologyFreq = {}
  for (const ticker of tickersByFreq) {
    for (const [psy, data] of Object.entries(matrix[ticker])) {
      psychologyFreq[psy] = (psychologyFreq[psy] ?? 0) + data.total
    }
  }
  const psychologies = Object.entries(psychologyFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PSYCHOLOGIES)
    .map(([psy]) => psy)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 text-left text-gray-500 font-medium border-b border-gray-200 dark:border-gray-700 min-w-[80px]">
              종목
            </th>
            {psychologies.map(psy => (
              <th
                key={psy}
                className="px-2 py-2 text-center text-gray-500 font-medium border-b border-gray-200 dark:border-gray-700 whitespace-nowrap min-w-[88px]"
              >
                {psy}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickersByFreq.map(ticker => (
            <tr key={ticker} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">
                {ticker}
              </td>
              {psychologies.map(psy => {
                const cell = matrix[ticker]?.[psy]
                if (!cell) {
                  return (
                    <td key={psy} className="px-2 py-2 text-center text-gray-300 dark:text-gray-600">
                      ─
                    </td>
                  )
                }
                const isProfit = cell.avgPnl > 0
                const isLoss = cell.avgPnl < 0
                const bgClass = isProfit
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : isLoss
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                const textClass = isProfit
                  ? 'text-red-600 dark:text-red-400'
                  : isLoss
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                return (
                  <td key={psy} className={`px-2 py-2 text-center ${bgClass}`}>
                    <span className={`font-medium ${textClass}`}>
                      {formatCurrencyShort(cell.avgPnl)}
                    </span>
                    <span className="block text-gray-400 dark:text-gray-500 text-[10px]">
                      {cell.total}건
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
