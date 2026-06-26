// 시장 브리핑 카드 — AI가 지수·미국 선행지표·변동성 레짐으로 오늘의 시장 국면을 분석
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import useAiCredentialStore from '@/store/aiCredentialStore'
import { callClaudeWithRetry, getLeadingIndicators, getVixRegime } from '@/api/claudeApi'
import { computeOvernightBias } from '@/api/regimeApi'
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

const REGIME_KO = { low: '저변동', normal: '정상', high: '고변동', crisis: '위기' }

// 방향 라벨 색 — 한국 컨벤션(상승=빨강, 하락=파랑), 중립=회색
function dirBadgeClass(label) {
  if (label === '강한상승' || label === '강세') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (label === '약세' || label === '강한하락') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

// 변동성 레짐 색 — 위험도(저변동/정상=중립, 고변동=주황, 위기=빨강 경고)
function regimeBadgeClass(regime) {
  if (regime === 'high') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (regime === 'crisis') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

export default function MarketBriefCard() {
  const { hasKey } = useAiCredentialStore()
  const [result, setResult] = useState(null)
  const [bias, setBias] = useState(null)
  const [leading, setLeading] = useState([])
  const [regime, setRegime] = useState(null)
  const [loading, setLoading] = useState(false)

  const runBrief = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const obj = JSON.parse(cached)
          setResult(obj.text)
          setBias(obj.bias ?? null)
          setLeading(obj.leading ?? [])
          setRegime(obj.regime ?? null)
          return
        } catch {
          // 구버전 plain-text 캐시 → 무시하고 재조회
        }
      }
    }

    setLoading(true)
    try {
      const [quoteResults, leadingData, vixRegime, news] = await Promise.all([
        Promise.all(
          BRIEF_INDICES.map(idx =>
            fetchQuote(idx.ticker, idx.market)
              .then(q => ({
                label: idx.label,
                ticker: idx.ticker,
                price: q?.price ?? q?.currentPrice ?? q?.regularMarketPrice ?? 0,
                changePercent: q?.changePercent ?? q?.regularMarketChangePercent ?? 0,
              }))
              .catch(() => ({ label: idx.label, ticker: idx.ticker, price: 0, changePercent: 0 }))
          )
        ),
        getLeadingIndicators().catch(() => ({ indicators: [], snapshot: {} })),
        getVixRegime().catch(() => null),
        fetchNews('^GSPC', 'NYSE').catch(() => []),
      ])

      // 지수 등락(S&P500·NASDAQ)도 bias에 반영
      const idxMap = Object.fromEntries(quoteResults.map(i => [i.label, i.changePercent]))
      const biasResult = computeOvernightBias({
        ...leadingData.snapshot,
        sp500: idxMap['S&P500'],
        nasdaq: idxMap['NASDAQ'],
      })

      const context = buildMarketBriefContext({
        indices: quoteResults,
        leading: leadingData.indicators,
        bias: biasResult,
        regime: vixRegime,
        news,
      })
      const response = await callClaudeWithRetry({
        systemPrompt: MARKET_BRIEF_PROMPT,
        messages: [{ role: 'user', content: context }],
        maxTokens: 2048,
      })
      const text = response.data?.content?.[0]?.text ?? ''

      const payload = { text, bias: biasResult, leading: leadingData.indicators, regime: vixRegime }
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
      setResult(text)
      setBias(biasResult)
      setLeading(leadingData.indicators)
      setRegime(vixRegime)
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

  const availableLeading = leading.filter(l => l.available)

  return (
    <Card className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            AI 시장 국면 — {today}
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

        {/* 국면 배지: 방향 가설 × 변동성 레짐 */}
        {!loading && bias && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${dirBadgeClass(bias.label)}`}>
              방향 {bias.label} ({bias.score >= 0 ? '+' : ''}{bias.score})
            </span>
            {regime && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${regimeBadgeClass(regime.regime)}`}>
                변동성 {REGIME_KO[regime.regime] ?? regime.regime}
                {regime.percentile != null ? ` (${regime.percentile.toFixed(0)}%ile)` : ''}
              </span>
            )}
          </div>
        )}

        {/* 선행지표 미니 라인 */}
        {!loading && availableLeading.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-xs border-b border-indigo-100 dark:border-indigo-900 pb-2">
            {availableLeading.map(l => (
              <span key={l.key} className="text-gray-600 dark:text-gray-400">
                {l.label}{' '}
                <span className="tabular-nums text-gray-800 dark:text-gray-200">
                  {l.price != null ? l.price.toLocaleString() : '-'}
                </span>{' '}
                <span className={l.changePercent >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}>
                  ({l.changePercent >= 0 ? '+' : ''}{l.changePercent?.toFixed(2)}%)
                </span>
              </span>
            ))}
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
