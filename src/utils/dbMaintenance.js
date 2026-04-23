import { db } from './db'
import { useSettingsStore } from '../store/settingsStore'

// ─── 오래된 데이터 자동 정리 ───
// 앱 시작 시 호출. 마지막 정리 후 24시간 미경과 시 스킵.

export async function runMaintenanceIfNeeded() {
  const { lastCleanupDate, setLastCleanupDate } = useSettingsStore.getState()

  // 마지막 정리 후 24시간 미경과 시 스킵
  if (lastCleanupDate) {
    const hoursSinceLast = (Date.now() - new Date(lastCleanupDate).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLast < 24) return
  }

  await cleanOldData()
  setLastCleanupDate(new Date().toISOString())
}

// 즉시 실행 (설정 페이지 "지금 정리" 버튼용)
export async function runMaintenanceNow() {
  const { setLastCleanupDate } = useSettingsStore.getState()
  const result = await cleanOldData()
  setLastCleanupDate(new Date().toISOString())
  return result
}

async function cleanOldData() {
  const now = new Date()
  const stats = { priceHistory: 0, reports: 0, alertHistory: 0 }

  try {
    // priceHistory: 6개월 이상 데이터 삭제
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]
    stats.priceHistory = await db.priceHistory
      .where('date').below(sixMonthsAgoStr)
      .delete()

    // reports: 1년 이상 된 리포트 삭제
    const oneYearAgo = new Date(now)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoStr = oneYearAgo.toISOString()
    stats.reports = await db.reports
      .where('createdAt').below(oneYearAgoStr)
      .delete()

    // alertHistory: 3개월 이상 된 알림 삭제
    const threeMonthsAgo = new Date(now)
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const threeMonthsAgoStr = threeMonthsAgo.toISOString()
    stats.alertHistory = await db.alertHistory
      .where('triggeredAt').below(threeMonthsAgoStr)
      .delete()
  } catch (err) {
    console.warn('[dbMaintenance] 정리 중 오류:', err)
  }

  return stats
}
