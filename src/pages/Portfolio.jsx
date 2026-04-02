import { useState, useMemo, useEffect } from 'react'
import { Plus, RefreshCw, Bot } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioStore } from '../store/portfolioStore'
import { useBatchQuotes, useExchangeRate } from '../hooks/useStockData'
import { calculateTotalValue, calculatePortfolioReturn, calculateTotalPnL } from '../utils/calculator'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import PortfolioTable from '../components/portfolio/PortfolioTable'
import AddStockModal from '../components/portfolio/AddStockModal'
import AllocationPieChart from '../components/charts/AllocationPieChart'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [editStock, setEditStock] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const { krw: cashKRW, usd: cashUSD } = useMemo(() => getSelectedCash(), [accounts, selectedAccountId])

  // 고유 종목
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

  const handleEdit = (stock) => {
    setEditStock(stock)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditStock(null)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batchQuotes'] })
    queryClient.invalidateQueries({ queryKey: ['exchangeRate'] })
  }

  const lastUpdateTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">포트폴리오</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">보유 중인 주식과 ETF를 관리하세요.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
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
            <Button
              variant="outline"
              onClick={() => setChatOpen(true)}
              className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
            >
              <Bot className="w-4 h-4" />
              포트폴리오 분석
            </Button>
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              종목 추가
            </Button>
          </div>
        </div>
        <AccountSelector />
      </div>

      {/* 요약 KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 평가금액</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrencyShort(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 수익률</p>
            <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPercent(totalReturn)}
            </p>
            <p className={`text-sm ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">현금 잔고</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(cashKRW)}</p>
            {cashUSD > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(cashUSD, 'USD')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 보유 종목 테이블 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            보유 종목 ({holdings.length}개)
            {selectedAccountId === 'all' && accounts.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">{accounts.length}개 계좌</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioTable onEdit={handleEdit} />
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

      {/* 종목 추가/수정 모달 */}
      <AddStockModal
        open={modalOpen}
        onClose={handleCloseModal}
        editStock={editStock}
      />
    </div>
  )
}
