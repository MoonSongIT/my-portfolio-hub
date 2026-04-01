import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { usePortfolioStore } from '../store/portfolioStore'
import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { samplePriceHistory, sampleBenchmark } from '../data/samplePriceHistory'
import { calculatePortfolioReturn, calculateTotalPnL } from '../utils/calculator'
import { formatPercent, formatShortDate, formatCurrencyShort } from '../utils/formatters'
import AccountSelector from '../components/common/AccountSelector'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Info } from 'lucide-react'

export default function Reports() {
  const { accounts, selectedAccountId, getSelectedHoldings } = usePortfolioStore()
  const [period, setPeriod] = useState('monthly')

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const totalReturn = useMemo(() => calculatePortfolioReturn(holdings, EXCHANGE_RATE), [holdings])
  const totalPnL = useMemo(() => calculateTotalPnL(holdings, EXCHANGE_RATE), [holdings])

  // 벤치마크 비교 데이터
  const comparisonData = useMemo(() => {
    const basePortfolio = samplePriceHistory[0]?.totalValue || 1
    const baseKospi = sampleBenchmark.KOSPI[0]?.value || 1
    const baseSP500 = sampleBenchmark.SP500[0]?.value || 1

    return samplePriceHistory.map((item, i) => ({
      date: item.date,
      portfolio: ((item.totalValue - basePortfolio) / basePortfolio) * 100,
      KOSPI: sampleBenchmark.KOSPI[i]
        ? ((sampleBenchmark.KOSPI[i].value - baseKospi) / baseKospi) * 100
        : 0,
      'S&P500': sampleBenchmark.SP500[i]
        ? ((sampleBenchmark.SP500[i].value - baseSP500) / baseSP500) * 100
        : 0,
    }))
  }, [])

  const periods = [
    { key: 'daily', label: '일간' },
    { key: 'weekly', label: '주간' },
    { key: 'monthly', label: '월간' },
    { key: 'yearly', label: '연간' },
  ]

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const data = payload[0]?.payload
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{data.date}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.stroke }}>
            {p.dataKey}: {p.value > 0 ? '+' : ''}{p.value.toFixed(2)}%
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">리포트</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">투자 성과를 분석하고 리포트를 생성하세요.</p>
        </div>
        {/* 계좌 선택 */}
        <AccountSelector />
      </div>

      {/* 기간 선택 탭 */}
      <div className="flex gap-1">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              period === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 수익률 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 수익률</p>
            <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPercent(totalReturn)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 손익</p>
            <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatCurrencyShort(totalPnL)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">보유 종목</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{holdings.length}개</p>
          </CardContent>
        </Card>
      </div>

      {/* 벤치마크 비교 차트 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">벤치마크 비교 (30일 수익률)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="portfolio" name="내 포트폴리오" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="KOSPI" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="S&P500" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Phase 5 안내 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          상세 리포트 (종목별 성과, 거래 내역, AI 인사이트)는 Phase 5에서 구현됩니다.
        </p>
      </div>
    </div>
  )
}
