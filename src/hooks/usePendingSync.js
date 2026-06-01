// 이탈 가드 — <Link> 클릭 인터셉트로 미동기화 레코드 있을 때 PendingUploadModal 표시
// (BrowserRouter 환경: useBlocker 미지원 → document capture 클릭 인터셉터로 대체)
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const pendingNavRef = useRef(null)

  const syncEnabled = useSyncStore(s => s.syncEnabled)
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleClick = async (e) => {
      if (!syncEnabled || !isLoggedIn) return

      // React Router <Link>는 <a href> 로 렌더링됨
      const anchor = e.target.closest('a[href]')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      // 외부 링크 / 같은 경로 무시
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return
      if (href === location.pathname) return

      const count = await syncService.countPendingRecords()
      if (count === 0) return

      e.preventDefault()
      e.stopPropagation()
      setPendingCount(count)
      pendingNavRef.current = href
      setModalOpen(true)
    }

    document.addEventListener('click', handleClick, true) // capture phase
    return () => document.removeEventListener('click', handleClick, true)
  }, [syncEnabled, isLoggedIn, location.pathname])

  function handleUploaded() {
    toast.success(`${pendingCount}개 항목이 서버에 저장되었습니다.`)
    setModalOpen(false)
    const target = pendingNavRef.current
    pendingNavRef.current = null
    if (target) navigate(target)
  }

  function handleLeave() {
    setModalOpen(false)
    const target = pendingNavRef.current
    pendingNavRef.current = null
    if (target) navigate(target)
  }

  function handleCancel() {
    setModalOpen(false)
    pendingNavRef.current = null
    setPendingCount(0)
  }

  return { modalOpen, pendingCount, handleUploaded, handleLeave, handleCancel }
}
