import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { samplePriceHistory } from '../../data/samplePriceHistory'
import { formatCurrency, formatShortDate } from '../../utils/formatters'

// 커스텀 툴팁
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{data.date}</p>
      <p className="text-blue-600">평가액: {formatCurrency(data.totalValue)}</p>
      <p className={data.dailyReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        일간: {data.dailyReturn > 0 ? '+' : ''}{data.dailyReturn.toFixed(2)}%
      </p>
    </div>
  )
}

export default function ProfitLineChart() {
  const [period, setPeriod] = useState(30) // 7 | 30

  const data = useMemo(() => {
    return samplePriceHistory.slice(-period)
  }, [period])

  const periods = [
    { value: 7, label: '7일' },
    { value: 30, label: '30일' },
  ]

  // Y축 도메인 계산 (최소/최대에 여유 마진)
  const values = data.map(d => d.totalValue)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const margin = (maxVal - minVal) * 0.1

  return (
    <div>
      {/* 기간 선택 */}
      <div className="flex gap-1 mb-4">
        {periods.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 라인차트 */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            domain={[minVal - margin, maxVal + margin]}
            tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="totalValue"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3B82F6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
