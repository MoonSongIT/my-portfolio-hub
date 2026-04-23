import { useState, useEffect, useCallback } from 'react'
import { Database, Trash2, RefreshCw } from 'lucide-react'
import { db } from '../../utils/db'
import { runMaintenanceNow } from '../../utils/dbMaintenance'
import { useSettingsStore } from '../../store/settingsStore'
import { toast } from 'sonner'

// 바이트 → 읽기 쉬운 크기 문자열 변환
function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// 테이블별 레코드 수 조회
async function fetchTableCounts() {
  const [transactions, cashFlows, dailyPnl, reports, priceHistory, alertHistory] =
    await Promise.all([
      db.transactions.count(),
      db.cashFlows.count(),
      db.dailyPnl.count(),
      db.reports.count(),
      db.priceHistory.count(),
      db.alertHistory.count(),
    ])
  return { transactions, cashFlows, dailyPnl, reports, priceHistory, alertHistory }
}

const TABLE_LABELS = {
  transactions:  '거래 내역',
  cashFlows:     '자금 흐름',
  dailyPnl:      '일별 손익',
  reports:       '리포트',
  priceHistory:  '주가 히스토리',
  alertHistory:  '알림 히스토리',
}

export default function StorageInfo() {
  const lastCleanupDate = useSettingsStore(s => s.lastCleanupDate)
  const [storageEstimate, setStorageEstimate] = useState(null)
  const [tableCounts, setTableCounts]         = useState(null)
  const [isCleaning, setIsCleaning]           = useState(false)
  const [loading, setLoading]                 = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [estimate, counts] = await Promise.all([
        navigator.storage?.estimate?.(),
        fetchTableCounts(),
      ])
      setStorageEstimate(estimate)
      setTableCounts(counts)
    } catch (err) {
      console.warn('[StorageInfo] 조회 실패:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCleanNow = async () => {
    setIsCleaning(true)
    try {
      const stats = await runMaintenanceNow()
      const total = Object.values(stats).reduce((a, b) => a + b, 0)
      toast.success(`정리 완료: ${total}건 삭제됨`)
      await refresh()
    } catch (err) {
      toast.error('정리 중 오류가 발생했습니다.')
    } finally {
      setIsCleaning(false)
    }
  }

  const usedPct = storageEstimate?.quota
    ? Math.round((storageEstimate.usage / storageEstimate.quota) * 100)
    : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">저장소 현황</h3>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 저장 용량 */}
      {storageEstimate && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">사용 / 할당량</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatBytes(storageEstimate.usage ?? 0)} / {formatBytes(storageEstimate.quota ?? 0)}
            </span>
          </div>
          {usedPct !== null && (
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 테이블별 레코드 수 */}
      {tableCounts && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">테이블별 레코드</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <div key={key} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700">
                <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  {(tableCounts[key] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 마지막 정리 날짜 */}
      <div className="flex items-center justify-between text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
        <span className="text-gray-500 dark:text-gray-400">
          마지막 정리:{' '}
          {lastCleanupDate
            ? new Date(lastCleanupDate).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
            : '아직 없음'}
        </span>
        <button
          onClick={handleCleanNow}
          disabled={isCleaning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 disabled:opacity-40 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {isCleaning ? '정리 중...' : '지금 정리'}
        </button>
      </div>
    </div>
  )
}
