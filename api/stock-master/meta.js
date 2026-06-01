// GET /api/stock-master/meta — 서버 종목 마스터 메타 정보 조회 (인증 불필요)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCHANGES = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF', 'NYSE', 'NASDAQ', 'US_ETF']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  // count 쿼리로 집계 — select('exchange') 방식은 Supabase 1,000행 제한에 걸림
  const [totalResult, ...exResults] = await Promise.all([
    supabase.from('stock_master').select('*', { count: 'exact', head: true }),
    ...EXCHANGES.map(ex =>
      supabase.from('stock_master').select('*', { count: 'exact', head: true }).eq('exchange', ex)
    ),
  ])

  if (totalResult.error) return res.status(500).json({ error: totalResult.error.message })

  const byExchange = {}
  EXCHANGES.forEach((ex, i) => { if (exResults[i].count) byExchange[ex] = exResults[i].count })

  // 마지막 업로드 시각
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
