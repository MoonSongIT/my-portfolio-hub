// 자동 탐색 결과 미리보기 모달 — 중복 감지·선택·일괄 저장

import { useMemo, useState, useEffect } from 'react'
import { useCalendarStore } from '../../store/calendarStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'

const SOURCE_BADGE = {
  dart:    'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300',
  finnhub: 'bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300',
}

const CATEGORY_BADGE = {
  dividend: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  earnings: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  ipo:      'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

const CATEGORY_LABEL = { dividend: '배당', earnings: '실적', ipo: 'IPO' }
const SOURCE_LABEL   = { dart: 'DART', finnhub: 'Finnhub' }

export default function FetchPreviewModal({ open, onClose, onConfirm, results = [] }) {
  const existingEvents = useCalendarStore(s => s.events)
  const watchlist = useWatchlistStore(s => s.watchlist)
  const getSelectedHoldings = usePortfolioStore(s => s.getSelectedHoldings)

  // 기존 DB 이벤트 맵 — ticker|date|category 기준 중복/업데이트 감지
  const existingMap = useMemo(() => {
    const m = new Map()
    for (const e of existingEvents) {
      if (e.ticker) m.set(`${e.ticker}|${e.date}|${e.category}`, e)
    }
    return m
  }, [existingEvents])

  // 관심종목 + 보유종목 ticker 합집합
  const relevantTickers = useMemo(() => {
    const s = new Set(watchlist.map(w => w.ticker))
    try { getSelectedHoldings().forEach(h => s.add(h.ticker)) } catch { /* 포트폴리오 없음 */ }
    return s
  }, [watchlist, getSelectedHoldings])

  const [checked, setChecked] = useState(new Set())

  // 모달이 열릴 때 관심/보유 종목 자동 선택
  useEffect(() => {
    if (!open) return
    const autoChecked = new Set()
    results.forEach((ev, i) => {
      if (ev.ticker && relevantTickers.has(ev.ticker)) autoChecked.add(i)
    })
    setChecked(autoChecked)
  }, [open, results]) // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 선택된 항목 중 관심/보유 종목 수
  const relevantCheckedCount = useMemo(
    () => results.filter((ev, i) => checked.has(i) && ev.ticker && relevantTickers.has(ev.ticker)).length,
    [checked, results, relevantTickers]
  )

  const allSelected  = results.length > 0 && checked.size === results.length
  const someSelected = checked.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setChecked(new Set())
    } else {
      setChecked(new Set(results.map((_, i) => i)))
    }
  }

  const toggleOne = (i) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleConfirm = () => {
    const selected = results.filter((_, i) => checked.has(i))
    onConfirm(selected)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>자동 탐색 결과</DialogTitle>
        </DialogHeader>

        {results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            탐색된 이벤트가 없습니다.
          </p>
        ) : (
          <>
            {/* 전체 선택 헤더 */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                전체 선택 ({results.length}건)
              </span>
              {relevantCheckedCount > 0 && (
                <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">
                  관심/보유 종목 {relevantCheckedCount}개 선택됨
                </span>
              )}
            </div>

            {/* 이벤트 목록 */}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {results.map((ev, i) => {
                const existingEv   = ev.ticker ? existingMap.get(`${ev.ticker}|${ev.date}|${ev.category}`) : null
                const isUpdatable  = existingEv && !existingEv.name   // 기존 있고 name 없음 → 업데이트 가능
                const isDuplicate  = existingEv && !!existingEv.name  // 기존 있고 name 있음 → 완전 중복
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      checked.has(i)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => toggleOne(i)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        {/* 출처 배지 */}
                        {ev.source && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[ev.source] ?? 'bg-gray-100 text-gray-700'}`}>
                            {SOURCE_LABEL[ev.source] ?? ev.source}
                          </span>
                        )}
                        {/* 카테고리 배지 */}
                        {ev.category && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_BADGE[ev.category] ?? 'bg-gray-100 text-gray-700'}`}>
                            {CATEGORY_LABEL[ev.category] ?? ev.category}
                          </span>
                        )}
                        {/* 업데이트 배지 — 기존 저장됐지만 name 없어 보완 가능 */}
                        {isUpdatable && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                            업데이트
                          </span>
                        )}
                        {/* 중복 경고 배지 — 기존에 name까지 있음 */}
                        {isDuplicate && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                            중복
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {ev.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {ev.date}
                        {ev.ticker && <span className="ml-2 font-mono">{ev.ticker}</span>}
                        {ev.market && <span className="ml-1 text-gray-400">· {ev.market}</span>}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleConfirm}
            disabled={checked.size === 0}
          >
            선택 저장 ({checked.size}건)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
