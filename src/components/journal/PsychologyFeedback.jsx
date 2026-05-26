// 매매 심리 선택 피드백 — 사용 빈도, 승률, 평균 손익 표시
import { useMemo } from 'react'
import { useJournalStore } from '../../store/journalStore'

function formatPnl(pnl) {
  if (pnl === null || pnl === undefined) return null
  const abs = Math.abs(pnl).toLocaleString('ko-KR')
  return pnl >= 0 ? `+${abs}` : `-${abs}`
}

export default function PsychologyFeedback({ psychology, action }) {
  const entries = useJournalStore(s => s.entries)
  const recentSelections = useJournalStore(s => s.psychologyFeedback.recentSelections)

  const stats = useMemo(() => {
    if (!psychology) return null
    const filtered = entries.filter(e => e.psychology === psychology && e.action === action)
    if (filtered.length === 0) return null
    const pnlEntries = filtered.filter(e => e.pnl !== null && e.pnl !== undefined)
    const winCount = pnlEntries.filter(e => e.pnl > 0).length
    const totalPnl = pnlEntries.reduce((sum, e) => sum + e.pnl, 0)
    return {
      count: filtered.length,
      winRate: pnlEntries.length > 0 ? Math.round((winCount / pnlEntries.length) * 100) : null,
      avgPnl: pnlEntries.length > 0 ? Math.round(totalPnl / pnlEntries.length) : null,
    }
  }, [psychology, action, entries])

  const recent = useMemo(() => {
    return recentSelections.filter(s => s.action === action).slice(0, 3)
  }, [recentSelections, action])

  if (!psychology || (!stats && recent.length === 0)) return null

  const winRateColor = stats?.winRate != null
    ? (stats.winRate >= 50 ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400')
    : 'text-gray-400'

  const avgPnlColor = stats?.avgPnl != null
    ? (stats.avgPnl >= 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-500 dark:text-blue-400')
    : 'text-gray-400'

  return (
    <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-xs space-y-2">
      {stats && (
        <div className="flex items-center gap-4">
          <span className="text-gray-500 dark:text-gray-400 font-medium">
            {action === 'buy' ? '매수' : '매도'} {stats.count}회
          </span>
          {stats.winRate !== null && (
            <span className={`font-semibold ${winRateColor}`}>
              승률 {stats.winRate}%
            </span>
          )}
          {stats.avgPnl !== null && (
            <span className={`font-semibold ${avgPnlColor}`}>
              평균 {formatPnl(stats.avgPnl)}원
            </span>
          )}
          {stats.winRate === null && (
            <span className="text-gray-400">손익 데이터 없음</span>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-400 dark:text-gray-500">최근 선택</span>
          {recent.map((s, i) => (
            <span
              key={s.timestamp}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                i === 0
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {s.category}
            </span>
          ))}
        </div>
      )}

      {!stats && recent.length === 0 && (
        <p className="text-gray-400">첫 선택입니다.</p>
      )}
    </div>
  )
}
