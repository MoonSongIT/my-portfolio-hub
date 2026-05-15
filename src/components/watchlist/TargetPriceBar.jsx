// 목표가·손절가·매입가 달성률 프로그레스 바 (알림과 독립)
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWatchlistStore } from '../../store/watchlistStore'
import { formatCurrency } from '../../utils/formatters'

export default function TargetPriceBar({ stock }) {
  const { updateWatchlistTargets } = useWatchlistStore()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    targetPrice: stock.targetPrice ?? '',
    stopLoss: stock.stopLoss ?? '',
    entryPrice: stock.entryPrice ?? '',
  })

  const currentPrice = stock.currentPrice ?? 0
  const currency = stock.currency || 'KRW'

  const hasAnyTarget = stock.targetPrice || stock.stopLoss || stock.entryPrice

  const handleSave = () => {
    updateWatchlistTargets(stock.ticker, {
      targetPrice: draft.targetPrice !== '' ? Number(draft.targetPrice) : null,
      stopLoss: draft.stopLoss !== '' ? Number(draft.stopLoss) : null,
      entryPrice: draft.entryPrice !== '' ? Number(draft.entryPrice) : null,
    })
    setOpen(false)
  }

  // 목표가 달성률 계산
  const progressPct = (() => {
    if (!stock.targetPrice || !currentPrice) return null
    const base = stock.entryPrice || stock.priceAtAdded || currentPrice
    if (!base || base === stock.targetPrice) return null
    const pct = ((currentPrice - base) / (stock.targetPrice - base)) * 100
    return Math.round(pct)
  })()

  const aboveTarget = stock.targetPrice && currentPrice >= stock.targetPrice
  const belowStopLoss = stock.stopLoss && currentPrice <= stock.stopLoss

  return (
    <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
      {/* 요약 행 — 항상 표시 */}
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

      {/* 달성률 바 */}
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

      {/* 입력 폼 — 펼침 시 */}
      {open && (
        <div className="mt-2 space-y-1.5">
          {[
            { key: 'entryPrice', label: '매입가' },
            { key: 'targetPrice', label: '목표가' },
            { key: 'stopLoss', label: '손절가' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-[11px] text-gray-500 w-12 shrink-0">{label}</label>
              <input
                type="number"
                value={draft[key]}
                onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                placeholder={currency === 'KRW' ? '예: 75000' : '예: 195.5'}
                className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-400"
              />
            </div>
          ))}
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
