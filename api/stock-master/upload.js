// POST /api/stock-master/upload — 관리자 전용 종목 마스터 서버 업로드
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// JS camelCase → SQL snake_case 변환
function toRow(r) {
  const now = new Date().toISOString()
  return {
    id:            r.id,
    ticker:        r.ticker,
    name:          r.name,
    name_en:       r.nameEn ?? null,
    category:      r.category,
    exchange:      r.exchange,
    type:          r.type,
    country:       r.country,
    currency:      r.currency,
    sector:        r.sector ?? null,
    industry:      r.industry ?? null,
    isin:          r.isin ?? null,
    corp_code:     r.corpCode ?? null,
    tradable_on:   r.tradableOn ?? null,
    is_custom:     r.isCustom ?? false,
    is_active:     r.isActive ?? true,
    first_seen_at: r.firstSeenAt ?? now,
    updated_at:    r.updatedAt ?? now,
    source:        r.source ?? 'MANUAL',
    uploaded_at:   now,
  }
}

async function isAdmin(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (!await isAdmin(user.id)) {
    return res.status(403).json({ error: 'Forbidden — 관리자 권한 필요' })
  }

  const { rows } = req.body
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows must be a non-empty array' })
  }
  if (rows.length > 500) {
    return res.status(400).json({ error: '한 번에 최대 500행까지 업로드 가능합니다' })
  }

  const dbRows = rows.map(toRow)
  const { error: upsertErr } = await supabase
    .from('stock_master')
    .upsert(dbRows, { onConflict: 'id' })
  if (upsertErr) return res.status(500).json({ error: upsertErr.message })

  res.status(200).json({ upserted: dbRows.length })
}
