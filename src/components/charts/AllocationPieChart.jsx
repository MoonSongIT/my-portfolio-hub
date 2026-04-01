import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calcAllocation, calcSectorAllocation, calcCountryAllocation, calcAccountAllocation } from '../../utils/calculator'
import { formatCurrency } from '../../utils/formatters'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

// 커스텀 툴팁
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</p>
      <p className="text-gray-600 dark:text-gray-400">
        비중: {data.weight.toFixed(1)}%
      </p>
      <p className="text-gray-600 dark:text-gray-400">
        평가액: {formatCurrency(data.value)}
      </p>
    </div>
  )
}

// 커스텀 라벨 (5% 이상만 표시)
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

export default function AllocationPieChart({ holdings, accounts = [], selectedAccountId = 'all' }) {
  // 계좌별 탭은 전체 선택 시에만 활성화
  const showAccountTab = selectedAccountId === 'all' && accounts.length > 1
  const [viewType, setViewType] = useState('stock') // 'stock' | 'sector' | 'country' | 'account'

  const stockAllocation = calcAllocation(holdings)
  const sectorAllocation = calcSectorAllocation(stockAllocation)
  const countryAllocation = calcCountryAllocation(stockAllocation)
  const accountAllocation = showAccountTab ? calcAccountAllocation(accounts) : []

  const dataMap = {
    stock: stockAllocation,
    sector: sectorAllocation,
    country: countryAllocation,
    account: accountAllocation,
  }

  // 개별 계좌로 전환 시 account 탭이 선택돼 있으면 stock으로 리셋
  const currentView = (!showAccountTab && viewType === 'account') ? 'stock' : viewType
  const data = dataMap[currentView] ?? []

  const tabs = [
    { key: 'stock', label: '종목별' },
    { key: 'sector', label: '업종별' },
    { key: 'country', label: '국가별' },
    ...(showAccountTab ? [{ key: 'account', label: '계좌별' }] : []),
  ]

  return (
    <div>
      {/* 탭 */}
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

      {/* 파이차트 */}
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          데이터가 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
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
                <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
