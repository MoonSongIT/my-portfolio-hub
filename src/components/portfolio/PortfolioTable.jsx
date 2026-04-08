import { useState, useMemo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { usePortfolioStore } from '../../store/portfolioStore'
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

export default function PortfolioTable({ onRowClick }) {
  const { accounts, selectedAccountId, exchangeRate, getSelectedHoldings } = usePortfolioStore()
  const [sortKey, setSortKey] = useState('returnRate')
  const [sortAsc, setSortAsc] = useState(false)

  const holdings = useMemo(() => getSelectedHoldings(), [accounts, selectedAccountId])

  // 비중 계산
  const allocations = useMemo(() => calcAllocation(holdings, exchangeRate), [holdings, exchangeRate])

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

  const SortButton = ({ label, sortField }) => (
    <button
      onClick={() => handleSort(sortField)}
      className="flex items-center justify-end gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full"
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((h) => (
              <TableRow
                key={`${h.accountId}-${h.ticker}`}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(h)}
              >
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
              </TableRow>
            ))}
            {sortedHoldings.length === 0 && (
              <TableRow>
                <TableCell colSpan={showAccountColumn ? 9 : 8} className="text-center py-10 text-gray-500">
                  <p className="text-base mb-1">보유 종목이 없습니다.</p>
                  <p className="text-sm text-gray-400">거래 일지에 매수 기록을 추가하면 자동으로 표시됩니다.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    </>
  )
}
