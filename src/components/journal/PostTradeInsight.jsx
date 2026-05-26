// 거래 직후 AI 심리 코칭 피드백 카드
import { useState, useEffect, useMemo } from 'react'
import { generatePostTradeCoaching } from '../../api/claudeApi'
import useAiCredentialStore from '../../store/aiCredentialStore'
import { useJournalStore } from '../../store/journalStore'
import { getPsychologyHistory } from '../../utils/calculator'
import { Sparkles, Loader2 } from 'lucide-react'
import { formatCurrencyShort } from '../../utils/formatters'

export default function PostTradeInsight({ entry }) {
  const [coaching, setCoaching] = useState('')
  const [loading, setLoading] = useState(false)
  const { apiKey } = useAiCredentialStore()
  const entries = useJournalStore(s => s.entries)

  const history = useMemo(
    () => entry ? getPsychologyHistory(entries, entry.psychology, entry.action) : null,
    [entries, entry]
  )

  useEffect(() => {
    if (!apiKey || !entry || !history || history.count < 2) return
    setCoaching('')
    setLoading(true)
    generatePostTradeCoaching(entry, history)
      .then(result => setCoaching(result))
      .catch(() => setCoaching(''))
      .finally(() => setLoading(false))
  }, [entry])

  if (!entry || !history) return null

  const isFirstTrade = history.count < 2
  const lossRateColor = history.lossRate >= 60
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-red-500 dark:text-red-400'

  return (
    <div className="w-full rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/10 p-3 space-y-2">
      {/* 이력 통계 */}
      {isFirstTrade ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-violet-600 dark:text-violet-400">{entry.psychology}</span>
          &nbsp;첫 기록입니다. 데이터가 쌓이면 패턴 분석이 시작됩니다.
        </p>
      ) : (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-gray-200">{entry.psychology}</span>
          &nbsp;— 최근 {history.count}회 중&nbsp;
          <span className={`font-semibold ${lossRateColor}`}>{history.lossCount}회 손실 ({history.lossRate}%)</span>
          {history.avgPnl !== 0 && (
            <span className="ml-1 text-gray-500">| 평균 {formatCurrencyShort(history.avgPnl)}</span>
          )}
        </p>
      )}

      {/* AI 코칭 (API키 있을 때만) */}
      {apiKey && !isFirstTrade && (
        <div className="flex items-start gap-1.5 pt-1 border-t border-violet-200 dark:border-violet-800/30">
          <Sparkles size={12} className="text-violet-500 mt-0.5 shrink-0" />
          {loading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-violet-400" />
              <span className="text-xs text-gray-400 animate-pulse">AI 코칭 중...</span>
            </div>
          ) : coaching ? (
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{coaching}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
