import { useState } from 'react'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { useWatchlistStore } from '../store/watchlistStore'
import { formatCurrency, formatPercent } from '../utils/formatters'
import StockCard from '../components/portfolio/StockCard'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'

export default function Watchlist() {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore()
  const [viewMode, setViewMode] = useState('card') // 'card' | 'table'
  const [addOpen, setAddOpen] = useState(false)
  const [newTicker, setNewTicker] = useState('')
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    if (!newTicker.trim() || !newName.trim()) return
    addToWatchlist({
      ticker: newTicker.trim().toUpperCase(),
      name: newName.trim(),
      market: 'KRX',
      currentPrice: 0,
      change: 0,
      currency: 'KRW',
      sector: 'IT',
    })
    setNewTicker('')
    setNewName('')
    setAddOpen(false)
  }

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">관심종목</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">관심 있는 종목을 모니터링하세요. (계좌 무관)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            추가
          </Button>
        </div>
      </div>

      {/* 관심종목 리스트 */}
      {watchlist.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg text-gray-500 dark:text-gray-400">관심종목이 없습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            종목을 추가하여 모니터링을 시작하세요
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((stock) => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              onRemove={removeFromWatchlist}
            />
          ))}
        </div>
      ) : (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목명</TableHead>
                  <TableHead>티커</TableHead>
                  <TableHead className="text-right">현재가</TableHead>
                  <TableHead className="text-right">변동률</TableHead>
                  <TableHead className="text-center w-16">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.map((stock) => (
                  <TableRow key={stock.ticker}>
                    <TableCell className="font-medium">{stock.name}</TableCell>
                    <TableCell className="text-gray-500">{stock.ticker}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(stock.currentPrice, stock.currency)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${(stock.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatPercent(stock.change || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => removeFromWatchlist(stock.ticker)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                      >
                        삭제
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 알림 조건 설정 (비활성) */}
      <Card className="border border-gray-200 dark:border-gray-700 opacity-60">
        <CardHeader>
          <CardTitle className="text-lg">알림 조건 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            가격 알림, 거래량 급증 알림 등은 Phase 4에서 구현됩니다.
          </p>
        </CardContent>
      </Card>

      {/* 종목 추가 모달 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>관심종목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">티커</label>
              <Input
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="예: 005930, AAPL"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목명</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 삼성전자, Apple Inc."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>취소</Button>
            <Button onClick={handleAdd}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
