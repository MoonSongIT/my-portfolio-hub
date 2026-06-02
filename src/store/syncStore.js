// 동기화 상태 관리 — 서버↔로컬 동기화 상태·설정 저장
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSyncStore = create(
  persist(
    (set, get) => ({
      // ── 동기화 상태 ──
      syncStatus: 'idle',      // 'idle' | 'syncing' | 'conflict' | 'error' | 'synced'
      pendingChanges: 0,
      localVersion: 0,
      serverVersion: 0,
      lastSyncedAt: null,      // ISO string
      conflicts: [],           // [{ table, localRecord, serverRecord }]

      // ── 동기화 설정 ──
      syncEnabled: false,
      autoSync: true,
      syncInterval: '15m',     // 'realtime' | '15m' | '1h' | 'manual'

      // ── 상태 액션 ──
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
      setServerVersion: (v) => set({ serverVersion: v }),
      setLocalVersion: (v) => set({ localVersion: v }),

      incrementPending: () => set((s) => ({ pendingChanges: s.pendingChanges + 1 })),
      resetPending: () => set({ pendingChanges: 0 }),
      setPendingChanges: (n) => set({ pendingChanges: n }),

      addConflict: (conflict) =>
        set((s) => ({ conflicts: [...s.conflicts, conflict] })),
      clearConflicts: () => set({ conflicts: [] }),

      // ── 설정 액션 ──
      enableSync: () => set({ syncEnabled: true }),
      disableSync: () => set({ syncEnabled: false }),
      setAutoSync: (v) => set({ autoSync: v }),
      setSyncInterval: (interval) => set({ syncInterval: interval }),
    }),
    {
      name: 'sync-storage',
      partialize: (s) => ({
        localVersion: s.localVersion,
        lastSyncedAt: s.lastSyncedAt,
        syncEnabled: s.syncEnabled,
        autoSync: s.autoSync,
        syncInterval: s.syncInterval,
      }),
    }
  )
)
