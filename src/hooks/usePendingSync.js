// 이탈 가드 — <Link> 클릭 인터셉트로 미동기화 레코드 있을 때 PendingUploadModal 표시
// (BrowserRouter 환경: useBlocker 미지원 → document capture 클릭 인터셉터로 대체)
// 주의: e.preventDefault()는 반드시 동기 구간에서 호출해야 브라우저가 취소함
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
  // Zustand에서 동기로 읽는 pendingChanges를 ref에 유지 — 클릭 핸들러 동기 구간에서 사용
  const pendingChanges = useSyncStore(s => s.pendingChanges)
  const pendingChangesRef = useRef(pendingChanges)
  useEffect(() => { pendingChangesRef.current = pendingChanges }, [pendingChanges])

  const syncEnabledRef = useRef(syncEnabled)
  useEffect(() => { syncEnabledRef.current = syncEnabled }, [syncEnabled])

  const isLoggedInRef = useRef(isLoggedIn)
  useEffect(() => { isLoggedInRef.current = isLoggedIn }, [isLoggedIn])

  const locationRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  useEffect(() => {
    const handleClick = (e) => {
      if (!syncEnabledRef.current || !isLoggedInRef.current) return
      // pendingChanges === 0 이면 차단 불필요 — 동기 체크
      if (pendingChangesRef.current === 0) return

      // React Router <Link>는 <a href> 로 렌더링됨
      const anchor = e.target.closest('a[href]')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      // 외부 링크 / 같은 경로 무시
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return
      if (href === locationRef.current) return

      // ← 동기 구간에서 즉시 이벤트 취소 (async 이후엔 브라우저가 무시)
      e.preventDefault()
      e.stopPropagation()
      pendingNavRef.current = href

      // 정확한 건수는 비동기로 조회해 모달에 표시
      syncService.countPendingRecords().then(count => {
        if (count === 0) {
          pendingNavRef.current = null
          return
        }
        setPendingCount(count)
        setModalOpen(true)
      })
    }

    document.addEventListener('click', handleClick, true) // capture phase
    return () => document.removeEventListener('click', handleClick, true)
  }, []) // 의존성 없음 — 모든 최신 값은 ref로 접근

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
