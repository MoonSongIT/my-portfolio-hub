// 리스크 지표 KPI 카드 — MDD(최대낙폭)·연환산 변동성 표시
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { calculateMDD, calculateVolatility, getStartDate } from '../../utils/calculator'
import { TrendingDown, BarChart2 } from 'lucide-react'

const MDD_LEVELS = [
  { max: 10,       label: '낮음',      color: 'text-emerald-500', bar: 'bg-emerald-500', desc: '안정적인 손실 관리 수준입니다.' },
  { max: 20,       label: '보통',      color: 'text-yellow-500',  bar: 'bg-yellow-400',  desc: '일반적인 주식 포트폴리오 범위입니다.' },
  { max: 30,       label: '높음',      color: 'text-orange-500',  bar: 'bg-orange-500',  desc: '고점 대비 손실이 큰 편입니다.' },
  { max: Infinity, label: '매우 높음', color: 'text-red-500',     bar: 'bg-red-500',     desc: '하락 위험 관리가 필요합니다.' },
]

const VOL_LEVELS = [
  { max: 15,       label: '안정',      color: 'text-emerald-500', bar: 'bg-emerald-500', desc: '채권 수준의 낮은 변동성입니다.' },
  { max: 30,       label: '보통',      color: 'text-yellow-500',  bar: 'bg-yellow-400',  desc: 'S&P500 평균(~15%) 대비 높습니다.' },
  { max: 50,       label: '높음',      color: 'text-orange-500',  bar: 'bg-orange-500',  desc: '수익이 크게 흔들릴 수 있습니다.' },
  { max: Infinity, label: '매우 높음', color: 'text-red-500',     bar: 'bg-red-500',     desc: '단기 급등락이 빈번한 수준입니다.' },
]

function getLevel(value, levels) {
  return levels.find(l => value <= l.max) ?? levels[levels.length - 1]
}

function RiskBar({ value, max, markers, barClass }) {
  const filled = Math.min(100, (value / max) * 100)
  return (
    <div className="relative w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-2 mb-1">
      <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${filled}%` }} />
      {markers.map((m) => (
        <div
          key={m.label}
          className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-gray-400 dark:bg-gray-500"
          style={{ left: `${Math.min(100, (m.pct / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

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

  const mddAbs = mdd != null ? Math.abs(mdd) : null
  const mddLevel = mddAbs != null ? getLevel(mddAbs, MDD_LEVELS) : null
  const volLevel = volatility != null ? getLevel(volatility, VOL_LEVELS) : null

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* MDD 카드 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            최대낙폭 (MDD)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {mdd == null ? (
            <p className="text-sm text-gray-400">데이터 부족</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-blue-500">{mdd}%</p>
                <span className={`text-xs font-semibold pb-0.5 ${mddLevel.color}`}>{mddLevel.label}</span>
              </div>
              <RiskBar value={mddAbs} max={60} markers={[{ pct: 30, label: 'KOSPI' }, { pct: 50, label: '기준' }]} barClass={mddLevel.bar} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{mddLevel.desc}</p>
              <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500 dark:text-gray-400">KOSPI 평균</span> -30%
                </span>
                <span className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500 dark:text-gray-400">S&P500 평균</span> -34%
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 연환산 변동성 카드 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />
            연환산 변동성
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {volatility == null ? (
            <p className="text-sm text-gray-400">데이터 부족</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{volatility}%</p>
                <span className={`text-xs font-semibold pb-0.5 ${volLevel.color}`}>{volLevel.label}</span>
              </div>
              <RiskBar value={Math.min(volatility, 60)} max={60} markers={[{ pct: 15, label: 'S&P500' }, { pct: 20, label: 'KOSPI' }]} barClass={volLevel.bar} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{volLevel.desc}</p>
              <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500 dark:text-gray-400">S&P500</span> ~15%
                </span>
                <span className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500 dark:text-gray-400">KOSPI</span> ~20%
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
