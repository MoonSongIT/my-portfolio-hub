// 종목 비교 패널 — 수익률 차트 + 지표 테이블
import { useState, useMemo, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { useStockSearch, useStockHistory, useStockDetail } from '../../hooks/useStockData'
import { useDebounce } from '../../hooks/useDebounce'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { formatLargeNumber } from '../../utils/formatters'

const RANGE_OPTIONS = [
  { value: '1mo', label: '1개월' },
  { value: '3mo', label: '3개월' },
  { value: '6mo', label: '6개월' },
  { value: '1y', label: '1년' },
]

function normalize(history) {
  if (!history?.length) return []
  const base = history[0].close
  if (!base) return []
  return history.map(h => ({
    date: h.date,
    pct: +((h.close - base) / base * 100).toFixed(2),
  }))
}

function mergeByDate(baseNorm, compareNorm, baseKey, compareKey) {
  const map = {}
  baseNorm.forEach(d => { map[d.date] = { date: d.date, [baseKey]: d.pct } })
  compareNorm.forEach(d => {
    if (map[d.date]) map[d.date][compareKey] = d.pct
    else map[d.date] = { date: d.date, [compareKey]: d.pct }
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

function MetricCell({ value, suffix = '' }) {
  if (value == null) return <span className="text-gray-400">N/A</span>
  return <span>{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</span>
}

export default function StockComparePanel({ baseTicker, baseMarket, baseName, onClose }) {
  const [range, setRange] = useState('3mo')
  const [compareQuery, setCompareQuery] = useState('')
  const [compareTicker, setCompareTicker] = useState(null)
  const [compareMarket, setCompareMarket] = useState(null)
  const [compareName, setCompareName] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef(null)
  const debouncedQuery = useDebounce(compareQuery, 200)

  const { data: searchResults } = useStockSearch(debouncedQuery)
  const { data: baseHistory } = useStockHistory(baseTicker, baseMarket, range)
  const { data: compareHistory } = useStockHistory(
    compareTicker, compareMarket, range, { enabled: !!compareTicker }
  )
  const { data: baseDetail } = useStockDetail(baseTicker, baseMarket)
  const { data: compareDetail } = useStockDetail(
    compareTicker, compareMarket, { enabled: !!compareTicker }
  )

  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const chartData = useMemo(() => {
    if (!baseHistory?.length) return []
    const baseNorm = normalize(baseHistory)
    if (!compareTicker || !compareHistory?.length) {
      return baseNorm.map(d => ({ date: d.date, [baseName]: d.pct }))
    }
    return mergeByDate(baseNorm, normalize(compareHistory), baseName, compareName)
  }, [baseHistory, compareHistory, compareTicker, baseName, compareName])

  const suggestions = debouncedQuery && searchResults?.length
    ? searchResults.filter(r => r.ticker !== baseTicker).slice(0, 6)
    : []

  function handleSelectCompare(item) {
    setCompareTicker(item.ticker)
    setCompareMarket(item.market)
    setCompareName(item.name)
    setCompareQuery('')
    setDropdownOpen(false)
  }

  function clearCompare() {
    setCompareTicker(null)
    setCompareMarket(null)
    setCompareName(null)
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">종목 비교</CardTitle>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 비교 종목 검색 / 선택 칩 */}
        {!compareTicker ? (
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
            <input
              value={compareQuery}
              onChange={(e) => { setCompareQuery(e.target.value); setDropdownOpen(true) }}
              onFocus={() => suggestions.length && setDropdownOpen(true)}
              placeholder="비교할 종목 검색..."
              autoComplete="off"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {dropdownOpen && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                {suggestions.map((item, idx) => (
                  <button
                    key={item.ticker}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectCompare(item) }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${idx !== 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                      <span className="text-xs text-gray-400">{item.ticker}</span>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{item.market}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{baseName}</span>
              <span className="text-gray-400 text-xs">{baseTicker}</span>
            </div>
            <span className="text-xs text-gray-400">vs</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-full text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{compareName}</span>
              <span className="text-gray-400 text-xs">{compareTicker}</span>
              <button
                onClick={clearCompare}
                className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* 기간 선택 */}
        <div className="flex gap-1">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                range === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 수익률 비교 차트 */}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={d => d?.slice(5) ?? ''}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
                width={52}
              />
              <Tooltip
                formatter={(value, name) => [`${value > 0 ? '+' : ''}${value}%`, name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey={baseName}
                stroke="#3b82f6"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
              {compareTicker && compareName && (
                <Line
                  type="monotone"
                  dataKey={compareName}
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* 지표 비교 테이블 */}
        {compareTicker && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">지표</th>
                  <th className="text-right py-2 text-blue-600 font-medium">{baseName}</th>
                  <th className="text-right py-2 text-orange-500 font-medium">{compareName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">PER</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={baseDetail?.trailingPE} />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={compareDetail?.trailingPE} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">PBR</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={baseDetail?.priceToBook} />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={compareDetail?.priceToBook} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">ROE</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell
                      value={baseDetail?.returnOnEquity != null
                        ? +(baseDetail.returnOnEquity * 100).toFixed(1) : null}
                      suffix="%"
                    />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell
                      value={compareDetail?.returnOnEquity != null
                        ? +(compareDetail.returnOnEquity * 100).toFixed(1) : null}
                      suffix="%"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">시가총액</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    {baseDetail?.marketCap != null
                      ? formatLargeNumber(baseDetail.marketCap)
                      : <span className="text-gray-400">N/A</span>}
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    {compareDetail?.marketCap != null
                      ? formatLargeNumber(compareDetail.marketCap)
                      : <span className="text-gray-400">N/A</span>}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">52주 고가</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={baseDetail?.fiftyTwoWeekHigh} />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={compareDetail?.fiftyTwoWeekHigh} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">52주 저가</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={baseDetail?.fiftyTwoWeekLow} />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell value={compareDetail?.fiftyTwoWeekLow} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500 dark:text-gray-400">배당수익률</td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell
                      value={baseDetail?.dividendYield != null
                        ? +(baseDetail.dividendYield * 100).toFixed(2) : null}
                      suffix="%"
                    />
                  </td>
                  <td className="text-right py-2 font-medium text-gray-900 dark:text-gray-100">
                    <MetricCell
                      value={compareDetail?.dividendYield != null
                        ? +(compareDetail.dividendYield * 100).toFixed(2) : null}
                      suffix="%"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
