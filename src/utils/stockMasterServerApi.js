// 서버 종목 마스터 API 클라이언트 (Vercel Functions 호출)
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/store/authStore'
import { getByExchange, upsertSync } from '@/utils/stockMasterDb'

const BASE = '/api/stock-master'
const UPLOAD_CHUNK = 500

// 서버에서 관리하는 거래소 목록
export const SERVER_EXCHANGES = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF', 'NYSE', 'NASDAQ', 'US_ETF']

// ── 메타 정보 조회 ────────────────────────────────────────────────────────────

/**
 * 서버 종목 마스터 메타 정보 조회 (인증 불필요)
 * @returns {Promise<{ total: number, byExchange: Record<string, number>, uploadedAt: string|null }>}
 */
export async function fetchServerMeta() {
  const res = await fetch(`${BASE}/meta`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `서버 메타 조회 실패 (${res.status})`)
  }
  return res.json()
}

// ── 관리자 권한 확인 ─────────────────────────────────────────────────────────

/**
 * 현재 로그인된 Supabase 사용자의 관리자 권한 확인
 * user_roles 테이블을 직접 조회 (RLS 가 본인 행만 반환)
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin() {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('[checkIsAdmin] 세션 없음 — false 반환')
    return false
  }

  // maybeSingle(): 행 없으면 null 반환 (single()은 행 없을 때 406 에러 발생)
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (error) {
    console.warn('[checkIsAdmin] 쿼리 오류:', error.code, error.message)
  }

  return data?.role === 'admin'
}

// ── 다운로드 (서버 → 로컬 IDB) ──────────────────────────────────────────────

/**
 * 단일 거래소 다운로드 후 로컬 IDB upsertSync
 * @param {string} exchange
 * @returns {Promise<{ added: number, changed: number, removed: number, durationMs: number }>}
 */
export async function downloadExchangeFromServer(exchange) {
  const res = await fetch(`${BASE}/download?exchange=${encodeURIComponent(exchange)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `다운로드 실패: ${exchange} (${res.status})`)
  }
  const { rows } = await res.json()
  return upsertSync(exchange, rows)
}

/**
 * 서버에서 전체 거래소 일괄 다운로드
 * @param {{ onProgress?: (phase: string, exchange: string, done: number, total: number) => void, signal?: AbortSignal }} opts
 * @returns {Promise<Record<string, { added: number, changed: number, removed: number }>>}
 */
export async function downloadAllFromServer({ onProgress, signal } = {}) {
  const results = {}
  const total = SERVER_EXCHANGES.length

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const exchange = SERVER_EXCHANGES[i]
    onProgress?.('download', exchange, i, total)

    const stats = await downloadExchangeFromServer(exchange)
    results[exchange] = stats
  }

  onProgress?.('download', '', total, total)
  return results
}

// ── 업로드 (로컬 IDB → 서버) ─────────────────────────────────────────────────

/**
 * 로컬 IDB 의 전체 종목을 청크 단위로 서버에 업로드 (관리자 전용)
 * @param {{ onProgress?: (phase: string, exchange: string, done: number, total: number) => void, signal?: AbortSignal }} opts
 * @returns {Promise<{ upserted: number }>}
 */
export async function uploadAllToServer({ onProgress, signal } = {}) {
  const session = useAuthStore.getState().supabaseSession
  if (!session?.access_token) throw new Error('로그인 세션이 없습니다')

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }

  let totalUpserted = 0
  const total = SERVER_EXCHANGES.length

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const exchange = SERVER_EXCHANGES[i]
    onProgress?.('upload', exchange, i, total)

    const rows = await getByExchange(exchange, { includeInactive: true })
    if (rows.length === 0) continue

    // 500행 청크 단위로 분할 전송
    for (let offset = 0; offset < rows.length; offset += UPLOAD_CHUNK) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      const chunk = rows.slice(offset, offset + UPLOAD_CHUNK)
      const res = await fetch(`${BASE}/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rows: chunk }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `업로드 실패: ${exchange} (${res.status})`)
      }

      const { upserted } = await res.json()
      totalUpserted += upserted
    }
  }

  onProgress?.('upload', '', total, total)
  return { upserted: totalUpserted }
}
