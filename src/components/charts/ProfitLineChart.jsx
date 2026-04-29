import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatShortDate } from '../../utils/formatters'
import EmptyState from '../common/EmptyState'

const PERIODS = [
  { value: 7,  label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{d.date}</p>
      <p className={d.returnRate >= 0 ? 'text-emerald-600' : 'text-red-500'}>
        수익률: {d.returnRate > 0 ? '+' : ''}{d.returnRate.toFixed(2)}%
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-xs">
        평가액: {formatCurrency(d.totalValue)}
      </p>
      {d.dailyReturn !== 0 && (
        <p className={`text-xs ${d.dailyReturn >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          일간: {d.dailyReturn > 0 ? '+' : ''}{d.dailyReturn.toFixed(2)}%
        </p>
      )}
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
 *   data: Array<{date:string, returnRate:number, totalValue:number, dailyReturn:number}>,
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

      {/* 라인차트 (2개 이상) */}
      {!isLoading && data.length >= 2 && (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="profitSplitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.25} />
              </linearGradient>
              <linearGradient id="profitStrokeColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={gradientOffset} stopColor="#22c55e" stopOpacity={1} />
                <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
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
              domain={yDomain}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              width={55}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" strokeOpacity={0.6} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="returnRate"
              stroke="url(#profitStrokeColor)"
              strokeWidth={2}
              fill="url(#profitSplitColor)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
