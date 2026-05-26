import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useJournalStore } from '../../store/journalStore'
import { useUserAccounts, useAccountStore, ACCOUNT_TYPES } from '../../store/accountStore'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import { ensureHistory } from '../../api/dailyPnlService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import PsychologySelector from './PsychologySelector'
import PsychologyFeedback from './PsychologyFeedback'
import PostTradeInsight from './PostTradeInsight'
import AccountSelector from '../account/AccountSelector'
import { formatCurrencyShort } from '../../utils/formatters'
import { Landmark, Wallet, History, CheckCircle2 } from 'lucide-react'

// ─── 천단위 콤마 헬퍼 ───

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

function parseNumInput(val, { allowNeg = false, allowDec = false } = {}) {
  let s = val.replace(/,/g, '')
  const pattern = allowNeg && allowDec ? /[^0-9.\-]/g
                : allowNeg            ? /[^0-9\-]/g
                : allowDec            ? /[^0-9.]/g
                :                       /[^0-9]/g
  s = s.replace(pattern, '')
  if (allowDec) {
    const parts = s.split('.')
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('')
  }
  if (allowNeg) s = s.replace(/(?!^)-/g, '')
  return s
}

const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ETC:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const ACTION_LABEL = { buy: '매수', sell: '매도' }

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

