// 로컬 데이터 서버 이전 모달 — 최초 Supabase 가입 후 일괄 업로드
import { useState } from 'react'
import { syncService } from '@/services/syncService'
import { useAuthStore } from '@/store/authStore'
import { Button } from '../ui/button'

export default function MigrateDataModal({ open, onClose }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'migrating' | 'done' | 'error'
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!open) return null

  const handleMigrate = async () => {
    if (!currentUser?.id) return
    setStatus('migrating')
    try {
      await syncService.migrateLocalToServer(currentUser.id)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">로컬 데이터 서버 이전</h2>

        {status === 'idle' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              기기에 저장된 거래 내역, 자금 흐름, 증시 일정을 서버로 업로드합니다.
              이 작업은 최초 1회만 필요합니다.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
              <Button className="flex-1" onClick={handleMigrate}>이전 시작</Button>
            </div>
          </>
        )}

        {status === 'migrating' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
            서버로 이전 중입니다...
          </p>
        )}

        {status === 'done' && (
          <>
            <p className="text-sm text-green-600 dark:text-green-400 mb-5">
              ✅ 이전이 완료되었습니다. 이제 어떤 기기에서든 데이터를 동기화할 수 있습니다.
            </p>
            <Button className="w-full" onClick={onClose}>닫기</Button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-sm text-red-500 mb-5">
              이전 중 오류가 발생했습니다. 네트워크 상태를 확인하고 다시 시도하세요.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>닫기</Button>
              <Button className="flex-1" onClick={handleMigrate}>다시 시도</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
