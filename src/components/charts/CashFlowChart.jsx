// 월별 입출금 흐름을 막대차트로 시각화하는 컴포넌트
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { formatCurrencyShort } from '../../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export default function CashFlowChart({ accountId }) {
  const cashFlows = useCashFlowStore(s => s.cashFlows)

  const monthlyData = useMemo(() => {
    const filtered = accountId && accountId !== 'all'
      ? cashFlows.filter(f => f.accountId === accountId)
      : cashFlows

    const map = {}
    filtered.forEach(f => {
      const month = f.date?.slice(0, 7)
      if (!month) return
      if (!map[month]) map[month] = { month, 입금: 0, 출금: 0 }
      if (f.type === 'deposit') map[month].입금 += f.amount ?? 0
      else map[month].출금 += f.amount ?? 0
    })

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [cashFlows, accountId])

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">월별 자금 흐름</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">입출금 내역이 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">월별 자금 흐름</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => formatCurrencyShort(v)} tick={{ fontSize: 12 }} width={56} />
            <Tooltip
              formatter={(v, name) => [formatCurrencyShort(v), name]}
              contentStyle={{ fontSize: 13, borderRadius: 8 }}
            />
            <Legend iconType="rect" wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="입금" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="출금" fill="#f87171" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
