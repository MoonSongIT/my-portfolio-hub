import { useState, useEffect, useMemo } from 'react'
import { useJournalStore } from '../../store/journalStore'
import { useAccountStore, ACCOUNT_TYPES } from '../../store/accountStore'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { KRX_STOCKS } from '../../data/krxStocks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import PsychologySelector from './PsychologySelector'
import AccountSelector from '../account/AccountSelector'
import { formatCurrencyShort } from '../../utils/formatters'
import { Landmark, Wallet } from 'lucide-react'

// ─── 천단위 콤마 헬퍼 ───

// raw 숫자 문자열 → 콤마 표시 (소수점·음수 보존)
function formatNumDisplay(raw) {
  if (raw === '' || raw == null) return ''
  const str = String(raw)
  const isNeg = str.startsWith('-')
  const abs   = isNeg ? str.slice(1) : str
  const [intPart, decPart] = abs.split('.')
  const formatted = intPart ? Number(intPart).toLocaleString('ko-KR') : '0'
  const result = decPart !== undefined ? `${formatted}.${decPart}` : formatted
  return isNeg ? `-${result}` : result
}

// 입력 이벤트 → raw 문자열 (콤마 제거, 허용 문자만 통과)
function parseNumInput(val, { allowNeg = false, allowDec = false } = {}) {
  let s = val.replace(/,/g, '')
  // 허용 문자 필터
  const pattern = allowNeg && allowDec ? /[^0-9.\-]/g
                : allowNeg            ? /[^0-9\-]/g
                : allowDec            ? /[^0-9.]/g
                :                       /[^0-9]/g
  s = s.replace(pattern, '')
  // 소수점 중복 제거
  if (allowDec) {
    const parts = s.split('.')
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('')
  }
  // 음수 부호는 맨 앞에만
  if (allowNeg) s = s.replace(/(?!^)-/g, '')
  return s
}

// 계좌 유형 배지 색상
const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ETC:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

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
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const entries   = useJournalStore(s => s.entries)
  const { computeHoldings } = useJournalStore()
  const { getTotalDeposit, getTotalWithdrawal } = useCashFlowStore()
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

  // 선택된 계좌 정보
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === form.accountId) || null,
    [form.accountId, accounts]
  )
  const selectedAccountTypeName = useMemo(
    () => ACCOUNT_TYPES.find(t => t.code === selectedAccount?.type)?.name || '',
    [selectedAccount]
  )
  const availableCash = useMemo(() => {
    if (!form.accountId) return null
    const deposit    = getTotalDeposit(form.accountId)
    const withdrawal = getTotalWithdrawal(form.accountId)
    const invested   = computeHoldings(form.accountId).reduce((s, h) => s + (h.totalCost || 0), 0)
    return deposit - withdrawal - invested
  }, [form.accountId, cashFlows, entries])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '매매 기록 수정' : '새 매매 기록'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 계좌 선택 + 선택된 계좌 카드 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">계좌</label>
            <div className="mt-1 flex items-stretch gap-3">
              {/* 왼쪽: 드롭다운 */}
              <div className="flex-1">
                <AccountSelector
                  value={form.accountId}
                  onChange={(v) => set('accountId', v)}
                  showAllOption={false}
                />
              </div>

              {/* 오른쪽: 선택된 계좌 정보 카드 */}
              {selectedAccount ? (
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                    <Landmark size={14} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {selectedAccount.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none shrink-0 ${TYPE_COLOR[selectedAccount.type] || TYPE_COLOR.ETC}`}>
                        {selectedAccountTypeName}
                      </span>
                    </div>
                    {selectedAccount.broker && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {selectedAccount.broker}
                      </p>
                    )}
                    {availableCash !== null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Wallet size={9} className={availableCash < 0 ? 'text-red-400' : 'text-green-500'} />
                        <span className={`text-[10px] font-medium ${availableCash < 0 ? 'text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {formatCurrencyShort(availableCash)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-600">
                  계좌를 선택하세요
                </div>
              )}
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
                type="text"
                inputMode="decimal"
                value={formatNumDisplay(form.price)}
                onChange={(e) => set('price', parseNumInput(e.target.value, { allowDec: true }))}
                placeholder="209,500"
                className="mt-1"
              />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수량</label>
              <Input
                type="text"
                inputMode="numeric"
                value={formatNumDisplay(form.quantity)}
                onChange={(e) => set('quantity', parseNumInput(e.target.value))}
                placeholder="10"
                className="mt-1"
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>
          </div>
          {/* 수수료 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수수료 (선택)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={formatNumDisplay(form.fee)}
              onChange={(e) => set('fee', parseNumInput(e.target.value, { allowDec: true }))}
              placeholder="예: 1,500"
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
                type="text"
                inputMode="decimal"
                value={formatNumDisplay(form.pnl)}
                onChange={(e) => set('pnl', parseNumInput(e.target.value, { allowNeg: true, allowDec: true }))}
                placeholder="예: 150,000 또는 -50,000"
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
