import { useState, useEffect } from 'react'

/**
 * 온라인/오프라인 상태 감지 훅
 * navigator.onLine + online/offline 이벤트 기반
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [lastOnlineAt, setLastOnlineAt] = useState(() =>
    navigator.onLine ? new Date() : null
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setLastOnlineAt(new Date())
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, lastOnlineAt }
}
