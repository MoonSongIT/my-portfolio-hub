// Finnhub API 키 저장·삭제 패널 (설정 페이지용)
import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import useAiCredentialStore from '../../store/aiCredentialStore.js'
import { maskKey } from '../../utils/apiKeyValidator.js'

export default function FinnhubKeyPanel() {
  const { finnhubApiKey, finnhubSavedAt, hasFinnhubKey, setFinnhubKey, clearFinnhubKey } = useAiCredentialStore()
  const [inputValue, setInputValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const keyExists = hasFinnhubKey()

  function StatusBadge() {
    if (!keyExists) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          미설정
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        저장됨
        {finnhubSavedAt && (
          <span className="text-green-600/70 dark:text-green-500/70">
            ({new Date(finnhubSavedAt).toLocaleDateString('ko-KR')})
          </span>
        )}
      </span>
    )
  }

  async function handleSave() {
    const key = inputValue.trim()
    if (!key) {
      toast.error('API 키를 입력해주세요.')
      return
    }
    await setFinnhubKey(key)
    setInputValue('')
    toast.success('Finnhub API 키가 저장되었습니다.')
  }

  async function handleDelete() {
    await clearFinnhubKey()
    setDeleteConfirmOpen(false)
    toast.success('Finnhub API 키가 삭제되었습니다.')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Finnhub API 키</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            미국 주식 실적·IPO 일정 자동 탐색에 사용됩니다.
          </p>
        </div>
        <StatusBadge />
      </div>

      {/* 저장된 키 마스킹 표시 */}
      {keyExists && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm font-mono text-gray-600 dark:text-gray-400">
          {showKey ? finnhubApiKey : maskKey(finnhubApiKey)}
          <button
            onClick={() => setShowKey(v => !v)}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label={showKey ? '키 숨기기' : '키 보기'}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* 키 입력 — form으로 감싸야 브라우저 password 경고 없음 */}
      <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
        <input
          type="password"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={keyExists ? '새 키로 교체하려면 입력하세요' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!inputValue.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-40 transition"
        >
          저장
        </button>
        {keyExists && (
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="ml-auto px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition"
          >
            삭제
          </button>
        )}
      </div>

      {/* 보안 안내 */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          이 키는 본인 브라우저(IndexedDB)에만 저장됩니다. 공유 PC 사용을 피하세요.{' '}
          <a
            href="https://finnhub.io/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-0.5"
          >
            Finnhub 키 발급 <ExternalLink className="w-3 h-3" />
          </a>
        </span>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Finnhub API 키 삭제</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">미국 실적·IPO 일정 자동 탐색 기능을 사용할 수 없게 됩니다</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">저장된 Finnhub API 키를 삭제하시겠습니까?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
