// 심리 성숙도 점수 + 심리별 평균손익 가로 막대 + TOP/BOTTOM 3 카드
import { usePsychologyInsight } from '../../hooks/usePsychologyInsight'
import { formatCurrencyShort } from '../../utils/formatters'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '10px 14px',
  fontSize: '13px',
  minWidth: '140px',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontWeight: 600, color: value >= 0 ? '#16a34a' : '#dc2626' }}>
        평균 손익: {value >= 0 ? '+' : ''}{formatCurrencyShort(value)}
      </p>
    </div>
  )
}

export default function PsychologyInsightDashboard() {
  const { stats, maturityScore } = usePsychologyInsight()

  if (stats.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        매매 기록이 5건 이상 있어야 인사이트를 표시합니다.
      </p>
    )
  }

  const sorted = [...stats].sort((a, b) => b.avgPnl - a.avgPnl)
  const top3 = sorted.slice(0, 3).filter(s => s.avgPnl > 0)
  const bottom3 = sorted.slice(-3).reverse().filter(s => s.avgPnl < 0)

  const chartData = stats.map(s => ({
    name: s.psychology,
    avgPnl: s.avgPnl,
  }))

  return (
    <div className="space-y-6">
      {/* 심리 성숙도 점수 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">심리 성숙도 점수</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {maturityScore === null ? '–' : `${maturityScore}점`}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          {maturityScore !== null && (
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${maturityScore}%`,
                background: maturityScore >= 70 ? '#22c55e' : maturityScore >= 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          )}
        </div>
        {maturityScore === null && (
          <p className="text-xs text-gray-400 mt-1">거래 5건 이상 필요</p>
        )}
      </div>

      {/* 심리별 평균 손익 가로 막대 차트 */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">심리별 평균 손익</p>
        <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 64, left: 0, bottom: 0 }}
          >
            <XAxis type="number" tickFormatter={v => formatCurrencyShort(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avgPnl" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.avgPnl >= 0 ? '#ef4444' : '#3b82f6'} />
              ))}
              <LabelList
                dataKey="avgPnl"
                position="right"
                formatter={v => formatCurrencyShort(v)}
                style={{ fontSize: 11, fill: '#6b7280' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TOP3 / BOTTOM3 카드 */}
      {(top3.length > 0 || bottom3.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {top3.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">TOP 3 수익 심리</p>
              <ol className="space-y-1">
                {top3.map((s, i) => (
                  <li key={s.psychology} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 mr-1 w-4">{i + 1}.</span>
                    <span className="flex-1 text-gray-800 dark:text-gray-200 truncate">{s.psychology}</span>
                    <span className="ml-2 font-semibold text-red-600 dark:text-red-400 shrink-0">
                      +{formatCurrencyShort(s.avgPnl)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {bottom3.length > 0 && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">BOTTOM 3 손실 심리</p>
              <ol className="space-y-1">
                {bottom3.map((s, i) => (
                  <li key={s.psychology} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 mr-1 w-4">{i + 1}.</span>
                    <span className="flex-1 text-gray-800 dark:text-gray-200 truncate">{s.psychology}</span>
                    <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                      {formatCurrencyShort(s.avgPnl)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
