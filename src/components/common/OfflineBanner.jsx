import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/**
 * 오프라인 상태일 때 화면 상단에 표시되는 배너
 */
export default function OfflineBanner() {
  const { isOnline, lastOnlineAt } = useOnlineStatus()

  if (isOnline) return null

  const lastSeenText = lastOnlineAt
    ? lastOnlineAt.toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' 마지막 연결'
    : null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white dark:bg-amber-600">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>오프라인 상태입니다. 인터넷 연결을 확인해 주세요.</span>
      {lastSeenText && (
        <span className="hidden text-amber-100 sm:inline">— {lastSeenText}</span>
      )}
    </div>
  )
}
