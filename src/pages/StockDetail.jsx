import { useState, useMemo, useEffect, useCallback, useRef, Component } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, StarOff, ExternalLink, Bot, CandlestickChart as CandleIcon, LineChart as LineIcon, Loader2 } from 'lucide-react'
import { useResearchBundle } from '../hooks/useResearchBundle'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts'
import { useStockPrice, useStockDetail, useStockHistory } from '../hooks/useStockData'
import { fetchHistory, RANGE_ORDER, getNextRange } from '../api/stockApi'
import { mergeOhlcvArrays } from '../utils/mergeHistory'
import CandlestickChart from '../components/charts/CandlestickChart'
import { useWatchlistStore } from '../store/watchlistStore'
import { formatCurrency, formatPercent, formatNumber, formatLargeNumber, formatShortDate } from '../utils/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ChatPanel from '../components/chat/ChatPanel'

// 차트 에러 격리용 ErrorBoundary
class ChartErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error) {
    console.error('[ChartErrorBoundary]', error)
  }
  // key 변경 시 에러 상태 리셋
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
          <p className="text-sm">차트 렌더링 오류</p>
          <p className="text-xs mt-1 text-red-400">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 text-xs text-blue-500 hover:underline"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
  const [allHistory, setAllHistory] = useState([])
  const [loadedRange, setLoadedRange] = useState(null)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [chartType, setChartType] = useState('line') // 'line' | 'candle'
  const [chatOpen, setChatOpen] = useState(false)
  const [bundleEnabled, setBundleEnabled] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [chatContext, setChatContext] = useState(null)

  const { data: quote, isLoading: quoteLoading, isError: quoteError } = useStockPrice(ticker, market)
  const { data: detail, isLoading: detailLoading } = useStockDetail(ticker, market)
  const { data: history, isLoading: historyLoading } = useStockHistory(ticker, market, range)

  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore()
  const isWatched = watchlist.some(w => w.ticker === ticker)

  // history 로드 완료 시 allHistory 초기화
  useEffect(() => {
    if (history?.length) {
      setAllHistory(history)
      setLoadedRange(range)
    }
  }, [history])

  // range 변경 시 누적 히스토리 리셋 (사용자가 명시적으로 기간 변경)
  const prevRangeRef = useRef(range)
  useEffect(() => {
    if (prevRangeRef.current !== range) {
      prevRangeRef.current = range
      setAllHistory([])
      setLoadedRange(null)
    }
  }, [range])

  const isMaxRange = loadedRange === RANGE_ORDER[RANGE_ORDER.length - 1]

  const handleNeedMoreData = useCallback(async () => {
    const nextRange = getNextRange(loadedRange)
    if (!nextRange || isFetchingMore) return
    setIsFetchingMore(true)
    try {
      const olderData = await fetchHistory(ticker, market, nextRange)
      setAllHistory(prev => mergeOhlcvArrays(prev, olderData))
      setLoadedRange(nextRange)
    } catch {
      // 이전 데이터 로딩 실패 시 무시 (현재 데이터 유지)
    } finally {
      setIsFetchingMore(false)
    }
  }, [ticker, market, loadedRange, isFetchingMore])

  // 이미 로드된 데이터 재사용 (번들 조립 시 중복 fetch 방지)
  const prefetched = useMemo(() => ({
    quote:   quote  ?? null,
    detail:  detail ?? null,
    history: history?.length ? history : null,
  }), [quote, detail, history])

  // 폴백: 번들 수집 실패 시 기본 stockData만으로 패널 열기
  const fallback = useMemo(() => ({
    stockData: {
      symbol: ticker,
      name: quote?.name,
      currentPrice: quote?.currentPrice,
      changePercent: quote?.changePercent,
      market,
      marketCap: detail?.marketCap,
      per: detail?.trailingPE,
      pbr: detail?.priceToBook,
      high52w: detail?.fiftyTwoWeekHigh,
      low52w: detail?.fiftyTwoWeekLow,
      volume: detail?.averageVolume,
    },
  }), [ticker, market, quote, detail])

  // React Query 캐싱 훅 — 5분 staleTime, 10분 gcTime (T10: 재질문 시 캐시 HIT)
  const {
    data: researchBundle,
    isLoading: bundleLoading,
  } = useResearchBundle(ticker, market, { enabled: bundleEnabled, prefetched })

  // 번들 로드 완료(또는 오류) → 채팅 패널 오픈
  useEffect(() => {
    if (!pendingOpen) return
    if (bundleLoading) return
    setChatContext(researchBundle ? { researchBundle } : fallback)
    setChatOpen(true)
    setPendingOpen(false)
    setBundleEnabled(false)
  }, [pendingOpen, bundleLoading, researchBundle, fallback])

  // AI 분석 버튼 클릭 — React Query로 번들 트리거 (캐시 HIT 시 즉시 응답)
  const handleOpenAIChat = () => {
    if (bundleLoading) return
    setBundleEnabled(true)
    setPendingOpen(true)
  }

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
    const src = allHistory.length > 0 ? allHistory : (history ?? [])
    if (!src.length) return ['auto', 'auto']
    const closes = src.map(d => d.close).filter(Boolean)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const margin = (max - min) * 0.05
    return [min - margin, max + margin]
  }, [allHistory, history])

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

  const isKRX = market === 'KRX'

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAIChat}
            disabled={bundleLoading}
            className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950 disabled:opacity-70"
          >
            {bundleLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Bot className="w-4 h-4" />
            }
            {bundleLoading ? '데이터 수집 중...' : 'AI 분석'}
          </Button>
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
      </div>

      {/* 시세 정보 카드 — 4열 레이아웃 */}
      {quote && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* 카드 1: 현재가 + 전일 종가 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="px-3 py-2">
              <div className="text-center mb-1">
                <p className="text-xs text-gray-500 mb-0.5">현재가</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(quote.currentPrice, quote.currency)}
                </p>
                <p className={`text-sm font-semibold ${quote.changePercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {quote.change >= 0 ? '+' : ''}{quote.change?.toFixed(2)} ({formatPercent(quote.changePercent)})
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">전일 종가</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(quote.previousClose, quote.currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 카드 2: 52주 고가 + 52주 저가 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="px-3 py-2">
              <div className="text-center mb-1">
                <p className="text-xs text-gray-500 mb-0.5">52주 고가</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {(detail?.fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh) != null
                    ? formatCurrency(detail?.fiftyTwoWeekHigh ?? quote.fiftyTwoWeekHigh, quote.currency)
                    : '---'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">52주 저가</p>
                <p className="text-lg font-semibold text-red-500">
                  {(detail?.fiftyTwoWeekLow ?? quote?.fiftyTwoWeekLow) != null
                    ? formatCurrency(detail?.fiftyTwoWeekLow ?? quote.fiftyTwoWeekLow, quote.currency)
                    : '---'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 카드 3: 액면가 + 외국인 보유율 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="px-3 py-2">
              <div className="text-center mb-1">
                <p className="text-xs text-gray-500 mb-0.5">액면가</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {(detail?.parValue ?? quote?.parValue) != null
                    ? `${(detail?.parValue ?? quote.parValue).toLocaleString()}원`
                    : 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">외국인 보유율</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {detail?.foreignRate != null ? `${detail.foreignRate}%` : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 카드 4: 애널리스트 추천 + 목표가 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="px-3 py-2">
              <div className="text-center mb-1">
                <p className="text-xs text-gray-500 mb-0.5">애널리스트 추천</p>
                <p className={`text-lg font-semibold ${
                  detail?.recommendationKey === 'buy' ? 'text-emerald-600' :
                  detail?.recommendationKey === 'sell' ? 'text-red-500' :
                  'text-gray-900 dark:text-gray-100'
                }`}>
                  {detail?.recommendationKey
                    ? ({ buy: '매수', hold: '중립', sell: '매도' }[detail.recommendationKey] ?? detail.recommendationKey.toUpperCase())
                    : 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">목표가</p>
                <p className="text-lg font-semibold text-blue-500">
                  {detail?.targetMeanPrice != null
                    ? formatCurrency(detail.targetMeanPrice, quote?.currency)
                    : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 가격 차트 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">가격 차트</CardTitle>
            <div className="flex items-center gap-2">
              {/* 차트 유형 토글 */}
              <div className="flex rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setChartType('line')}
                  title="라인 차트"
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                    chartType === 'line'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <LineIcon className="w-3.5 h-3.5" />
                  라인
                </button>
                <button
                  onClick={() => setChartType('candle')}
                  title="캔들스틱 차트"
                  className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors border-l border-gray-200 dark:border-gray-600 ${
                    chartType === 'candle'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <CandleIcon className="w-3.5 h-3.5" />
                  캔들
                </button>
              </div>
              {/* 기간 선택 */}
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
          </div>
        </CardHeader>
        <CardContent>
          <ChartErrorBoundary resetKey={`${chartType}-${range}`}>
            {historyLoading ? (
              <LoadingSpinner />
            ) : allHistory.length > 0 ? (
              chartType === 'candle' ? (
                <CandlestickChart
                  data={allHistory}
                  ticker={ticker}
                  timeframe={range}
                  onNeedMoreData={handleNeedMoreData}
                  isFetchingMore={isFetchingMore}
                  isMaxRange={isMaxRange}
                />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={allHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              )
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">차트 데이터가 없습니다</div>
            )}
          </ChartErrorBoundary>
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
            ) : (
              <div className="space-y-3">
                <MetricRow label="섹터" value={detail?.sector ?? 'N/A'} />
                <MetricRow label="업종" value={detail?.industry ?? 'N/A'} />
                <MetricRow label="시가총액" value={fmtCap(detail?.marketCap ?? quote?.marketCap)} />
                <MetricRow
                  label="거래량 (평균 20일)"
                  value={detail?.averageVolume != null ? formatNumber(detail.averageVolume) : 'N/A'}
                />
                {/* 거래대금: KRX 전용 */}
                {isKRX && detail?.tradingValue != null && (
                  <MetricRow
                    label="거래대금"
                    value={`${(detail.tradingValue / 1000).toFixed(0)}억원`}
                  />
                )}
                <MetricRow
                  label="배당수익률"
                  value={detail?.dividendYield != null ? fmtPct(detail.dividendYield) : 'N/A'}
                />
                {/* 주당 배당금: KRX 전용 */}
                {isKRX && detail?.dividendPerShare != null && (
                  <MetricRow
                    label="주당 배당금"
                    value={`${detail.dividendPerShare.toLocaleString()}원`}
                  />
                )}
                {detail?.website && (
                  <div className="pt-2">
                    <a href={detail.website} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {detail.website}
                    </a>
                  </div>
                )}
                {detail?.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-5">
                    {detail.description}
                  </p>
                )}
              </div>
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
            ) : (
              <div className="space-y-1">
                {/* ── 공통 밸류에이션 ── */}
                <MetricRow label="PER (주가수익비율)"  value={fmtVal(detail?.trailingPE)}  hint="낮을수록 저평가" />
                <MetricRow label="추정 PER (Forward)" value={fmtVal(detail?.forwardPE)}   hint="예상 실적 기준" />
                <MetricRow label="PBR (주가순자산비율)" value={fmtVal(detail?.priceToBook)} hint="1 미만이면 저평가" />

                {/* ── KRX 전용: 주당 지표 ── */}
                {isKRX && (
                  <>
                    <MetricRow
                      label="EPS (주당순이익)"
                      value={detail?.eps != null ? `${detail.eps.toLocaleString()}원` : 'N/A'}
                    />
                    <MetricRow
                      label="추정 EPS"
                      value={detail?.cnsEps != null ? `${detail.cnsEps.toLocaleString()}원` : 'N/A'}
                      hint="컨센서스 기준"
                    />
                    <MetricRow
                      label="BPS (주당순자산)"
                      value={detail?.bps != null ? `${detail.bps.toLocaleString()}원` : 'N/A'}
                    />
                  </>
                )}

                {/* ── 공통: 재무 비율 ── */}
                <MetricRow label="ROE (자기자본이익률)" value={fmtPct(detail?.returnOnEquity)}   hint="높을수록 효율적" />
                <MetricRow label="부채비율"             value={fmtVal(detail?.debtToEquity, '%')} />
                {isKRX && detail?.operatingMargin != null && (
                  <MetricRow label="영업이익률" value={fmtPct(detail.operatingMargin)} />
                )}
                {isKRX && detail?.netMargin != null && (
                  <MetricRow label="순이익률"   value={fmtPct(detail.netMargin)} />
                )}
                <MetricRow label="매출 성장률"           value={fmtPct(detail?.revenueGrowth)} />
                <MetricRow label="이익 성장률"           value={fmtPct(detail?.earningsGrowth)} />
                <MetricRow label={isKRX ? "당좌비율" : "유동비율"}
                           value={isKRX ? fmtVal(detail?.currentRatio, '%') : fmtVal(detail?.currentRatio)}
                           hint={isKRX ? "100% 이상 안전" : "1 이상 안전"} />

                {/* 컨센서스는 상단 카드로 이동 */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI 채팅 패널 — researchBundle 포함 컨텍스트 주입 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={chatContext ?? {}}
        forceAgent="research"
        initialMessage={`${quote?.name || ticker} 종합 분석해줘`}
      />
    </div>
  )
}
