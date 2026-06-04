// api/stock-master.js — 종목 마스터 통합 API (meta / download / upload)
// vercel.json rewrites:
//   /api/stock-master/meta     → /api/stock-master?action=meta
//   /api/stock-master/download → /api/stock-master?action=download
//   /api/stock-master/upload   → /api/stock-master?action=upload
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCHANGES = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF', 'NYSE', 'NASDAQ', 'US_ETF']

// ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

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
  if (r.name_en     != null) row.nameEn     = r.name_en
  if (r.sector      != null) row.sector     = r.sector
  if (r.industry    != null) row.industry   = r.industry
  if (r.isin        != null) row.isin       = r.isin
  if (r.corp_code   != null) row.corpCode   = r.corp_code
  if (r.tradable_on != null) row.tradableOn = r.tradable_on
  return row
}

function toRow(r) {
  const now = new Date().toISOString()
  return {
    id:            r.id,
    ticker:        r.ticker,
    name:          r.name,
    name_en:       r.nameEn       ?? null,
    category:      r.category,
    exchange:      r.exchange,
    type:          r.type,
    country:       r.country,
    currency:      r.currency,
    sector:        r.sector       ?? null,
    industry:      r.industry     ?? null,
    isin:          r.isin         ?? null,
    corp_code:     r.corpCode     ?? null,
    tradable_on:   r.tradableOn   ?? null,
    is_custom:     r.isCustom     ?? false,
    is_active:     r.isActive     ?? true,
    first_seen_at: r.firstSeenAt  ?? now,
    updated_at:    r.updatedAt    ?? now,
    source:        r.source       ?? 'MANUAL',
    uploaded_at:   now,
  }
}

async function checkIsAdmin(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

// ── meta ──────────────────────────────────────────────────────────────────
async function handleMeta(req, res) {
  const [totalResult, ...exResults] = await Promise.all([
    supabase.from('stock_master').select('*', { count: 'exact', head: true }),
    ...EXCHANGES.map(ex =>
      supabase.from('stock_master').select('*', { count: 'exact', head: true }).eq('exchange', ex)
    ),
  ])

  if (totalResult.error) return res.status(500).json({ error: totalResult.error.message })

  const byExchange = {}
  EXCHANGES.forEach((ex, i) => { if (exResults[i].count) byExchange[ex] = exResults[i].count })

  const { data: latest } = await supabase
    .from('stock_master')
    .select('uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  res.status(200).json({
    total:      totalResult.count ?? 0,
    byExchange,
    uploadedAt: latest?.uploaded_at ?? null,
  })
}

// ── download ──────────────────────────────────────────────────────────────
async function handleDownload(req, res) {
  const { exchange } = req.query
  let query = supabase.from('stock_master').select('*').range(0, 49999)
  if (exchange) query = query.eq('exchange', exchange)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const rows = (data ?? []).map(fromRow)
  res.status(200).json({ rows, total: rows.length })
}

// ── upload (관리자 전용) ───────────────────────────────────────────────────
async function handleUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (!await checkIsAdmin(user.id)) {
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

// ── 메인 라우터 ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action } = req.query
  if (action === 'meta')     return handleMeta(req, res)
  if (action === 'download') return handleDownload(req, res)
  if (action === 'upload')   return handleUpload(req, res)

  return res.status(400).json({ error: 'action 파라미터가 필요합니다 (meta|download|upload)' })
}
