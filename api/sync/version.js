// GET /api/sync/version — 서버의 현재 글로벌 sync 버전 반환
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // 서버 전용 키 (클라이언트 노출 금지)
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data, error: dbError } = await supabase
    .from('user_sync_meta')
    .select('global_version, last_synced_at')
    .eq('user_id', user.id)
    .single()

  if (dbError && dbError.code === 'PGRST116') {
    // 첫 동기화 — 메타 없음
    return res.status(200).json({ globalVersion: 0, lastSyncedAt: null })
  }
  if (dbError) return res.status(500).json({ error: dbError.message })

  res.status(200).json({
    globalVersion: data.global_version,
    lastSyncedAt: data.last_synced_at,
  })
}
