// Vite dev 서버 미들웨어 — /api/sync/upload, /api/sync/download 처리
// Vercel 서버리스 함수(api/sync/upload.js, api/sync/download.js)의 개발 서버 대응 구현
import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })
}

const TABLE_MAP = {
  userAccounts:   'user_accounts',
  transactions:   'transactions',
  cashFlows:      'cash_flows',
  watchlist:      'watchlist',
  calendarEvents: 'calendar_events',
  reports:        'reports',
}

const toSnake = key => key.replace(/([A-Z])/g, '_$1').toLowerCase()
const toCamel = key => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const recordToServer = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toSnake(k), v]))
const recordToLocal = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toCamel(k), v]))

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const toUUID = val => (val && UUID_RE.test(String(val)) ? val : null)

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

/**
 * POST /api/sync/upload
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Record<string, string>} env
 */
export async function handleSyncUpload(req, res, env) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' })
    return res.end()
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return json(401, { error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Unauthorized' })

  const { table, records } = await parseBody(req)
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return json(400, { error: `Unknown table: ${table}` })
  if (!Array.isArray(records) || records.length === 0) return json(200, { uploaded: [], failed: [] })

  const uploaded = []
  const failed = []

  for (const record of records) {
    try {
      const converted = {
        ...recordToServer(record),
        user_id:      user.id,
        user_email:   user.email,
        sync_version: (record.syncVersion ?? 0) + 1,
        synced_at:    new Date().toISOString(),
      }

      for (const field of (UUID_FIELDS[pgTable] ?? [])) {
        if (converted[field] !== undefined) converted[field] = toUUID(converted[field])
      }

      const serverRecord = filterColumns(converted, pgTable)

      const { error } = await supabase.from(pgTable).upsert(serverRecord, { onConflict: 'id' })
      if (error) {
        failed.push({ id: record.id, error: error.message })
      } else {
        uploaded.push({ ...record, syncVersion: serverRecord.sync_version })
      }
    } catch (err) {
      failed.push({ id: record.id, error: err.message })
    }
  }

  json(200, { uploaded, failed })
}

/**
 * GET /api/sync/download?table=xxx
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Record<string, string>} env
 */
export async function handleSyncDownload(req, res, env) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization' })
    return res.end()
  }
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return json(401, { error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Unauthorized' })

  const url = new URL(req.url, 'http://localhost')
  const table = url.searchParams.get('table')
  const since = url.searchParams.get('since')   // 증분 다운로드용 타임스탬프
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return json(400, { error: `Unknown table: ${table}` })

  let query = supabase
    .from(pgTable)
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  // 증분 다운로드: since 이후 변경된 레코드만 반환
  if (since) {
    query = query.gte('updated_at', since)
  }

  const { data, error } = await query

  if (error) return json(500, { error: error.message })

  const records = (data ?? []).map(recordToLocal)
  json(200, { records, count: records.length })
}
