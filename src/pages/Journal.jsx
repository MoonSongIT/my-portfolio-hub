import { useState, useEffect, useMemo } from 'react'
import { useJournalStore } from '../store/journalStore'
import { useUserAccounts } from '../store/accountStore'
import { usePortfolioStore } from '../store/portfolioStore'
import { filterByDateRange } from '../utils/calculator'
import { exportJournalCsv } from '../utils/dataExport'
import AccountSelector from '../components/account/AccountSelector'
import AccountSetupModal from '../components/account/AccountSetupModal'
import JournalEntryForm from '../components/journal/JournalEntryForm'
import JournalBatchForm from '../components/journal/JournalBatchForm'
import JournalList from '../components/journal/JournalList'
import HtsImportModal from '../components/journal/HtsImportModal'
import PsychologyProfitChart from '../components/charts/PsychologyProfitChart'
import ChatPanel from '../components/chat/ChatPanel'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { formatCurrencyShort } from '../utils/formatters'

export default function Journal() {
  const [entryFormOpen, setEntryFormOpen] = useState(false)
  const [batchFormOpen, setBatchFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [htsImportOpen, setHtsImportOpen] = useState(false)
  const [dateRange, setDateRange] = useState('all')
  const selectedAccountId    = usePortfolioStore(s => s.selectedAccountId)
  const setSelectedAccountId = usePortfolioStore(s => s.selectAccount)

  const entries = useJournalStore((s) => s.entries)
  const getProfitByPsychology = useJournalStore((s) => s.getProfitByPsychology)
  const getSummaryStats = useJournalStore((s) => s.getSummaryStats)
  const recalculateSellPnl = useJournalStore((s) => s.recalculateSellPnl)
  const accounts = useUserAccounts()
  const exchangeRate = usePortfolioStore(s => s.exchangeRate)

  // 마운트 시 기존 매도 항목 pnl 소급 계산
  useEffect(() => {
    recalculateSellPnl()
  }, [])

  // 날짜 범위 필터 적용 (기본값 'all' = 전체)
  const filteredEntries = useMemo(
    () => dateRange === 'all' ? entries : filterByDateRange(entries, dateRange),
    [entries, dateRange]
  )

  // 선택 계좌 필터 ('all' = 전체 집계)
  const accountFilter = selectedAccountId === 'all' ? undefined : selectedAccountId
  const chartData = getProfitByPsychology(accountFilter, exchangeRate, filteredEntries)
  const stats = getSummaryStats(accountFilter, filteredEntries)

  // 최근 7일 심리 패턴 경고 (추격매매 / 공포에 매도 3회 이상)
  const patternWarnings = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 6)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const recent = entries.filter(e => e.date >= cutoffStr)
    const count추격 = recent.filter(e => e.psychology === '추격매매').length
    const count공포 = recent.filter(e => e.psychology === '공포에 매도').length
    const warns = []
    if (count추격 >= 3) warns.push({ key: '추격매매', count: count추격 })
    if (count공포 >= 3) warns.push({ key: '공포에 매도', count: count공포 })
    return warns
  }, [entries])
  const [dismissedWarnings, setDismissedWarnings] = useState([])
  const visibleWarnings = patternWarnings.filter(w => !dismissedWarnings.includes(w.key))

  // 월별 거래 건수 + 실현손익 집계 (최근 6개월)
  const monthlyStats = useMemo(() => {
    const map = {}
    const filtered = accountFilter
      ? filteredEntries.filter(e => e.accountId === accountFilter)
      : filteredEntries
    filtered.forEach(e => {
      const month = e.date?.slice(0, 7)
      if (!month) return
      if (!map[month]) map[month] = { month, 거래건수: 0, 실현손익: 0 }
      map[month].거래건수 += 1
      if (e.pnl != null) map[month].실현손익 += e.pnl
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6)
  }, [filteredEntries, accountFilter])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">투자 매매 일지</h1>
          <p className="text-sm text-gray-500 mt-1">매매 심리를 기록하고 패턴을 발견하세요</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEntryFormOpen(true)}>
            + 빠른 입력
          </Button>
          <Button variant="outline" onClick={() => setBatchFormOpen(true)}>
            일괄 입력
          </Button>
          <Button variant="outline" onClick={() => setHtsImportOpen(true)}>
            HTS 가져오기
          </Button>
          <Button variant="outline" onClick={() => exportJournalCsv(filteredEntries, accounts)}>
            CSV 내보내기
          </Button>
          <Button variant="outline" onClick={() => setChatOpen(true)}>
            📔 AI 패턴 분석
          </Button>
        </div>
      </div>

      {/* 계좌 선택 */}
      <AccountSelector
        value={selectedAccountId}
        onChange={setSelectedAccountId}
        showAllOption={true}
        onAddClick={() => setAccountModalOpen(true)}
      />

      {/* 날짜 범위 필터 */}
      <div className="flex gap-1">
        {[
          { key: '1w', label: '1주' },
          { key: '1m', label: '1개월' },
          { key: '3m', label: '3개월' },
          { key: 'all', label: '전체' },
        ].map(r => (
          <button
            key={r.key}
            onClick={() => setDateRange(r.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              dateRange === r.key
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 심리 패턴 경고 배너 */}
      {visibleWarnings.map(w => (
        <div key={w.key} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm">
          <span>⚠️ 이번 주 <strong>{w.key}</strong> {w.count}회 — AI 코치에게 패턴 분석을 요청해보세요.</span>
          <button
            onClick={() => setDismissedWarnings(prev => [...prev, w.key])}
            className="shrink-0 text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-100"
            aria-label="닫기"
          >✕</button>
        </div>
      ))}

      {/* 요약 통계 */}
      {stats.totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="총 거래" value={`${stats.totalCount}건`} />
          <StatCard label="매수" value={`${stats.buyCount}건`} color="blue" />
          <StatCard label="매도" value={`${stats.sellCount}건`} color="red" />
          <StatCard
            label="실현 손익"
            value={stats.pnlCount > 0
              ? `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString('ko-KR')}원`
              : '–'
            }
            color={stats.totalPnl >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* 월별 거래 트렌드 차트 */}
      {monthlyStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">월별 거래 트렌드</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 12 }} width={32} />
                <YAxis yAxisId="pnl" orientation="right" tickFormatter={v => formatCurrencyShort(v)} tick={{ fontSize: 12 }} width={56} />
                <Tooltip
                  formatter={(v, name) => name === '실현손익' ? [formatCurrencyShort(v), name] : [`${v}건`, name]}
                  contentStyle={{ fontSize: 13, borderRadius: 8 }}
                />
                <Legend iconType="rect" wrapperStyle={{ fontSize: 13 }} />
                <Bar yAxisId="count" dataKey="거래건수" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="pnl" dataKey="실현손익" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 심리 유형별 수익률 차트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">심리 유형별 평균 손익</CardTitle>
        </CardHeader>
        <CardContent>
          <PsychologyProfitChart data={chartData} />
        </CardContent>
      </Card>

      {/* 일지 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">매매 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <JournalList filterAccountId={selectedAccountId} dateRange={dateRange} />
        </CardContent>
      </Card>

      {/* 폼 모달 */}
      <JournalEntryForm
        open={entryFormOpen}
        onClose={() => setEntryFormOpen(false)}
      />
      <JournalBatchForm
        open={batchFormOpen}
        onClose={() => setBatchFormOpen(false)}
      />
      <HtsImportModal
        open={htsImportOpen}
        onClose={() => setHtsImportOpen(false)}
      />

      {/* AI 매매 코치 채팅 패널 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{ journalEntries: entries, accounts }}
        forceAgent="journal"
        initialMessage="내 매매 패턴을 분석해줘"
      />
      <AccountSetupModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    red: 'text-red-500 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${colorMap[color] ?? 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
    </div>
  )
}
