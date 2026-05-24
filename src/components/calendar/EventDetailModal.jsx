// 증시 일정 상세 보기 모달 — 수정·삭제 진입점

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useCalendarStore } from '../../store/calendarStore'
import { useAuthStore } from '../../store/authStore'
import { useJournalStore } from '../../store/journalStore'
import { getByTicker } from '../../utils/stockMasterDb'
import EventBadge from './EventBadge'
import AddEventModal from './AddEventModal'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'

const IMPACT_LABELS = { low: '낮음', medium: '중간', high: '높음' }

export default function EventDetailModal({ open, onClose, event }) {
  const { deleteEvent } = useCalendarStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const journalEntries = useJournalStore(s => s.entries)
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!event) return null

  const handleDelete = async () => {
    try {
      await deleteEvent(currentUser?.id, event.id)
      toast.success('일정이 삭제되었습니다')
      onClose()
    } catch {
      toast.error('삭제에 실패했습니다')
    }
  }

  const handleClose = () => {
    setConfirmDelete(false)
    setShowEdit(false)
    onClose()
  }

  const handleOpenJournal = async () => {
    const ticker = event.ticker
    // 이벤트에 저장된 name·market 우선 사용 (AddEventModal에서 선택 시 저장됨)
    let name = event.name ?? ''
    let market = event.market ?? ''

    // fallback 1: 기존 일지에서 같은 ticker의 최근 항목
    if (!name || !market) {
      const prev = [...journalEntries].reverse().find(e => e.ticker === ticker)
      if (prev) {
        if (!name) name = prev.name ?? ''
        if (!market) market = prev.market ?? ''
      }
    }

    // fallback 2: stockMasterDb (이름/시장 여전히 없을 때)
    if (!name || !market) {
      try {
        const stock = await getByTicker(ticker)
        if (stock) {
          if (!name) name = stock.name ?? ''
          if (!market) market = stock.exchange ?? ''
        }
      } catch { /* DB 미구축 시 무시 */ }
    }

    handleClose()
    navigate('/journal', {
      state: { prefill: { ticker, name, market, date: event.date, memo: event.title } },
    })
  }

  return (
    <>
      <Dialog open={open && !showEdit} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {event.title}
              <EventBadge category={event.category} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-14 shrink-0">날짜</span>
              <span className="text-gray-900 dark:text-white">
                {event.date}{event.endDate ? ` ~ ${event.endDate}` : ''}
              </span>
            </div>
            {event.ticker && (
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 w-14 shrink-0">종목</span>
                <span className="text-gray-900 dark:text-white">
                  {event.name ? `${event.name} (${event.ticker})` : event.ticker}
                </span>
              </div>
            )}
            {event.impact && (
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 w-14 shrink-0">중요도</span>
                <span className="text-gray-900 dark:text-white">{IMPACT_LABELS[event.impact] ?? event.impact}</span>
              </div>
            )}
            {event.memo && (
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 w-14 shrink-0">메모</span>
                <span className="text-gray-900 dark:text-white whitespace-pre-wrap">{event.memo}</span>
              </div>
            )}
          </div>

          {confirmDelete ? (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 text-sm text-red-800 dark:text-red-300">
              <p className="mb-3 font-medium">이 일정을 삭제하시겠습니까?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>취소</Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>삭제</Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-1" />삭제
              </Button>
              {event.ticker && (
                <Button variant="outline" size="sm" onClick={handleOpenJournal}>
                  <BookOpen className="h-4 w-4 mr-1" />일지 작성
                </Button>
              )}
              <Button size="sm" onClick={() => setShowEdit(true)}>
                <Pencil className="h-4 w-4 mr-1" />수정
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AddEventModal
        open={showEdit}
        onClose={() => { setShowEdit(false); onClose() }}
        editData={event}
      />
    </>
  )
}
