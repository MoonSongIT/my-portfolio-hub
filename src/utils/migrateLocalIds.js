// 기존 로컬 user-XXXX ID를 Supabase UUID로 1회성 교정하는 유틸
// M-2: 로그인 직후 await 블로킹으로 실행 — Race Condition 방지
import { db } from './db'
import { useAccountStore } from '../store/accountStore'

// 교정 대상 IndexedDB 테이블 (userId 필드 보유 테이블만)
const MIGRATE_TABLES = ['transactions', 'cashFlows', 'calendarEvents', 'dailyPnl', 'reports']

/**
 * localStorage의 account-storage 내 user-XXXX userId를 UUID로 교정
 */
function migrateAccountStorage(legacyIds, uuid, email) {
  try {
    const raw = localStorage.getItem('account-storage')
    if (!raw) return

    const parsed = JSON.parse(raw)
    const accounts = parsed?.state?.accounts
    if (!Array.isArray(accounts) || accounts.length === 0) return

    let changed = false
    const updated = accounts.map(acc => {
      if (legacyIds.includes(acc.userId)) {
        changed = true
        return { ...acc, userId: uuid, userEmail: email }
      }
      return acc
    })
    if (!changed) return

    parsed.state.accounts = updated
    localStorage.setItem('account-storage', JSON.stringify(parsed))
    useAccountStore.setState(state => ({ ...state, accounts: updated }))
  } catch (err) {
    console.warn('[migrateLocalIds] account-storage 교정 실패:', err)
  }
}

/**
 * 로컬 IndexedDB의 user-XXXX userId 레코드를 Supabase UUID로 교정
 *
 * @param {string} uuid   - 현재 로그인된 Supabase user.id
 * @param {string} email  - 현재 로그인된 Supabase user.email
 * @returns {Promise<number>} 교정된 레코드 총 건수 (0이면 교정 불필요)
 */
export async function migrateLocalIdsIfNeeded(uuid, email) {
  if (!uuid) return 0

  // 이미 완료됐으면 즉시 반환
  const flagKey = `id_migrated_to_${uuid}`
  if (localStorage.getItem(flagKey)) return 0

  try {
    // 1. transactions 샘플로 user-XXXX 패턴 탐색
    const sample = await db.transactions.limit(300).toArray()
    const legacyIds = [
      ...new Set(
        sample
          .map(r => r.userId)
          .filter(id => typeof id === 'string' && id.startsWith('user-'))
      ),
    ]

    // cashFlows도 추가 탐색 (transactions에 데이터 없을 수 있음)
    if (legacyIds.length === 0) {
      const cfSample = await db.cashFlows.limit(100).toArray()
      const cfIds = cfSample
        .map(r => r.userId)
        .filter(id => typeof id === 'string' && id.startsWith('user-'))
      legacyIds.push(...new Set(cfIds))
    }

    // 교정할 구 ID가 없으면 완료 처리
    if (legacyIds.length === 0) {
      migrateAccountStorage([], uuid, email)
      localStorage.setItem(flagKey, new Date().toISOString())
      return 0
    }

    // 2. 각 테이블에서 구 userId 레코드 교정
    let totalCount = 0
    for (const table of MIGRATE_TABLES) {
      if (!db[table]) continue
      for (const legacyId of legacyIds) {
        const count = await db[table]
          .where('userId').equals(legacyId)
          .modify({
            userId: uuid,
            userEmail: email,
            syncedAt: null,   // 미동기화 상태로 표시 → 다음 Upload 대상
          })
        totalCount += count
      }
    }

    // 3. localStorage account-storage 교정
    migrateAccountStorage(legacyIds, uuid, email)

    // 4. 완료 플래그 저장
    localStorage.setItem(flagKey, new Date().toISOString())

    console.info(`[migrateLocalIds] 완료: ${legacyIds.join(', ')} → ${uuid} (${totalCount}건)`)
    return totalCount
  } catch (err) {
    console.warn('[migrateLocalIds] 교정 실패:', err)
    return 0
  }
}
