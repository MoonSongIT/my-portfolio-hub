/**
 * CustomStockForm.jsx — 커스텀 종목 추가/삭제 UI
 *
 * IDB(StockMasterDB)에 isCustom=true 종목 직접 CRUD.
 * stockDbStore(구 localStorage) 와 무관하게 동작합니다.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Tag } from 'lucide-react'
import { toast } from 'sonner'
import {
  addCustom,
  removeCustom,
  stockMasterDb,
} from '@/utils/stockMasterDb'
import { EXCHANGES, EXCHANGE_LABELS } from '@/api/stockMasterApi'

// category → exchange 옵션 매핑
const CATEGORY_OPTIONS = [
  { value: 'DOMESTIC', label: '국내' },
  { value: 'OVERSEAS', label: '해외' },
]

const EXCHANGE_OPTIONS = {
  DOMESTIC: EXCHANGES.DOMESTIC.map(ex => ({ value: ex, label: EXCHANGE_LABELS[ex] })),
  OVERSEAS: EXCHANGES.OVERSEAS.map(ex => ({ value: ex, label: EXCHANGE_LABELS[ex] })),
}

const TYPE_OPTIONS = [
  { value: 'EQUITY', label: '주식' },
  { value: 'ETF',    label: 'ETF' },
  { value: 'ETN',    label: 'ETN' },
  { value: 'REIT',   label: 'REIT' },
]

const INPUT_CLASS =
  'px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500'

const INITIAL_FORM = { ticker: '', name: '', category: 'OVERSEAS', exchange: 'NASDAQ', type: 'EQUITY' }

export default function CustomStockForm({ onChanged }) {
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(INITIAL_FORM)
  const [customRows, setCustomRows] = useState([])
  const [loading, setLoading]       = useState(false)

  // ── IDB에서 커스텀 종목 로드 ─────────────────────────────────────────────
  const loadCustomRows = useCallback(async () => {
    try {
      const rows = await stockMasterDb.stocks
        .filter(r => r.isCustom === true)
        .toArray()
      // 이름순 정렬
      rows.sort((a, b) => a.name.localeCompare(b.name))
      setCustomRows(rows)
    } catch (err) {
      console.warn('[CustomStockForm] 커스텀 종목 로드 실패:', err.message)
    }
  }, [])

  useEffect(() => { loadCustomRows() }, [loadCustomRows])

  // category 변경 시 exchange 초기화
  const handleCategoryChange = (e) => {
    const cat = e.target.value
    const firstEx = EXCHANGE_OPTIONS[cat]?.[0]?.value || 'NASDAQ'
    setForm(f => ({ ...f, category: cat, exchange: firstEx }))
  }

  // ── 추가 ─────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const { ticker, name, category, exchange, type } = form
    if (!ticker.trim() || !name.trim()) {
      toast.error('티커와 종목명을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const added = await addCustom({
        ticker:   ticker.trim().toUpperCase(),
        name:     name.trim(),
        category,
        exchange,
        type,
      })

      if (!added) {
        toast.error('이미 등록된 티커입니다.')
        return
      }

      toast.success(`${ticker.trim().toUpperCase()} 추가됨`)
      setForm(INITIAL_FORM)
      setShowForm(false)
      await loadCustomRows()
      onChanged?.()
    } catch (err) {
      toast.error(`추가 실패: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────
  const handleRemove = async (row) => {
    try {
      const removed = await removeCustom(row.id)
      if (removed) {
        toast.success(`${row.ticker} 삭제됨`)
        await loadCustomRows()
        onChanged?.()
      }
    } catch (err) {
      toast.error(`삭제 실패: ${err.message}`)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">커스텀 종목</p>
          {customRows.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">
              {customRows.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          종목 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* 티커 */}
            <input
              type="text"
              placeholder="티커 (예: TSLA)"
              value={form.ticker}
              onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
              className={INPUT_CLASS}
            />
            {/* 종목명 */}
            <input
              type="text"
              placeholder="종목명 (예: Tesla Inc.)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={INPUT_CLASS}
            />
            {/* 국내/해외 */}
            <select
              value={form.category}
              onChange={handleCategoryChange}
              className={INPUT_CLASS}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* 거래소 */}
            <select
              value={form.exchange}
              onChange={e => setForm(f => ({ ...f, exchange: e.target.value }))}
              className={INPUT_CLASS}
            >
              {(EXCHANGE_OPTIONS[form.category] || []).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* 유형 */}
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className={INPUT_CLASS}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {/* 추가 버튼 */}
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* 커스텀 종목 목록 */}
      {customRows.length > 0 ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {customRows.map(row => (
            <div key={row.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {row.ticker}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {row.name}
                </span>
                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                  {EXCHANGE_LABELS[row.exchange] || row.exchange}
                </span>
              </div>
              <button
                onClick={() => handleRemove(row)}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-red-500 transition"
                title="삭제"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          추가된 커스텀 종목이 없습니다.
        </p>
      )}
    </div>
  )
}
