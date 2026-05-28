// 관리자 API 클라이언트 — 사용자 역할 조회 및 변경
import { useAuthStore } from '@/store/authStore'

const BASE = '/api/admin'

function getAuthHeaders() {
  const session = useAuthStore.getState().supabaseSession
  if (!session?.access_token) throw new Error('로그인 세션이 없습니다')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

/**
 * 전체 사용자 목록 + 역할 조회
 * @returns {Promise<Array<{ id, email, createdAt, lastSignIn, role, grantedAt }>>}
 */
export async function fetchAdminUsers() {
  const res = await fetch(`${BASE}/users`, { headers: getAuthHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `사용자 목록 조회 실패 (${res.status})`)
  }
  const { users } = await res.json()
  return users
}

/**
 * 대상 사용자의 역할 변경
 * @param {string} targetUserId
 * @param {'admin'|'user'} role
 */
export async function updateUserRole(targetUserId, role) {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetUserId, role }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `역할 변경 실패 (${res.status})`)
  }
  return res.json()
}
