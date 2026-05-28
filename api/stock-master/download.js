// GET /api/stock-master/download — 서버 종목 마스터 다운로드 (인증 불필요, exchange 필터 가능)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// SQL snake_case → JS camelCase 변환
function fromRow(r) {
  const row = {
    id:          r.id,
    ticker:      r.ticker,
    name:        r.name,
    category:    r.category,
    exchange:    r.exchange,
    type:        r.type,
    country:     r.country,
    currency:    r.currency,
    isCustom:    r.is_custom,
    isActive:    r.is_active,
    firstSeenAt: r.first_seen_at,
    updatedAt:   r.updated_at,
    source:      r.source,
  }
  if (r.name_en    != null) row.nameEn     = r.name_en
  if (r.sector     != null) row.sector     = r.sector
  if (r.industry   != null) row.industry   = r.industry
  if (r.isin       != null) row.isin       = r.isin
  if (r.corp_code  != null) row.corpCode   = r.corp_code
  if (r.tradable_on != null) row.tradableOn = r.tradable_on
  return row
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { exchange } = req.query

  let query = supabase.from('stock_master').select('*')
  if (exchange) query = query.eq('exchange', exchange)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const rows = (data ?? []).map(fromRow)
  res.status(200).json({ rows, total: rows.length })
}
