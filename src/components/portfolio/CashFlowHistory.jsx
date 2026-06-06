// 입출금 내역 테이블 — 편집·카테고리 필터 지원
import { useState, useMemo } from 'react'
import { Trash2, Pencil, ArrowDownCircle, ArrowUpCircle, Bot, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { useAccountStore } from '../../store/accountStore'
import { formatCurrency, formatDate } from '../../utils/formatters'
import CashFlowModal from './CashFlowModal'

const PAGE_SIZE = 20

// 카테고리 필터 칩 목록
const CATEGORY_CHIPS = [
  { value: 'all',            label: '전체' },
  { value: 'investment_in',  label: '투자금 입금' },
  { value: 'realized_gain',  label: '매도차익' },
  { value: 'dividend',       label: '배당금' },
  { value: 'interest',       label: '이자/기타' },
  { value: 'adjust_plus',    label: '조정(+)' },
  { value: 'investment_out', label: '투자금 출금' },
  { value: 'fee_tax',        label: '수수료/세금' },
  { value: 'adjust_minus',   label: '조정(-)' },
]

// dateFilter: 'all' | 'this_month' | '3month' | 'custom'
export default function CashFlowHistory({ accountId = 'all', dateFilter = 'all', customFrom = '', customTo = '' }) {
  // cashFlows 상태를 직접 구독 — 데이터 변경 시 재렌더링 보장
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const { getCashFlowsByAccount, getRunningBalance, deleteCashFlow } = useCashFlowStore()
  const { getAccountLabel } = useAccountStore()
  const [page, setPage] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  // 날짜 범위 계산
  const { fromDate, toDate } = useMemo(() => {
    const today = new Date()
    const toDate = today.toISOString().split('T')[0]
    if (dateFilter === 'this_month') {
      const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      return { fromDate, toDate }
    }
    if (dateFilter === '3month') {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 3)
      return { fromDate: d.toISOString().split('T')[0], toDate }
    }
    if (dateFilter === 'custom') {
      return { fromDate: customFrom || null, toDate: customTo || toDate }
    }
    return { fromDate: null, toDate: null }
  }, [dateFilter, customFrom, customTo])

  // 잔고 누계 배열 (자동 포함 전체 입출금, 날짜 오름차순) — cashFlows 변경 시 재계산
  const runningBalance = useMemo(
    () => getRunningBalance(accountId),
    [accountId, cashFlows]
  )

  // 전체 내역 (날짜 내림차순) — cashFlows 변경 시 재계산
  const allFlows = useMemo(() => {
    let flows = getCashFlowsByAccount(accountId)
    if (fromDate) flows = flows.filter(f => f.date >= fromDate && f.date <= toDate)
    if (categoryFilter !== 'all') flows = flows.filter(f => f.category === categoryFilter)
    return flows
  }, [accountId, fromDate, toDate, cashFlows, categoryFilter])

  // 잔고 누계 맵 (id → balance)
  const balanceMap = useMemo(() => {
    const map = {}
    runningBalance.forEach(f => { map[f.id] = f.balance })
    return map
  }, [runningBalance])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(allFlows.length / PAGE_SIZE))
  const paginated = allFlows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = (id) => {
    deleteCashFlow(id)
    setConfirmDeleteId(null)
  }

  // CSV 내보내기
  const handleCsvExport = () => {
    const categoryLabel = (code) => CATEGORY_CHIPS.find(c => c.value === code)?.label ?? code
    const headers = ['날짜', '유형', '카테고리', '계좌', '금액', '통화', '잔고', '메모']
    const rows = allFlows.map(f => [
      f.date,
      f.type === 'deposit' ? '입금' : '출금',
      categoryLabel(f.category),
      getAccountLabel(f.accountId),
      f.amount,
      f.currency || 'KRW',
      balanceMap[f.id] ?? '',
      f.memo || '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const accountName = accountId === 'all' ? '전체' : getAccountLabel(accountId).split(' (')[0]
    a.href = url
    a.download = `cashflow_${accountName}_${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (allFlows.length === 0) {
    return (
      <div>
        {/* 카테고리 필터 칩 */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          {CATEGORY_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => { setCategoryFilter(chip.value); setPage(1) }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                categoryFilter === chip.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
          <ArrowDownCircle size={40} className="mb-3 opacity-30" />
          <p className="text-sm">입출금 내역이 없습니다.</p>
          <p className="text-xs mt-1">입금 버튼을 눌러 자금을 등록해보세요.</p>
        </div>
        <CashFlowModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          editTarget={editTarget}
        />
      </div>
    )
  }

  return (
    <div>
      {/* 카테고리 필터 칩 + CSV 내보내기 */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        {CATEGORY_CHIPS.map(chip => (
          <button
            key={chip.value}
            onClick={() => { setCategoryFilter(chip.value); setPage(1) }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              categoryFilter === chip.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
        <button
          onClick={handleCsvExport}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          title="CSV 내보내기"
        >
          <Download size={11} />
          CSV
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">날짜</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">유형</th>
              {accountId === 'all' && (
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">계좌</th>
              )}
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">금액</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">잔고 누계</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400">메모</th>
              <th className="py-3 px-4 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {paginated.map((flow) => (
              <tr
                key={flow.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              >
                {/* 날짜 */}
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {formatDate(flow.date)}
                </td>

                {/* 유형 뱃지 */}
                <td className="py-3 px-4">
                  {flow.isAuto ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      <Bot size={10} />
                      자동
                    </span>
                  ) : flow.type === 'deposit' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <ArrowDownCircle size={10} />
                      입금
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
                      <ArrowUpCircle size={10} />
                      출금
                    </span>
                  )}
                </td>

                {/* 계좌 (전체 보기 시만) */}
                {accountId === 'all' && (
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                    {getAccountLabel(flow.accountId)}
                  </td>
                )}

                {/* 금액 */}
                <td className="py-3 px-4 text-right font-medium whitespace-nowrap">
                  <span className={flow.type === 'deposit' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'}>
                    {flow.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(flow.amount, flow.currency)}
                  </span>
                </td>

                {/* 잔고 누계 (KRW 환산) */}
                <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {balanceMap[flow.id] !== undefined
                    ? formatCurrency(balanceMap[flow.id])
                    : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                  }
                </td>

                {/* 메모 */}
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                  {flow.memo || '—'}
                </td>

                {/* 편집/삭제 버튼 (수동 입출금만) */}
                <td className="py-3 px-4 text-center">
                  {!flow.isAuto && (
                    confirmDeleteId === flow.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(flow.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => setEditTarget(flow)}
                          className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-300 hover:text-blue-500 transition"
                          title="수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(flow.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-400 transition"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400">
            총 {allFlows.length}건 · {page}/{totalPages} 페이지
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      <CashFlowModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        editTarget={editTarget}
      />
    </div>
  )
}
