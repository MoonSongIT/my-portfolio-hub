import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'

const PSYCHOLOGY_COLORS = [
  '#6366F1', '#F59E0B', '#10B981', '#3B82F6',
  '#EC4899', '#14B8A6', '#F97316', '#8B5CF6',
]

const TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '10px 14px',
  fontSize: '13px',
  minWidth: '160px',
}

function CustomTooltip({ active, payload, isCountMode }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pnl = d.avgPnl ?? 0
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>{d.psychology}</p>
      <p style={{ color: '#6b7280' }}>거래 건수: {d.count}건</p>
      {isCountMode ? (
        <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>
          매도 기록이 있으면 손익이 표시됩니다
        </p>
      ) : (
        <p style={{ fontWeight: 600, color: pnl >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
          평균 손익: {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
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
          <Tooltip
            content={<CustomTooltip isCountMode={!hasPnlData} />}
            wrapperStyle={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
          />
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
