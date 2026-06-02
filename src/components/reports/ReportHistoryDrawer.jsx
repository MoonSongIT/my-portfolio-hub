// AI 리포트 히스토리 조회 Drawer
import { useState, useEffect, useCallback } from 'react'
import { getAllReportsByUser, deleteReport } from '../../utils/db'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../ui/sheet'
import { Loader2, Trash2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_LABEL = { weekly: '주간', monthly: '월간' }

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10).replace(/-/g, '.')
}

export default function ReportHistoryDrawer({ open, onClose, userId }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getAllReportsByUser(userId)
      setReports(data)
    } catch {
      toast.error('리포트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) {
      setSelected(null)
      load()
    }
  }, [open, load])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteReport(id)
      setReports(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) setSelected(null)
      toast.success('리포트가 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SheetTitle>AI 리포트 히스토리</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : selected ? (
          /* 리포트 상세 보기 */
          <div className="p-4 space-y-4">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-blue-500 hover:underline"
            >
              ← 목록으로
            </button>
            <div>
              <p className="text-xs text-gray-400 mb-1">
                {TYPE_LABEL[selected.type] ?? selected.type} · {formatDate(selected.createdAt)}
              </p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {selected.title}
              </p>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selected.data ?? selected.content}
              </div>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">저장된 리포트가 없습니다.</p>
            <p className="text-xs mt-1">AI 인사이트 탭에서 주간 리포트를 저장해보세요.</p>
          </div>
        ) : (
          /* 리포트 목록 */
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {reports.map((r) => (
              <li
                key={r.id}
                onClick={() => setSelected(r)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 font-medium">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.title}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={(e) => handleDelete(e, r.id)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
