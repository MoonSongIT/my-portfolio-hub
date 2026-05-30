// GET /api/sync/download — 서버에서 로컬로 데이터 다운로드 (data 래핑 없음)
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

// snake_case → camelCase
const toCamel = key => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const recordToLocal = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toCamel(k), v]))

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { table } = req.query
  const pgTable = TABLE_MAP[table]
  if (!pgTable) return res.status(400).json({ error: `Unknown table: ${table}` })

  const { data, error } = await supabase
    .from(pgTable)
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (error) return res.status(500).json({ error: error.message })

  // snake_case → camelCase 변환 후 반환
  const records = (data ?? []).map(recordToLocal)

  res.status(200).json({ records, count: records.length })
}
