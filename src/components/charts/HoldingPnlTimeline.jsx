import { useMemo } from 'react'
import {
  ComposedChart, Line, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useDailyPnlStore } from '../../store/dailyPnlStore'
import { formatShortDate } from '../../utils/formatters'

// 종목별 색상 팔레트
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
]

const PORTFOLIO_BAR_KEY = '__portfolioDailyDelta__'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const barPayload = payload.find(p => p.dataKey === PORTFOLIO_BAR_KEY)
  const linePayloads = payload.filter(p => p.dataKey !== PORTFOLIO_BAR_KEY)
  const sorted = [...linePayloads].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">{label}</p>
      {barPayload?.value != null && (
        <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-gray-100 dark:border-gray-700">
          <span className={`font-semibold ${barPayload.value >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            종합 일간 증감
          </span>
          <span className={`font-semibold ${barPayload.value >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {barPayload.value >= 0 ? '+' : ''}{barPayload.value.toFixed(2)}%p
          </span>
        </div>
      )}
      {sorted.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }} className="font-medium truncate max-w-[90px]">{p.name}</span>
          <span style={{ color: p.color }}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * HoldingPnlTimeline — 현재 보유 종목 누적 수익률 오버레이 차트
 * Props:
 *   accountId    : string | 'all'
 *   activeTickers: string[]  현재 보유 중인 티커 목록 (없으면 전체 표시)
 *   height       : number  (기본 300)
 */
export default function HoldingPnlTimeline({ accountId, activeTickers, height = 300 }) {
  const snapshots = useDailyPnlStore(s => s.snapshots)
  const tickerSet = useMemo(
    () => activeTickers ? new Set(activeTickers) : null,
    [activeTickers?.join(',')]
  )

  // 종목별 { date -> cumulativePnlRate } 집계 + 포트폴리오 합산 일간 증감 계산
  const { dates, tickers, tickerNames, merged } = useMemo(() => {
    const all = Object.values(snapshots).filter(s => {
      if (accountId && accountId !== 'all' && s.accountId !== accountId) return false
      if (tickerSet && !tickerSet.has(s.ticker)) return false
      return true
    })
    if (all.length === 0) return { dates: [], tickers: [], tickerNames: {}, merged: [] }

    // 날짜 유니크 + 정렬
    const dateSet = new Set(all.map(s => s.date))
    const dates   = [...dateSet].sort()

    // 종목 유니크
    const snapshotTickerSet = new Set(all.map(s => s.ticker))
    const tickers           = [...snapshotTickerSet]
    const tickerNames = {}
    all.forEach(s => { tickerNames[s.ticker] = s.name || s.ticker })

    // 날짜별 데이터 맵 { ticker -> { date -> rate } }
    const rateMap = {}
    tickers.forEach(t => { rateMap[t] = {} })
    all.forEach(s => { rateMap[s.ticker][s.date] = s.cumulativePnlRate })

    // 날짜별 포트폴리오 합산 평균 누적 수익률 (단순 평균)
    const portfolioByDate = {}
    for (const date of dates) {
      const vals = tickers.map(t => rateMap[t][date]).filter(v => v != null)
      if (vals.length > 0) portfolioByDate[date] = vals.reduce((s, v) => s + v, 0) / vals.length
    }

    // 날짜 순서로 병합 (데이터 없는 날짜는 이전 값 carry-forward)
    const merged = []
    const lastRate = {}
    let prevPortfolioRate = null
    for (const date of dates) {
      const entry = { date }
      for (const t of tickers) {
        const v = rateMap[t][date]
        if (v !== undefined) lastRate[t] = v
        entry[t] = lastRate[t] ?? null
      }
      // 포트폴리오 합산 일간 증감치
      const portfolioRate = portfolioByDate[date] ?? null
      if (portfolioRate != null && prevPortfolioRate != null) {
        entry[PORTFOLIO_BAR_KEY] = parseFloat((portfolioRate - prevPortfolioRate).toFixed(3))
      } else {
        entry[PORTFOLIO_BAR_KEY] = null
      }
      if (portfolioRate != null) prevPortfolioRate = portfolioRate
      merged.push(entry)
    }

    return { dates, tickers, tickerNames, merged }
  }, [snapshots, accountId])

  if (tickers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
        <TrendingUp size={36} className="mb-2 opacity-30" />
        <p className="text-sm">데이터가 없습니다.</p>
        <p className="text-xs mt-1">일별 손익 스냅샷이 쌓이면 차트가 표시됩니다.</p>
      </div>
    )
  }

  // Y축 도메인
  const allVals = merged.flatMap(d => tickers.map(t => d[t]).filter(v => v !== null))
  const minV = Math.min(...allVals, 0)
  const maxV = Math.max(...allVals, 0)
  const pad  = (maxV - minV) * 0.12 || 1

  // 우측 Y축(일간 증감) 도메인 계산
  const deltaVals = merged.map(d => d[PORTFOLIO_BAR_KEY]).filter(v => v != null)
  const deltaAbs = deltaVals.length > 0 ? Math.max(...deltaVals.map(Math.abs), 0.1) : 1
  const deltaDomain = [-deltaAbs * 1.5, deltaAbs * 1.5]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={merged} margin={{ top: 4, right: 52, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="left"
          domain={[minV - pad, maxV + pad]}
          tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          tickLine={false}
          width={54}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={deltaDomain}
          tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
          tick={{ fontSize: 10 }}
          stroke="#9ca3af"
          tickLine={false}
          opacity={0.6}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine yAxisId="left" y={0} stroke="#9ca3af" strokeDasharray="4 3" strokeWidth={1.5} />
        <Legend
          formatter={(value) => value === PORTFOLIO_BAR_KEY ? '종합 일간 증감' : (tickerNames[value] || value)}
          iconType="plainline"
          iconSize={16}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar yAxisId="right" dataKey={PORTFOLIO_BAR_KEY} name="종합 일간 증감" maxBarSize={8} radius={[2, 2, 0, 0]}>
          {merged.map((entry, i) => (
            <Cell
              key={i}
              fill={entry[PORTFOLIO_BAR_KEY] >= 0 ? '#EF4444' : '#3B82F6'}
              fillOpacity={entry[PORTFOLIO_BAR_KEY] == null ? 0 : 0.65}
            />
          ))}
        </Bar>
        {tickers.map((ticker, i) => (
          <Line
            key={ticker}
            yAxisId="left"
            type="monotone"
            dataKey={ticker}
            name={tickerNames[ticker] || ticker}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
