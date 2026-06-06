import { useMemo } from 'react'
import {
  ComposedChart, Area, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatCurrencyShort, formatShortDate } from '../../utils/formatters'
import EmptyState from '../common/EmptyState'

const PERIODS = [
  { value: 7,  label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pnl = d.totalValue - d.investedValue   // 손익합계 = 자산 − 투자원금
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm space-y-0.5 min-w-[180px]">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{d.date}</p>
      <p className={d.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}>
        종합수익률: {d.returnRate > 0 ? '+' : ''}{d.returnRate.toFixed(2)}%
      </p>
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>투자원금</span>
        <span>{formatCurrency(d.investedValue)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-gray-500 dark:text-gray-400">손익합계</span>
        <span className={pnl >= 0 ? 'text-red-500 font-medium' : 'text-blue-500 font-medium'}>
          {pnl > 0 ? '+' : ''}{formatCurrency(pnl)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs pt-1 mt-1 border-t border-gray-100 dark:border-gray-700">
        <span className="text-gray-700 dark:text-gray-200 font-medium">총 자산</span>
        <span className="text-gray-900 dark:text-gray-100 font-semibold">{formatCurrency(d.totalValue)}</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="h-[300px] flex flex-col gap-2 animate-pulse pt-4">
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

/**
 * @param {{
 *   data: Array<{date:string, returnRate:number, totalValue:number, investedValue:number, dailyReturn:number}>,
 *   period: number,
 *   onPeriodChange: (p: number) => void,
 *   isLoading?: boolean,
 * }} props
 */
export default function ProfitLineChart({ data = [], period, onPeriodChange, isLoading = false }) {
  // 수익/손실 구간 fill 분리 — gradientOffset 기법
  const gradientOffset = useMemo(() => {
    if (data.length === 0) return 1
    const max = Math.max(...data.map(d => d.returnRate))
    const min = Math.min(...data.map(d => d.returnRate))
    if (max <= 0) return 0
    if (min >= 0) return 1
    return max / (max - min)
  }, [data])

  const lastDate = data.length > 0 ? data[data.length - 1].date : null

  const yDomain = useMemo(() => {
    if (data.length === 0) return ['auto', 'auto']
    const rates = data.map(d => d.returnRate)
    const min = Math.min(...rates)
    const max = Math.max(...rates)
    const pad = Math.max((max - min) * 0.15, 0.5)
    return [min - pad, max + pad]
  }, [data])

  // 누적 막대용 파생 데이터 — 투자원금(베이스) + 손익(상단 세그먼트)
  // 손익 양수: 베이스=투자원금, 위에 이익(빨강) → 막대 전체=평가액
  // 손익 음수: 베이스=평가액,   위에 손실(파랑) → 막대 전체=투자원금
  const chartData = useMemo(() => data.map(d => {
    const pnl = d.totalValue - d.investedValue
    return {
      ...d,
      pnl,
      principalBase: Math.min(d.investedValue, d.totalValue),
      pnlSegment: Math.abs(pnl),
    }
  }), [data])

  // 우측 금액 축 도메인 — 0 ~ max(평가액, 투자원금)
  const amountDomain = useMemo(() => {
    if (data.length === 0) return [0, 'auto']
    const top = Math.max(...data.map(d => Math.max(d.totalValue, d.investedValue)), 0)
    return [0, top * 1.1]
  }, [data])

  return (
    <div>
      {/* 기간 선택 + 마지막 업데이트 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => onPeriodChange?.(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {lastDate && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {lastDate} 기준
          </span>
        )}
      </div>

      {isLoading && <Skeleton />}

      {!isLoading && data.length === 0 && (
        <EmptyState
          title="수익률 데이터가 없습니다"
          description="매매 일지를 입력하고 스냅샷을 저장하면 추이 차트가 표시됩니다."
          action={{ label: '매매 일지 입력하기 →', href: '/journal' }}
        />
      )}

      {/* 스냅샷 1건 — 수치 카드 */}
      {!isLoading && data.length === 1 && (
        <div className="flex flex-col items-center justify-center h-[300px] gap-2">
          <p className={`text-3xl font-bold ${data[0].returnRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {data[0].returnRate > 0 ? '+' : ''}{data[0].returnRate.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data[0].date} 기준 누적 수익률
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            스냅샷이 2개 이상 쌓이면 추이 차트가 표시됩니다.
          </p>
        </div>
      )}

      {/* 복합 차트 (2개 이상) */}
      {!isLoading && data.length >= 2 && (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 14, left: 0, bottom: 5 }}>
            <defs>
              {/* Area fill — 면은 거의 투명, 선만 강조 */}
              <linearGradient id="profitSplitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#15803d" stopOpacity={0.12} />
                <stop offset={gradientOffset} stopColor="#b91c1c" stopOpacity={0.12} />
              </linearGradient>
              {/* Area stroke — 고채도 진한 색 (전경 강조) */}
              <linearGradient id="profitStrokeColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#15803d" stopOpacity={1} />
                <stop offset={gradientOffset} stopColor="#b91c1c" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
            />
            <YAxis
              yAxisId="left"
              domain={yDomain}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              width={55}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={amountDomain}
              tickFormatter={(v) => formatCurrencyShort(v)}
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              opacity={0.6}
              width={52}
            />
            <ReferenceLine yAxisId="left" y={0} stroke="#6b7280" strokeDasharray="3 3" strokeOpacity={0.6} />
            <Tooltip content={<CustomTooltip />} />
            {/* 누적 막대 — 저채도 파스텔 (은은한 배경 레이어) */}
            <Bar yAxisId="right" dataKey="principalBase" stackId="amount" maxBarSize={32} fill="#e2e8f0" fillOpacity={0.5} />
            <Bar yAxisId="right" dataKey="pnlSegment" stackId="amount" maxBarSize={32} radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.pnl >= 0 ? '#fca5a5' : '#93c5fd'}
                  fillOpacity={0.55}
                />
              ))}
            </Bar>
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="returnRate"
              stroke="url(#profitStrokeColor)"
              strokeWidth={3}
              fill="url(#profitSplitColor)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
