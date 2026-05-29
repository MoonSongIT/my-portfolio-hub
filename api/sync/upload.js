// POST /api/sync/upload — 로컬 변경사항을 서버에 업로드 (충돌 감지 포함)
import { createClient } from '@supabase/supabase-js'
import { setCors, handlePreflight } from '../_cors.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 서버 전용 키 (클라이언트 노출 금지)
)

// 로컬 Dexie 테이블명 → 서버 PostgreSQL 테이블명
// aiCredentials 제외 — 보안 필수
const TABLE_MAP = {
  transactions:   'transactions',
  cashFlows:      'cash_flows',
  calendarEvents: 'calendar_events',
  accounts:       'accounts',
  watchlist:      'watchlist',
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // syncService는 { table, records } 형태로 전송
  const { table, records } = req.body
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return res.status(400).json({ error: `Unknown table: ${table}` })
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array' })
  }

  const conflicts = []
  const uploaded = []

  for (const record of records) {
    // 서버 현재 버전 조회 — 충돌 감지
    const { data: existing } = await supabase
      .from(pgTable)
      .select('id, sync_version')
      .eq('id', String(record.id))
      .single()

    if (existing && existing.sync_version > (record.syncVersion ?? 0)) {
      conflicts.push({
        id: record.id,
        serverVersion: existing.sync_version,
        localVersion: record.syncVersion,
      })
      continue
    }

    await supabase.from(pgTable).upsert({
      id:           String(record.id),
      user_id:      user.id,
      data:         record,
      sync_version: (record.syncVersion ?? 0) + 1,
      synced_at:    new Date().toISOString(),
      deleted_at:   record.deletedAt ?? null,
    })
    uploaded.push({ ...record, syncVersion: (record.syncVersion ?? 0) + 1 })
  }

  // 글로벌 버전 갱신
  await supabase.from('user_sync_meta').upsert({
    user_id:        user.id,
    global_version: Date.now(),
    last_synced_at: new Date().toISOString(),
  })

  res.status(200).json({ uploaded, conflicts })
}
