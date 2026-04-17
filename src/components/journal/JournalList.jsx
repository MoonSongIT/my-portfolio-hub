import { useState } from 'react'
import { useJournalStore, BUY_PSYCHOLOGY, SELL_PSYCHOLOGY } from '../../store/journalStore'
import { useUserAccounts, useAccountStore } from '../../store/accountStore'
import { formatCurrency, formatDate } from '../../utils/formatters'
import JournalEntryForm from './JournalEntryForm'

const ALL_PSYCHOLOGY = ['전체', ...BUY_PSYCHOLOGY, ...SELL_PSYCHOLOGY.filter(p => !BUY_PSYCHOLOGY.includes(p))]

export default function JournalList({ filterAccountId = '전체' }) {
  const { entries, deleteEntry } = useJournalStore()
  const accounts = useUserAccounts()
  const getAccountLabel = useAccountStore((state) => state.getAccountLabel)
  const [filterPsychology, setFilterPsychology] = useState('전체')
  const [filterAction, setFilterAction] = useState('전체')
  const [searchTicker, setSearchTicker] = useState('')
  const [editEntry, setEditEntry] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  // 필터 적용
  const filtered = entries
    .filter(e => filterAccountId === '전체' || e.accountId === filterAccountId)
    .filter(e => filterAction === '전체' || e.action === (filterAction === '매수' ? 'buy' : 'sell'))
    .filter(e => filterPsychology === '전체' || e.psychology === filterPsychology)
    .filter(e => !searchTicker || e.name.includes(searchTicker) || e.ticker.includes(searchTicker.toUpperCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  // 날짜별 그룹화
  const grouped = filtered.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = []
    acc[entry.date].push(entry)
    return acc
  }, {})

  const handleEdit = (entry) => {
    setEditEntry(entry)
    setEditOpen(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('이 기록을 삭제할까요?')) deleteEntry(id)
  }

  return (
    <div>
      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={searchTicker}
          onChange={(e) => setSearchTicker(e.target.value)}
          placeholder="종목 검색..."
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
        />

        {/* 매수/매도 필터 */}
        <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
          {['전체', '매수', '매도'].map(v => (
            <button
              key={v}
              onClick={() => setFilterAction(v)}
              className={`px-3 py-1.5 transition-colors ${
                filterAction === v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* 심리 필터 */}
        <select
          value={filterPsychology}
          onChange={(e) => setFilterPsychology(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ALL_PSYCHOLOGY.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* 결과 없음 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📔</p>
          <p className="text-sm">매매 기록이 없습니다.</p>
          <p className="text-xs mt-1">위의 "빠른 입력" 또는 "일괄 입력" 버튼으로 기록을 추가해보세요.</p>
        </div>
      )}

      {/* 날짜별 그룹 목록 */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              {formatDate(date)}
            </h3>
            <div className="space-y-2">
              {dayEntries.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  accountLabel={entry.accountId ? getAccountLabel(entry.accountId) : null}
                  onEdit={() => handleEdit(entry)}
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 수정 폼 */}
      <JournalEntryForm
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditEntry(null) }}
        editEntry={editEntry}
      />
    </div>
  )
}

function EntryCard({ entry, accountLabel, onEdit, onDelete }) {
  const isProfit = entry.pnl > 0
  const isLoss = entry.pnl < 0
  const currency = (entry.market === 'NYSE' || entry.market === 'NASDAQ') ? 'USD' : 'KRW'

  return (
    <div className="flex items-start justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-start gap-3">
        {/* 매수/매도 뱃지 */}
        <span className={`mt-0.5 px-2 py-0.5 text-xs font-bold rounded ${
          entry.action === 'buy'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        }`}>
          {entry.action === 'buy' ? '매수' : '매도'}
        </span>

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {entry.name}
            <span className="ml-1.5 text-xs text-gray-400 font-normal">{entry.ticker}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatCurrency(entry.price, currency)} × {entry.quantity.toLocaleString()}주
            {' '}= {formatCurrency(entry.amount, currency)}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {accountLabel && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                {accountLabel}
              </span>
            )}
            <span className="px-2 py-0.5 text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full border border-orange-200 dark:border-orange-700">
              {entry.psychology}
            </span>
            {entry.pnl !== null && entry.pnl !== undefined && (
              <span className={`text-xs font-semibold ${isProfit ? 'text-green-600' : isLoss ? 'text-red-500' : 'text-gray-500'}`}>
                {isProfit ? '+' : ''}{formatCurrency(entry.pnl, currency)}
              </span>
            )}
            {entry.memo && (
              <span className="text-xs text-gray-400 truncate max-w-[200px]">{entry.memo}</span>
            )}
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-1 ml-2 shrink-0">
        <button
          onClick={onEdit}
          className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          수정
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
