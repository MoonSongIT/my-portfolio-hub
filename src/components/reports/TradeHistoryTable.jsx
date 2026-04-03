import { useMemo } from 'react'
import { formatCurrency } from '../../utils/formatters'

// 매수/매도 구분 뱃지
function ActionBadge({ action }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
      action === 'buy'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    }`}>
      {action === 'buy' ? '매수' : '매도'}
    </span>
  )
}

// 손익 셀
function PnLCell({ pnl }) {
  if (pnl == null) return <span className="text-gray-400 text-xs">-</span>
  return (
    <span className={`font-medium ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}원
    </span>
  )
}

// 요약 헬퍼
function calculateSummary(entries) {
  const buyCount = entries.filter(e => e.action === 'buy').length
  const sellCount = entries.filter(e => e.action === 'sell').length
  const pnlEntries = entries.filter(e => e.pnl != null)
  const winCount = pnlEntries.filter(e => e.pnl > 0).length
  const winRate = pnlEntries.length > 0 ? Math.round((winCount / pnlEntries.length) * 100) : null
  const totalPnl = pnlEntries.reduce((sum, e) => sum + e.pnl, 0)
  return { buyCount, sellCount, winRate, totalPnl, pnlCount: pnlEntries.length }
}

export default function TradeHistoryTable({ entries = [] }) {
  const summary = useMemo(() => calculateSummary(entries), [entries])

  // 최신순 정렬
  const sorted = useMemo(() =>
    [...entries].sort((a, b) => b.date.localeCompare(b.date) || b.createdAt?.localeCompare(a.createdAt || '') || 0),
    [entries]
  )

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 dark:text-gray-500">
        <p className="text-lg">거래 내역이 없습니다</p>
        <p className="text-sm mt-1">매매 일지를 기록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">매수</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{summary.buyCount}건</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">매도</p>
          <p className="text-lg font-bold text-red-500 dark:text-red-400">{summary.sellCount}건</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">승률</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {summary.winRate != null ? `${summary.winRate}%` : '-'}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">실현 손익</p>
          <p className={`text-lg font-bold ${summary.totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {summary.totalPnl >= 0 ? '+' : ''}{summary.totalPnl.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">날짜</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">종목</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">구분</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">가격</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">수량</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">심리</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">손익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{entry.date}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{entry.name || entry.ticker}</p>
                  <p className="text-xs text-gray-400">{entry.ticker}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                  {entry.price?.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {entry.quantity?.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                    {entry.psychology || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <PnLCell pnl={entry.pnl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
