import { db } from './db'
import { useAccountStore } from '../store/accountStore'
import { useSettingsStore } from '../store/settingsStore'
import { useWatchlistStore } from '../store/watchlistStore'

const EXPORT_VERSION = '1.0'

// ─── 전체 데이터 내보내기 ───
// IndexedDB + Zustand persist 스토어 데이터를 하나의 JSON으로 다운로드

export async function exportAllData() {
  const [transactions, cashFlows, dailyPnl, reports] = await Promise.all([
    db.transactions.toArray(),
    db.cashFlows.toArray(),
    db.dailyPnl.toArray(),
    db.reports.toArray(),
  ])

  const accounts  = useAccountStore.getState().accounts
  const settings  = (() => {
    const s = useSettingsStore.getState()
    return { theme: s.theme, language: s.language, currency: s.currency, benchmarkIndex: s.benchmarkIndex }
  })()
  const watchlist = useWatchlistStore.getState().watchlist
  const alerts    = useWatchlistStore.getState().alerts

  const exportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    transactions,
    cashFlows,
    dailyPnl,
    reports,
    accounts,
    watchlist,
    alerts,
    settings,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `portfolio-hub-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── 데이터 가져오기 ───
// JSON 파일 파싱 → IndexedDB + Zustand 스토어 복원
// onProgress(step, total) 콜백으로 진행률 전달

export async function importData(jsonFile, { onProgress } = {}) {
  const text = await jsonFile.text()
  const data = JSON.parse(text)

  // 버전 호환성 확인
  if (!data.version || !data.exportedAt) {
    throw new Error('올바른 백업 파일이 아닙니다.')
  }

  const steps = ['transactions', 'cashFlows', 'dailyPnl', 'reports', 'stores']
  let current = 0
  const notify = (label) => {
    current++
    onProgress?.(current, steps.length, label)
  }

  // IndexedDB 복원
  if (data.transactions?.length) {
    await db.transactions.bulkPut(data.transactions)
  }
  notify('거래 내역 복원 완료')

  if (data.cashFlows?.length) {
    await db.cashFlows.bulkPut(data.cashFlows)
  }
  notify('자금 흐름 복원 완료')

  if (data.dailyPnl?.length) {
    await db.dailyPnl.bulkPut(data.dailyPnl)
  }
  notify('일별 손익 복원 완료')

  if (data.reports?.length) {
    await db.reports.bulkPut(data.reports)
  }
  notify('리포트 복원 완료')

  // Zustand 스토어 복원
  if (data.accounts?.length) {
    useAccountStore.setState({ accounts: data.accounts })
  }
  if (data.watchlist) {
    useWatchlistStore.setState({
      watchlist: data.watchlist,
      alerts: data.alerts || [],
    })
  }
  if (data.settings) {
    useSettingsStore.setState({
      theme: data.settings.theme ?? 'light',
      language: data.settings.language ?? 'ko',
      currency: data.settings.currency ?? 'KRW',
      benchmarkIndex: data.settings.benchmarkIndex ?? 'KOSPI',
    })
  }
  notify('설정 및 스토어 복원 완료')

  return { importedAt: data.exportedAt, counts: {
    transactions: data.transactions?.length ?? 0,
    cashFlows: data.cashFlows?.length ?? 0,
    dailyPnl: data.dailyPnl?.length ?? 0,
    reports: data.reports?.length ?? 0,
  }}
}
