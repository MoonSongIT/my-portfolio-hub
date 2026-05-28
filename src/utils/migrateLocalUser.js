// Supabase 로그인 후 기존 로컬 userId 데이터를 새 userId로 재할당하는 마이그레이션 유틸
import { db } from './db'
import { useAccountStore } from '../store/accountStore'

// 마이그레이션 대상 테이블 (aiCredentials 제외 — 보안 필수)
const MIGRATE_TABLES = ['transactions', 'cashFlows', 'calendarEvents', 'dailyPnl', 'reports']

/**
 * localStorage의 account-storage에서 구 userId를 새 userId로 교체.
 * accountStore는 IndexedDB 대신 Zustand persist(localStorage)를 사용하므로 별도 처리 필요.
 */
function migrateAccountStorage(legacyUserIds, newUserId) {
  try {
    const raw = localStorage.getItem('account-storage')
    if (!raw) return

    const parsed = JSON.parse(raw)
    const accounts = parsed?.state?.accounts
    if (!Array.isArray(accounts) || accounts.length === 0) return

    let changed = false
    const updated = accounts.map(acc => {
      if (legacyUserIds.includes(acc.userId)) {
        changed = true
        return { ...acc, userId: newUserId }
      }
      return acc
    })
    if (!changed) return

    // localStorage 직접 업데이트
    parsed.state.accounts = updated
    localStorage.setItem('account-storage', JSON.stringify(parsed))

    // 인메모리 스토어도 즉시 반영 (리렌더 트리거)
    useAccountStore.setState({ accounts: updated })
    console.info('[Migration] account-storage 계좌 userId 재할당 완료')
  } catch (err) {
    console.warn('[Migration] account-storage 마이그레이션 실패:', err)
  }
}

/**
 * 로컬 "user-*" 형식 userId 데이터를 Supabase UUID로 재할당
 *
 * 조건: newUserId로 조회했을 때 데이터가 없고,
 *       "user-" 접두사를 가진 구 userId 데이터가 존재할 때만 실행
 *
 * @param {string} newUserId - 현재 Supabase user.id (UUID)
 * @returns {Promise<boolean>} 마이그레이션이 실행되었으면 true
 */
export async function migrateLocalUserData(newUserId) {
  if (!newUserId) return false

  // ── 계좌 마이그레이션 (IDB와 독립적 — 별도 플래그 사용) ──
  // IDB 마이그레이션 완료 여부와 무관하게, 계좌의 userId가 구 형식이면 항상 재할당
  const accountMigratedKey = `account_migrated_to_${newUserId}`
  if (!localStorage.getItem(accountMigratedKey)) {
    const legacyInAccounts = [...new Set(
      (useAccountStore.getState().accounts || [])
        .map(a => a.userId)
        .filter(id => typeof id === 'string' && id.startsWith('user-'))
    )]
    if (legacyInAccounts.length > 0) {
      migrateAccountStorage(legacyInAccounts, newUserId)
    }
    localStorage.setItem(accountMigratedKey, '1')
  }

  // ── IndexedDB 마이그레이션 ──
  const migratedKey = `migrated_to_${newUserId}`
  if (localStorage.getItem(migratedKey)) return false

  try {
    // 1. 새 userId로 기존 데이터가 있는지 확인
    const existingCount = await db.transactions
      .where('userId').equals(newUserId).count()

    if (existingCount > 0) {
      // IDB는 이미 마이그레이션됨
      localStorage.setItem(migratedKey, '1')
      return false
    }

    // 2. "user-" 접두사를 가진 구 userId 레코드 탐색
    const sampleRecords = await db.transactions.limit(200).toArray()
    const legacyUserIds = [
      ...new Set(
        sampleRecords
          .map(r => r.userId)
          .filter(id => typeof id === 'string' && id.startsWith('user-'))
      )
    ]

    if (legacyUserIds.length === 0) {
      // 구 데이터 없음 — 진짜 신규 사용자
      localStorage.setItem(migratedKey, '1')
      return false
    }

    // 3. 각 IndexedDB 테이블의 구 userId 레코드를 새 userId로 업데이트
    for (const table of MIGRATE_TABLES) {
      if (!db[table]) continue

      for (const oldUserId of legacyUserIds) {
        await db[table]
          .where('userId').equals(oldUserId)
          .modify({ userId: newUserId })
      }
    }

    // 4. localStorage의 계좌(account-storage) userId도 재할당
    migrateAccountStorage(legacyUserIds, newUserId)

    localStorage.setItem(migratedKey, '1')
    console.info(`[Migration] 로컬 데이터를 Supabase 계정으로 이전 완료 (${legacyUserIds.join(', ')} → ${newUserId})`)
    return true
  } catch (err) {
    console.warn('[Migration] userId 마이그레이션 실패:', err)
    return false
  }
}
