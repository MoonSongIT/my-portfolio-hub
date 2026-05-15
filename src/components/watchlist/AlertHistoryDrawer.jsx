// 알림 발동 이력을 보여주는 우측 슬라이드 드로어
import { BellOff, CheckCheck, Trash2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../ui/sheet'
import { Button } from '../ui/button'
import { useWatchlistStore } from '../../store/watchlistStore'
import { formatCurrency } from '../../utils/formatters'

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function AlertHistoryDrawer({ open, onOpenChange }) {
  const {
    alertHistory,
    markAlertHistoryRead,
    markAllAlertHistoryRead,
    clearAlertHistory,
  } = useWatchlistStore()

  const unreadCount = alertHistory.filter(h => !h.read).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b border-gray-100 dark:border-gray-700 pb-3">
          <SheetTitle className="flex items-center justify-between">
            <span>알림 이력</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-normal">
                {unreadCount}개 새 알림
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* 액션 버튼 */}
        {alertHistory.length > 0 && (
          <div className="flex items-center gap-2 pt-3 pb-1">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAlertHistoryRead}
                className="gap-1.5 text-xs h-7"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                모두 읽음
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={clearAlertHistory}
              className="gap-1.5 text-xs h-7 text-red-500 hover:text-red-600 hover:border-red-300 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              전체 삭제
            </Button>
          </div>
        )}

        {/* 이력 목록 */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          {alertHistory.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
              <BellOff className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">알림 이력이 없습니다</p>
              <p className="text-xs mt-1 opacity-60">가격 알림이 발동되면 여기에 기록됩니다</p>
            </div>
          ) : (
            alertHistory.map((entry) => {
              const isAbove = entry.condition === 'above'
              return (
                <button
                  key={entry.id}
                  onClick={() => !entry.read && markAlertHistoryRead(entry.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    entry.read
                      ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${isAbove ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className={`text-sm font-medium ${entry.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}`}>
                          {entry.name}
                          <span className={`ml-1.5 text-xs font-normal ${isAbove ? 'text-red-500' : 'text-blue-500'}`}>
                            {isAbove ? '↑ 이상 도달' : '↓ 이하 도달'}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          목표가 {formatCurrency(entry.targetPrice, entry.currency)}
                          {entry.currentPrice != null && (
                            <span className="ml-1">→ 현재 {formatCurrency(entry.currentPrice, entry.currency)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                      {formatRelativeTime(entry.firedAt)}
                    </span>
                  </div>
                  {!entry.read && (
                    <p className="text-[10px] text-blue-400 mt-1.5 ml-5">탭하여 읽음 처리</p>
                  )}
                </button>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
