import { useState, useMemo, useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { toast } from 'sonner'
import { usePortfolioStore } from '../store/portfolioStore'
import { useJournalStore } from '../store/journalStore'
import { useAuthStore } from '../store/authStore'
import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { fetchBenchmarkHistory } from '../api/stockApi'
import { sendToAgent } from '../api/claudeApi'
import {
  calculatePortfolioReturn, calculateTotalPnL,
  filterByDateRange, calculateWinRate,
} from '../utils/calculator'
import { formatPercent, formatShortDate, formatCurrencyShort } from '../utils/formatters'
import { exportAsPNG, exportAsPDF } from '../utils/exportReport'
import { saveScheduledReport, shouldGenerateWeeklyReport } from '../agents/reportAgent'
import { getLatestReportByType } from '../utils/db'
import AccountSelector from '../components/common/AccountSelector'
import TradeHistoryTable from '../components/reports/TradeHistoryTable'
import InsightsCard from '../components/reports/InsightsCard'
import PerformanceRanking from '../components/reports/PerformanceRanking'
import RealizedVsUnrealized from '../components/reports/RealizedVsUnrealized'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import {
  TrendingUp, TrendingDown, BarChart2, Target, Loader2,
  Download, ChevronDown, CalendarCheck, CheckCircle2, AlertCircle,
} from 'lucide-react'

const DATE_RANGES = [
  { key: '1d', label: '오늘' },
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '1y', label: '1년' },
]

