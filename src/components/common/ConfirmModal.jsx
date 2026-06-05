// 공용 확인 다이얼로그 — 위험/경고 액션 전 사용자 재확인
import { AlertCircle, Trash2 } from 'lucide-react'

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   description: string,
 *   subText?: string,
 *   confirmLabel?: string,
 *   variant?: 'danger' | 'warning',
 *   loading?: boolean,
 *   loadingLabel?: string,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmModal({
  open,
  title,
  description,
  subText,
  confirmLabel = '확인',
  variant = 'danger',
  loading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  const isDanger  = variant === 'danger'
  const iconBg    = isDanger ? 'bg-red-100 dark:bg-red-900/30'  : 'bg-amber-100 dark:bg-amber-900/30'
  const iconColor = isDanger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
  const btnColor  = isDanger ? 'bg-red-600 hover:bg-red-700'    : 'bg-blue-600 hover:bg-blue-700'
  const Icon      = isDanger ? Trash2 : AlertCircle

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
        {/* 아이콘 + 제목 */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {subText && <p className="text-sm text-gray-500 dark:text-gray-400">{subText}</p>}
          </div>
        </div>

        {/* 본문 */}
        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition ${btnColor}`}
          >
            <Icon className="w-4 h-4" />
            {loading && loadingLabel ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
