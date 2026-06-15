import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calcAllocation, calcStockAllocation, calcSectorAllocation, calcCountryAllocation, calcAccountAllocation } from '../../utils/calculator'
import { formatCurrency } from '../../utils/formatters'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</p>
      <p className="text-gray-600 dark:text-gray-400">비중: {data.weight.toFixed(1)}%</p>
      <p className="text-gray-600 dark:text-gray-400">평가액: {formatCurrency(data.value)}</p>
    </div>
  )
}

function renderLabel({ weight, cx, cy, midAngle, innerRadius, outerRadius }) {
  if (weight < 5) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {weight.toFixed(0)}%
    </text>
  )
}

function SingleChart({ data, innerRadius = 60, outerRadius = 110, height = 300 }) {
  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-400 text-sm">
        데이터가 없습니다
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          nameKey="name"
          labelLine={false}
          label={renderLabel}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function AllocationPieChart({ holdings, accounts = [], selectedAccountId = 'all' }) {
  const showAccountTab = selectedAccountId === 'all' && accounts.length > 1
  const [viewType, setViewType] = useState('stock')

  const rawAllocation = calcAllocation(holdings)
  // 종목별: 같은 종목을 계좌 구분 없이 하나로 합산 (전체 조회 시 중복 슬라이스 방지)
  const stockAllocation = calcStockAllocation(rawAllocation)
  const sectorAllocation = calcSectorAllocation(rawAllocation)
  const countryAllocation = calcCountryAllocation(rawAllocation)
  const accountAllocation = showAccountTab ? calcAccountAllocation(accounts) : []

  const dataMap = {
    stock: stockAllocation,
    sector: sectorAllocation,
    country: countryAllocation,
    account: accountAllocation,
  }

  const currentView = (!showAccountTab && viewType === 'account') ? 'stock' : viewType
  const data = dataMap[currentView] ?? []

  const tabs = [
    { key: 'stock', label: '종목별' },
    { key: 'sector', label: '업종별' },
    { key: 'country', label: '국가별' },
    ...(showAccountTab ? [{ key: 'account', label: '계좌별' }] : []),
  ]

  const wideCharts = [
    { key: 'stock', label: '종목별', data: stockAllocation },
    { key: 'sector', label: '업종별', data: sectorAllocation },
    { key: 'country', label: '국가별', data: countryAllocation },
  ]

  return (
    <div>
      {/* 와이드 레이아웃: lg 이상 — 3개 차트 나란히 */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-2">
        {wideCharts.map(({ key, label, data: chartData }) => (
          <div key={key} className="flex flex-col items-center">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">
              {label}
            </p>
            <SingleChart data={chartData} innerRadius={45} outerRadius={80} height={240} />
          </div>
        ))}
      </div>

      {/* 모바일 레이아웃: lg 미만 — 탭 + 단일 차트 */}
      <div className="lg:hidden">
        <div className="flex gap-1 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewType(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentView === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SingleChart data={data} innerRadius={60} outerRadius={110} height={300} />
      </div>
    </div>
  )
}
