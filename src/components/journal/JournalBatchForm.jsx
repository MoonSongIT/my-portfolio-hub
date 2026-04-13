import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useJournalStore } from '../../store/journalStore'
import { useUserAccounts } from '../../store/accountStore'
import { ensureHistory } from '../../api/dailyPnlService'
import { KRX_STOCKS } from '../../data/krxStocks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import PsychologySelector from './PsychologySelector'
import AccountSelector from '../account/AccountSelector'

const US_STOCKS = [
  { ticker: 'AAPL', name: 'Apple', market: 'NASDAQ' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'NASDAQ' },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'NASDAQ' },
  { ticker: 'AMZN', name: 'Amazon', market: 'NASDAQ' },
  { ticker: 'META', name: 'Meta', market: 'NASDAQ' },
  { ticker: 'TSLA', name: 'Tesla', market: 'NASDAQ' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', market: 'NYSE' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', market: 'NASDAQ' },
]
const ALL_STOCKS = [...KRX_STOCKS, ...US_STOCKS]

function searchStocks(query) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  return ALL_STOCKS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.ticker.toLowerCase().includes(q) ||
    (s.nameEn && s.nameEn.toLowerCase().includes(q))
  ).slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyRow = () => ({
  _id: crypto.randomUUID(),
  ticker: '',
  name: '',
  market: 'KRX',
  action: 'buy',
  price: '',
  quantity: '',
  psychology: '',
  memo: '',
  pnl: '',
  // 검색 UI 상태
  _searchQuery: '',
  _showSearch: false,
})

