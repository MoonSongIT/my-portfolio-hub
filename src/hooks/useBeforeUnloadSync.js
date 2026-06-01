// 브라우저 탭 닫기 / 새로고침 / 외부 URL 이탈 대응
// beforeunload: 기본 확인창 표시 (커스텀 UI 불가)
// pagehide: sendBeacon으로 백그라운드 업로드 시도
import { useEffect } from 'react'
import { useSyncStore } from '@/store/syncStore'
import { authService } from '@/services/authService'

const API_BASE = import.meta.env.VITE_SYNC_API_BASE || ''

export function useBeforeUnloadSync() {
  useEffect(() => {
    function handleBeforeUnload(event) {
      const { pendingChanges, syncEnabled } = useSyncStore.getState()
      if (pendingChanges > 0 && syncEnabled) {
        event.preventDefault()
        event.returnValue = '' // 브라우저 기본 확인창 표시
      }
    }

    async function handlePageHide() {
      const { pendingChanges, syncEnabled } = useSyncStore.getState()
      if (pendingChanges === 0 || !syncEnabled) return

      // sendBeacon: 페이지 언로드 후에도 전송 보장 (응답 수신 불가)
      try {
        const session = await authService.getSession()
        const token = session?.access_token
        if (!token) return

        // 서버가 토큰으로 미동기화 레코드를 직접 조회해 업로드 처리
        navigator.sendBeacon(
          `${API_BASE}/api/sync/upload-pending`,
          new Blob([JSON.stringify({ token })], { type: 'application/json' })
        )
      } catch {
        // pagehide 중 오류는 무시 — 로컬 IDB에 데이터 보존됨
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])
}
