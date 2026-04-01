import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { usePortfolioStore } from '../store/portfolioStore'
import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { calculateTotalValue, calculatePortfolioReturn, calculateTotalPnL } from '../utils/calculator'
import { formatCurrency, formatPercent, formatCurrencyShort } from '../utils/formatters'
import PortfolioTable from '../components/portfolio/PortfolioTable'
import AddStockModal from '../components/portfolio/AddStockModal'
import AllocationPieChart from '../components/charts/AllocationPieChart'
import AccountSelector from '../components/common/AccountSelector'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

export default function Portfolio() {
  const { accounts, selectedAccountId, getSelectedHoldings, getSelectedCash } = usePortfolioStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editStock, setEditStock] = useState(null)

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

  const handleEdit = (stock) => {
    setEditStock(stock)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditStock(null)
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
          <Button onClick={() => setModalOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            종목 추가
          </Button>
        </div>
        {/* 계좌 선택 */}
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

      {/* 종목 추가/수정 모달 */}
      <AddStockModal
        open={modalOpen}
        onClose={handleCloseModal}
        editStock={editStock}
      />
    </div>
  )
}
