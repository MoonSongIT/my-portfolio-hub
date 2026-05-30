// POST /api/sync/upload — 로컬 레코드를 서버에 upsert (data 래핑 없음)
import { createClient } from '@supabase/supabase-js'
import { setCors, handlePreflight } from '../_cors.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Dexie 테이블명 → PostgreSQL 테이블명
const TABLE_MAP = {
  userAccounts:   'user_accounts',
  transactions:   'transactions',
  cashFlows:      'cash_flows',
  watchlist:      'watchlist',
  calendarEvents: 'calendar_events',
  reports:        'reports',
}

// camelCase → snake_case
const toSnake = key => key.replace(/([A-Z])/g, '_$1').toLowerCase()
const recordToServer = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toSnake(k), v]))

// UUID 형식 검증 — 비표준 ID(demo-account-general 등)를 null로 변환
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const toUUID = val => (val && UUID_RE.test(String(val)) ? val : null)

// UUID 타입인 FK 컬럼 목록 (테이블별)
const UUID_FIELDS = {
  transactions:   ['account_id', 'linked_cash_flow_id'],
  cash_flows:     ['account_id', 'linked_journal_id'],
  user_accounts:  [],
  watchlist:      [],
  calendar_events:[],
  reports:        [],
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { table, records } = req.body
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return res.status(400).json({ error: `Unknown table: ${table}` })
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(200).json({ uploaded: [], failed: [] })
  }

  const uploaded = []
  const failed = []

  for (const record of records) {
    try {
      // camelCase → snake_case 변환 + user_id/user_email 강제 덮어쓰기
      const serverRecord = {
        ...recordToServer(record),
        user_id:      user.id,
        user_email:   user.email,
        sync_version: (record.syncVersion ?? 0) + 1,
        synced_at:    new Date().toISOString(),
      }

      // 비표준 UUID 필드 → null 변환 (demo-account-general 등 방어)
      for (const field of (UUID_FIELDS[pgTable] ?? [])) {
        if (serverRecord[field] !== undefined) {
          serverRecord[field] = toUUID(serverRecord[field])
        }
      }

      const { error } = await supabase
        .from(pgTable)
        .upsert(serverRecord, { onConflict: 'id' })

      if (error) {
        failed.push({ id: record.id, error: error.message })
      } else {
        uploaded.push({ ...record, syncVersion: serverRecord.sync_version })
      }
    } catch (err) {
      failed.push({ id: record.id, error: err.message })
    }
  }

  res.status(200).json({ uploaded, failed })
}
