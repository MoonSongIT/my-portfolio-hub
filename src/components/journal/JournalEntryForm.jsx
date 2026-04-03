import { useState, useEffect, useMemo } from 'react'
import { useJournalStore } from '../../store/journalStore'
import { useAccountStore } from '../../store/accountStore'
import { KRX_STOCKS } from '../../data/krxStocks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import PsychologySelector from './PsychologySelector'
import AccountSelector from '../account/AccountSelector'

// 로컬 종목 검색 (KRX + 미국 주요 종목 하드코딩)
const US_STOCKS = [
  { ticker: 'AAPL', name: 'Apple', market: 'NASDAQ' },
  { ticker: 'MSFT', name: 'Microsoft', market: 'NASDAQ' },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'NASDAQ' },
  { ticker: 'AMZN', name: 'Amazon', market: 'NASDAQ' },
  { ticker: 'META', name: 'Meta', market: 'NASDAQ' },
  { ticker: 'TSLA', name: 'Tesla', market: 'NASDAQ' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', market: 'NASDAQ' },
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

const INITIAL_FORM = {
  accountId: '',
  date: today(),
  ticker: '',
  name: '',
  market: 'KRX',
  action: 'buy',
  price: '',
  quantity: '',
  fee: '',
  psychology: '',
  memo: '',
  pnl: '',
}

export default function JournalEntryForm({ open, onClose, editEntry = null }) {
  const { addEntry, updateEntry } = useJournalStore()
  const accounts = useAccountStore((state) => state.accounts)
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const isEdit = !!editEntry

  const searchResults = useMemo(() => searchStocks(searchQuery), [searchQuery])

  // 수정 모드: 기존 데이터 채우기
  useEffect(() => {
    if (editEntry) {
      setForm({
        accountId: editEntry.accountId ?? '',
        date: editEntry.date,
        ticker: editEntry.ticker,
        name: editEntry.name,
        market: editEntry.market,
        action: editEntry.action,
        price: String(editEntry.price),
        quantity: String(editEntry.quantity),
        fee: editEntry.fee != null && editEntry.fee !== 0 ? String(editEntry.fee) : '',
        psychology: editEntry.psychology,
        memo: editEntry.memo ?? '',
        pnl: editEntry.pnl !== null && editEntry.pnl !== undefined ? String(editEntry.pnl) : '',
      })
    } else {
      // 신규 입력: 첫 번째 계좌를 기본 선택
      const defaultAccountId = accounts.length > 0 ? accounts[0].id : ''
      setForm({ ...INITIAL_FORM, date: today(), accountId: defaultAccountId })
    }
    setErrors({})
    setSearchQuery('')
    setShowSearch(false)
  }, [editEntry, open])

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSelectStock = (item) => {
    set('ticker', item.ticker)
    set('name', item.name)
    set('market', item.market)
    setSearchQuery('')
    setShowSearch(false)
  }

  const validate = () => {
    const e = {}
    if (!form.accountId) e.accountId = '계좌를 선택하세요'
    if (!form.ticker.trim()) e.ticker = '종목을 선택하세요'
    if (!form.date) e.date = '날짜를 입력하세요'
    if (!form.price || Number(form.price) <= 0) e.price = '가격을 입력하세요'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = '수량을 입력하세요'
    if (!form.psychology) e.psychology = '매매 심리를 선택하세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    const price = Number(form.price)
    const quantity = Number(form.quantity)
    const entry = {
      accountId: form.accountId,
      date: form.date,
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim(),
      market: form.market,
      action: form.action,
      price,
      quantity,
      amount: price * quantity,
      fee: form.fee !== '' ? Number(form.fee) : 0,
      psychology: form.psychology,
      memo: form.memo.trim(),
      pnl: form.pnl !== '' ? Number(form.pnl) : null,
    }

    if (isEdit) {
      updateEntry(editEntry.id, entry)
    } else {
      addEntry(entry)
    }

    onClose()
  }

  const amount = form.price && form.quantity
    ? (Number(form.price) * Number(form.quantity)).toLocaleString('ko-KR')
    : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '매매 기록 수정' : '새 매매 기록'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 계좌 선택 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">계좌</label>
            <div className="mt-1">
              <AccountSelector
                value={form.accountId}
                onChange={(v) => set('accountId', v)}
                showAllOption={false}
              />
            </div>
            {errors.accountId && <p className="text-red-500 text-xs mt-1">{errors.accountId}</p>}
          </div>

          {/* 종목 검색 */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목</label>
            <Input
              value={isEdit ? `${form.name} (${form.ticker})` : searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
              onFocus={() => !isEdit && setShowSearch(true)}
              placeholder="종목명 또는 티커 검색 (예: 삼성전자, AAPL)"
              disabled={isEdit}
              className="mt-1"
            />
            {showSearch && searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {searchResults.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => handleSelectStock(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-gray-500">{item.ticker} · {item.market}</span>
                  </button>
                ))}
              </div>
            )}
            {form.ticker && !isEdit && (
              <p className="text-xs text-blue-600 mt-1">{form.name} ({form.ticker}) · {form.market}</p>
            )}
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
          </div>

          {/* 구분 + 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">구분</label>
              <div className="mt-1 flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { set('action', 'buy'); set('psychology', '') }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.action === 'buy'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  매수
                </button>
                <button
                  type="button"
                  onClick={() => { set('action', 'sell'); set('psychology', '') }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    form.action === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  매도
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">날짜</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="mt-1"
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>

          {/* 가격 + 수량 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">가격</label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="72000"
                min="0"
                step="any"
                className="mt-1"
              />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수량</label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="10"
                min="1"
                className="mt-1"
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>
          </div>
          {/* 수수료 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수수료 (선택)</label>
            <Input
              type="number"
              value={form.fee}
              onChange={(e) => set('fee', e.target.value)}
              placeholder="예: 360"
              min="0"
              step="any"
              className="mt-1"
            />
          </div>

          {amount && (
            <p className="text-xs text-gray-500 -mt-2">거래금액: ₩{amount}</p>
          )}

          {/* 심리 카테고리 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              {form.action === 'buy' ? '매수' : '매도'} 심리
            </label>
            <PsychologySelector
              action={form.action}
              value={form.psychology}
              onChange={(v) => set('psychology', v)}
            />
            {errors.psychology && <p className="text-red-500 text-xs mt-1">{errors.psychology}</p>}
          </div>

          {/* 실현 손익 (매도 시만 표시) */}
          {form.action === 'sell' && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                실현 손익 (선택)
              </label>
              <Input
                type="number"
                value={form.pnl}
                onChange={(e) => set('pnl', e.target.value)}
                placeholder="예: 150000 또는 -50000"
                step="any"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-0.5">양수: 이익, 음수: 손실</p>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              메모 (선택)
            </label>
            <textarea
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              placeholder="매매 이유, 시장 상황, 느낀 점 등 자유롭게..."
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit}>{isEdit ? '수정하기' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
