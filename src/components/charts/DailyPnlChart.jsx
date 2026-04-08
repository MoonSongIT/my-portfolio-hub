import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Area, ComposedChart,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useDailyPnlStore } from '../../store/dailyPnlStore'
import { formatCurrency, formatShortDate } from '../../utils/formatters'

// 커스텀 툴팁
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const isRate = payload[0]?.dataKey === 'cumulativePnlRate'
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{d.date}</p>
      <p className="text-gray-500">종가: {formatCurrency(d.closePrice)}</p>
      <p className={d.dailyPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        일간 손익: {d.dailyPnl >= 0 ? '+' : ''}{formatCurrency(d.dailyPnl)}
      </p>
      <p className={d.cumulativePnl >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
        누적 손익: {d.cumulativePnl >= 0 ? '+' : ''}{formatCurrency(d.cumulativePnl)}
      </p>
      <p className={d.cumulativePnlRate >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        수익률: {d.cumulativePnlRate >= 0 ? '+' : ''}{d.cumulativePnlRate?.toFixed(2)}%
      </p>
    </div>
  )
}

// Y축 포매터
function fmtPnl(v) {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`
  return v.toLocaleString()
}

function fmtRate(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

/**
 * DailyPnlChart
 * Props:
 *   ticker     : string
 *   accountId  : string
 *   name       : string  (종목명 표시용)
 *   height     : number  (기본 280)
 */
export default function DailyPnlChart({ ticker, accountId, name, height = 280 }) {
  const [mode, setMode] = useState('rate') // 'rate' | 'amount'
  const snapshots = useDailyPnlStore(s => s.snapshots)

  const data = useMemo(() => {
    const all = Object.values(snapshots)
    return all
      .filter(s => s.ticker === ticker && (!accountId || s.accountId === accountId))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        date:              s.date,
        closePrice:        s.closePrice,
        dailyPnl:          s.dailyPnl,
        cumulativePnl:     s.cumulativePnl,
        cumulativePnlRate: s.cumulativePnlRate,
      }))
  }, [snapshots, ticker, accountId])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
        <TrendingUp size={36} className="mb-2 opacity-30" />
        <p className="text-sm">데이터가 없습니다.</p>
        <p className="text-xs mt-1">스냅샷 저장 후 차트가 표시됩니다.</p>
      </div>
    )
  }

  const isRate = mode === 'rate'
  const dataKey = isRate ? 'cumulativePnlRate' : 'cumulativePnl'
  const lastVal = data[data.length - 1]
  const isPositive = (isRate ? lastVal.cumulativePnlRate : lastVal.cumulativePnl) >= 0
  const lineColor = isPositive ? '#10b981' : '#ef4444'

  // Y축 도메인
  const vals = data.map(d => d[dataKey])
  const minV = Math.min(...vals, 0)
  const maxV = Math.max(...vals, 0)
  const pad  = (maxV - minV) * 0.12 || (isRate ? 1 : 10000)

  return (
    <div>
      {/* 모드 토글 */}
      <div className="flex items-center justify-between mb-3">
        {name && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{name}</p>}
        <div className="flex gap-1 ml-auto">
          {[
            { key: 'rate',   label: '수익률(%)' },
            { key: 'amount', label: '손익(원)' },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                mode === m.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={isRate ? fmtRate : fmtPnl}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickLine={false}
            width={isRate ? 54 : 64}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Y=0 기준선 */}
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 3" strokeWidth={1.5} />
          {/* 영역 채우기 */}
          <Area
            type="monotone"
            dataKey={dataKey}
            fill={`url(#grad-${ticker})`}
            stroke="none"
          />
          {/* 라인 */}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
