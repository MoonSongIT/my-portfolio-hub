// 동기화 설정 패널 — 자동동기화 ON/OFF, 주기 선택
import { useSyncStore } from '@/store/syncStore'
import { syncService } from '@/services/syncService'
import { useAuthStore } from '@/store/authStore'

const INTERVAL_OPTIONS = [
  { value: 'realtime', label: '실시간' },
  { value: '15m', label: '15분마다' },
  { value: '1h', label: '1시간마다' },
  { value: 'manual', label: '수동' },
]

export default function SyncSettings() {
  const isSupabaseUser = useAuthStore((s) => s.isSupabaseUser)
  const {
    syncEnabled, autoSync, syncInterval, syncStatus, lastSyncedAt, pendingChanges,
    enableSync, disableSync, setAutoSync, setSyncInterval,
  } = useSyncStore()

  if (!isSupabaseUser) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Supabase 계정으로 로그인하면 동기화 설정을 사용할 수 있습니다.
      </p>
    )
  }

  const handleManualSync = async () => {
    try {
      await syncService.uploadPending()
    } catch {
      // syncStore의 setSyncStatus('error')가 자동 처리
    }
  }

  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '없음'

  return (
    <div className="space-y-4">
      {/* 동기화 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">동기화 활성화</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">서버와 로컬 데이터를 동기화합니다.</p>
        </div>
        <button
          onClick={() => syncEnabled ? disableSync() : enableSync()}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            syncEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            syncEnabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {syncEnabled && (
        <>
          {/* 자동 동기화 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">자동 동기화</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">변경사항을 자동으로 서버에 업로드합니다.</p>
            </div>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSync ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoSync ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* 동기화 주기 */}
          {autoSync && (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">동기화 주기</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSyncInterval(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      syncInterval === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 상태 + 수동 동기화 */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
              <p>마지막 동기화: {lastSyncLabel}</p>
              {pendingChanges > 0 && (
                <p className="text-blue-600 dark:text-blue-400">미동기화 {pendingChanges}건 대기 중</p>
              )}
              {syncStatus === 'error' && (
                <p className="text-red-500">동기화 오류가 발생했습니다.</p>
              )}
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncStatus === 'syncing'}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncStatus === 'syncing' ? '동기화 중...' : '지금 동기화'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
