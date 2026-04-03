import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { usePortfolioStore } from '../store/portfolioStore'
import { useJournalStore } from '../store/journalStore'
import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { samplePriceHistory, sampleBenchmark } from '../data/samplePriceHistory'
import {
  calculatePortfolioReturn, calculateTotalPnL,
  filterByDateRange, calculateWinRate,
} from '../utils/calculator'
import { formatPercent, formatShortDate, formatCurrencyShort } from '../utils/formatters'
import AccountSelector from '../components/common/AccountSelector'
import TradeHistoryTable from '../components/reports/TradeHistoryTable'
import InsightsCard from '../components/reports/InsightsCard'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { TrendingUp, TrendingDown, BarChart2, Target } from 'lucide-react'

const DATE_RANGES = [
  { key: '1d', label: '오늘' },
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '1y', label: '1년' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{data.date}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {p.value > 0 ? '+' : ''}{p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

function KPICard({ icon: Icon, label, value, sub, color = 'text-gray-900 dark:text-gray-100' }) {
  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const { accounts, selectedAccountId, getSelectedHoldings } = usePortfolioStore()
  const { entries } = useJournalStore()
  const [dateRange, setDateRange] = useState('1m')

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const totalReturn = useMemo(() => calculatePortfolioReturn(holdings, EXCHANGE_RATE), [holdings])
  const totalPnL = useMemo(() => calculateTotalPnL(holdings, EXCHANGE_RATE), [holdings])

  // 기간 필터된 일지 항목
  const filteredEntries = useMemo(() => filterByDateRange(entries, dateRange), [entries, dateRange])
  const winRate = useMemo(() => calculateWinRate(filteredEntries), [filteredEntries])

  // 벤치마크 비교 데이터
  const comparisonData = useMemo(() => {
    const basePortfolio = samplePriceHistory[0]?.totalValue || 1
    const baseKospi = sampleBenchmark.KOSPI[0]?.value || 1
    const baseSP500 = sampleBenchmark.SP500[0]?.value || 1
    return samplePriceHistory.map((item, i) => ({
      date: item.date,
      '내 포트폴리오': ((item.totalValue - basePortfolio) / basePortfolio) * 100,
      KOSPI: sampleBenchmark.KOSPI[i]
        ? ((sampleBenchmark.KOSPI[i].value - baseKospi) / baseKospi) * 100 : 0,
      'S&P500': sampleBenchmark.SP500[i]
        ? ((sampleBenchmark.SP500[i].value - baseSP500) / baseSP500) * 100 : 0,
    }))
  }, [])

  // 벤치마크 대비 수익률 차이 (KOSPI 기준)
  const benchmarkDiff = useMemo(() => {
    if (!comparisonData.length) return null
    const last = comparisonData[comparisonData.length - 1]
    return (last['내 포트폴리오'] - last['KOSPI']).toFixed(2)
  }, [comparisonData])

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">리포트</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">투자 성과를 분석하고 AI 인사이트를 받아보세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AccountSelector />
          {/* 기간 선택 */}
          <div className="flex gap-1">
            {DATE_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  dateRange === r.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={TrendingUp}
          label="총 수익률"
          value={formatPercent(totalReturn)}
          sub={`손익 ${formatCurrencyShort(totalPnL)}`}
          color={totalReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
        />
        <KPICard
          icon={BarChart2}
          label="KOSPI 대비"
          value={benchmarkDiff != null ? `${benchmarkDiff > 0 ? '+' : ''}${benchmarkDiff}%` : '-'}
          sub="벤치마크 초과 수익률"
          color={benchmarkDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
        />
        <KPICard
          icon={Target}
          label="거래 횟수"
          value={`${filteredEntries.length}건`}
          sub={`매수 ${filteredEntries.filter(e => e.action === 'buy').length} / 매도 ${filteredEntries.filter(e => e.action === 'sell').length}`}
        />
        <KPICard
          icon={TrendingDown}
          label="승률"
          value={winRate != null ? `${winRate}%` : '-'}
          sub={winRate == null ? '손익 기록 없음' : winRate >= 50 ? '양호' : '개선 필요'}
          color={winRate == null ? 'text-gray-900 dark:text-gray-100' : winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
        />
      </div>

      {/* 탭 */}
      <Tabs defaultValue="performance">
        <TabsList className="mb-4">
          <TabsTrigger value="performance">성과 추이</TabsTrigger>
          <TabsTrigger value="trades">거래 내역</TabsTrigger>
          <TabsTrigger value="insights">AI 인사이트</TabsTrigger>
        </TabsList>

        {/* 성과 추이 탭 */}
        <TabsContent value="performance">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">벤치마크 비교 (수익률 %)</CardTitle>
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
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="내 포트폴리오" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="KOSPI" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="S&P500" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 거래 내역 탭 */}
        <TabsContent value="trades">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                거래 내역
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {DATE_RANGES.find(r => r.key === dateRange)?.label} 기준
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TradeHistoryTable entries={filteredEntries} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 인사이트 탭 */}
        <TabsContent value="insights">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">AI 인사이트</CardTitle>
            </CardHeader>
            <CardContent>
              <InsightsCard
                entries={filteredEntries}
                dateRange={dateRange}
                holdings={holdings}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
