// GET /api/sync/download — 서버에서 로컬로 데이터 다운로드 (증분 동기화 지원)
import { createClient } from '@supabase/supabase-js'
import { setCors, handlePreflight } from '../_cors.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 서버 전용 키 (클라이언트 노출 금지)
)

// 서버 PostgreSQL 테이블명 목록 (aiCredentials 제외 — 보안 필수)
const TABLES = ['transactions', 'cash_flows', 'calendar_events', 'accounts', 'watchlist']

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return
  setCors(req, res)
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // since: ISO 타임스탬프 — 이 시각 이후 변경분만 반환 (증분 동기화)
  const since = req.query.since ?? null

  const result = {}

  for (const table of TABLES) {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', user.id)

    if (since) {
      query = query.gte('synced_at', since)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message, table })

    result[table] = data ?? []
  }

  res.status(200).json(result)
}
