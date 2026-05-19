// 종목 급등락 원인 분석 카드 — AI가 뉴스·공시를 바탕으로 오늘의 주가 움직임을 해석
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefreshCw, Search, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ApiKeyRequiredDialog from '@/components/common/ApiKeyRequiredDialog'
import useAiCredentialStore from '@/store/aiCredentialStore'
import claudeApi from '@/api/claudeApi'
import { fetchNews } from '@/api/newsApi'
import { fetchDisclosures } from '@/api/disclosureApi'
import { ANALYSIS_PROMPT, buildMovementContext } from '@/agents/analysisAgent'

const today = new Date().toISOString().slice(0, 10)

function getCacheKey(ticker) {
  return `movement_${ticker}_${today}`
}

export default function MovementExplainerCard({ ticker, name, changePercent, market }) {
  const { hasKey } = useAiCredentialStore()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showKeyDialog, setShowKeyDialog] = useState(false)

  const runAnalysis = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!hasKey) {
      setShowKeyDialog(true)
      return
    }

    const cacheKey = getCacheKey(ticker)
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        setResult(cached)
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      const [news, disclosures] = await Promise.all([
        fetchNews(ticker, market).catch(() => []),
        fetchDisclosures(ticker, market).catch(() => []),
      ])

      const context = buildMovementContext({ ticker, name, changePercent, market, news, disclosures })
      const response = await claudeApi.post('/claude', {
        systemPrompt: ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: context }],
        maxTokens: 1024,
      })
      const text = response.data?.content?.[0]?.text ?? ''
      sessionStorage.setItem(cacheKey, text)
      setResult(text)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || '분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [ticker, name, changePercent, market, hasKey])

  useEffect(() => {
    if (Math.abs(changePercent) >= 3) {
      runAnalysis()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    sessionStorage.removeItem(getCacheKey(ticker))
    runAnalysis({ forceRefresh: true })
  }

  const absChange = Math.abs(changePercent ?? 0)
  const changeLabel = changePercent >= 0 ? `+${changePercent?.toFixed(2)}%` : `${changePercent?.toFixed(2)}%`
  const changeColor = changePercent >= 0 ? 'text-red-500' : 'text-blue-500'

  return (
    <>
      <ApiKeyRequiredDialog open={showKeyDialog} onClose={() => setShowKeyDialog(false)} />

      <Card className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500" />
              오늘의 이유 분석
              {absChange >= 3 && (
                <span className={`text-sm font-bold ${changeColor}`}>{changeLabel}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {result && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-7 px-2 text-xs text-gray-500"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </Button>
              )}
              {!result && !loading && (
                <Button
                  size="sm"
                  onClick={() => runAnalysis()}
                  disabled={loading}
                  className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  분석하기
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/5" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>{error}</p>
                <button
                  onClick={() => runAnalysis()}
                  className="mt-1 underline text-xs"
                >
                  재시도
                </button>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          )}

          {!result && !loading && !error && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {absChange >= 3
                ? 'AI가 오늘의 급등락 원인을 분석하고 있습니다...'
                : '버튼을 눌러 오늘의 주가 움직임 원인을 분석해보세요.'}
            </p>
          )}

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
            ⚠️ 이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
