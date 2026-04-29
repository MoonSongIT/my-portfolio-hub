import { useMemo, useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Wallet, Briefcase, RefreshCw, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioStore } from '../store/portfolioStore'
import { useUserAccounts } from '../store/accountStore'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { snapshotToday, backfillHistory } from '../api/dailyPnlService'
import { useBatchQuotes, useExchangeRate } from '../hooks/useStockData'
import {
  calculateTotalValue,
  calculatePortfolioReturn,
  calculateTotalPnL,
  calcAllocation,
  calcDailyChange,
  calculateReturn,
} from '../utils/calculator'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import { aggregatePortfolioHistory } from '../utils/portfolioAggregator'
import AllocationPieChart from '../components/charts/AllocationPieChart'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import AccountSelector from '../components/common/AccountSelector'
import LoadingSpinner from '../components/common/LoadingSpinner'
import AvailableCashCard from '../components/portfolio/AvailableCashCard'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [chartPeriod, setChartPeriod] = useState(30)
  const autoSnapshotRan = useRef(false)
  const {
    accounts, selectedAccountId, exchangeRate,
    getSelectedHoldings, getSelectedCash,
    updateAllPrices, updateExchangeRate, lastUpdated,
  } = usePortfolioStore()

  // 실제 계좌 수는 accountStore 기준으로 읽음 (portfolioStore.accounts는 동기화 지연 있음)
  const userAccounts = useUserAccounts()

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const { krw: cashKRW, usd: cashUSD } = useMemo(() => getSelectedCash(), [accounts, selectedAccountId])

  // 고유 종목만 추출 (일괄 시세 조회용)
  const uniqueHoldings = useMemo(() => {
    const seen = new Set()
    return holdings.filter(h => {
      if (seen.has(h.ticker)) return false
      seen.add(h.ticker)
      return true
    })
  }, [holdings])

  // API 훅
  const { data: batchData, isLoading: priceLoading, isError: priceError } = useBatchQuotes(uniqueHoldings)
  const { data: rateData } = useExchangeRate()

  // API 응답 → Store 반영
  useEffect(() => {
    if (batchData) {
      const priceMap = {}
      batchData.forEach(r => {
        if (r.success && r.data) priceMap[r.ticker] = r.data.currentPrice
      })
      if (Object.keys(priceMap).length > 0) updateAllPrices(priceMap)
    }
  }, [batchData])

  useEffect(() => {
    if (rateData?.rate) updateExchangeRate(rateData.rate)
  }, [rateData])

  // KPI 계산
  const totalValue = useMemo(
    () => calculateTotalValue(holdings, cashKRW, cashUSD, exchangeRate),
    [holdings, cashKRW, cashUSD, exchangeRate]
  )
  const totalReturn = useMemo(
    () => calculatePortfolioReturn(holdings, exchangeRate),
    [holdings, exchangeRate]
  )
  const totalPnL = useMemo(
    () => calculateTotalPnL(holdings, exchangeRate),
    [holdings, exchangeRate]
  )

  // dailyPnlStore
  const getSnapshotsByDate  = useDailyPnlStore(s => s.getSnapshotsByDate)
  const snapshots           = useDailyPnlStore(s => s.snapshots)
  const hasSnapshotToday    = useDailyPnlStore(s => s.hasSnapshotToday)
  const allSnapshots        = useMemo(() => Object.values(snapshots), [snapshots])

  // 수익률 추이 데이터 집계
  const portfolioHistory = useMemo(
    () => aggregatePortfolioHistory(allSnapshots, chartPeriod, exchangeRate),
    [allSnapshots, chartPeriod, exchangeRate]
  )

  // 마운트 시 스냅샷 없으면 자동 저장 + 과거 데이터 백필 (silent)
  useEffect(() => {
    if (autoSnapshotRan.current) return
    autoSnapshotRan.current = true
    if (holdings.length === 0) return

    if (!hasSnapshotToday()) {
      snapshotToday(selectedAccountId === 'all' ? undefined : selectedAccountId)
        .catch(() => {})
    }

    // 스냅샷이 전혀 없는 종목은 과거 데이터 백필
    holdings.forEach(h => {
      const existing = Object.values(snapshots).filter(s => s.ticker === h.ticker && s.accountId === h.accountId)
      if (existing.length === 0) {
        backfillHistory(h.ticker, h.accountId, h.market || 'KRX').catch(() => {})
      }
    })
  }, [holdings.length])

  const dailyChange = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todaySnapshots = getSnapshotsByDate(today, selectedAccountId)

    // ① dailyPnlStore 스냅샷 데이터가 있으면 우선 사용
    if (todaySnapshots.length > 0) {
      const snapshotPnl = todaySnapshots.reduce((sum, s) => sum + (s.dailyPnl || 0), 0)
      const prevTotal = totalValue - snapshotPnl
      return calcDailyChange(prevTotal, totalValue)
    }

    // ② 없으면 API previousClose 기반으로 fallback
    if (!batchData) return { amount: 0, rate: 0 }
    let todayPnL = 0
    batchData.forEach(r => {
      if (!r.success || !r.data) return
      if (!r.data.previousClose || r.data.previousClose <= 0) return
      const h = holdings.filter(h => h.ticker === r.ticker)
      h.forEach(holding => {
        const change = (r.data.currentPrice - r.data.previousClose) * holding.quantity
        todayPnL += holding.currency === 'USD' ? change * exchangeRate : change
      })
    })
    const prevTotal = totalValue - todayPnL
    return calcDailyChange(prevTotal, totalValue)
  }, [snapshots, selectedAccountId, batchData, holdings, totalValue, exchangeRate])

  const holdingsSub = useMemo(() => {
    if (selectedAccountId === 'all') {
      return `${holdings.length}종목 / ${userAccounts.length}계좌`
    }
    return `KR ${holdings.filter(h => h.market === 'KRX').length} / US ${holdings.filter(h => h.market !== 'KRX').length}`
  }, [holdings, userAccounts, selectedAccountId])

  const holdingsWithStats = useMemo(() => {
    const allocations = calcAllocation(holdings, exchangeRate)
    return holdings
      .map((h, i) => ({
        ...h,
        returnRate: calculateReturn(h.avgPrice, h.currentPrice),
        weight: allocations[i]?.weight || 0,
      }))
      .sort((a, b) => b.returnRate - a.returnRate)
  }, [holdings, exchangeRate])

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batchQuotes'] })
    queryClient.invalidateQueries({ queryKey: ['exchangeRate'] })
  }

  const handleSnapshot = async () => {
    setSnapshotLoading(true)
    try {
      await snapshotToday(selectedAccountId === 'all' ? undefined : selectedAccountId)
      toast.success('오늘 손익 스냅샷 저장 완료')
    } catch {
      toast.error('손익 저장 실패. 다시 시도해주세요.')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const lastUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

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
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">대시보드</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">전체 포트폴리오 현황을 한눈에 확인하세요.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            {lastUpdateTime && <span>업데이트 {lastUpdateTime}</span>}
            {rateData && <span className="text-xs">USD/KRW {Math.round(rateData.rate).toLocaleString()}</span>}
            <button
              onClick={handleSnapshot}
              disabled={snapshotLoading}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="오늘 손익 저장"
            >
              <Camera className={`w-4 h-4 ${snapshotLoading ? 'animate-pulse' : ''}`} />
            </button>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${priceLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <AccountSelector />
      </div>

      {/* API 에러 배너 */}
      {priceError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <span className="text-sm text-amber-700 dark:text-amber-300">
            일부 시세 데이터를 가져오지 못했습니다. 캐시 데이터를 표시합니다.
          </span>
          <button onClick={handleRefresh} className="text-sm text-amber-700 font-medium hover:underline">다시 시도</button>
        </div>
      )}

      {/* KPI 카드 5개 (4개 + 투자 가능 금액) - 동일 간격 가로 정렬 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        {/* 5번째 카드: 투자 가능 금액 */}
        <AvailableCashCard accountId={selectedAccountId} compact />
      </div>

      {/* 차트 영역 */}
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
            <ProfitLineChart
              data={portfolioHistory}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              isLoading={snapshotLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* 보유 종목 요약 테이블 */}
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
          {priceLoading && holdings.length === 0 ? (
            <LoadingSpinner />
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
