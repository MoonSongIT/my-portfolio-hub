// 반복 손실 패턴 경고 배너 — lossCount 3회 이상 심리 유형 표시
import { useState, useMemo } from 'react'
import { useJournalStore, selectPatternAlerts } from '../../store/journalStore'
import { formatCurrencyShort } from '../../utils/formatters'

export default function PatternWarning() {
  const entries = useJournalStore(s => s.entries)
  const alerts = useMemo(() => selectPatternAlerts({ entries }), [entries])
  const [dismissed, setDismissed] = useState(new Set())

  const visible = alerts.filter(a => !dismissed.has(a.psychology))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(alert => (
        <AlertBanner
          key={alert.psychology}
          alert={alert}
          onDismiss={() => setDismissed(prev => new Set([...prev, alert.psychology]))}
        />
      ))}
    </div>
  )
}

function AlertBanner({ alert, onDismiss }) {
  const isDanger = alert.level === 'danger'

  const containerClass = isDanger
    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'

  const dismissClass = isDanger
    ? 'text-red-500 dark:text-red-400 hover:text-red-800 dark:hover:text-red-100'
    : 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-100'

  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${containerClass}`}>
      <div className="flex items-start gap-2 min-w-0">
        <span className="shrink-0 mt-0.5">{isDanger ? '🔴' : '🟡'}</span>
        <div className="min-w-0">
          <span className="font-semibold">{alert.psychology}</span>
          <span className="ml-1">
            최근 {alert.totalCount}회 중 {alert.lossCount}회 손실 ({alert.lossRate}%)
            {alert.avgLoss < 0 && (
              <span className="ml-1">| 평균 손실 {formatCurrencyShort(Math.abs(alert.avgLoss))}</span>
            )}
          </span>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="경고 닫기"
        className={`shrink-0 ${dismissClass}`}
      >
        ✕
      </button>
    </div>
  )
}
