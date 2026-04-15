import { useState } from 'react'
import { Bot, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { sendToAgent } from '../../api/claudeApi'

// 마크다운 굵게/줄바꿈 간단 렌더링
function SimpleMarkdown({ text }) {
  if (!text) return null
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />
        // **굵게** 처리
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function InsightsCard({ entries = [], dateRange = '1m', holdings = [], reportContext = null }) {
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState(null)
  const [error, setError] = useState(null)

  const periodLabel = dateRange === '1d' ? '오늘' : dateRange === '1w' ? '이번 주' : dateRange === '1m' ? '이번 달' : '올해'

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setInsight(null)

    const context = reportContext ?? { holdings, period: dateRange, journalEntries: entries }

    const result = await sendToAgent(
      `${periodLabel} 투자 성과 리포트를 생성해줘. 주요 지표: 수익률 ${context.totalReturn?.toFixed(2) ?? '-'}%, KOSPI 대비 ${context.benchmarkDiff ?? '-'}%p, 거래 ${entries.length}건, 승률 ${context.winRate ?? '-'}%`,
      context,
      'report'
    )

    if (result.text && !result.text.startsWith('오류') && !result.text.startsWith('네트워크')) {
      setInsight(result.text)
    } else {
      setError(result.text)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* 생성 버튼 영역 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">AI 투자 인사이트</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            매매 일지 데이터를 기반으로 AI가 성과를 분석합니다
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="gap-2"
          size="sm"
        >
          {loading
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Bot className="w-4 h-4" />
          }
          {loading ? '분석 중...' : 'AI 인사이트 생성'}
        </Button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* 결과 */}
      {insight && (
        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">ReportAgent 분석 결과</span>
          </div>
          <SimpleMarkdown text={insight} />
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 border-t border-blue-100 dark:border-blue-800 pt-3">
            이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
          </p>
        </div>
      )}

      {/* 초기 안내 */}
      {!insight && !error && !loading && (
        <div className="py-12 text-center text-gray-400 dark:text-gray-500">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">버튼을 클릭하면 AI가 투자 패턴을 분석합니다</p>
          {entries.length === 0 && (
            <p className="text-xs mt-1">매매 일지 데이터가 있으면 더 정확한 분석이 가능합니다</p>
          )}
        </div>
      )}
    </div>
  )
}
