// 시장 브리핑 카드 — AI가 주요 지수·뉴스를 바탕으로 오늘의 시장 흐름을 요약
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import useAiCredentialStore from '@/store/aiCredentialStore'
import claudeApi from '@/api/claudeApi'
import { fetchQuote } from '@/api/stockApi'
import { fetchNews } from '@/api/newsApi'
import { MARKET_BRIEF_PROMPT, buildMarketBriefContext } from '@/agents/analysisAgent'

const BRIEF_INDICES = [
  { label: 'KOSPI', ticker: '^KS11', market: 'NYSE' },
  { label: 'KOSDAQ', ticker: '^KQ11', market: 'NYSE' },
  { label: 'NASDAQ', ticker: '^IXIC', market: 'NASDAQ' },
  { label: 'S&P500', ticker: '^GSPC', market: 'NYSE' },
]

const today = new Date().toISOString().slice(0, 10)
const CACHE_KEY = `market_brief_${today}`

export default function MarketBriefCard() {
  const { hasKey } = useAiCredentialStore()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runBrief = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        setResult(cached)
        return
      }
    }

    setLoading(true)
    try {
      const [quoteResults, news] = await Promise.all([
        Promise.all(
          BRIEF_INDICES.map(idx =>
            fetchQuote(idx.ticker, idx.market)
              .then(q => ({
                label: idx.label,
                ticker: idx.ticker,
                price: q?.price ?? q?.regularMarketPrice ?? 0,
                changePercent: q?.changePercent ?? q?.regularMarketChangePercent ?? 0,
              }))
              .catch(() => ({ label: idx.label, ticker: idx.ticker, price: 0, changePercent: 0 }))
          )
        ),
        fetchNews('^GSPC', 'NYSE').catch(() => []),
      ])

      const context = buildMarketBriefContext({ indices: quoteResults, news })
      const response = await claudeApi.post('/claude', {
        systemPrompt: MARKET_BRIEF_PROMPT,
        messages: [{ role: 'user', content: context }],
        maxTokens: 1024,
      })
      const text = response.data?.content?.[0]?.text ?? ''
      sessionStorage.setItem(CACHE_KEY, text)
      setResult(text)
    } catch {
      // API 키 미설정 등 오류 시 카드 자체를 숨김
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasKey) runBrief()
  }, [hasKey, runBrief])

  if (!hasKey) return null

  const handleRefresh = () => {
    sessionStorage.removeItem(CACHE_KEY)
    runBrief({ forceRefresh: true })
  }

  return (
    <Card className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            AI 시장 브리핑 — {today}
          </CardTitle>
          {result && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-7 px-2 text-xs text-gray-500"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              갱신
            </Button>
          )}
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

        {result && !loading && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        )}

        {result && (
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
            ⚠️ 이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
