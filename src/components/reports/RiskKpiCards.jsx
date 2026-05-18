// 리스크 지표 KPI 카드 — MDD(최대낙폭)·연환산 변동성 표시
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { calculateMDD, calculateVolatility, getStartDate } from '../../utils/calculator'
import { TrendingDown, BarChart2 } from 'lucide-react'

function buildDailySeries(snapshots, fromDate, toDate) {
  const byDate = {}
  Object.values(snapshots).forEach((s) => {
    if (s.date < fromDate || s.date > toDate) return
    if (!byDate[s.date]) byDate[s.date] = 0
    byDate[s.date] += s.cumulativePnlRate ?? 0
  })
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))
}

function buildDailyReturnSeries(snapshots, fromDate, toDate) {
  const byDate = {}
  Object.values(snapshots).forEach((s) => {
    if (s.date < fromDate || s.date > toDate) return
    if (!byDate[s.date]) byDate[s.date] = 0
    byDate[s.date] += s.dailyPnlRate ?? 0
  })
  return Object.values(byDate).map((v) => v / 100)
}

export default function RiskKpiCards({ snapshots, dateRange, customRange }) {
  const { mdd, volatility } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    let fromDate, toDate = today

    if (dateRange === 'custom' && customRange?.from && customRange?.to) {
      fromDate = customRange.from
      toDate = customRange.to
    } else {
      const startDate = getStartDate(dateRange)
      fromDate = startDate ? new Date(startDate).toISOString().split('T')[0] : '2000-01-01'
    }

    const series = buildDailySeries(snapshots, fromDate, toDate)
    const returns = buildDailyReturnSeries(snapshots, fromDate, toDate)

    return {
      mdd: calculateMDD(series),
      volatility: calculateVolatility(returns),
    }
  }, [snapshots, dateRange, customRange])

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            최대낙폭 (MDD)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {mdd == null ? (
            <p className="text-sm text-gray-400">데이터 부족</p>
          ) : (
            <p className="text-2xl font-bold text-blue-500">{mdd}%</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />
            연환산 변동성
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {volatility == null ? (
            <p className="text-sm text-gray-400">데이터 부족</p>
          ) : (
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{volatility}%</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