export default function JournalEntryForm({ open, onClose, editEntry = null, initialValues = null }) {
  const { addEntry, updateEntry, entries, addToRecentSelections } = useJournalStore()
  const accounts = useUserAccounts()
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const { getAvailableCash } = useCashFlowStore()
  const watchlist = useWatchlistStore(s => s.watchlist)
  const getSelectedHoldings = usePortfolioStore(s => s.getSelectedHoldings)

  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [savedEntry, setSavedEntry] = useState(null)
  const isEdit = !!editEntry

  // 관심종목 + 보유종목 합산 후 ticker 중복 제거
  const stockPool = useMemo(() => {
    const holdings = getSelectedHoldings().map(h => ({ ticker: h.ticker, name: h.name, market: h.market }))
    const watched  = watchlist.map(w => ({ ticker: w.ticker, name: w.name, market: w.market }))
    const merged = [...holdings, ...watched]
    const seen = new Set()
    return merged.filter(s => { if (seen.has(s.ticker)) return false; seen.add(s.ticker); return true })
  }, [watchlist, getSelectedHoldings])

  // 최근 거래 종목 (빈 검색어일 때 드롭다운에 표시)
  const recentTickers = useMemo(() => {
    const seen = new Set()
    return [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(e => { if (seen.has(e.ticker)) return false; seen.add(e.ticker); return true })
      .slice(0, 6)
      .map(e => ({ ticker: e.ticker, name: e.name, market: e.market, isRecent: true }))
  }, [entries])

  // 선택된 종목의 최근 거래 히스토리 (최근 3건)
  const tickerHistory = useMemo(() => {
    if (!form.ticker) return []
    return [...entries]
      .filter(e => e.ticker === form.ticker)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
  }, [form.ticker, entries])

  // 가장 최근 거래 (placeholder 힌트용)
  const lastTrade = tickerHistory[0] ?? null

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 1) return []
    const q = searchQuery.toLowerCase()
    return stockPool.filter(s =>
      s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [searchQuery, stockPool])

  // 수정 모드: 기존 데이터 채우기
  useEffect(() => {
    setSavedEntry(null)
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
      const defaultAccountId = accounts.length > 0 ? accounts[0].id : ''
      const base = { ...INITIAL_FORM, date: today(), accountId: defaultAccountId }
      setForm(initialValues ? { ...base, ...initialValues } : base)
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

  const handleClose = () => {
    setSavedEntry(null)
    onClose()
  }

  const doSave = (entry) => {
    if (isEdit) {
      updateEntry(editEntry.id, entry)
      onClose()
      return
    }
    addEntry(entry)
    if (entry.psychology) addToRecentSelections(entry.psychology, entry.action)
    if (entry.action === 'buy' && entry.accountId) {
      ensureHistory(entry.ticker, entry.accountId, entry.market).then(results => {
        if (results.length > 0) {
          toast.success(`${entry.name} 손익 히스토리 로드 완료 (${results.length}일)`)
        }
      }).catch(() => {
        toast.error(`${entry.name} 손익 히스토리 로드 실패. 포트폴리오에서 수동으로 로드해주세요.`)
      })
    }
    setSavedEntry(entry)
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

    if (!isEdit) {
      const ticker = form.ticker.trim().toUpperCase()
      const duplicate = entries.find(e =>
        e.date === form.date &&
        e.ticker === ticker &&
        e.action === form.action &&
        e.quantity === quantity
      )
      if (duplicate) {
        toast.warning(
          `동일한 거래가 이미 있습니다. (${form.date} ${ticker} ${ACTION_LABEL[form.action]} ${quantity}주)`,
          {
            action: { label: '계속 저장', onClick: () => doSave(entry) },
            cancel: { label: '취소' },
            duration: 8000,
          }
        )
        return
      }
    }

    doSave(entry)
  }

  const amount = form.price && form.quantity
    ? (Number(form.price) * Number(form.quantity)).toLocaleString('ko-KR')
    : null

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
    return getAvailableCash(form.accountId)
  }, [form.accountId, cashFlows])

  // 드롭다운에 표시할 목록 (검색어 있으면 검색결과, 없으면 최근 거래)
  const dropdownItems = searchQuery.length > 0 ? searchResults : recentTickers
  const dropdownLabel = searchQuery.length > 0 ? null : '최근 거래 종목'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '매매 기록 수정' : '새 매매 기록'}</DialogTitle>
        </DialogHeader>

        {savedEntry ? (
          <div className="py-6 flex flex-col items-center gap-4 overflow-y-auto px-1">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200">
                  {savedEntry.name} {savedEntry.action === 'buy' ? '매수' : '매도'} 기록 완료
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {Number(savedEntry.price).toLocaleString('ko-KR')}원 × {savedEntry.quantity}주 · {savedEntry.psychology}
                </p>
              </div>
            </div>
            <PostTradeInsight entry={savedEntry} />
          </div>
        ) : (
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* 계좌 선택 + 선택된 계좌 카드 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">계좌</label>
            <div className="mt-1 flex items-stretch gap-3">
              <div className="flex-1">
                <AccountSelector
                  value={form.accountId}
                  onChange={(v) => set('accountId', v)}
                  showAllOption={false}
                />
              </div>

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
              lang="ko"
              autoComplete="off"
              value={isEdit ? `${form.name} (${form.ticker})` : searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
              onFocus={() => !isEdit && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              placeholder="종목명 또는 티커 검색 (예: 삼성전자, AAPL)"
              disabled={isEdit}
              className="mt-1"
            />

            {/* 드롭다운: 검색결과 or 최근 거래 종목 */}
            {showSearch && !isEdit && dropdownItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 max-h-52 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {dropdownLabel && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <History size={12} className="text-gray-400" />
                    <span className="text-[11px] text-gray-400 font-medium">{dropdownLabel}</span>
                  </div>
                )}
                {dropdownItems.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onMouseDown={() => handleSelectStock(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-gray-500 text-xs">{item.ticker} · {item.market}</span>
                    {item.isRecent && (
                      <span className="ml-1 text-[10px] text-blue-400">최근</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {form.ticker && !isEdit && (
              <p className="text-xs text-blue-600 mt-1">{form.name} ({form.ticker}) · {form.market}</p>
            )}
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}

            {/* 선택된 종목 최근 거래 히스토리 */}
            {form.ticker && !isEdit && tickerHistory.length > 0 && (
              <div className="mt-2 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 px-3 py-2 space-y-1">
                <div className="flex items-center gap-1 mb-1">
                  <History size={11} className="text-blue-400" />
                  <span className="text-[11px] font-medium text-blue-500 dark:text-blue-400">
                    {form.name} 최근 거래
                  </span>
                </div>
                {tickerHistory.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                    <span className="text-gray-400 w-20 shrink-0">{h.date}</span>
                    <span className={`font-medium shrink-0 ${h.action === 'buy' ? 'text-blue-600' : 'text-red-500'}`}>
                      {ACTION_LABEL[h.action]}
                    </span>
                    <span>{Number(h.price).toLocaleString('ko-KR')}원</span>
                    <span className="text-gray-400">×</span>
                    <span>{h.quantity}주</span>
                    {h.psychology && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
                        {h.psychology}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                autoComplete="off"
                value={formatNumDisplay(form.price)}
                onChange={(e) => set('price', parseNumInput(e.target.value, { allowDec: true }))}
                placeholder={lastTrade ? Number(lastTrade.price).toLocaleString('ko-KR') : '209,500'}
                className="mt-1"
              />
              {lastTrade && !form.price && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  최근: {Number(lastTrade.price).toLocaleString('ko-KR')}원
                </p>
              )}
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수량</label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatNumDisplay(form.quantity)}
                onChange={(e) => set('quantity', parseNumInput(e.target.value))}
                placeholder={lastTrade ? String(lastTrade.quantity) : '10'}
                className="mt-1"
              />
              {lastTrade && !form.quantity && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  최근: {lastTrade.quantity}주
                </p>
              )}
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>
          </div>

          {/* 수수료 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수수료 (선택)</label>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={formatNumDisplay(form.fee)}
              onChange={(e) => set('fee', parseNumInput(e.target.value, { allowDec: true }))}
              placeholder={lastTrade?.fee ? Number(lastTrade.fee).toLocaleString('ko-KR') : '예: 1,500'}
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
            <PsychologyFeedback psychology={form.psychology} action={form.action} />
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
                autoComplete="off"
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
              autoComplete="off"
              placeholder={lastTrade?.memo || '매매 이유, 시장 상황, 느낀 점 등 자유롭게...'}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {lastTrade?.memo && !form.memo && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                최근 메모: {lastTrade.memo}
              </p>
            )}
          </div>
        </div>
        )}

        <DialogFooter>
          {savedEntry ? (
            <Button onClick={handleClose}>닫기</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>취소</Button>
              <Button onClick={handleSubmit}>{isEdit ? '수정하기' : '저장'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
