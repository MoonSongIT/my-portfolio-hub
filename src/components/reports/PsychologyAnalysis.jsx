// 심리 유형별 수익 패턴 분석 컴포넌트
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'
import {
  calcPsychologyStats, findRepeatedMistakes, findBestPatterns,
  calcDayOfWeekStats, calcHoldingPeriodDistribution, calcSectorStats,
} from '../../utils/calculator'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { AlertTriangle, Star } from 'lucide-react'

function formatPnl(v) {
  if (v == null) return '-'
  const abs = Math.abs(v)
  const str = abs >= 10000
    ? `${(abs / 10000).toFixed(0)}만원`
    : `${Math.round(abs).toLocaleString('ko-KR')}원`
  return (v >= 0 ? '+' : '-') + str
}

export default function PsychologyAnalysis({ entries }) {
  const stats = calcPsychologyStats(entries)
  const mistakes = findRepeatedMistakes(entries)
  const bestPatterns = findBestPatterns(entries)

  const tickerSectorMap = useMemo(() => {
    const map = {}
    entries.forEach((e) => { if (e.ticker && e.sector) map[e.ticker] = e.sector })
    return map
  }, [entries])

  const dowStats = useMemo(() => calcDayOfWeekStats(entries), [entries])
  const holdingDist = useMemo(() => calcHoldingPeriodDistribution(entries), [entries])
  const sectorStats = useMemo(() => calcSectorStats(entries, tickerSectorMap), [entries, tickerSectorMap])

  const hasData = entries.some(e => e.psychology)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
        <p className="text-4xl mb-3">🧠</p>
        <p className="text-sm">매매 일지에 심리 유형 데이터가 없습니다.</p>
        <p className="text-xs mt-1">거래 기록 시 심리 유형을 선택하면 분석이 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 심리 유형별 평균 손익 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">심리 유형별 평균 손익</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={stats}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => v === 0 ? '0' : Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(0)}만` : `${(v / 1000).toFixed(0)}천`}
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
              />
              <YAxis
                type="category"
                dataKey="psychology"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                width={80}
              />
              <Tooltip
                formatter={(v) => [formatPnl(v), '평균손익']}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#111827' }}
                itemStyle={{ color: '#374151' }}
              />
              <Bar dataKey="avgPnl" radius={[0, 4, 4, 0]}>
                {stats.map((s, i) => (
                  <Cell
                    key={i}
                    fill={s.avgPnl == null ? '#6b7280' : s.avgPnl >= 0 ? '#ef4444' : '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 심리 유형별 승률 */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">심리 유형별 승률 · 거래수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.map((s) => (
              <div key={s.psychology} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-24 shrink-0 truncate">{s.psychology}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${s.winRate ?? 0}%`,
                      backgroundColor: s.winRate == null ? '#6b7280' : s.winRate >= 50 ? '#ef4444' : '#3b82f6',
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right shrink-0">
                  {s.winRate != null ? `${s.winRate}%` : '-'}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">{s.count}건</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 패턴 카드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 반복 실수 경고 */}
        <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              반복 실수 패턴
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mistakes.length === 0 ? (
              <p className="text-sm text-gray-400">3회 이상 반복된 손실 패턴이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {mistakes.map((m) => (
                  <li key={m.psychology} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{m.psychology}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{m.lossCount}회 손실</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 잘된 결정 강화 */}
        <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-500" />
              잘된 결정 강화
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestPatterns.length === 0 ? (
              <p className="text-sm text-gray-400">수익 거래 데이터가 충분하지 않습니다.</p>
            ) : (
              <ul className="space-y-2">
                {bestPatterns.map((p) => (
                  <li key={p.psychology} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{p.psychology}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">상위 {p.count}건</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 요일별 평균 손익 */}
      {dowStats.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">요일별 평균 손익</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowStats} margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  tickFormatter={(v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(0)}만` : `${(v / 1000).toFixed(0)}천`}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  formatter={(v) => [formatPnl(v), '평균손익']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="avgPnl" radius={[4, 4, 0, 0]}>
                  {dowStats.map((s, i) => (
                    <Cell key={i} fill={s.avgPnl >= 0 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 보유기간 분포 */}
      {holdingDist.some((b) => b.count > 0) && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">보유기간 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={holdingDist} margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(v) => [`${v}건`, '거래수']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 업종별 평균 손익 */}
      {sectorStats.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">업종별 평균 손익</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(160, sectorStats.length * 36)}>
              <BarChart
                data={sectorStats}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(0)}만` : `${(v / 1000).toFixed(0)}천`}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  type="category"
                  dataKey="sector"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  width={70}
                />
                <Tooltip
                  formatter={(v) => [formatPnl(v), '평균손익']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="avgPnl" radius={[0, 4, 4, 0]}>
                  {sectorStats.map((s, i) => (
                    <Cell key={i} fill={s.avgPnl >= 0 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
