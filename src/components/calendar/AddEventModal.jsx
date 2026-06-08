// 증시 일정 추가·수정 모달 — 날짜, 제목, 카테고리, 종목 검색, 임팩트, 메모

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useCalendarStore } from '../../store/calendarStore'
import { useAuthStore } from '../../store/authStore'
import { useStockSearch } from '../../hooks/useStockData'
import { useDebounce } from '../../hooks/useDebounce'
import { CATEGORY_COLORS } from './EventBadge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const CATEGORIES = Object.entries(CATEGORY_COLORS).map(([value, c]) => ({ value, label: c.label }))
const IMPACTS = [
  { value: '', label: '없음' },
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '중간' },
  { value: 'high', label: '높음' },
]

const today = () => new Date().toISOString().split('T')[0]

export default function AddEventModal({ open, onClose, editData = null, initialDate = null }) {
  const { addEvent, updateEvent } = useCalendarStore()
  const currentUser = useAuthStore(s => s.currentUser)

  const [form, setForm] = useState({
    date: today(), endDate: '', title: '', category: 'earnings',
    impact: '', ticker: '', name: '', market: '', memo: '',
  })
  const [errors, setErrors] = useState({})
  const [tickerQuery, setTickerQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const debouncedQuery = useDebounce(tickerQuery, 300)
  const { data: searchResults } = useStockSearch(debouncedQuery)

  const isEdit = !!editData

  useEffect(() => {
    if (!open) return
    if (editData) {
      setForm({
        date: editData.date ?? today(),
        endDate: editData.endDate ?? '',
        title: editData.title ?? '',
        category: editData.category ?? 'earnings',
        impact: editData.impact ?? '',
        ticker: editData.ticker ?? '',
        name: editData.name ?? '',
        market: editData.market ?? '',
        memo: editData.memo ?? '',
      })
      // 기존 이벤트에 name이 있으면 "이름 (티커)" 형태로, 없으면 ticker만 표시
      setTickerQuery(editData.name
        ? `${editData.name} (${editData.ticker ?? ''})`
        : (editData.ticker ?? '')
      )
    } else {
      setForm({
        date: initialDate ?? today(),
        endDate: '', title: '', category: 'earnings',
        impact: '', ticker: '', name: '', market: '', memo: '',
      })
      setTickerQuery('')
    }
    setErrors({})
    setShowSearch(false)
  }, [open, editData, initialDate])

  const validate = () => {
    const errs = {}
    if (!form.date) errs.date = '날짜를 입력하세요'
    if (!form.title.trim()) errs.title = '제목을 입력하세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const userId = currentUser?.id
    if (!userId) { toast.error('로그인이 필요합니다'); return }

    const data = {
      date: form.date,
      endDate: form.endDate || null,
      title: form.title.trim(),
      category: form.category,
      impact: form.impact || null,
      ticker: form.ticker.trim().toUpperCase() || null,
      name: form.name.trim() || null,
      market: form.market || null,
      memo: form.memo.trim() || null,
    }

    try {
      if (isEdit) {
        await updateEvent(userId, editData.id, data)
        toast.success('일정이 수정되었습니다')
      } else {
        await addEvent(userId, data)
        toast.success('일정이 추가되었습니다')
      }
      onClose()
    } catch {
      toast.error('저장에 실패했습니다')
    }
  }

  const handleSelectTicker = (item) => {
    setForm(prev => ({ ...prev, ticker: item.ticker, name: item.name ?? '', market: item.market ?? '' }))
    // 입력창에 "종목명 (티커)" 형태로 표시
    setTickerQuery(item.name ? `${item.name} (${item.ticker})` : item.ticker)
    setShowSearch(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '일정 수정' : '일정 추가'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 날짜 + 종료일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">날짜 *</label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="mt-1"
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종료일 (선택)</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">제목 *</label>
            <Input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 삼성전자 4분기 실적 발표"
              className="mt-1"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* 카테고리 + 임팩트 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-category" className="text-sm font-medium text-gray-700 dark:text-gray-300">카테고리</label>
              <select
                id="event-category"
                name="category"
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="event-impact" className="text-sm font-medium text-gray-700 dark:text-gray-300">중요도</label>
              <select
                id="event-impact"
                name="impact"
                value={form.impact}
                onChange={e => setForm(prev => ({ ...prev, impact: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {IMPACTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {/* 종목 검색 */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목 (선택)</label>
            <Input
              value={tickerQuery}
              onChange={e => {
                setTickerQuery(e.target.value)
                setShowSearch(true)
                setForm(prev => ({ ...prev, ticker: '', name: '', market: '' }))
              }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
              placeholder="예: 삼성전자, AAPL"
              className="mt-1"
            />
            {showSearch && searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {searchResults.map(item => (
                  <button
                    key={item.ticker}
                    onMouseDown={() => handleSelectTicker(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-gray-500">{item.ticker} · {item.market}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label htmlFor="event-memo" className="text-sm font-medium text-gray-700 dark:text-gray-300">메모 (선택)</label>
            <textarea
              id="event-memo"
              name="memo"
              value={form.memo}
              onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
              placeholder="추가 메모"
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit}>{isEdit ? '수정하기' : '추가하기'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
