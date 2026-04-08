import { useState } from 'react'
import { useJournalStore } from '../store/journalStore'
import { useUserAccounts } from '../store/accountStore'
import JournalEntryForm from '../components/journal/JournalEntryForm'
import JournalBatchForm from '../components/journal/JournalBatchForm'
import JournalList from '../components/journal/JournalList'
import PsychologyProfitChart from '../components/charts/PsychologyProfitChart'
import ChatPanel from '../components/chat/ChatPanel'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Journal() {
  const [entryFormOpen, setEntryFormOpen] = useState(false)
  const [batchFormOpen, setBatchFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState('전체')

  const { entries, getProfitByPsychology, getSummaryStats } = useJournalStore()
  const accounts = useUserAccounts()

  // 선택 계좌 필터 (전체 = undefined → 전체 집계)
  const accountFilter = selectedAccountId === '전체' ? undefined : selectedAccountId
  const chartData = getProfitByPsychology(accountFilter)
  const stats = getSummaryStats(accountFilter)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">투자 매매 일지</h1>
          <p className="text-sm text-gray-500 mt-1">매매 심리를 기록하고 패턴을 발견하세요</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEntryFormOpen(true)}>
            + 빠른 입력
          </Button>
          <Button variant="outline" onClick={() => setBatchFormOpen(true)}>
            일괄 입력
          </Button>
          <Button variant="outline" onClick={() => setChatOpen(true)}>
            📔 AI 패턴 분석
          </Button>
        </div>
      </div>

      {/* 계좌 탭 필터 (계좌 2개 이상일 때만 표시) */}
      {accounts.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {['전체', ...accounts.map(a => a.id)].map((id) => {
            const label = id === '전체' ? '전체' : (accounts.find(a => a.id === id)?.name ?? id)
            return (
              <button
                key={id}
                onClick={() => setSelectedAccountId(id)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  selectedAccountId === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

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
          <JournalList filterAccountId={selectedAccountId} />
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

      {/* AI 매매 코치 채팅 패널 */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{ journalEntries: entries, accounts }}
        forceAgent="journal"
        initialMessage="내 매매 패턴을 분석해줘"
      />
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
