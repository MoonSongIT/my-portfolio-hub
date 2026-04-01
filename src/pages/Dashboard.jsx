import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Wallet, BarChart2, Briefcase } from 'lucide-react'
import { usePortfolioStore } from '../store/portfolioStore'
import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { samplePriceHistory } from '../data/samplePriceHistory'
import {
  calculateTotalValue,
  calculatePortfolioReturn,
  calculateTotalPnL,
  calcAllocation,
  calcDailyChange,
  calculateReturn,
} from '../utils/calculator'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import AllocationPieChart from '../components/charts/AllocationPieChart'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import AccountSelector from '../components/common/AccountSelector'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Dashboard() {
  const { accounts, selectedAccountId, getSelectedHoldings, getSelectedCash } = usePortfolioStore()

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const { krw: cashKRW, usd: cashUSD } = useMemo(() => getSelectedCash(), [accounts, selectedAccountId])

  // KPI 계산
  const totalValue = useMemo(
    () => calculateTotalValue(holdings, cashKRW, cashUSD, EXCHANGE_RATE),
    [holdings, cashKRW, cashUSD]
  )
  const totalReturn = useMemo(
    () => calculatePortfolioReturn(holdings, EXCHANGE_RATE),
    [holdings]
  )
  const totalPnL = useMemo(
    () => calculateTotalPnL(holdings, EXCHANGE_RATE),
    [holdings]
  )

  // 오늘 손익 (샘플 히스토리 마지막 2일 기준)
  const dailyChange = useMemo(() => {
    const history = samplePriceHistory
    if (history.length < 2) return { amount: 0, rate: 0 }
    return calcDailyChange(
      history[history.length - 2].totalValue,
      history[history.length - 1].totalValue
    )
  }, [])

  // 보유 종목 수 / 계좌 수 표시
  const holdingsSub = useMemo(() => {
    if (selectedAccountId === 'all') {
      const accountCount = accounts.length
      return `${holdings.length}종목 / ${accountCount}계좌`
    }
    return `KR ${holdings.filter(h => h.market === 'KRX').length} / US ${holdings.filter(h => h.market !== 'KRX').length}`
  }, [holdings, accounts, selectedAccountId])

  // 종목별 비중 + 수익률 (요약 테이블용, 수익률 기준 내림차순)
  const holdingsWithStats = useMemo(() => {
    const allocations = calcAllocation(holdings, EXCHANGE_RATE)
    return holdings
      .map((h, i) => ({
        ...h,
        returnRate: calculateReturn(h.avgPrice, h.currentPrice),
        weight: allocations[i]?.weight || 0,
      }))
      .sort((a, b) => b.returnRate - a.returnRate)
  }, [holdings])

  const kpiCards = [
    {
      title: '총 자산',
      value: formatCurrencyShort(totalValue),
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: '오늘 손익',
      value: formatCurrencyShort(dailyChange.amount),
      sub: formatPercent(dailyChange.rate),
      icon: dailyChange.amount >= 0 ? TrendingUp : TrendingDown,
      color: dailyChange.amount >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: dailyChange.amount >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: '총 수익률',
      value: formatPercent(totalReturn),
      sub: formatCurrencyShort(totalPnL),
      icon: totalReturn >= 0 ? TrendingUp : TrendingDown,
      color: totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: totalReturn >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: '보유 종목',
      value: `${holdings.length}종목`,
      sub: holdingsSub,
      icon: Briefcase,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">대시보드</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">전체 포트폴리오 현황을 한눈에 확인하세요.</p>
        </div>
        {/* 계좌 선택 */}
        <AccountSelector />
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title} className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{kpi.title}</span>
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                {kpi.sub && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{kpi.sub}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 차트 영역: 파이차트 + 라인차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">자산 배분</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPieChart holdings={holdings} accounts={accounts} selectedAccountId={selectedAccountId} />
          </CardContent>
        </Card>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">수익률 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfitLineChart />
          </CardContent>
        </Card>
      </div>

      {/* 보유 종목 요약 테이블 (TOP 5) */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">보유 종목 요약</CardTitle>
          <Link
            to="/portfolio"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            전체 보기 →
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>종목명</TableHead>
                {selectedAccountId === 'all' && <TableHead>계좌</TableHead>}
                <TableHead className="text-right">현재가</TableHead>
                <TableHead className="text-right">수익률</TableHead>
                <TableHead className="text-right">비중</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdingsWithStats.slice(0, 5).map((h) => (
                <TableRow key={`${h.accountId}-${h.ticker}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{h.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{h.ticker}</p>
                    </div>
                  </TableCell>
                  {selectedAccountId === 'all' && (
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                      {h.accountName}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatCurrency(h.currentPrice, h.currency)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${h.returnRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatPercent(h.returnRate)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600 dark:text-gray-400">
                    {h.weight.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {holdingsWithStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    보유 종목이 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
