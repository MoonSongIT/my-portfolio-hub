import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { EXCHANGE_RATE } from '../../data/samplePortfolio'

// 월별 실현 손익 집계
function calcMonthlyRealized(entries) {
  const map = {}
  entries.forEach(e => {
    if (e.action !== 'sell' || e.pnl == null) return
    const month = e.date?.slice(0, 7) // YYYY-MM
    if (!month) return
    map[month] = (map[month] || 0) + e.pnl
  })
  return map
}

// 포트폴리오 미실현 손익 총합
function calcTotalUnrealized(holdings) {
  return holdings.reduce((sum, h) => {
    const pnl = (h.currentPrice - h.avgPrice) * h.quantity
    return sum + (h.currency === 'USD' ? pnl * EXCHANGE_RATE : pnl)
  }, 0)
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{payload[0]?.payload?.month}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value?.toLocaleString()}원
        </p>
      ))}
    </div>
  )
}

export default function RealizedVsUnrealized({ entries = [], holdings = [] }) {
  const unrealizedTotal = useMemo(() => calcTotalUnrealized(holdings), [holdings])

  // 최근 6개월 월별 데이터 생성
  const chartData = useMemo(() => {
    const monthlyRealized = calcMonthlyRealized(entries)
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({
        month: `${d.getMonth() + 1}월`,
        실현손익: monthlyRealized[key] || 0,
        // 미실현 손익은 현재 시점 값을 마지막 달에만 표시
        미실현손익: i === 0 ? unrealizedTotal : 0,
      })
    }
    return months
  }, [entries, unrealizedTotal])

  const hasData = entries.some(e => e.action === 'sell' && e.pnl != null) || holdings.length > 0

  if (!hasData) {
    return (
      <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
        매도 일지 또는 보유 종목이 있으면 손익 추이가 표시됩니다.
      </div>
    )
  }

  // 요약 통계
  const totalRealized = Object.values(
    chartData.reduce((acc, d) => { acc[d.month] = d.실현손익; return acc }, {})
  ).reduce((sum, v) => sum + v, 0)

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">실현 손익 (최근 6개월)</p>
          <p className={`text-xl font-bold ${totalRealized >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {totalRealized >= 0 ? '+' : ''}{totalRealized.toLocaleString()}원
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">미실현 손익 (현재)</p>
          <p className={`text-xl font-bold ${unrealizedTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {unrealizedTotal >= 0 ? '+' : ''}{Math.round(unrealizedTotal).toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            tickFormatter={v => v === 0 ? '0' : `${(v / 10000).toFixed(0)}만`}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
          <Bar dataKey="실현손익" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="미실현손익" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        * 미실현 손익은 현재 시점 기준입니다.
      </p>
    </div>
  )
}
