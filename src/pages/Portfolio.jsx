import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Bot, X, TrendingUp, BarChart2, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioStore } from '../store/portfolioStore'
import { useCashFlowStore } from '../store/cashFlowStore'
import { useJournalStore } from '../store/journalStore'
import { useDailyPnlStore } from '../store/dailyPnlStore'
import { useBatchQuotes, useExchangeRate } from '../hooks/useStockData'
import { calculateTotalValue, calculatePortfolioReturn, calculateTotalPnL } from '../utils/calculator'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import { snapshotToday, backfillHistory } from '../api/dailyPnlService'
import PortfolioTable from '../components/portfolio/PortfolioTable'
import AllocationPieChart from '../components/charts/AllocationPieChart'
import DailyPnlChart from '../components/charts/DailyPnlChart'
import HoldingPnlTimeline from '../components/charts/HoldingPnlTimeline'
import AccountSelector from '../components/common/AccountSelector'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import ChatPanel from '../components/chat/ChatPanel'

export default function Portfolio() {
  const queryClient = useQueryClient()
  const {
    accounts, selectedAccountId, exchangeRate,
    getSelectedHoldings, getSelectedCash,
    updateAllPrices, updateExchangeRate, lastUpdated,
  } = usePortfolioStore()
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const entries   = useJournalStore(s => s.entries)
  const snapshots = useDailyPnlStore(s => s.snapshots)

  const [chatOpen, setChatOpen] = useState(false)
  // 종목 상세 드로어
  const [drawerTicker, setDrawerTicker] = useState(null) // { ticker, accountId, name, market }
  // 스냅샷 작업 상태
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [backfillLoading, setBackfillLoading] = useState(false)

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId, entries])
  const { krw: cashKRW, usd: cashUSD } = useMemo(() => getSelectedCash(), [accounts, selectedAccountId, cashFlows, entries])

  const uniqueHoldings = useMemo(() => {
    const seen = new Set()
    return holdings.filter(h => {
      if (seen.has(h.ticker)) return false
      seen.add(h.ticker)
      return true
    })
  }, [holdings])

  const { data: batchData, isLoading: priceLoading } = useBatchQuotes(uniqueHoldings)
  const { data: rateData } = useExchangeRate()

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

  const totalValue  = useMemo(() => calculateTotalValue(holdings, cashKRW, cashUSD, exchangeRate), [holdings, cashKRW, cashUSD, exchangeRate])
  const totalReturn = useMemo(() => calculatePortfolioReturn(holdings, exchangeRate), [holdings, exchangeRate])
  const totalPnL    = useMemo(() => calculateTotalPnL(holdings, exchangeRate), [holdings, exchangeRate])

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batchQuotes'] })
    queryClient.invalidateQueries({ queryKey: ['exchangeRate'] })
  }

  const lastUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  // 오늘 스냅샷 저장
  const handleSnapshotToday = async () => {
    setSnapshotLoading(true)
    try {
      await snapshotToday(selectedAccountId === 'all' ? undefined : selectedAccountId)
      toast.success('오늘 손익 스냅샷 저장 완료')
    } catch {
      toast.error('오늘 손익 저장 실패. 다시 시도해주세요.')
    } finally {
      setSnapshotLoading(false)
    }
  }

  // 선택 종목 전체 백필
  const handleBackfillAll = async () => {
    if (holdings.length === 0) return
    setBackfillLoading(true)
    try {
      for (const h of uniqueHoldings) {
        await backfillHistory(h.ticker, h.accountId, h.market || 'KRX')
      }
      toast.success(`전체 히스토리 로드 완료 (${uniqueHoldings.length}종목)`)
    } catch {
      toast.error('히스토리 로드 중 오류가 발생했습니다.')
    } finally {
      setBackfillLoading(false)
    }
  }

  // 종목 행 클릭 → 드로어
  const handleRowClick = (h) => {
    setDrawerTicker({ ticker: h.ticker, accountId: h.accountId, name: h.name, market: h.market })
  }

  // 드로어 종목의 스냅샷 수 (데이터 유무 표시용)
  const drawerSnapshotCount = useMemo(() => {
    if (!drawerTicker) return 0
    return Object.values(snapshots).filter(
      s => s.ticker === drawerTicker.ticker && s.accountId === drawerTicker.accountId
    ).length
  }, [snapshots, drawerTicker])

  // 드로어 종목 백필
  const handleDrawerBackfill = async () => {
    if (!drawerTicker) return
    setBackfillLoading(true)
    try {
      await backfillHistory(drawerTicker.ticker, drawerTicker.accountId, drawerTicker.market || 'KRX')
      toast.success(`${drawerTicker.name} 히스토리 로드 완료`)
    } catch {
      toast.error(`${drawerTicker.name} 히스토리 로드 실패`)
    } finally {
      setBackfillLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">포트폴리오</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">보유 중인 주식과 ETF를 관리하세요.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {lastUpdateTime && <span>업데이트 {lastUpdateTime}</span>}
              {rateData && <span>USD/KRW {Math.round(rateData.rate).toLocaleString()}</span>}
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="새로고침"
              >
                <RefreshCw className={`w-4 h-4 ${priceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {/* 손익 스냅샷 저장 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSnapshotToday}
              disabled={snapshotLoading}
              className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
              title="오늘 종가로 손익 스냅샷 저장"
            >
              {snapshotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
              오늘 손익 저장
            </Button>
            <Button
              variant="outline"
              onClick={() => setChatOpen(true)}
              className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
            >
              <Bot className="w-4 h-4" />
              포트폴리오 분석
            </Button>
          </div>
        </div>
        <AccountSelector />
      </div>

      {/* 요약 KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-3 space-y-0.5 text-right">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">총 평가금액</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrencyShort(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-3 space-y-0.5 text-right">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">총 수익률</p>
            <p className={`text-xl font-bold ${totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPercent(totalReturn)}
            </p>
            <p className={`text-xs ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-3 space-y-0.5 text-right">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">현금 잔고</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(cashKRW)}</p>
            {cashUSD > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(cashUSD, 'USD')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 보유 종목 테이블 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              보유 종목 ({holdings.length}개)
              {selectedAccountId === 'all' && accounts.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">{accounts.length}개 계좌</span>
              )}
            </CardTitle>
            <p className="text-xs text-gray-400">종목 행 클릭 → 손익 차트</p>
          </div>
        </CardHeader>
        <CardContent>
          <PortfolioTable onRowClick={handleRowClick} />
        </CardContent>
      </Card>

      {/* 보유 종목 누적 수익률 타임라인 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              보유 종목 수익률 추이
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackfillAll}
              disabled={backfillLoading || holdings.length === 0}
              className="text-xs text-gray-500 gap-1"
            >
              {backfillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              전체 히스토리 로드
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <HoldingPnlTimeline accountId={selectedAccountId} height={300} />
        </CardContent>
      </Card>

      {/* 자산 배분 차트 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">자산 배분</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationPieChart holdings={holdings} accounts={accounts} selectedAccountId={selectedAccountId} />
        </CardContent>
      </Card>

      {/* ── 종목별 손익 드로어 ── */}
      {drawerTicker && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawerTicker(null)}>
          {/* 오버레이 */}
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
          {/* 패널 */}
          <div
            className="relative z-50 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full"
            onClick={e => e.stopPropagation()}
          >
            {/* 드로어 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{drawerTicker.name}</p>
                <p className="text-xs text-gray-500">{drawerTicker.ticker} · {drawerTicker.market}</p>
              </div>
              <button
                onClick={() => setDrawerTicker(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 드로어 내용 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {drawerSnapshotCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600 text-sm">
                  <TrendingUp size={40} className="mb-3 opacity-30" />
                  <p className="mb-1">손익 데이터가 없습니다.</p>
                  <p className="text-xs mb-4">히스토리 로드로 과거 데이터를 불러오세요.</p>
                  <Button
                    size="sm"
                    onClick={handleDrawerBackfill}
                    disabled={backfillLoading}
                    className="gap-1"
                  >
                    {backfillLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
                    히스토리 로드
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">{drawerSnapshotCount}일치 데이터</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDrawerBackfill}
                      disabled={backfillLoading}
                      className="text-xs text-gray-500 gap-1"
                    >
                      {backfillLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      히스토리 갱신
                    </Button>
                  </div>
                  <DailyPnlChart
                    ticker={drawerTicker.ticker}
                    accountId={drawerTicker.accountId}
                    name={null}
                    height={260}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 채팅 패널 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{
          holdings: holdings.map(h => ({
            ticker: h.ticker, name: h.name, quantity: h.quantity,
            avgPrice: h.avgPrice, currentPrice: h.currentPrice, market: h.market,
          })),
          exchangeRate,
        }}
        forceAgent="portfolio"
        initialMessage="내 포트폴리오 현황을 분석해줘"
      />
    </div>
  )
}
