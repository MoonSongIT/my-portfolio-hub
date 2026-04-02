import { useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, StarOff, ExternalLink } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts'
import { useStockPrice, useStockDetail, useStockHistory } from '../hooks/useStockData'
import { useWatchlistStore } from '../store/watchlistStore'
import { formatCurrency, formatPercent, formatNumber, formatLargeNumber, formatShortDate } from '../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import LoadingSpinner from '../components/common/LoadingSpinner'

const RANGE_OPTIONS = [
  { value: '5d', label: '1주' },
  { value: '1mo', label: '1개월' },
  { value: '3mo', label: '3개월' },
  { value: '6mo', label: '6개월' },
  { value: '1y', label: '1년' },
]

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{d.date}</p>
      <p className="text-blue-600">종가: {d.close?.toLocaleString()}</p>
      {d.volume != null && <p className="text-gray-500">거래량: {formatNumber(d.volume)}</p>}
    </div>
  )
}

function MetricRow({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value ?? 'N/A'}</span>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  )
}

export default function StockDetail() {
  const { ticker } = useParams()
  const [searchParams] = useSearchParams()
  const market = searchParams.get('market') || 'NASDAQ'
  const navigate = useNavigate()

  const [range, setRange] = useState('6mo')

  const { data: quote, isLoading: quoteLoading, isError: quoteError } = useStockPrice(ticker, market)
  const { data: detail, isLoading: detailLoading } = useStockDetail(ticker, market)
  const { data: history, isLoading: historyLoading } = useStockHistory(ticker, market, range)

  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore()
  const isWatched = watchlist.some(w => w.ticker === ticker)

  const toggleWatchlist = () => {
    if (isWatched) {
      removeFromWatchlist(ticker)
    } else if (quote) {
      addToWatchlist({
        ticker,
        name: quote.name,
        market,
        currentPrice: quote.currentPrice,
        change: quote.changePercent,
        currency: quote.currency,
        sector: detail?.sector || 'IT',
      })
    }
  }

  // 차트 Y축 범위
  const chartDomain = useMemo(() => {
    if (!history?.length) return ['auto', 'auto']
    const closes = history.map(d => d.close).filter(Boolean)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const margin = (max - min) * 0.05
    return [min - margin, max + margin]
  }, [history])

  if (quoteLoading) return <div className="p-6"><LoadingSpinner /></div>

  if (quoteError) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
          <ArrowLeft className="w-4 h-4" /> 뒤로
        </button>
        <div className="text-center py-20">
          <p className="text-lg text-gray-500">종목을 찾을 수 없습니다: {ticker}</p>
        </div>
      </div>
    )
  }

  const fmtVal = (v, suffix = '') => v != null ? `${v.toLocaleString()}${suffix}` : 'N/A'
  const fmtPct = (v) => v != null ? formatPercent(v * 100) : 'N/A'
  const fmtCap = (v) => {
    if (v == null) return 'N/A'
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    return formatNumber(v)
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {quote?.name || ticker}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{ticker} · {market}</p>
          </div>
        </div>
        <Button
          variant={isWatched ? 'outline' : 'default'}
          size="sm"
          onClick={toggleWatchlist}
          className="gap-1"
        >
          {isWatched ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
          {isWatched ? '관심종목 제거' : '관심종목 추가'}
        </Button>
      </div>

      {/* 시세 정보 카드 */}
      {quote && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">현재가</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(quote.currentPrice, quote.currency)}
              </p>
              <p className={`text-sm font-semibold ${quote.changePercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {quote.change >= 0 ? '+' : ''}{quote.change?.toFixed(2)} ({formatPercent(quote.changePercent)})
              </p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">전일 종가</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(quote.previousClose, quote.currency)}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">52주 고가</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {detail?.fiftyTwoWeekHigh != null ? formatCurrency(detail.fiftyTwoWeekHigh, quote.currency) : '---'}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">52주 저가</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {detail?.fiftyTwoWeekLow != null ? formatCurrency(detail.fiftyTwoWeekLow, quote.currency) : '---'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 가격 차트 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">가격 차트</CardTitle>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    range === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <LoadingSpinner />
          ) : history?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={history} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis domain={chartDomain} tick={{ fontSize: 11 }} stroke="#9ca3af" width={70}
                  tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="close" stroke="#3B82F6" strokeWidth={2}
                  fill="url(#colorClose)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">차트 데이터가 없습니다</div>
          )}
        </CardContent>
      </Card>

      {/* 기업 정보 + 재무 지표 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기업 개요 */}
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">기업 개요</CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <LoadingSpinner />
            ) : detail ? (
              <div className="space-y-3">
                <MetricRow label="섹터" value={detail.sector} />
                <MetricRow label="업종" value={detail.industry} />
                <MetricRow label="시가총액" value={fmtCap(detail.marketCap)} />
                <MetricRow label="거래량 (평균)" value={detail.averageVolume != null ? formatNumber(detail.averageVolume) : 'N/A'} />
                <MetricRow label="배당수익률" value={detail.dividendYield != null ? fmtPct(detail.dividendYield) : 'N/A'} />
                {detail.website && (
                  <div className="pt-2">
                    <a href={detail.website} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {detail.website}
                    </a>
                  </div>
                )}
                {detail.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-5">
                    {detail.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">기업 정보를 불러오지 못했습니다</p>
            )}
          </CardContent>
        </Card>

        {/* 재무 지표 */}
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">재무 지표</CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <LoadingSpinner />
            ) : detail ? (
              <div className="space-y-1">
                <MetricRow label="PER (주가수익비율)" value={fmtVal(detail.trailingPE)} hint="낮을수록 저평가" />
                <MetricRow label="Forward PER" value={fmtVal(detail.forwardPE)} hint="예상 실적 기준" />
                <MetricRow label="PBR (주가순자산비율)" value={fmtVal(detail.priceToBook)} hint="1 미만이면 저평가" />
                <MetricRow label="ROE (자기자본이익률)" value={fmtPct(detail.returnOnEquity)} hint="높을수록 효율적" />
                <MetricRow label="부채비율" value={fmtVal(detail.debtToEquity, '%')} />
                <MetricRow label="매출 성장률" value={fmtPct(detail.revenueGrowth)} />
                <MetricRow label="이익 성장률" value={fmtPct(detail.earningsGrowth)} />
                <MetricRow label="유동비율" value={fmtVal(detail.currentRatio)} hint="1 이상 안전" />
                <MetricRow label="애널리스트 추천" value={detail.recommendationKey?.toUpperCase()} hint={detail.numberOfAnalystOpinions ? `${detail.numberOfAnalystOpinions}명` : null} />
                <MetricRow label="목표가" value={detail.targetMeanPrice != null ? formatCurrency(detail.targetMeanPrice, quote?.currency) : 'N/A'} />
              </div>
            ) : (
              <p className="text-gray-400 text-sm">재무 데이터를 불러오지 못했습니다</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
