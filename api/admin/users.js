// GET/POST /api/admin/users — 관리자 전용 사용자 역할 조회 및 관리
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function isAdmin(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (!await isAdmin(user.id)) return res.status(403).json({ error: 'Forbidden' })

  // ── GET: 전체 사용자 + 역할 목록 ────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) return res.status(500).json({ error: listErr.message })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role, granted_at')

    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r]))

    const users = (data?.users ?? []).map(u => {
      const r = roleMap.get(u.id)
      return {
        id:         u.id,
        email:      u.email,
        createdAt:  u.created_at,
        lastSignIn: u.last_sign_in_at,
        role:       r?.role ?? 'user',
        grantedAt:  r?.granted_at ?? null,
      }
    })

    return res.status(200).json({ users })
  }

  // ── POST: 역할 변경 ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { targetUserId, role } = req.body
    if (!targetUserId || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: '유효하지 않은 요청입니다' })
    }

    if (role === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: targetUserId, role: 'admin', granted_at: new Date().toISOString(), granted_by: user.id },
          { onConflict: 'user_id' }
        )
      if (error) return res.status(500).json({ error: error.message })
    } else {
      // 'user' 역할 = user_roles 행 삭제 (기본값이 user)
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
      if (error) return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
