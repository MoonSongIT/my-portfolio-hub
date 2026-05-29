// 동기화 충돌 해결 모달 — 서버/로컬 버전 선택 UI
import { useSyncStore } from '@/store/syncStore'
import { syncService } from '@/services/syncService'
import { Button } from '../ui/button'

const TABLE_LABELS = {
  transactions: '거래 내역',
  cashFlows: '자금 흐름',
  calendarEvents: '증시 일정',
}

export default function ConflictModal() {
  const conflicts = useSyncStore((s) => s.conflicts)
  const clearConflicts = useSyncStore((s) => s.clearConflicts)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)

  if (conflicts.length === 0) return null

  const conflict = conflicts[0]
  const tableLabel = TABLE_LABELS[conflict.table] ?? conflict.table

  const handleKeepServer = async () => {
    try {
      await syncService.downloadFromServer(lastSyncedAt)
    } finally {
      clearConflicts()
    }
  }

  const handleKeepLocal = async () => {
    try {
      await syncService.uploadPending()
    } finally {
      clearConflicts()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">동기화 충돌 발생</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span className="font-medium text-yellow-600">{tableLabel}</span>에서 서버와 로컬 데이터가 충돌했습니다.
          어느 버전을 유지할지 선택하세요.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">서버 버전</p>
            <p className="text-gray-600 dark:text-gray-400">v{conflict.serverVersion ?? '?'}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <p className="font-semibold text-orange-700 dark:text-orange-300 mb-1">로컬 버전</p>
            <p className="text-gray-600 dark:text-gray-400">v{conflict.localVersion ?? '?'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={handleKeepServer}>
            서버 버전 유지 (로컬 덮어쓰기)
          </Button>
          <Button className="w-full" onClick={handleKeepLocal}>
            로컬로 덮어쓰기 (서버에 업로드)
          </Button>
        </div>
      </div>
    </div>
  )
}
