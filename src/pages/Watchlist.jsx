import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List, ExternalLink, RefreshCw, Bot } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useWatchlistStore } from '../store/watchlistStore'
import { useBatchQuotes, useStockSearch } from '../hooks/useStockData'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'
import ChatPanel from '../components/chat/ChatPanel'

// 가격 알림 라벨
function AlertBadge({ changePercent }) {
  if (changePercent == null) return null
  const abs = Math.abs(changePercent)
  if (abs >= 10) return <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">긴급</span>
  if (abs >= 5) return <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">주의</span>
  return null
}

export default function Watchlist() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore()
  const [viewMode, setViewMode] = useState('card')
  const [addOpen, setAddOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  // 관심종목 일괄 시세 조회
  const watchHoldings = useMemo(() =>
    watchlist.map(w => ({ ticker: w.ticker, market: w.market })),
    [watchlist]
  )
  const { data: batchData, isLoading: priceLoading } = useBatchQuotes(watchHoldings)

  // 실시간 가격 매핑
  const priceMap = useMemo(() => {
    const map = {}
    if (batchData) {
      batchData.forEach(r => {
        if (r.success && r.data) {
          map[r.ticker] = r.data
        }
      })
    }
    return map
  }, [batchData])

  // 관심종목 + 실시간 가격 병합
  const enrichedWatchlist = useMemo(() =>
    watchlist.map(w => {
      const live = priceMap[w.ticker]
      return {
        ...w,
        currentPrice: live?.currentPrice ?? w.currentPrice,
        change: live?.changePercent ?? w.change,
        currency: live?.currency ?? w.currency,
      }
    }),
    [watchlist, priceMap]
  )

  // 검색 자동완성
  const { data: searchResults } = useStockSearch(debouncedSearch)

  const handleAddFromSearch = (item) => {
    addToWatchlist({
      ticker: item.ticker,
      name: item.name,
      market: item.market,
      currentPrice: 0,
      change: 0,
      currency: item.market === 'KRX' ? 'KRW' : 'USD',
      sector: 'IT',
    })
    setSearchQuery('')
    setAddOpen(false)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batchQuotes'] })
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatOpen(true)}
            className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
          >
            <Bot className="w-4 h-4" />
            오늘 브리핑
          </Button>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${priceLoading ? 'animate-spin' : ''}`} />
          </button>
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
      {enrichedWatchlist.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg text-gray-500 dark:text-gray-400">관심종목이 없습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            종목을 추가하여 모니터링을 시작하세요
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedWatchlist.map((stock) => {
            const isPositive = (stock.change || 0) >= 0
            return (
              <div key={stock.ticker}
                className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => removeFromWatchlist(stock.ticker)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 text-xs"
                >
                  삭제
                </button>
                <div className="mb-2">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{stock.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stock.ticker} · {stock.market}</p>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {stock.currentPrice > 0 ? formatCurrency(stock.currentPrice, stock.currency) : '---'}
                  </p>
                  <div className="flex items-center">
                    <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stock.change != null ? formatPercent(stock.change) : '---'}
                    </span>
                    <AlertBadge changePercent={stock.change} />
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/research/${stock.ticker}?market=${stock.market}`)}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> 상세보기
                </button>
              </div>
            )
          })}
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
                  <TableHead className="text-center w-24">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedWatchlist.map((stock) => (
                  <TableRow key={stock.ticker}>
                    <TableCell className="font-medium">{stock.name}</TableCell>
                    <TableCell className="text-gray-500">{stock.ticker}</TableCell>
                    <TableCell className="text-right">
                      {stock.currentPrice > 0 ? formatCurrency(stock.currentPrice, stock.currency) : '---'}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${(stock.change || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stock.change != null ? formatPercent(stock.change) : '---'}
                      <AlertBadge changePercent={stock.change} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/research/${stock.ticker}?market=${stock.market}`)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          상세
                        </button>
                        <button
                          onClick={() => removeFromWatchlist(stock.ticker)}
                          className="text-gray-400 hover:text-red-500 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 알림 조건 설정 */}
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

      {/* 종목 추가 모달 (검색 연동) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>관심종목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목 검색</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="종목명 또는 티커를 입력하세요"
                className="mt-1"
              />
            </div>
            {/* 검색 결과 */}
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {searchResults.map((item) => {
                  const alreadyAdded = watchlist.some(w => w.ticker === item.ticker)
                  return (
                    <button
                      key={item.ticker}
                      onClick={() => !alreadyAdded && handleAddFromSearch(item)}
                      disabled={alreadyAdded}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.ticker} · {item.market}</p>
                      </div>
                      {alreadyAdded && <span className="text-xs text-gray-400">추가됨</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {debouncedSearch && searchResults?.length === 0 && (
              <p className="text-sm text-gray-400 py-2">검색 결과가 없습니다</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSearchQuery('') }}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 채팅 패널 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{
          watchlist: watchlist.map(w => ({ ticker: w.ticker, name: w.name, market: w.market })),
          quotesMap: priceMap,
        }}
        forceAgent="alert"
        initialMessage="오늘 관심종목 시장 브리핑해줘"
      />
    </div>
  )
}
