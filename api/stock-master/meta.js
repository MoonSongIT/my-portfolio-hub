// GET /api/stock-master/meta — 서버 종목 마스터 메타 정보 조회 (인증 불필요)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  // exchange 컬럼만 조회해 JS 집계 (PostgREST group-by 복잡도 우회)
  const { data: rows, error } = await supabase
    .from('stock_master')
    .select('exchange')

  if (error) return res.status(500).json({ error: error.message })

  const byExchange = {}
  for (const r of rows ?? []) {
    byExchange[r.exchange] = (byExchange[r.exchange] || 0) + 1
  }

  // 마지막 업로드 시각
  const { data: latest } = await supabase
    .from('stock_master')
    .select('uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single()

  res.status(200).json({
    total:      rows?.length ?? 0,
    byExchange,
    uploadedAt: latest?.uploaded_at ?? null,
  })
}