export default function JournalBatchForm({ open, onClose }) {
  const { addEntry } = useJournalStore()
  const accounts = useUserAccounts()
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState([emptyRow()])
  const [errors, setErrors] = useState({})
  const [activeSearchRow, setActiveSearchRow] = useState(null)

  // 폼 열릴 때 첫 번째 계좌 기본 선택
  useMemo(() => {
    if (open && !accountId && accounts.length > 0) {
      setAccountId(accounts[0].id)
    }
  }, [open, accounts])

  // 현재 검색 중인 행의 query로 로컬 검색
  const activeRow = rows.find(r => r._id === activeSearchRow)
  const searchResults = useMemo(() => searchStocks(activeRow?._searchQuery ?? ''), [activeRow?._searchQuery])

  const updateRow = (id, key, value) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [key]: value } : r))
  }

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const removeRow = (id) => {
    if (rows.length === 1) return
    setRows(prev => prev.filter(r => r._id !== id))
  }

  const handleSelectStock = (rowId, item) => {
    setRows(prev => prev.map(r => r._id === rowId
      ? { ...r, ticker: item.ticker, name: item.name, market: item.market, _searchQuery: '', _showSearch: false }
      : r
    ))
    setActiveSearchRow(null)
  }

  const validate = () => {
    const e = {}
    if (!accountId) e.accountId = '계좌를 선택하세요'
    rows.forEach((row, i) => {
      if (!row.ticker.trim()) e[`${i}_ticker`] = '종목 필요'
      if (!row.price || Number(row.price) <= 0) e[`${i}_price`] = '가격 필요'
      if (!row.quantity || Number(row.quantity) <= 0) e[`${i}_quantity`] = '수량 필요'
      if (!row.psychology) e[`${i}_psychology`] = '심리 선택 필요'
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveAll = () => {
    if (!validate()) return
    const buyRows = []
    rows.forEach(row => {
      const price = Number(row.price)
      const quantity = Number(row.quantity)
      addEntry({
        accountId,
        date,
        ticker: row.ticker.trim().toUpperCase(),
        name: row.name.trim(),
        market: row.market,
        action: row.action,
        price,
        quantity,
        amount: price * quantity,
        fee: 0,
        psychology: row.psychology,
        memo: row.memo.trim(),
        pnl: row.pnl !== '' ? Number(row.pnl) : null,
      })
      if (row.action === 'buy') buyRows.push(row)
    })
    // 매수 항목 손익 히스토리 백필 (백그라운드, 비차단)
    buyRows.forEach(row => {
      ensureHistory(row.ticker.trim().toUpperCase(), accountId, row.market)
        .then(results => {
          if (results.length > 0) {
            toast.success(`${row.name} 손익 히스토리 로드 완료 (${results.length}일)`)
          }
        })
        .catch(() => {
          toast.error(`${row.name} 손익 히스토리 로드 실패. 포트폴리오에서 수동으로 로드해주세요.`)
        })
    })
    setRows([emptyRow()])
    setDate(today())
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>일괄 입력 — 마감 후 정리</DialogTitle>
        </DialogHeader>

        {/* 계좌 선택 (공통) */}
        <div className="flex items-center gap-3 py-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">계좌</label>
          <AccountSelector
            value={accountId}
            onChange={setAccountId}
            showAllOption={false}
          />
          {errors.accountId && <p className="text-red-500 text-xs">{errors.accountId}</p>}
        </div>

        {/* 날짜 */}
        <div className="flex items-center gap-3 py-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">거래 날짜</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>

        {/* 행 목록 */}
        <div className="space-y-6">
          {rows.map((row, i) => (
            <div key={row._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 relative">
              {/* 행 번호 + 삭제 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">거래 {i + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row._id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 종목 검색 */}
              <div className="relative">
                <Input
                  value={row._searchQuery || (row.ticker ? `${row.name} (${row.ticker})` : '')}
                  onChange={(e) => {
                    updateRow(row._id, '_searchQuery', e.target.value)
                    updateRow(row._id, '_showSearch', true)
                    updateRow(row._id, 'ticker', '')
                    setActiveSearchRow(row._id)
                  }}
                  onFocus={() => setActiveSearchRow(row._id)}
                  placeholder="종목 검색..."
                  className="text-sm"
                />
                {row._showSearch && activeSearchRow === row._id && searchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {searchResults.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleSelectStock(row._id, item)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-gray-500">{item.ticker} · {item.market}</span>
                      </button>
                    ))}
                  </div>
                )}
                {errors[`${i}_ticker`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${i}_ticker`]}</p>}
              </div>

              {/* 구분 + 가격 + 수량 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { updateRow(row._id, 'action', 'buy'); updateRow(row._id, 'psychology', '') }}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      row.action === 'buy' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'
                    }`}
                  >매수</button>
                  <button
                    type="button"
                    onClick={() => { updateRow(row._id, 'action', 'sell'); updateRow(row._id, 'psychology', '') }}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      row.action === 'sell' ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'
                    }`}
                  >매도</button>
                </div>
                <div>
                  <Input
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(row._id, 'price', e.target.value)}
                    placeholder="가격"
                    min="0"
                    step="any"
                    className="text-sm"
                  />
                  {errors[`${i}_price`] && <p className="text-red-500 text-xs">{errors[`${i}_price`]}</p>}
                </div>
                <div>
                  <Input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => updateRow(row._id, 'quantity', e.target.value)}
                    placeholder="수량"
                    min="1"
                    className="text-sm"
                  />
                  {errors[`${i}_quantity`] && <p className="text-red-500 text-xs">{errors[`${i}_quantity`]}</p>}
                </div>
                {row.action === 'sell' && (
                  <div>
                    <Input
                      type="number"
                      value={row.pnl}
                      onChange={(e) => updateRow(row._id, 'pnl', e.target.value)}
                      placeholder="손익"
                      step="any"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* 심리 카테고리 */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{row.action === 'buy' ? '매수' : '매도'} 심리</p>
                <PsychologySelector
                  action={row.action}
                  value={row.psychology}
                  onChange={(v) => updateRow(row._id, 'psychology', v)}
                />
                {errors[`${i}_psychology`] && <p className="text-red-500 text-xs mt-1">{errors[`${i}_psychology`]}</p>}
              </div>

              {/* 메모 */}
              <Input
                value={row.memo}
                onChange={(e) => updateRow(row._id, 'memo', e.target.value)}
                placeholder="메모 (선택)"
                className="text-sm"
              />
            </div>
          ))}
        </div>

        {/* 행 추가 */}
        <button
          type="button"
          onClick={addRow}
          className="w-full py-2 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          + 거래 추가
        </button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSaveAll}>전체 저장 ({rows.length}건)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
