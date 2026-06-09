// api/sync.js — 동기화 통합 API (download / upload)
// vercel.json rewrites:
//   /api/sync/download → /api/sync?action=download
//   /api/sync/upload   → /api/sync?action=upload
import { createClient } from '@supabase/supabase-js'
import { setCors, handlePreflight } from './_cors.js'

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

// camelCase ↔ snake_case 변환
const toCamel = key => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const toSnake = key => key.replace(/([A-Z])/g, '_$1').toLowerCase()
const recordToLocal  = record => Object.fromEntries(Object.entries(record).map(([k, v]) => [toCamel(k), v]))
const recordToServer = record => Object.fromEntries(Object.entries(record).map(([k, v]) => [toSnake(k), v]))

// UUID 형식 검증
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const toUUID  = val => (val && UUID_RE.test(String(val)) ? val : null)

const UUID_FIELDS = {
  transactions:    ['account_id', 'linked_cash_flow_id'],
  cash_flows:      ['account_id', 'linked_journal_id'],
  user_accounts:   [],
  watchlist:       [],
  calendar_events: [],
  reports:         [],
}

const ALLOWED_COLUMNS = {
  user_accounts: [
    'id','user_id','user_email','name','broker','type','currency',
    'initial_balance','memo','sync_version','synced_at','deleted_at',
    'created_at','updated_at',
  ],
  transactions: [
    'id','user_id','user_email','account_id','account_name','ticker','name',
    'action','date','price','quantity','fee','pnl','psychology','memo',
    'market','sector','source','linked_cash_flow_id','external_id',
    'sync_version','synced_at','deleted_at','created_at','imported_at',
  ],
  cash_flows: [
    'id','user_id','user_email','account_id','account_name','type','category',
    'amount','currency','date','memo','is_auto','linked_journal_id',
    'sync_version','synced_at','deleted_at','created_at',
  ],
  watchlist: [
    'id','user_id','user_email','ticker','name','market','added_at',
    'price_at_added','target_price','stop_loss','entry_price','group_ids',
    'trailing_alert','sync_version','synced_at','deleted_at',
  ],
  calendar_events: [
    'id','user_id','user_email','date','title','category','ticker','source',
    'description','memo','impact','extra','sync_version','synced_at','deleted_at',
    'created_at',
  ],
  reports: [
    'id','user_id','user_email','type','data','sync_version','synced_at',
    'deleted_at','created_at',
  ],
}

const filterColumns = (record, pgTable) => {
  const allowed = ALLOWED_COLUMNS[pgTable]
  if (!allowed) return record
  return Object.fromEntries(Object.entries(record).filter(([k]) => allowed.includes(k)))
}

// ── download 핸들러 ───────────────────────────────────────────────────────
async function handleDownload(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { table, since } = req.query
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return res.status(400).json({ error: `Unknown table: ${table}` })

  let query = supabase
    .from(pgTable)
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (since) query = query.gt('synced_at', since)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const records = (data ?? []).map(recordToLocal)
  res.status(200).json({ records, count: records.length })
}

// ── upload 핸들러 ─────────────────────────────────────────────────────────
async function handleUpload(req, res) {
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

  const now = new Date().toISOString()

  // 모든 레코드를 동기적으로 변환 (await 없음 — 네트워크 호출 없음)
  const serverRecords = records.map(record => {
    const converted = {
      ...recordToServer(record),
      user_id:      user.id,
      user_email:   user.email,
      sync_version: (record.syncVersion ?? 0) + 1,
      synced_at:    now,
    }
    for (const field of (UUID_FIELDS[pgTable] ?? [])) {
      if (converted[field] !== undefined) converted[field] = toUUID(converted[field])
    }
    return filterColumns(converted, pgTable)
  })

  // 단일 bulk upsert — N개 레코드를 1번 API 호출로 처리 (타임아웃 방지)
  const { error } = await supabase.from(pgTable).upsert(serverRecords, { onConflict: 'id' })

  if (error) {
    const failed = records.map(r => ({ id: r.id, error: error.message }))
    return res.status(200).json({ uploaded: [], failed })
  }

  const uploaded = records.map((r, i) => ({
    ...r,
    syncVersion: serverRecords[i].sync_version,
  }))
  res.status(200).json({ uploaded, failed: [] })
}

// ── 메인 라우터 ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)

  const { action } = req.query
  if (action === 'download') return handleDownload(req, res)
  if (action === 'upload')   return handleUpload(req, res)

  return res.status(400).json({ error: 'action 파라미터가 필요합니다 (download|upload)' })
}
