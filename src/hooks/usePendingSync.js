// React Router 이탈 가드 — 미동기화 레코드가 있으면 PendingUploadModal 표시
import { useState, useCallback, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { toast } from 'sonner'
import { syncService } from '@/services/syncService'
import { useSyncStore } from '@/store/syncStore'
import { useAuthStore } from '@/store/authStore'

/**
 * 반환값:
 *  - modalOpen: boolean — 모달 표시 여부
 *  - pendingCount: number — 미동기화 레코드 수
 *  - handleUploaded: () => void — 업로드 성공 시 콜백
 *  - handleLeave: () => void — 그냥 이동 콜백
 *  - handleCancel: () => void — 취소 콜백
 */
export function usePendingSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const syncEnabled = useSyncStore(s => s.syncEnabled)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)

  const shouldBlock = useCallback(async () => {
    if (!syncEnabled || !isLoggedIn) return false
    const count = await syncService.countPendingRecords()
    if (count > 0) setPendingCount(count)
    return count > 0
  }, [syncEnabled, isLoggedIn])

  // useBlocker: pathname 변경 시 이동 차단
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname
  )

  // blocked 상태 진입 시 실제 IDB 스캔
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    shouldBlock().then((block) => {
      if (!block) blocker.proceed()
    })
  }, [blocker.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const modalOpen = blocker.state === 'blocked' && pendingCount > 0

  function handleUploaded() {
    toast.success(`${pendingCount}개 항목이 서버에 저장되었습니다.`)
    blocker.proceed?.()
  }

  function handleLeave() {
    blocker.proceed?.()
  }

  function handleCancel() {
    setPendingCount(0)
    blocker.reset?.()
  }

  return { modalOpen, pendingCount, handleUploaded, handleLeave, handleCancel }
}
