// 거래 직후 AI 심리 코칭 피드백 카드
import { useState, useEffect } from 'react'
import { generatePostTradeCoaching } from '../../api/claudeApi'
import useAiCredentialStore from '../../store/aiCredentialStore'
import { useJournalStore } from '../../store/journalStore'
import { getPsychologyHistory } from '../../utils/calculator'
import { Sparkles, Loader2 } from 'lucide-react'

export default function PostTradeInsight({ entry }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const { apiKey } = useAiCredentialStore()
  const entries = useJournalStore(s => s.entries)

  useEffect(() => {
    if (!apiKey || !entry) return

    const history = getPsychologyHistory(entries, entry.psychology, entry.action)
    setLoading(true)
    generatePostTradeCoaching(entry, history)
      .then(result => setText(result))
      .catch(() => setText(''))
      .finally(() => setLoading(false))
  }, [entry])

  if (!apiKey) return null

  return (
    <div className="w-full rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/10 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={13} className="text-violet-500" />
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">AI 심리 피드백</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-violet-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">분석 중...</span>
        </div>
      ) : text ? (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{text}</p>
      ) : null}
    </div>
  )
}
