import { useState, useEffect, useMemo } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useUserAccounts } from '../../store/accountStore'
import { SECTORS, MARKETS } from '../../data/samplePortfolio'
import { useStockSearch, useStockPrice } from '../../hooks/useStockData'
import { useDebounce } from '../../hooks/useDebounce'
import { formatCurrency } from '../../utils/formatters'
import { getByTicker, stockMasterDb } from '../../utils/stockMasterDb'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { AlertTriangle } from 'lucide-react'

const INITIAL_FORM = {
  accountId: '',
  ticker: '',
  name: '',
  market: 'KRX',
  quantity: '',
  avgPrice: '',
  currentPrice: '',
  sector: 'IT',
  currency: 'KRW',
}

export default function AddStockModal({ open, onClose, editStock = null }) {
  const { addHolding, updateHolding } = usePortfolioStore()
  const rawAccounts = useUserAccounts()
  const accounts = useMemo(() => rawAccounts.map(a => ({
    id: a.id,
    accountName: a.name,
    accountType: a.type,
    holdings: [],
  })), [rawAccounts])
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [masterWarn, setMasterWarn] = useState(false) // 마스터 DB 미존재 경고
  const isEdit = !!editStock

  const debouncedSearch = useDebounce(searchQuery, 300)
  const { data: searchResults } = useStockSearch(debouncedSearch)

  // 선택 종목 실시간 가격 조회
  const { data: liveQuote } = useStockPrice(
    !isEdit && form.ticker ? form.ticker : null,
    form.market
  )

  // 수정 모드: 기존 데이터 채우기
  useEffect(() => {
    if (editStock) {
      setForm({
        accountId: editStock.accountId || (accounts[0]?.id ?? ''),
        ticker: editStock.ticker,
        name: editStock.name,
        market: editStock.market,
        quantity: String(editStock.quantity),
        avgPrice: String(editStock.avgPrice),
        currentPrice: String(editStock.currentPrice),
        sector: editStock.sector,
        currency: editStock.currency,
      })
      setShowSearch(false)
    } else {
      setForm({
        ...INITIAL_FORM,
        accountId: accounts[0]?.id ?? '',
      })
      setShowSearch(true)
    }
    setErrors({})
    setSearchQuery('')
    setMasterWarn(false)
  }, [editStock, open, accounts])

  // 실시간 가격 자동 반영
  useEffect(() => {
    if (liveQuote && !isEdit && form.ticker) {
      setForm(prev => ({
        ...prev,
        currentPrice: String(liveQuote.currentPrice),
      }))
    }
  }, [liveQuote, isEdit, form.ticker])

  // 검색 결과 선택
  const handleSelectSearch = (item) => {
    setForm(prev => ({
      ...prev,
      ticker: item.ticker,
      name: item.name,
      market: item.market,
      currency: (item.market === 'NYSE' || item.market === 'NASDAQ') ? 'USD' : 'KRW',
    }))
    setSearchQuery('')
    setShowSearch(false)
    setMasterWarn(false) // 검색 선택 시 경고 해제 (마스터 DB 결과이므로)
  }

  // 티커 직접 입력 시 마스터 DB 검증
  // DB가 비어있으면(미동기화) 경고 없이 통과, DB에 데이터가 있을 때만 검증
  const handleTickerBlur = async () => {
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker || isEdit) return
    try {
      const total = await stockMasterDb.stocks.count()
      if (total === 0) { setMasterWarn(false); return }
      const found = await getByTicker(ticker)
      setMasterWarn(!found)
    } catch { setMasterWarn(false) }
  }

  const handleMarketChange = (market) => {
    setForm(prev => ({
      ...prev,
      market,
      currency: (market === 'NYSE' || market === 'NASDAQ') ? 'USD' : 'KRW',
    }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.accountId) newErrors.accountId = '계좌를 선택하세요'
    if (!form.ticker.trim()) newErrors.ticker = '티커를 입력하세요'
    if (!form.name.trim()) newErrors.name = '종목명을 입력하세요'
    if (!form.quantity || Number(form.quantity) <= 0) newErrors.quantity = '수량을 입력하세요'
    if (!form.avgPrice || Number(form.avgPrice) <= 0) newErrors.avgPrice = '매수가를 입력하세요'
    if (!form.currentPrice || Number(form.currentPrice) <= 0) newErrors.currentPrice = '현재가를 입력하세요'

    if (!isEdit && form.accountId) {
      const acc = accounts.find(a => a.id === form.accountId)
      if (acc?.holdings.some(h => h.ticker === form.ticker.trim().toUpperCase())) {
        newErrors.ticker = '해당 계좌에 이미 존재하는 종목입니다'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    const stockData = {
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim(),
      market: form.market,
      quantity: Number(form.quantity),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.currentPrice),
      sector: form.sector,
      currency: form.currency,
    }

    if (isEdit) {
      updateHolding(editStock.accountId, editStock.ticker, stockData)
    } else {
      addHolding(form.accountId, stockData)
    }

    setForm(INITIAL_FORM)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '종목 수정' : '종목 추가'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 계좌 선택 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">계좌</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm(prev => ({ ...prev, accountId: e.target.value }))}
              disabled={isEdit}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">계좌를 선택하세요</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.accountType})
                </option>
              ))}
            </select>
            {errors.accountId && <p className="text-red-500 text-xs mt-1">{errors.accountId}</p>}
          </div>

          {/* 종목 검색 (추가 모드에서만) */}
          {!isEdit && (
            <div className="relative">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목 검색</label>
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)}
                placeholder="검색어 입력 (예: 삼성전자, AAPL)"
                className="mt-1"
              />
              {/* 자동완성 드롭다운 */}
              {showSearch && searchResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  {searchResults.map((item) => (
                    <button
                      key={item.ticker}
                      onClick={() => handleSelectSearch(item)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-gray-500">{item.ticker} · {item.market}</span>
                    </button>
                  ))}
                </div>
              )}
              {showSearch && debouncedSearch && searchResults?.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
                  <p className="text-sm text-gray-400">검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          )}

          {/* 마스터 DB 미존재 경고 배너 */}
          {masterWarn && !isEdit && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>검증되지 않은 종목입니다. 설정 페이지에서 종목 DB를 업데이트하면 더 정확한 정보를 확인할 수 있습니다.</span>
            </div>
          )}

          {/* 티커 + 종목명 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">티커</label>
              <Input
                value={form.ticker}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, ticker: e.target.value }))
                  setMasterWarn(false)
                }}
                onBlur={handleTickerBlur}
                placeholder="005930"
                disabled={isEdit}
                className="mt-1"
              />
              {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목명</label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="삼성전자"
                className="mt-1"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
          </div>

          {/* 시장 + 섹터 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">시장</label>
              <select
                value={form.market}
                onChange={(e) => handleMarketChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">섹터</label>
              <select
                value={form.sector}
                onChange={(e) => setForm(prev => ({ ...prev, sector: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수량</label>
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="100"
              min="1"
              className="mt-1"
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
          </div>

          {/* 평균매수가 + 현재가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                평균매수가 ({form.currency})
              </label>
              <Input
                type="number"
                value={form.avgPrice}
                onChange={(e) => setForm(prev => ({ ...prev, avgPrice: e.target.value }))}
                placeholder="68500"
                min="0"
                step="any"
                className="mt-1"
              />
              {errors.avgPrice && <p className="text-red-500 text-xs mt-1">{errors.avgPrice}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                현재가 ({form.currency})
              </label>
              <Input
                type="number"
                value={form.currentPrice}
                onChange={(e) => setForm(prev => ({ ...prev, currentPrice: e.target.value }))}
                placeholder="72000"
                min="0"
                step="any"
                className="mt-1"
              />
              {liveQuote && !isEdit && (
                <p className="text-xs text-blue-600 mt-0.5">
                  실시간: {formatCurrency(liveQuote.currentPrice, liveQuote.currency)}
                </p>
              )}
              {errors.currentPrice && <p className="text-red-500 text-xs mt-1">{errors.currentPrice}</p>}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            통화: {form.currency} (시장에 따라 자동 설정)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit}>{isEdit ? '수정하기' : '추가하기'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
