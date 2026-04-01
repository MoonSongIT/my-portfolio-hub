import { useState, useMemo } from 'react'
import { Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { EXCHANGE_RATE } from '../../data/samplePortfolio'
import { calculateReturn, calcAllocation } from '../../utils/calculator'
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'

export default function PortfolioTable({ onEdit }) {
  const { accounts, selectedAccountId, removeHolding, getSelectedHoldings } = usePortfolioStore()
  const [sortKey, setSortKey] = useState('returnRate')
  const [sortAsc, setSortAsc] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // { accountId, ticker, name }

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])

  // 비중 계산
  const allocations = useMemo(() => calcAllocation(holdings, EXCHANGE_RATE), [holdings])

  // 정렬된 데이터
  const sortedHoldings = useMemo(() => {
    return holdings
      .map((h, i) => ({
        ...h,
        returnRate: calculateReturn(h.avgPrice, h.currentPrice),
        evalValue: h.quantity * h.currentPrice,
        weight: allocations[i]?.weight || 0,
      }))
      .sort((a, b) => {
        let diff = 0
        switch (sortKey) {
          case 'returnRate': diff = a.returnRate - b.returnRate; break
          case 'weight': diff = a.weight - b.weight; break
          case 'evalValue': diff = a.evalValue - b.evalValue; break
          case 'name': diff = a.name.localeCompare(b.name); break
          default: diff = 0
        }
        return sortAsc ? diff : -diff
      })
  }, [holdings, allocations, sortKey, sortAsc])

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const handleDelete = () => {
    if (deleteTarget) {
      removeHolding(deleteTarget.accountId, deleteTarget.ticker)
      setDeleteTarget(null)
    }
  }

  const SortButton = ({ label, sortField }) => (
    <button
      onClick={() => handleSort(sortField)}
      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  )

  // 전체 선택 여부 (계좌명 컬럼 표시 여부)
  const showAccountColumn = selectedAccountId === 'all'

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton label="종목명" sortField="name" /></TableHead>
              <TableHead>티커</TableHead>
              {showAccountColumn && <TableHead>계좌</TableHead>}
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">평균매수가</TableHead>
              <TableHead className="text-right">현재가</TableHead>
              <TableHead className="text-right"><SortButton label="평가금액" sortField="evalValue" /></TableHead>
              <TableHead className="text-right"><SortButton label="수익률" sortField="returnRate" /></TableHead>
              <TableHead className="text-right"><SortButton label="비중" sortField="weight" /></TableHead>
              <TableHead className="text-center w-20">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((h) => (
              <TableRow key={`${h.accountId}-${h.ticker}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <TableCell>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{h.name}</p>
                  <p className="text-xs text-gray-500">{h.market}</p>
                </TableCell>
                <TableCell className="text-gray-600 dark:text-gray-400">{h.ticker}</TableCell>
                {showAccountColumn && (
                  <TableCell className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {h.accountName}
                  </TableCell>
                )}
                <TableCell className="text-right">{formatNumber(h.quantity)}</TableCell>
                <TableCell className="text-right">{formatCurrency(h.avgPrice, h.currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(h.currentPrice, h.currency)}</TableCell>
                <TableCell className="text-right">{formatCurrency(h.evalValue, h.currency)}</TableCell>
                <TableCell className={`text-right font-semibold ${h.returnRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatPercent(h.returnRate)}
                </TableCell>
                <TableCell className="text-right text-gray-600 dark:text-gray-400">
                  {h.weight.toFixed(1)}%
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(h)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 transition-colors"
                      title="수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ accountId: h.accountId, ticker: h.ticker, name: h.name })}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedHoldings.length === 0 && (
              <TableRow>
                <TableCell colSpan={showAccountColumn ? 10 : 9} className="text-center py-8 text-gray-500">
                  보유 종목이 없습니다. 종목을 추가해보세요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 삭제 확인 Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>종목 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600 dark:text-gray-400 py-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{deleteTarget?.name}</span>
            ({deleteTarget?.ticker})을(를) 정말 삭제하시겠습니까?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
