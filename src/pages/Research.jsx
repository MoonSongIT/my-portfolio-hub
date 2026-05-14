// 종목 탐색 페이지 — Discovery Panel, 시장 필터, 검색 결과
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ExternalLink, TrendingUp, Clock, BarChart2, X } from 'lucide-react'
import { useStockSearch, useStockPrice } from '../hooks/useStockData'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import LoadingSpinner from '../components/common/LoadingSpinner'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const POPULAR_TICKERS = [
  { ticker: '005930', name: '삼성전자', market: 'KRX' },
  { ticker: '000660', name: 'SK하이닉스', market: 'KRX' },
  { ticker: 'AAPL',   name: 'Apple',     market: 'NASDAQ' },
  { ticker: 'NVDA',   name: 'NVIDIA',    market: 'NASDAQ' },
  { ticker: 'TSLA',   name: 'Tesla',     market: 'NASDAQ' },
  { ticker: 'MSFT',   name: 'Microsoft', market: 'NASDAQ' },
  { ticker: '035420', name: 'NAVER',     market: 'KRX' },
  { ticker: 'AMZN',   name: 'Amazon',    market: 'NASDAQ' },
]

// 지수 티커는 모두 Yahoo Finance로 조회 (Naver API는 ^ 지수 미지원)
const MARKET_INDICES = [
  { label: 'KOSPI',   ticker: '^KS11', market: 'NYSE' },
  { label: 'KOSDAQ',  ticker: '^KQ11', market: 'NYSE' },
  { label: 'NASDAQ',  ticker: '^IXIC', market: 'NASDAQ' },
  { label: 'S&P 500', ticker: '^GSPC', market: 'NYSE' },
]

const MARKET_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'kr',  label: '한국', markets: ['KRX', 'KOSDAQ', 'KOSPI', 'NXT'] },
  { key: 'us',  label: '미국', markets: ['NASDAQ', 'NYSE', 'AMEX'] },
  { key: 'etf', label: 'ETF',  type: 'ETF' },
]

const RECENTLY_VIEWED_KEY = 'recentlyViewedStocks'

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function MarketIndexCard({ label, ticker, market }) {
  const { data: quote, isLoading } = useStockPrice(ticker, market)

  return (
    <div className="flex-1 min-w-[100px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {isLoading ? (
        <div className="animate-pulse space-y-1">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ) : quote ? (
        <>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {quote.currentPrice?.toLocaleString() ?? '-'}
          </p>
          <p className={`text-xs font-semibold mt-0.5 ${quote.changePercent >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {formatPercent(quote.changePercent)}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-400">-</p>
      )}
    </div>
  )
}

function DiscoveryPanel({ onSelectTicker }) {
  const navigate = useNavigate()
  const [recentlyViewed, setRecentlyViewed] = useState([])

  useEffect(() => {
    try {
      setRecentlyViewed(JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]'))
    } catch {
      setRecentlyViewed([])
    }
  }, [])

  function removeRecentlyViewed(e, ticker) {
    e.stopPropagation()
    const next = recentlyViewed.filter(item => item.ticker !== ticker)
    setRecentlyViewed(next)
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next))
  }

  return (
    <div className="space-y-6">
      {/* 시장 요약 */}
      <section>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <BarChart2 className="w-4 h-4" />
          시장 요약
        </div>
        <div className="flex gap-3 flex-wrap">
          {MARKET_INDICES.map(idx => (
            <MarketIndexCard key={idx.ticker} {...idx} />
          ))}
        </div>
      </section>

      {/* 최근 본 종목 */}
      {recentlyViewed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4" />
            최근 본 종목
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyViewed.map(item => (
              <div
                key={item.ticker}
                className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm group"
              >
                <button
                  onClick={() => navigate(`/research/${item.ticker}?market=${item.market}`)}
                  className="flex items-center gap-1.5"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{item.ticker}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {item.market}
                  </span>
                </button>
                <button
                  onClick={(e) => removeRecentlyViewed(e, item.ticker)}
                  className="ml-0.5 p-0.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 인기 종목 */}
      <section>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <TrendingUp className="w-4 h-4" />
          인기 종목
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TICKERS.map(item => (
            <button
              key={item.ticker}
              onClick={() => onSelectTicker(item.ticker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">{item.ticker}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

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
            <span className={`text-sm font-semibold ${quote.changePercent >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
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

// ─── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function Research() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [marketFilter, setMarketFilter] = useState('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchBoxRef = useRef(null)
  const debouncedQuery = useDebounce(query, 200)

  const { data: searchResults, isLoading, isError } = useStockSearch(debouncedQuery)

  const filteredResults = useMemo(() => {
    if (!searchResults) return []
    const filter = MARKET_FILTERS.find(f => f.key === marketFilter)
    if (!filter || filter.key === 'all') return searchResults
    if (filter.type === 'ETF') return searchResults.filter(r => r.type === 'ETF')
    return searchResults.filter(r => filter.markets?.includes(r.market))
  }, [searchResults, marketFilter])

  // 검색창 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSuggestionClick(item) {
    setDropdownOpen(false)
    setQuery('')
    navigate(`/research/${item.ticker}?market=${item.market}`)
  }

  const suggestions = debouncedQuery && searchResults?.length ? searchResults.slice(0, 8) : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">종목 탐색</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">신규 투자 후보를 찾고 분석하세요.</p>
      </div>

      {/* 검색창 + 자동완성 드롭다운 */}
      <div className="relative max-w-xl" ref={searchBoxRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true) }}
          onFocus={() => suggestions.length && setDropdownOpen(true)}
          placeholder="종목명 또는 티커를 검색하세요 (예: 삼성전자, AAPL)"
          className="pl-10 h-12 text-base"
          autoComplete="off"
        />
        {/* 자동완성 드롭다운 */}
        {dropdownOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
            {suggestions.map((item, idx) => (
              <button
                key={item.ticker}
                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(item) }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${idx !== 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.ticker}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{item.market}</span>
                  {item.type === 'ETF' && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">ETF</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 시장 필터 탭 (검색 중일 때만 표시) */}
      {debouncedQuery && (
        <div className="flex gap-2">
          {MARKET_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setMarketFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                marketFilter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {f.label}
              {f.key !== 'all' && searchResults && (
                <span className="ml-1 text-xs opacity-70">
                  {f.type === 'ETF'
                    ? searchResults.filter(r => r.type === 'ETF').length
                    : searchResults.filter(r => f.markets?.includes(r.market)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 */}
      {isLoading && debouncedQuery && <LoadingSpinner />}

      {isError && (
        <div className="text-center py-8">
          <p className="text-amber-600">검색 중 오류가 발생했습니다. 다시 시도해주세요.</p>
        </div>
      )}

      {debouncedQuery && !isLoading && filteredResults.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            검색 결과 ({filteredResults.length}건)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResults.map((item) => (
              <SearchResultCard key={item.ticker} item={item} />
            ))}
          </div>
        </div>
      )}

      {debouncedQuery && !isLoading && filteredResults.length === 0 && searchResults && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">"{debouncedQuery}"에 대한 검색 결과가 없습니다</p>
        </div>
      )}

      {/* 빈 검색어 → Discovery Panel */}
      {!debouncedQuery && <DiscoveryPanel onSelectTicker={(t) => setQuery(t)} />}
    </div>
  )
}
