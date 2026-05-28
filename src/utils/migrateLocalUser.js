// Supabase 로그인 후 기존 로컬 userId 데이터를 새 userId로 재할당하는 마이그레이션 유틸
import { db } from './db'

// 마이그레이션 대상 테이블 (aiCredentials 제외 — 보안 필수)
const MIGRATE_TABLES = ['transactions', 'cashFlows', 'calendarEvents', 'dailyPnl', 'reports']

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

  // 이미 마이그레이션했는지 확인 (localStorage 플래그)
  const migratedKey = `migrated_to_${newUserId}`
  if (localStorage.getItem(migratedKey)) return false

  try {
    // 1. 새 userId로 기존 데이터가 있는지 확인
    const existingCount = await db.transactions
      .where('userId').equals(newUserId).count()

    if (existingCount > 0) {
      // 이미 데이터 있음 — 마이그레이션 불필요
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

    // 3. 각 테이블의 구 userId 레코드를 새 userId로 업데이트
    for (const table of MIGRATE_TABLES) {
      if (!db[table]) continue

      for (const oldUserId of legacyUserIds) {
        await db[table]
          .where('userId').equals(oldUserId)
          .modify({ userId: newUserId })
      }
    }

    localStorage.setItem(migratedKey, '1')
    console.info(`[Migration] 로컬 데이터를 Supabase 계정으로 이전 완료 (${legacyUserIds.join(', ')} → ${newUserId})`)
    return true
  } catch (err) {
    console.warn('[Migration] userId 마이그레이션 실패:', err)
    return false
  }
}
