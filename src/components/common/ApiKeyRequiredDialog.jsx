import { useNavigate } from 'react-router-dom'
import { KeyRound, ExternalLink } from 'lucide-react'

/**
 * AI 기능 진입 시 API 키 미설정 안내 모달
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function ApiKeyRequiredDialog({ open, onClose }) {
  const navigate = useNavigate()

  if (!open) return null

  function handleGoToSettings() {
    onClose()
    navigate('/settings')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">API 키가 필요합니다</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI 기능을 사용하려면 키 등록이 필요합니다</p>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p>
            Anthropic Claude API 키를 등록하면 AI 코치, 종목 분석, 성과 리포트 등 모든 AI 기능을 사용할 수 있습니다.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            키는 본인 브라우저에만 저장되며 외부로 전송되지 않습니다. API 사용 비용은 Anthropic 계정에서 직접 발생합니다.
          </p>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
          >
            Anthropic Console에서 키 발급하기 <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            취소
          </button>
          <button
            onClick={handleGoToSettings}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            설정 페이지로 이동
          </button>
        </div>
      </div>
    </div>
  )
}
