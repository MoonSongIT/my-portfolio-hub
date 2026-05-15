// 목표가·손절가·매입가 달성률 프로그레스 바 (알림과 독립)
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWatchlistStore } from '../../store/watchlistStore'
import { formatCurrency } from '../../utils/formatters'

// 천단위 콤마 포맷 (소수점 보존, 빈값·부호 그대로)
function toComma(val) {
  const s = String(val ?? '').replace(/,/g, '')
  if (s === '' || s === '-') return s
  const negative = s.startsWith('-')
  const abs = negative ? s.slice(1) : s
  const [int, dec] = abs.split('.')
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (negative ? '-' : '') + formatted + (dec !== undefined ? '.' + dec : '')
}

// 콤마 제거 후 숫자 (NaN이면 null)
function fromComma(val) {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''))
  return isNaN(n) ? null : n
}

// KRW 정수 반올림, USD 소수점 2자리
function roundPrice(price, currency) {
  return currency === 'KRW' ? Math.round(price) : Math.round(price * 100) / 100
}

// 두 가격으로 % 계산 → 문자열
function pctFromPrices(price, entry) {
  if (!entry || entry === 0) return ''
  const pct = ((price - entry) / entry) * 100
  return isFinite(pct) ? String(Math.round(pct * 10) / 10) : ''
}

// % + 매입가로 가격 계산 → 숫자 or null
function priceFromPct(pct, entry, currency) {
  const p = parseFloat(pct)
  if (isNaN(p) || !entry || entry === 0) return null
  return roundPrice(entry * (1 + p / 100), currency)
}

