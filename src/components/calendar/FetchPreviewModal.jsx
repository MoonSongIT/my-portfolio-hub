// 자동 탐색 결과 미리보기 모달 — 중복 감지·선택·일괄 저장

import { useMemo, useState, useEffect } from 'react'
import { useCalendarStore } from '../../store/calendarStore'
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

  // 기존 DB 이벤트 키 셋 — ticker|date 기준 중복 감지
  const existingKeys = useMemo(() => {
    const s = new Set()
    for (const e of existingEvents) {
      if (e.ticker) s.add(`${e.ticker}|${e.date}`)
    }
    return s
  }, [existingEvents])

  const [checked, setChecked] = useState(new Set())

  // 모달이 열릴 때마다 비중복 항목 전체 선택으로 초기화
  useEffect(() => {
    if (!open) return
    const initial = new Set()
    results.forEach((ev, i) => {
      const isDup = ev.ticker && existingKeys.has(`${ev.ticker}|${ev.date}`)
      if (!isDup) initial.add(i)
    })
    setChecked(initial)
  }, [open, results, existingKeys])

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
            </div>

            {/* 이벤트 목록 */}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {results.map((ev, i) => {
                const isDup = ev.ticker && existingKeys.has(`${ev.ticker}|${ev.date}`)
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
                        {/* 중복 경고 배지 */}
                        {isDup && (
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
