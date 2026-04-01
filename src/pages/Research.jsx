import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ExternalLink } from 'lucide-react'
import { useStockSearch, useStockPrice } from '../hooks/useStockData'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import LoadingSpinner from '../components/common/LoadingSpinner'

// 검색 결과 카드 (실시간 가격 조회)
function SearchResultCard({ item }) {
  const navigate = useNavigate()
  const { data: quote, isLoading } = useStockPrice(item.ticker, item.market)

  return (
    <Card
      className="border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
      onClick={() => navigate(`/research/${item.ticker}?market=${item.market}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.ticker} · {item.market}</p>
          </div>
          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
            {item.type === 'ETF' ? 'ETF' : '주식'}
          </span>
        </div>
        {isLoading ? (
          <div className="h-8 flex items-center">
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-24 rounded" />
          </div>
        ) : quote ? (
          <div className="flex items-end justify-between">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(quote.currentPrice, quote.currency)}
            </p>
            <span className={`text-sm font-semibold ${quote.changePercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatPercent(quote.changePercent)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">시세 조회 실패</p>
        )}
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <ExternalLink className="w-3 h-3" />
          상세보기
        </div>
      </CardContent>
    </Card>
  )
}

export default function Research() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data: searchResults, isLoading, isError } = useStockSearch(debouncedQuery)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">종목 탐색</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">신규 투자 후보를 찾고 분석하세요.</p>
      </div>

      {/* 검색창 */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 티커를 검색하세요 (예: 삼성전자, AAPL)"
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* 검색 결과 */}
      {isLoading && debouncedQuery && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-8">
          <p className="text-amber-600">검색 중 오류가 발생했습니다. 다시 시도해주세요.</p>
        </div>
      )}

      {searchResults && searchResults.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            검색 결과 ({searchResults.length}건)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((item) => (
              <SearchResultCard key={item.ticker} item={item} />
            ))}
          </div>
        </div>
      )}

      {searchResults && searchResults.length === 0 && debouncedQuery && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">"{debouncedQuery}"에 대한 검색 결과가 없습니다</p>
        </div>
      )}

      {!debouncedQuery && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-lg text-gray-500 dark:text-gray-400">종목을 검색해주세요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            티커 또는 종목명으로 검색하여 상세 분석을 확인할 수 있습니다
          </p>
        </div>
      )}
    </div>
  )
}