export default function TargetPriceBar({ stock }) {
  const { updateWatchlistTargets } = useWatchlistStore()
  const [open, setOpen] = useState(false)

  // draft: 콤마 없는 숫자 문자열로 보관
  const [draft, setDraft] = useState({
    entryPrice:   stock.entryPrice  != null ? String(stock.entryPrice)  : '',
    targetPrice:  stock.targetPrice != null ? String(stock.targetPrice) : '',
    targetPct:    '',
    stopLoss:     stock.stopLoss    != null ? String(stock.stopLoss)    : '',
    stopLossPct:  '',
  })

  const currency     = stock.currency || 'KRW'
  const currentPrice = stock.currentPrice ?? 0
  const hasAnyTarget = stock.targetPrice || stock.stopLoss || stock.entryPrice

  // ── 입력 핸들러 ────────────────────────────────────────────────

  // 매입가 변경 → 목표가·손절가 % 재계산
  const handleEntryChange = (raw) => {
    const digits = raw.replace(/[^\d.]/g, '')
    const entry  = fromComma(digits)
    const target = fromComma(draft.targetPrice)
    const stop   = fromComma(draft.stopLoss)

    setDraft(d => ({
      ...d,
      entryPrice:   digits,
      targetPct:    entry && target   ? pctFromPrices(target, entry) : d.targetPct,
      stopLossPct:  entry && stop     ? pctFromPrices(stop,   entry) : d.stopLossPct,
    }))
  }

  // 가격 직접 입력 → % 자동 계산
  const handlePriceChange = (priceKey, pctKey, raw) => {
    const digits = raw.replace(/[^\d.]/g, '')
    const price  = fromComma(digits)
    const entry  = fromComma(draft.entryPrice)

    setDraft(d => ({
      ...d,
      [priceKey]: digits,
      [pctKey]:   price && entry ? pctFromPrices(price, entry) : d[pctKey],
    }))
  }

  // % 입력 → 가격 자동 계산 (음수·소수 허용)
  const handlePctChange = (priceKey, pctKey, raw) => {
    const cleaned  = raw.replace(/[^\d.\-]/g, '')
    const entry    = fromComma(draft.entryPrice)
    const newPrice = priceFromPct(cleaned, entry, currency)

    setDraft(d => ({
      ...d,
      [pctKey]:   cleaned,
      [priceKey]: newPrice != null ? String(newPrice) : d[priceKey],
    }))
  }

  const handleSave = () => {
    updateWatchlistTargets(stock.ticker, {
      targetPrice: fromComma(draft.targetPrice),
      stopLoss:    fromComma(draft.stopLoss),
      entryPrice:  fromComma(draft.entryPrice),
    })
    setOpen(false)
  }

  // ── 달성률 계산 ────────────────────────────────────────────────
  const progressPct = (() => {
    if (!stock.targetPrice || !currentPrice) return null
    const base = stock.entryPrice || stock.priceAtAdded || currentPrice
    if (!base || base === stock.targetPrice) return null
    const pct = ((currentPrice - base) / (stock.targetPrice - base)) * 100
    return Math.round(pct)
  })()

  const aboveTarget  = stock.targetPrice && currentPrice >= stock.targetPrice
  const belowStopLoss = stock.stopLoss   && currentPrice <= stock.stopLoss

  // 공용 클래스
  const priceInputCls =
    'flex-1 min-w-0 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-400'
  const pctInputCls =
    'w-16 text-xs px-2 py-1 pr-5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-400 text-right'

  return (
    <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">

      {/* ── 요약 행 ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <span className="flex items-center gap-1.5">
          {hasAnyTarget ? (
            <>
              {stock.targetPrice && (
                <span className="flex items-center gap-0.5">
                  목표 {formatCurrency(stock.targetPrice, currency)}
                  {aboveTarget && <span className="text-red-500 font-bold ml-0.5">✓</span>}
                </span>
              )}
              {stock.stopLoss && (
                <span className={`flex items-center gap-0.5 ml-1.5 ${belowStopLoss ? 'text-blue-500 font-semibold' : ''}`}>
                  · 손절 {formatCurrency(stock.stopLoss, currency)}
                  <span className="ml-0.5">{belowStopLoss ? '⚠️' : '✅'}</span>
                </span>
              )}
            </>
          ) : (
            <span className="italic opacity-60">목표가 설정</span>
          )}
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* ── 달성률 바 ───────────────────────────────────────── */}
      {progressPct !== null && !open && (
        <div className="mt-1.5">
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>{aboveTarget ? '목표 초과' : `${Math.min(progressPct, 100)}%`}</span>
            <span className={aboveTarget ? 'text-red-500 font-semibold' : ''}>
              {aboveTarget ? `+${progressPct - 100}% 초과` : `${100 - progressPct}% 남음`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${aboveTarget ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(Math.max(progressPct, 0), 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 입력 폼 ─────────────────────────────────────────── */}
      {open && (
        <div className="mt-2 space-y-1.5">

          {/* 매입가 */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 w-12 shrink-0">매입가</label>
            <input
              type="text"
              inputMode="numeric"
              value={toComma(draft.entryPrice)}
              onChange={e => handleEntryChange(e.target.value)}
              placeholder={currency === 'KRW' ? '75,000' : '195.50'}
              className={priceInputCls}
            />
          </div>

          {/* 목표가 + % */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 w-12 shrink-0">목표가</label>
            <input
              type="text"
              inputMode="numeric"
              value={toComma(draft.targetPrice)}
              onChange={e => handlePriceChange('targetPrice', 'targetPct', e.target.value)}
              placeholder={currency === 'KRW' ? '90,000' : '234.60'}
              className={priceInputCls}
            />
            <div className="relative flex-shrink-0">
              <input
                type="text"
                inputMode="decimal"
                value={draft.targetPct}
                onChange={e => handlePctChange('targetPrice', 'targetPct', e.target.value)}
                placeholder="+20"
                className={pctInputCls}
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
            </div>
          </div>

          {/* 손절가 + % */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 w-12 shrink-0">손절가</label>
            <input
              type="text"
              inputMode="numeric"
              value={toComma(draft.stopLoss)}
              onChange={e => handlePriceChange('stopLoss', 'stopLossPct', e.target.value)}
              placeholder={currency === 'KRW' ? '65,000' : '175.95'}
              className={priceInputCls}
            />
            <div className="relative flex-shrink-0">
              <input
                type="text"
                inputMode="decimal"
                value={draft.stopLossPct}
                onChange={e => handlePctChange('stopLoss', 'stopLossPct', e.target.value)}
                placeholder="-10"
                className={pctInputCls}
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
            </div>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 text-xs py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
