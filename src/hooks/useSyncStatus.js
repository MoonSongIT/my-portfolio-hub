// 동기화 상태 훅 — 오프라인 복구 자동 동기화 + 수동 트리거
import { useEffect, useCallback } from 'react'
import { useSyncStore } from '@/store/syncStore'
import { useAuthStore } from '@/store/authStore'
import { syncService } from '@/services/syncService'

export function useSyncStatus() {
  const syncStatus = useSyncStore((s) => s.syncStatus)
  const pendingChanges = useSyncStore((s) => s.pendingChanges)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const conflicts = useSyncStore((s) => s.conflicts)
  const syncEnabled = useSyncStore((s) => s.syncEnabled)

  const isSupabaseUser = useAuthStore((s) => s.isSupabaseUser)

  const triggerSync = useCallback(async () => {
    if (!isSupabaseUser || !syncEnabled) return
    try {
      await syncService.uploadPending()
    } catch (err) {
      console.error('[Sync] 동기화 실패:', err)
    }
  }, [isSupabaseUser, syncEnabled])

  // 오프라인 → 온라인 복구 시 자동 동기화
  useEffect(() => {
    const handleOnline = () => {
      if (isSupabaseUser && syncEnabled) {
        triggerSync()
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [isSupabaseUser, syncEnabled, triggerSync])

  return {
    syncStatus,
    pendingChanges,
    lastSyncedAt,
    conflicts,
    isOnline: navigator.onLine,
    triggerSync,
  }
}
