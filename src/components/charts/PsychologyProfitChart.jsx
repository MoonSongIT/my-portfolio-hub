import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'

const PSYCHOLOGY_COLORS = [
  '#6366F1', '#F59E0B', '#10B981', '#3B82F6',
  '#EC4899', '#14B8A6', '#F97316', '#8B5CF6',
]

function CustomTooltip({ active, payload, isCountMode }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-900 mb-1">{d.psychology}</p>
      <p className="text-gray-500">거래 건수: {d.count}건</p>
      {isCountMode ? (
        <p className="text-gray-400 text-xs mt-1">매도 기록이 있으면 손익이 표시됩니다</p>
      ) : (
        <p className={`font-semibold mt-0.5 ${d.avgPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          평균 손익: {d.avgPnl >= 0 ? '+' : ''}{formatCurrency(d.avgPnl)}
        </p>
      )}
    </div>
  )
}

export default function PsychologyProfitChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        매매 기록을 추가하면 심리 유형별 분석이 표시됩니다.
      </div>
    )
  }

  const hasPnlData = data.some(d => d.avgPnl !== null && d.avgPnl !== undefined)

  const chartData = data.map(d => ({
    ...d,
    displayValue: hasPnlData ? (d.avgPnl ?? 0) : d.count,
  }))

  const xTickFormatter = hasPnlData
    ? (v) => v === 0 ? '0' : `${(v / 10000).toFixed(0)}만`
    : (v) => `${v}건`

  return (
    <div>
      {!hasPnlData && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 px-1">
          손익 데이터 없음 — 거래 건수 기준 표시
        </p>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="psychology"
            width={90}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip isCountMode={!hasPnlData} />} />
          <Bar dataKey="displayValue" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.psychology}
                fill={
                  hasPnlData
                    ? (entry.displayValue >= 0 ? '#10B981' : '#EF4444')
                    : PSYCHOLOGY_COLORS[index % PSYCHOLOGY_COLORS.length]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
