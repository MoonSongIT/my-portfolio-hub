// 종목별 누적 수익률 미니 스파크라인 차트
import { useMemo } from 'react'
import { LineChart, Line, ReferenceLine } from 'recharts'
import { useDailyPnlStore } from '../../store/dailyPnlStore'

export default function HoldingSparkline({ ticker, accountId }) {
  const snapshots = useDailyPnlStore(s => s.snapshots)

  const { data, lastRate } = useMemo(() => {
    const all = Object.values(snapshots).filter(s => {
      if (s.ticker !== ticker) return false
      if (accountId && accountId !== 'all' && s.accountId !== accountId) return false
      return true
    })
    if (all.length === 0) return { data: [], lastRate: 0 }

    const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date))
    const data = sorted.map(s => ({ v: s.cumulativePnlRate }))
    return { data, lastRate: sorted[sorted.length - 1].cumulativePnlRate }
  }, [snapshots, ticker, accountId])

  if (data.length < 2) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>

  const color = lastRate >= 0 ? '#ef4444' : '#3b82f6'

  return (
    <LineChart width={80} height={32} data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
      <Line
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  )
}
