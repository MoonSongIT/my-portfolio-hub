import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{d.psychology}</p>
      <p className="text-gray-600 dark:text-gray-400">거래 건수: {d.count}건</p>
      {d.avgPnl !== null ? (
        <p className={`font-semibold ${d.avgPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          평균 손익: {d.avgPnl >= 0 ? '+' : ''}{formatCurrency(d.avgPnl)}
        </p>
      ) : (
        <p className="text-gray-400">손익 데이터 없음</p>
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

  // avgPnl이 있는 항목만 차트에 표시, 없으면 건수 기반으로 표시
  const chartData = data.map(d => ({
    ...d,
    displayValue: d.avgPnl ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => v === 0 ? '0' : `${(v / 10000).toFixed(0)}만`}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="psychology"
          width={90}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="displayValue" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.psychology}
              fill={entry.displayValue >= 0 ? '#10B981' : '#EF4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
