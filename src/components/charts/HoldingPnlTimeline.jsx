import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useDailyPnlStore } from '../../store/dailyPnlStore'
import { formatCurrency, formatShortDate } from '../../utils/formatters'

// 종목별 색상 팔레트
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }} className="font-medium truncate max-w-[90px]">{p.name}</span>
          <span style={{ color: p.color }}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * HoldingPnlTimeline — 전체 보유 종목 누적 수익률 오버레이 차트
 * Props:
 *   accountId : string | 'all'
 *   height    : number  (기본 300)
 */
export default function HoldingPnlTimeline({ accountId, height = 300 }) {
  const snapshots = useDailyPnlStore(s => s.snapshots)

  // 종목별 { date -> cumulativePnlRate } 집계
  const { dates, tickers, tickerNames, merged } = useMemo(() => {
    const all = Object.values(snapshots).filter(s =>
      !accountId || accountId === 'all' || s.accountId === accountId
    )
    if (all.length === 0) return { dates: [], tickers: [], tickerNames: {}, merged: [] }

    // 날짜 유니크 + 정렬
    const dateSet = new Set(all.map(s => s.date))
    const dates   = [...dateSet].sort()

    // 종목 유니크
    const tickerSet = new Set(all.map(s => s.ticker))
    const tickers   = [...tickerSet]
    const tickerNames = {}
    all.forEach(s => { tickerNames[s.ticker] = s.name || s.ticker })

    // 날짜별 데이터 맵 { ticker -> { date -> rate } }
    const rateMap = {}
    tickers.forEach(t => { rateMap[t] = {} })
    all.forEach(s => { rateMap[s.ticker][s.date] = s.cumulativePnlRate })

    // 날짜 순서로 병합 (데이터 없는 날짜는 이전 값 carry-forward)
    const merged = []
    const lastRate = {}
    for (const date of dates) {
      const entry = { date }
      for (const t of tickers) {
        const v = rateMap[t][date]
        if (v !== undefined) lastRate[t] = v
        entry[t] = lastRate[t] ?? null
      }
      merged.push(entry)
    }

    return { dates, tickers, tickerNames, merged }
  }, [snapshots, accountId])

  if (tickers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
        <TrendingUp size={36} className="mb-2 opacity-30" />
        <p className="text-sm">데이터가 없습니다.</p>
        <p className="text-xs mt-1">일별 손익 스냅샷이 쌓이면 차트가 표시됩니다.</p>
      </div>
    )
  }

  // Y축 도메인
  const allVals = merged.flatMap(d => tickers.map(t => d[t]).filter(v => v !== null))
  const minV = Math.min(...allVals, 0)
  const maxV = Math.max(...allVals, 0)
  const pad  = (maxV - minV) * 0.12 || 1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={[minV - pad, maxV + pad]}
          tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          tickLine={false}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 3" strokeWidth={1.5} />
        <Legend
          formatter={(value) => tickerNames[value] || value}
          iconType="plainline"
          iconSize={16}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        {tickers.map((ticker, i) => (
          <Line
            key={ticker}
            type="monotone"
            dataKey={ticker}
            name={ticker}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
