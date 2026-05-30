// 서버↔로컬 동기화 서비스 — upload / download 단방향 구현
import { db } from '@/utils/db'
import { SYNC_TABLE_MAP } from '@/constants/syncConfig'
import { authService } from '@/services/authService'
import { useSyncStore } from '@/store/syncStore'

const API_BASE = import.meta.env.VITE_SYNC_API_BASE || ''

async function getToken() {
  const session = await authService.getSession()
  if (!session?.access_token) throw new Error('로그인이 필요합니다')
  return session.access_token
}

export const syncService = {
  /**
   * 단일 테이블 업로드 — syncedAt=null 레코드를 서버에 upsert
   * @param {string} localTable - Dexie 테이블명 (예: 'transactions')
   * @returns {{ uploaded: number, failed: number }}
   */
  async uploadTable(localTable) {
    if (!db[localTable]) throw new Error(`Unknown table: ${localTable}`)

    const token = await getToken()

    const pending = await db[localTable]
      .filter(r => !r.syncedAt)
      .toArray()

    if (pending.length === 0) return { uploaded: 0, failed: 0 }

    const res = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ table: localTable, records: pending }),
    })

    if (!res.ok) throw new Error(`Upload 실패 (${localTable}): ${res.status}`)

    const { uploaded, failed } = await res.json()

    // 업로드 성공 레코드에 syncedAt 기록
    if (uploaded?.length > 0) {
      const now = new Date().toISOString()
      await db[localTable].bulkPut(
        uploaded.map(r => ({ ...r, syncedAt: now }))
      )
    }

    return { uploaded: uploaded?.length ?? 0, failed: failed?.length ?? 0 }
  },

  /**
   * 단일 테이블 다운로드 — 서버 전체 레코드를 로컬 IDB에 PUT
   * @param {string} localTable - Dexie 테이블명
   * @returns {{ downloaded: number }}
   */
  async downloadTable(localTable) {
    if (!db[localTable]) throw new Error(`Unknown table: ${localTable}`)

    const token = await getToken()

    const res = await fetch(`${API_BASE}/api/sync/download?table=${localTable}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Download 실패 (${localTable}): ${res.status}`)

    const { records } = await res.json()

    if (records?.length > 0) {
      await db[localTable].bulkPut(records)
    }

    return { downloaded: records?.length ?? 0 }
  },

  /**
   * 전체 테이블 업로드 (SYNC_TABLE_MAP 순서)
   */
  async uploadAll() {
    const { setSyncStatus, setLastSyncedAt } = useSyncStore.getState()
    setSyncStatus('syncing')

    try {
      let total = 0
      for (const { local } of SYNC_TABLE_MAP) {
        if (!db[local]) continue
        const { uploaded } = await syncService.uploadTable(local)
        total += uploaded
      }
      setLastSyncedAt(new Date().toISOString())
      setSyncStatus('synced')
      return { total }
    } catch (err) {
      setSyncStatus('error')
      throw err
    }
  },

  /**
   * 전체 테이블 다운로드 (SYNC_TABLE_MAP 순서)
   */
  async downloadAll() {
    const { setSyncStatus, setLastSyncedAt } = useSyncStore.getState()
    setSyncStatus('syncing')

    try {
      let total = 0
      for (const { local } of SYNC_TABLE_MAP) {
        if (!db[local]) continue
        const { downloaded } = await syncService.downloadTable(local)
        total += downloaded
      }
      setLastSyncedAt(new Date().toISOString())
      setSyncStatus('synced')
      return { total }
    } catch (err) {
      setSyncStatus('error')
      throw err
    }
  },
}
