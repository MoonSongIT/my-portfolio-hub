// +N more 클릭 시 나타나는 날짜별 일정 팝업 — 스크롤·체크박스·일괄 삭제 지원

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import EventBadge from './EventBadge'

const IMPACT_STARS  = { high: '★★★', medium: '★★', low: '★' }
const IMPACT_COLORS = {
  high:   'text-red-500 dark:text-red-400',
  medium: 'text-yellow-500 dark:text-yellow-400',
  low:    'text-green-500 dark:text-green-400',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`
}

export default function DayEventsModal({ open, date, events = [], onClose, onDelete }) {
  const [checked, setChecked] = useState(new Set())

  // 모달이 열릴 때마다 선택 초기화
  useEffect(() => {
    if (!open) return
    setChecked(new Set())
  }, [open, date])

  const allSelected  = events.length > 0 && checked.size === events.length
  const someSelected = checked.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) setChecked(new Set())
    else setChecked(new Set(events.map(e => e.id)))
  }

  const toggleOne = (id) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDelete = () => {
    if (checked.size === 0) return
    onDelete([...checked])
    setChecked(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{formatDate(date)} 일정</DialogTitle>
        </DialogHeader>

        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            일정이 없습니다.
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
                전체 선택 ({events.length}건)
              </span>
            </div>

            {/* 스크롤 가능한 이벤트 목록 */}
            <div className="overflow-y-auto flex-1 max-h-80 space-y-1 pr-1">
              {events.map(ev => (
                <label
                  key={ev.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    checked.has(ev.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(ev.id)}
                    onChange={() => toggleOne(ev.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <EventBadge category={ev.category} />
                      {ev.impact && (
                        <span className={`text-[11px] font-medium ${IMPACT_COLORS[ev.impact] ?? ''}`}>
                          {IMPACT_STARS[ev.impact]}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {ev.title}
                    </p>
                    {ev.ticker && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {ev.ticker}
                        {ev.market && <span className="ml-1 text-gray-400">· {ev.market}</span>}
                      </p>
                    )}
                    {ev.memo && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 leading-tight mt-0.5">
                        {ev.memo}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="pt-3 border-t border-gray-200 dark:border-gray-700 gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={checked.size === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            선택 삭제 ({checked.size}건)
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