const toApiRange = (dr) => {
  switch (dr) {
    case '1d': return '5d'
    case '1w': return '1w'
    case '1m': return '1mo'
    case '1y': return '1y'
    default:   return '1mo'
  }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{data.date}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: {p.value > 0 ? '+' : ''}{p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

function KPICard({ icon: Icon, label, value, sub, color = 'text-gray-900 dark:text-gray-100' }) {
  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function ExportMenu({ onPNG, onPDF }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        내보내기
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            onClick={() => { onPNG(); setOpen(false) }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            PNG 저장
          </button>
          <button
            onClick={() => { onPDF(); setOpen(false) }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            PDF 저장
          </button>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const { accounts, selectedAccountId, getSelectedHoldings } = usePortfolioStore()
  const { entries } = useJournalStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [dateRange, setDateRange] = useState('1m')
  const [benchmark, setBenchmark] = useState({ KOSPI: [], SP500: [] })
  const [benchLoading, setBenchLoading] = useState(false)
  const [weeklyStatus, setWeeklyStatus] = useState('idle') // 'idle' | 'loading' | 'saved' | 'exists' | 'error'
  const reportRef = useRef(null)

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])
  const totalReturn = useMemo(() => calculatePortfolioReturn(holdings, EXCHANGE_RATE), [holdings])
  const totalPnL = useMemo(() => calculateTotalPnL(holdings, EXCHANGE_RATE), [holdings])

  const filteredEntries = useMemo(() => filterByDateRange(entries, dateRange), [entries, dateRange])
  const winRate = useMemo(() => calculateWinRate(filteredEntries), [filteredEntries])

  useEffect(() => {
    let cancelled = false
    setBenchLoading(true)
    fetchBenchmarkHistory(toApiRange(dateRange))
      .then(data => { if (!cancelled) setBenchmark(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBenchLoading(false) })
    return () => { cancelled = true }
  }, [dateRange])

  const comparisonData = useMemo(() => {
    const kospi = benchmark.KOSPI || []
    const sp500 = benchmark.SP500 || []
    if (kospi.length === 0 && sp500.length === 0) return []

    const baseData = kospi.length > 0 ? kospi : sp500
    const baseKospi = kospi[0]?.close || 1
    const baseSP500 = sp500[0]?.close || 1

    const sp500Map = {}
    sp500.forEach(d => { sp500Map[d.date] = d.close })

    const portfolioReturn = totalReturn

    return baseData.map((item, i) => {
      const kospiVal = kospi[i]?.close
      const sp500Val = sp500Map[item.date] ?? null
      return {
        date: item.date,
        '내 포트폴리오': portfolioReturn,
        KOSPI: kospiVal != null ? ((kospiVal - baseKospi) / baseKospi) * 100 : null,
        'S&P500': sp500Val != null ? ((sp500Val - baseSP500) / baseSP500) * 100 : null,
      }
    })
  }, [benchmark, totalReturn])

  const benchmarkDiff = useMemo(() => {
    if (!comparisonData.length) return null
    const last = comparisonData[comparisonData.length - 1]
    if (last['KOSPI'] == null) return null
    return (last['내 포트폴리오'] - last['KOSPI']).toFixed(2)
  }, [comparisonData])

  const handleSaveWeeklyReport = async () => {
    const userId = currentUser?.id
    if (!userId) {
      toast.error('로그인이 필요합니다.')
      return
    }

    // 이번 주에 이미 저장된 리포트가 있는지 확인
    const latest = await getLatestReportByType('weekly', userId)
    if (latest && !shouldGenerateWeeklyReport(latest.generatedAt)) {
      setWeeklyStatus('exists')
      toast.info('이번 주 리포트가 이미 저장되어 있습니다.', { description: latest.title })
      return
    }

    setWeeklyStatus('loading')
    const result = await sendToAgent(
      '이번 주 투자 성과 주간 리포트를 생성해줘.',
      { holdings, period: 'weekly', journalEntries: filteredEntries, totalReturn, totalPnL, winRate,
        benchmarkDiff: benchmarkDiff ? parseFloat(benchmarkDiff) : null },
      'report'
    )

    const isError = !result.text || result.text.startsWith('오류') || result.text.startsWith('네트워크') || result.text.startsWith('응답')
    if (isError) {
      setWeeklyStatus('error')
      toast.error('리포트 생성 실패', { description: result.text })
      return
    }

    try {
      await saveScheduledReport('weekly', result.text, userId)
      setWeeklyStatus('saved')
      toast.success('주간 리포트가 저장되었습니다.')
    } catch {
      setWeeklyStatus('error')
      toast.error('IndexedDB 저장 실패')
    }
  }

  const handleExportPNG = async () => {
    if (!reportRef.current) return
    try {
      await exportAsPNG(reportRef.current, 'portfolio-report')
    } catch (e) {
      console.error('[Export PNG]', e)
      alert(`PNG 저장 실패: ${e.message}`)
    }
  }
  const handleExportPDF = async () => {
    if (!reportRef.current) return
    try {
      await exportAsPDF(reportRef.current, 'portfolio-report')
    } catch (e) {
      console.error('[Export PDF]', e)
      alert(`PDF 저장 실패: ${e.message}`)
    }
  }

  // ReportAgent에 전달할 강화된 컨텍스트
  const reportContext = useMemo(() => ({
    holdings,
    period: dateRange,
    journalEntries: filteredEntries,
    totalReturn,
    totalPnL,
    winRate,
    benchmarkDiff: benchmarkDiff ? parseFloat(benchmarkDiff) : null,
  }), [holdings, dateRange, filteredEntries, totalReturn, totalPnL, winRate, benchmarkDiff])

  return (
    <div className="p-6 space-y-6" ref={reportRef}>
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">리포트</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">투자 성과를 분석하고 AI 인사이트를 받아보세요.</p>
          </div>
          <ExportMenu onPNG={handleExportPNG} onPDF={handleExportPDF} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AccountSelector />
          <div className="flex gap-1">
            {DATE_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  dateRange === r.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={TrendingUp}
          label="총 수익률"
          value={formatPercent(totalReturn)}
          sub={`손익 ${formatCurrencyShort(totalPnL)}`}
          color={totalReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
        />
        <KPICard
          icon={BarChart2}
          label="KOSPI 대비"
          value={benchmarkDiff != null ? `${benchmarkDiff > 0 ? '+' : ''}${benchmarkDiff}%` : '-'}
          sub="벤치마크 초과 수익률"
          color={
            benchmarkDiff != null && Number(benchmarkDiff) >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : benchmarkDiff != null
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-900 dark:text-gray-100'
          }
        />
        <KPICard
          icon={Target}
          label="거래 횟수"
          value={`${filteredEntries.length}건`}
          sub={`매수 ${filteredEntries.filter(e => e.action === 'buy').length} / 매도 ${filteredEntries.filter(e => e.action === 'sell').length}`}
        />
        <KPICard
          icon={TrendingDown}
          label="승률"
          value={winRate != null ? `${winRate}%` : '-'}
          sub={winRate == null ? '손익 기록 없음' : winRate >= 50 ? '양호' : '개선 필요'}
          color={winRate == null ? 'text-gray-900 dark:text-gray-100' : winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
        />
      </div>

      {/* 탭 */}
      <Tabs defaultValue="performance" className="!flex !flex-col">
        <TabsList className="mb-4 !flex !flex-row !h-auto gap-1 bg-gray-800/50 rounded-lg p-1 w-fit flex-wrap">
          <TabsTrigger value="performance" className="!h-auto px-4 py-2 rounded-md text-sm font-medium text-gray-400 data-[active]:bg-blue-600 data-[active]:text-white hover:text-gray-200 transition-colors">성과 추이</TabsTrigger>
          <TabsTrigger value="ranking" className="!h-auto px-4 py-2 rounded-md text-sm font-medium text-gray-400 data-[active]:bg-blue-600 data-[active]:text-white hover:text-gray-200 transition-colors">TOP/BOTTOM</TabsTrigger>
          <TabsTrigger value="pnl" className="!h-auto px-4 py-2 rounded-md text-sm font-medium text-gray-400 data-[active]:bg-blue-600 data-[active]:text-white hover:text-gray-200 transition-colors">실현/미실현</TabsTrigger>
          <TabsTrigger value="trades" className="!h-auto px-4 py-2 rounded-md text-sm font-medium text-gray-400 data-[active]:bg-blue-600 data-[active]:text-white hover:text-gray-200 transition-colors">거래 내역</TabsTrigger>
          <TabsTrigger value="insights" className="!h-auto px-4 py-2 rounded-md text-sm font-medium text-gray-400 data-[active]:bg-blue-600 data-[active]:text-white hover:text-gray-200 transition-colors">AI 인사이트</TabsTrigger>
        </TabsList>

        {/* 성과 추이 탭 */}
        <TabsContent value="performance">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                벤치마크 비교 (수익률 %)
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {DATE_RANGES.find(r => r.key === dateRange)?.label} 기준
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {benchLoading ? (
                <div className="flex items-center justify-center h-[350px] text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span className="text-sm">벤치마크 데이터 로딩 중...</span>
                </div>
              ) : comparisonData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-gray-400">
                  <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">벤치마크 데이터를 가져올 수 없습니다.</p>
                  <p className="text-xs mt-1">네트워크 연결을 확인해 주세요.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis
                      tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="내 포트폴리오" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="KOSPI" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 4" connectNulls />
                    <Line type="monotone" dataKey="S&P500" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 4" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP/BOTTOM 성과 순위 탭 */}
        <TabsContent value="ranking">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">종목별 성과 순위</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceRanking entries={filteredEntries} holdings={holdings} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 실현/미실현 손익 탭 */}
        <TabsContent value="pnl">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">실현 손익 vs 미실현 손익</CardTitle>
            </CardHeader>
            <CardContent>
              <RealizedVsUnrealized entries={entries} holdings={holdings} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 거래 내역 탭 */}
        <TabsContent value="trades">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                거래 내역
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {DATE_RANGES.find(r => r.key === dateRange)?.label} 기준
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TradeHistoryTable entries={filteredEntries} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 인사이트 탭 */}
        <TabsContent value="insights">
          <div className="space-y-4">
            {/* 주간 리포트 저장 카드 */}
            <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                      <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">주간 리포트 저장</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {weeklyStatus === 'saved' && '이번 주 리포트가 저장되었습니다.'}
                        {weeklyStatus === 'exists' && '이번 주 리포트가 이미 존재합니다.'}
                        {weeklyStatus === 'error' && '생성 중 오류가 발생했습니다. 다시 시도해주세요.'}
                        {(weeklyStatus === 'idle' || weeklyStatus === 'loading') && 'AI가 이번 주 성과를 분석해 IndexedDB에 저장합니다.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {weeklyStatus === 'saved' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {weeklyStatus === 'exists' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                    {weeklyStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    <button
                      onClick={handleSaveWeeklyReport}
                      disabled={weeklyStatus === 'loading'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {weeklyStatus === 'loading'
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 생성 중...</>
                        : <><CalendarCheck className="w-3.5 h-3.5" /> 주간 리포트 저장</>
                      }
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI 인사이트 카드 */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">AI 인사이트</CardTitle>
              </CardHeader>
              <CardContent>
                <InsightsCard
                  entries={filteredEntries}
                  dateRange={dateRange}
                  holdings={holdings}
                  reportContext={reportContext}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
