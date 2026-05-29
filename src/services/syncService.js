// 서버↔로컬 동기화 서비스 — 업로드·다운로드·충돌 처리·초기 이전
import { db } from '@/utils/db'
import { useSyncStore } from '@/store/syncStore'
import { authService } from '@/services/authService'

// aiCredentials 는 절대 동기화 금지 — 보안 필수
const SYNC_TABLES = ['transactions', 'cashFlows', 'calendarEvents']

// 로컬 개발 환경에서는 배포된 Vercel API를 직접 호출
const API_BASE = import.meta.env.VITE_SYNC_API_BASE || ''

async function getAuthToken() {
  const session = await authService.getSession()
  if (!session?.access_token) throw new Error('로그인이 필요합니다')
  return session.access_token
}

export const syncService = {
  // 서버 버전 확인
  async checkServerVersion() {
    const token = await getAuthToken()
    const res = await fetch(`${API_BASE}/api/sync/version`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('버전 확인 실패')
    const data = await res.json()
    useSyncStore.getState().setServerVersion(data.version)
    return data.version
  },

  // 미동기화 레코드 서버 업로드
  async uploadPending() {
    const token = await getAuthToken()
    const { setSyncStatus, setLastSyncedAt, resetPending, addConflict } =
      useSyncStore.getState()

    setSyncStatus('syncing')

    try {
      for (const table of SYNC_TABLES) {
        const pending = await db[table]
          .filter((r) => r.syncedAt === null || r.syncedAt === undefined)
          .toArray()

        if (pending.length === 0) continue

        const res = await fetch(`${API_BASE}/api/sync/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ table, records: pending }),
        })

        if (!res.ok) throw new Error(`업로드 실패: ${table}`)

        const { conflicts, uploaded } = await res.json()

        // 충돌 레코드 저장
        if (conflicts?.length) {
          conflicts.forEach((c) => addConflict({ table, ...c }))
          setSyncStatus('conflict')
          return
        }

        // 업로드 성공한 레코드에 syncedAt 표시
        const now = new Date().toISOString()
        await db[table].bulkPut(
          uploaded.map((r) => ({ ...r, syncedAt: now }))
        )
      }

      resetPending()
      setLastSyncedAt(new Date().toISOString())
      setSyncStatus('synced')
    } catch (err) {
      setSyncStatus('error')
      throw err
    }
  },

  // 서버에서 로컬로 다운로드
  async downloadFromServer(since = null) {
    const token = await getAuthToken()
    const { setSyncStatus, setLastSyncedAt, setServerVersion } =
      useSyncStore.getState()

    setSyncStatus('syncing')

    try {
      for (const table of SYNC_TABLES) {
        const url = since
          ? `${API_BASE}/api/sync/download?table=${table}&since=${encodeURIComponent(since)}`
          : `${API_BASE}/api/sync/download?table=${table}`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`다운로드 실패: ${table}`)

        const { records, version } = await res.json()
        if (version !== undefined) setServerVersion(version)

        for (const record of records) {
          if (record.deleted_at) {
            // 소프트 삭제 처리
            await db[table].delete(record.id)
          } else {
            await db[table].put({
              ...record,
              syncedAt: record.synced_at ?? new Date().toISOString(),
            })
          }
        }
      }

      setLastSyncedAt(new Date().toISOString())
      setSyncStatus('synced')
    } catch (err) {
      setSyncStatus('error')
      throw err
    }
  },

  // 최초 Supabase 가입 시 로컬 데이터 전체 서버 이전
  async migrateLocalToServer(userId) {
    const token = await getAuthToken()
    const { setSyncStatus, setLastSyncedAt, resetPending } =
      useSyncStore.getState()

    setSyncStatus('syncing')

    try {
      for (const table of SYNC_TABLES) {
        const records = await db[table]
          .where('userId').equals(userId)
          .toArray()

        if (records.length === 0) continue

        const res = await fetch(`${API_BASE}/api/sync/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ table, records, migrate: true }),
        })

        if (!res.ok) throw new Error(`이전 실패: ${table}`)

        const { uploaded } = await res.json()
        const now = new Date().toISOString()
        await db[table].bulkPut(
          uploaded.map((r) => ({ ...r, syncedAt: now }))
        )
      }

      resetPending()
      setLastSyncedAt(new Date().toISOString())
      setSyncStatus('synced')
    } catch (err) {
      setSyncStatus('error')
      throw err
    }
  },
}
