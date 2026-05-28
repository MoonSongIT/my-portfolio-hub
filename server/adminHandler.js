// Vite dev 서버 미들웨어 — /api/admin/users GET/POST 처리
import { createClient } from '@supabase/supabase-js'

/** POST 요청 바디를 파싱하는 헬퍼 */
function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })
}

/**
 * Vite dev 서버 미들웨어: GET /api/admin/users, POST /api/admin/users
 * Vercel 서버리스 함수(api/admin/users.js)의 개발 서버 대응 구현
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Record<string, string>} env - vite loadEnv 결과
 */
export async function handleAdminUsers(req, res, env) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  // Supabase 미설정 시 명확한 오류 반환
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: 'Supabase 환경변수가 설정되지 않았습니다 (.env 파일을 확인하세요)' })
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // Bearer 토큰 검증
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return json(401, { error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Unauthorized' })

  // 관리자 권한 확인
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleRow?.role !== 'admin') return json(403, { error: 'Forbidden' })

  // ── GET: 전체 사용자 + 역할 목록 ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) return json(500, { error: listErr.message })

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

    return json(200, { users })
  }

  // ── POST: 역할 변경 ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const { targetUserId, role } = body

    if (!targetUserId || !['admin', 'user'].includes(role)) {
      return json(400, { error: '유효하지 않은 요청입니다' })
    }

    if (role === 'admin') {
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: targetUserId, role: 'admin', granted_at: new Date().toISOString(), granted_by: user.id },
          { onConflict: 'user_id' }
        )
      if (error) return json(500, { error: error.message })
    } else {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
      if (error) return json(500, { error: error.message })
    }

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method Not Allowed' })
}
