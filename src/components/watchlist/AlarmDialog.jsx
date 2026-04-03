import { useState, useEffect } from 'react'
import { Bell, BellOff, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useWatchlistStore } from '../../store/watchlistStore'
import { formatCurrency } from '../../utils/formatters'

export default function AlarmDialog({ open, onOpenChange, stock }) {
  const { alerts, addAlert, removeAlert } = useWatchlistStore()
  const [condition, setCondition] = useState('above')
  const [targetPrice, setTargetPrice] = useState('')
  const [error, setError] = useState('')

  // 이 종목에 연결된 알림만 필터링
  const stockAlerts = alerts.filter(a => a.ticker === stock?.ticker)

  // 다이얼로그 열릴 때 입력값 초기화
  useEffect(() => {
    if (open) {
      setTargetPrice('')
      setError('')
      setCondition('above')
    }
  }, [open])

  const handleAdd = () => {
    const price = parseFloat(targetPrice)
    if (!targetPrice || isNaN(price) || price <= 0) {
      setError('유효한 가격을 입력해주세요')
      return
    }
    setError('')
    addAlert({
      ticker: stock.ticker,
      name: stock.name,
      condition,
      targetPrice: price,
      currency: stock.currency,
    })
    setTargetPrice('')
  }

  if (!stock) return null

  const currency = stock.currency || 'KRW'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            가격 알림 설정 — {stock.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 현재가 표시 */}
          {stock.currentPrice > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              현재가: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(stock.currentPrice, currency)}</span>
            </p>
          )}

          {/* 알림 추가 폼 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">조건</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCondition('above')}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  condition === 'above'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                이상 (↑)
              </button>
              <button
                onClick={() => setCondition('below')}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  condition === 'below'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                이하 (↓)
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              목표가 ({currency})
            </label>
            <Input
              type="number"
              value={targetPrice}
              onChange={(e) => { setTargetPrice(e.target.value); setError('') }}
              placeholder={currency === 'KRW' ? '예: 75000' : '예: 195.5'}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <Button onClick={handleAdd} className="w-full gap-2" size="sm">
            <Bell className="w-4 h-4" />
            알림 추가
          </Button>

          {/* 등록된 알림 목록 */}
          {stockAlerts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">등록된 알림</p>
              {stockAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${alert.condition === 'above' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-gray-700 dark:text-gray-300">
                      {alert.condition === 'above' ? '이상' : '이하'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(alert.targetPrice, alert.currency)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                    title="알림 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {stockAlerts.length === 0 && (
            <div className="py-4 text-center text-gray-400 dark:text-gray-500">
              <BellOff className="w-6 h-6 mx-auto mb-1 opacity-40" />
              <p className="text-xs">등록된 알림이 없습니다</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
