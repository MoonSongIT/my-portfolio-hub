import { useMemo, useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Wallet, RefreshCw, Camera, Loader2, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioStore } from '../store/portfolioStore'
import { useUserAccounts } from '../store/accountStore'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { useCashFlowStore } from '../store/cashFlowStore'
import { snapshotToday, backfillHistory } from '../api/dailyPnlService'
import { useBatchQuotes, useExchangeRate, isAnyMarketOpen } from '../hooks/useStockData'
import {
  calculateTotalValue,
  calculatePortfolioReturn,
  calculateTotalPnL,
  calculateTotalRealizedPnl,
  calculateComprehensiveReturn,
  calculateNetCapital,
  calcAllocation,
  calculateReturn,
  calcMorningComparePnl,
  calcRealizedTodayPnl,
} from '../utils/calculator'
import { useJournalStore } from '../store/journalStore'
import { getByTicker } from '../utils/stockMasterDb'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import { aggregatePortfolioHistory } from '../utils/portfolioAggregator'
import AllocationPieChart from '../components/charts/AllocationPieChart'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import AccountSelector from '../components/account/AccountSelector'
import AccountSetupModal from '../components/account/AccountSetupModal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [overwriteConfirm, setOverwriteConfirm] = useState(false)
  const [existingSnapshotTime, setExistingSnapshotTime] = useState('')
  const [chartPeriod, setChartPeriod] = useState(30)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoSnapshotRan = useRef(false)
  const {
    accounts, selectedAccountId, exchangeRate,
    getSelectedHoldings, getSelectedCash,
    updateAllPrices, updateExchangeRate, lastUpdated,
    selectAccount,
  } = usePortfolioStore()

  // 실제 계좌 수는 accountStore 기준으로 읽음 (portfolioStore.accounts는 동기화 지연 있음)
  const userAccounts = useUserAccounts()

  const entries = useJournalStore(s => s.entries)
  const getAvailableCash = useCashFlowStore(s => s.getAvailableCash)
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const [sectorMap, setSectorMap] = useState({})
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

  // API 훅 — autoRefresh Off 시 주기·마운트·포커스 갱신 모두 비활성화
  // Off 상태에서는 수동 새로고침(handleRefresh) 시에만 시세 조회
  const batchInterval = autoRefresh ? (isAnyMarketOpen() ? 60_000 : 300_000) : false
  const rateInterval  = autoRefresh ? 5 * 60_000 : false
  const { data: batchData, isLoading: priceLoading, isFetching: priceRefreshing, isError: priceError } = useBatchQuotes(uniqueHoldings, {
    refetchInterval: batchInterval,
    refetchOnMount: autoRefresh,
    refetchOnWindowFocus: autoRefresh,
  })
  const { data: rateData } = useExchangeRate({
    refetchInterval: rateInterval,
    refetchOnMount: autoRefresh,
    refetchOnWindowFocus: autoRefresh,
  })

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
  const snapshots           = useDailyPnlStore(s => s.snapshots)
  const hasSnapshotToday    = useDailyPnlStore(s => s.hasSnapshotToday)
  const allSnapshots        = useMemo(() => Object.values(snapshots), [snapshots])

  // 수익률 추이 데이터 집계 — 오늘 포인트는 portfolioStore 실시간으로 override
  const portfolioHistory = useMemo(() => {
    const acct = selectedAccountId
    const snaps = acct === 'all' ? allSnapshots : allSnapshots.filter(s => s.accountId === acct)
    const cfs   = acct === 'all' ? cashFlows    : cashFlows.filter(f => f.accountId === acct)
    const ens   = acct === 'all' ? entries      : entries.filter(e => e.accountId === acct)
    const history = aggregatePortfolioHistory(snaps, chartPeriod, exchangeRate, cfs, ens)
    if (history.length === 0) return history

    // 오늘 포인트를 portfolioStore 실시간 미실현으로 override
    // — 스냅샷 종가가 아닌 현재 실시간 주가 기준으로 카드와 일치시킴
    const todayStr = new Date().toISOString().split('T')[0]
    const base = history[history.length - 1]   // 투자원금/실현/배당은 마지막 항목 그대로
    const investedValue = base.investedValue
    const realized      = base.realized || 0
    const dividend      = base.dividend || 0
    const unrealized    = totalPnL              // portfolioStore 실시간 미실현
    const pnlTotal      = unrealized + realized + dividend
    const returnRate    = investedValue > 0 ? (pnlTotal / investedValue) * 100 : 0
    const portfolioReturnRate = investedValue > 0 ? (unrealized / investedValue) * 100 : 0
    const todayPoint = {
      ...base,
      date: todayStr,
      unrealized,
      totalValue: investedValue + pnlTotal,
      returnRate,
      portfolioReturnRate,
      dailyReturn: returnRate - (history.length >= 2 ? history[history.length - 2].returnRate : 0),
    }

    // 마지막 항목이 오늘이면 교체, 아니면(주말·공휴일 이력 없음) 추가
    return base.date === todayStr
      ? [...history.slice(0, -1), todayPoint]
      : [...history, todayPoint]
  }, [allSnapshots, chartPeriod, exchangeRate, cashFlows, entries, selectedAccountId, totalPnL])

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

  useEffect(() => {
    if (holdings.length === 0) return

    // batchData에서 sector 먼저 추출 (추가 API 호출 없음)
    const fromBatch = {}
    if (batchData) {
      batchData.forEach(r => {
        if (r.success && r.data?.sector) fromBatch[r.ticker] = r.data.sector
      })
    }

    // batchData에 sector 없는 ticker만 DB에서 보완
    const tickers = [...new Set(holdings.map(h => h.ticker))]
    const missing = tickers.filter(t => !fromBatch[t])
    if (missing.length === 0) {
      setSectorMap(fromBatch)
      return
    }
    Promise.all(missing.map(t => getByTicker(t).then(row => [t, row?.sector])))
      .then(pairs => {
        const fromDb = Object.fromEntries(pairs.filter(([, s]) => s))
        setSectorMap({ ...fromBatch, ...fromDb })
      })
      .catch(() => setSectorMap(fromBatch))
  }, [batchData, holdings.map(h => h.ticker).join(',')])

  const holdingsWithSector = useMemo(
    () => holdings.map(h => ({ ...h, sector: sectorMap[h.ticker] ?? h.sector })),
    [holdings, sectorMap]
  )

  const morningPnl = useMemo(
    () => calcMorningComparePnl(holdings, batchData, exchangeRate),
    [holdings, batchData, exchangeRate]
  )

  const filteredEntries = useMemo(() =>
    selectedAccountId === 'all' ? entries : entries.filter(e => e.accountId === selectedAccountId),
    [entries, selectedAccountId]
  )

  const realizedTodayPnl = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return calcRealizedTodayPnl(filteredEntries, today)
  }, [filteredEntries])

  const availableCash = useMemo(
    () => getAvailableCash(selectedAccountId),
    [selectedAccountId, getAvailableCash]
  )

  // 순 투자원금 — isCapital=true 카테고리(투자금 입출금)만 합산
  const totalInvestment = useMemo(() =>
    calculateNetCapital(cashFlows, selectedAccountId, exchangeRate).total
  , [cashFlows, selectedAccountId, exchangeRate])

  const realizedAllPnl = useMemo(
    () => calculateTotalRealizedPnl(filteredEntries, exchangeRate),
    [filteredEntries, exchangeRate]
  )

  // 배당금 합산 — category === 'dividend' 기준
  const totalDividends = useMemo(() => {
    return cashFlows
      .filter(f =>
        f.category === 'dividend' &&
        !f.isAuto &&
        (selectedAccountId === 'all' || f.accountId === selectedAccountId)
      )
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  }, [cashFlows, selectedAccountId])

  const cashFlowRealizedPnl = useMemo(() => {
    return cashFlows
      .filter(f =>
        f.type === 'deposit' &&
        !f.isAuto &&
        f.category === 'realized_gain' &&
        (selectedAccountId === 'all' || f.accountId === selectedAccountId)
      )
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  }, [cashFlows, selectedAccountId])

  const combinedRealizedPnl = realizedAllPnl + cashFlowRealizedPnl

  const comprehensiveReturn = useMemo(() => {
    const unrealized = calculateTotalPnL(holdings, exchangeRate)
    if (totalInvestment <= 0) return 0
    return ((unrealized + combinedRealizedPnl + totalDividends) / totalInvestment) * 100
  }, [holdings, combinedRealizedPnl, totalDividends, totalInvestment, exchangeRate])

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

  const executeSnapshotToday = async () => {
    setOverwriteConfirm(false)
    setSnapshotLoading(true)
    try {
      const { failed } = await snapshotToday(selectedAccountId === 'all' ? undefined : selectedAccountId)
      if (failed.length > 0) {
        toast.warning(`일부 종목 가격 조회 실패: ${failed.join(', ')}`)
      } else {
        toast.success('오늘 손익 스냅샷 저장 완료')
      }
    } catch {
      toast.error('손익 저장 실패. 다시 시도해주세요.')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const handleSnapshot = () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const existing = Object.values(snapshots).find(
      s => s.date === todayStr &&
        (selectedAccountId === 'all' || s.accountId === selectedAccountId)
    )
    if (existing) {
      const time = new Date(existing.createdAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul'
      })
      setExistingSnapshotTime(time)
      setOverwriteConfirm(true)
    } else {
      executeSnapshotToday()
    }
  }

  const lastUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const kpiCards = [
    {
      title: '자산 현황',
      value: formatCurrencyShort(totalValue),
      sub: `투자가능 ${formatCurrencyShort(availableCash)}`,
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      breakdown: [
        { label: '주식평가액', value: formatCurrencyShort(totalValue - cashKRW - cashUSD * exchangeRate) },
        { label: '현금비중', value: totalValue > 0 ? `${((cashKRW + cashUSD * exchangeRate) / totalValue * 100).toFixed(1)}%` : '0.0%' },
      ],
    },
    {
      title: '오늘 손익',
      value: formatCurrencyShort(morningPnl.amount),
      sub: `아침대비 ${formatPercent(morningPnl.rate)}`,
      sub2: `실현 ${formatCurrencyShort(realizedTodayPnl.amount)} (${realizedTodayPnl.count}건)`,
      icon: morningPnl.amount >= 0 ? TrendingUp : TrendingDown,
      color: morningPnl.amount >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: morningPnl.amount >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
      loading: priceLoading,
    },
    {
      title: '포트폴리오',
      value: formatPercent(totalReturn),
      sub: formatCurrencyShort(totalPnL),
      sub2: holdingsSub,
      icon: totalReturn >= 0 ? TrendingUp : TrendingDown,
      color: totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: totalReturn >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: '종합수익률',
      value: formatPercent(comprehensiveReturn),
      icon: comprehensiveReturn >= 0 ? TrendingUp : TrendingDown,
      color: comprehensiveReturn >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: comprehensiveReturn >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
      breakdown: [
        { label: '미실현손익', value: formatCurrencyShort(totalPnL), pnl: totalPnL },
        { label: '실현손익', value: formatCurrencyShort(combinedRealizedPnl), pnl: combinedRealizedPnl },
        { label: '배당금', value: formatCurrencyShort(totalDividends), pnl: totalDividends },
        { label: '손익합계', value: formatCurrencyShort(totalPnL + combinedRealizedPnl + totalDividends), pnl: totalPnL + combinedRealizedPnl + totalDividends, divider: true },
        { label: '투자원금', value: formatCurrencyShort(totalInvestment) },
      ],
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 스냅샷 덮어쓰기 확인 다이얼로그 */}
      <Dialog open={overwriteConfirm} onOpenChange={setOverwriteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>스냅샷 덮어쓰기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300 py-2">
            {existingSnapshotTime}에 저장된 스냅샷이 있는데 현시점으로 덮어쓰겠습니까?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOverwriteConfirm(false)}>취소</Button>
            <Button onClick={executeSnapshotToday}>덮어쓰기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새로고침 오버레이 */}
      {priceRefreshing && !priceLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl bg-gray-900/90 shadow-2xl border border-gray-700">
            <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-sm font-medium text-gray-200">시세 업데이트 중...</p>
          </div>
        </div>
      )}

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
            {/* 자동고침 토글 */}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={autoRefresh ? '자동고침 켜짐 — 클릭하여 끄기' : '자동고침 꺼짐 — 클릭하여 켜기'}
            >
              <span className="text-xs text-gray-500 dark:text-gray-400 select-none">자동고침</span>
              <div className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${autoRefresh ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>
        <AccountSelector
          value={selectedAccountId}
          onChange={selectAccount}
          showAllOption={true}
          onAddClick={() => setAccountModalOpen(true)}
        />
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

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title} className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{kpi.title}</span>
                    {kpi.loading && (
                      <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                    )}
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${kpi.color} ${kpi.loading ? 'opacity-50' : ''}`}>
                  {kpi.value}
                </p>
                {kpi.sub && (
                  <p className={`text-base font-medium text-gray-700 dark:text-gray-200 mt-1 ${kpi.loading ? 'opacity-50' : ''}`}>
                    {kpi.sub}
                  </p>
                )}
                {kpi.sub2 && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                    {kpi.sub2}
                  </p>
                )}
                {kpi.note && (
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-1 italic">
                    {kpi.note}
                  </p>
                )}
                {kpi.breakdown && (
                  <div className="mt-2 space-y-0.5">
                    {kpi.breakdown.map((item) => (
                      <div key={item.label}>
                        {item.divider && <hr className="my-1 border-gray-200 dark:border-gray-700" />}
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400 dark:text-gray-500">{item.label}</span>
                          <span className={
                            item.divider
                              ? 'font-semibold text-gray-600 dark:text-gray-300'
                              : item.pnl != null
                                ? item.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'
                                : 'text-gray-500 dark:text-gray-400'
                          }>
                            {item.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">자산 배분</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPieChart holdings={holdingsWithSector} accounts={accounts} selectedAccountId={selectedAccountId} />
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
      <AccountSetupModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />
    </div>
  )
}
