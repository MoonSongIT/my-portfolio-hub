// Anthropic / DART / Finnhub API 키를 한 패널에서 통합 관리
import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, Loader2, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import useAiCredentialStore from '../../store/aiCredentialStore.js'
import { maskKey } from '../../utils/apiKeyValidator.js'
import ConfirmModal from '../common/ConfirmModal'

const SERVICES = [
  {
    id: 'anthropic',
    name: 'Anthropic AI',
    description: 'AI 채팅 기능',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabel: '키 발급',
    hasValidation: true,
  },
  {
    id: 'dart',
    name: 'DART',
    description: '국내 공시 조회',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://opendart.fss.or.kr/intro/main.do',
    docsLabel: 'DART 키 발급',
    hasValidation: false,
  },
  {
    id: 'finnhub',
    name: 'Finnhub',
    description: '미국 실적·IPO 일정',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://finnhub.io/dashboard',
    docsLabel: 'Finnhub 키 발급',
    hasValidation: false,
  },
]

const STATUS_STYLE = {
  gray:   'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  red:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
}

function getStatus(svc, store) {
  if (svc.id === 'anthropic') {
    if (!store.hasKey())        return { label: '미설정',   color: 'gray' }
    if (store.isValid === true)  return { label: '검증 완료', color: 'green',  date: store.validatedAt }
    if (store.isValid === false) return { label: '검증 실패', color: 'red' }
    return { label: '미검증', color: 'yellow' }
  }
  if (svc.id === 'dart') {
    if (!store.hasDartKey()) return { label: '미설정', color: 'gray' }
    return { label: '저장됨', color: 'green', date: store.dartSavedAt }
  }
  if (svc.id === 'finnhub') {
    if (!store.hasFinnhubKey()) return { label: '미설정', color: 'gray' }
    return { label: '저장됨', color: 'green', date: store.finnhubSavedAt }
  }
}

function keyExists(svc, store) {
  if (svc.id === 'anthropic') return store.hasKey()
  if (svc.id === 'dart')      return store.hasDartKey()
  if (svc.id === 'finnhub')   return store.hasFinnhubKey()
  return false
}

function getCurrentKey(svc, store) {
  if (svc.id === 'anthropic') return store.apiKey
  if (svc.id === 'dart')      return store.dartApiKey
  if (svc.id === 'finnhub')   return store.finnhubApiKey
  return null
}

function StatusBadge({ status }) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[status.color]}`}>
      {status.color === 'green' && <CheckCircle2 className="w-3 h-3" />}
      {status.color === 'red'   && <XCircle className="w-3 h-3" />}
      {status.label}
      {status.date && (
        <span className="opacity-70">({new Date(status.date).toLocaleDateString('ko-KR')})</span>
      )}
    </span>
  )
}

export default function ApiKeyPanel() {
  const store = useAiCredentialStore()
  const [expandedId, setExpandedId]     = useState(null)
  const [inputs, setInputs]             = useState({ anthropic: '', dart: '', finnhub: '' })
  const [showKey, setShowKey]           = useState({ anthropic: false, dart: false, finnhub: false })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id))

  async function handleSave(svc) {
    const key = inputs[svc.id].trim()
    if (!key) { toast.error('API 키를 입력해주세요.'); return }
    if (svc.id === 'anthropic')    await store.setApiKey(key)
    else if (svc.id === 'dart')    await store.setDartKey(key)
    else if (svc.id === 'finnhub') await store.setFinnhubKey(key)
    setInputs(prev => ({ ...prev, [svc.id]: '' }))
    setExpandedId(null)
    toast.success(`${svc.name} API 키가 저장되었습니다.`)
  }

  async function handleValidate() {
    const ok = await store.validateKey()
    if (ok) toast.success('API 키 검증 성공!')
    else    toast.error('API 키 검증 실패. 키를 확인해주세요.')
  }

  async function handleDelete(svc) {
    if (svc.id === 'anthropic')    await store.clearKey()
    else if (svc.id === 'dart')    await store.clearDartKey()
    else if (svc.id === 'finnhub') await store.clearFinnhubKey()
    setDeleteTarget(null)
    toast.success(`${svc.name} API 키가 삭제되었습니다.`)
  }

  const deleteSvc = SERVICES.find(s => s.id === deleteTarget)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {SERVICES.map((svc, idx) => {
        const status     = getStatus(svc, store)
        const exists     = keyExists(svc, store)
        const expanded   = expandedId === svc.id
        const currentKey = getCurrentKey(svc, store)

        return (
          <div key={svc.id} className={idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
            {/* ─── 행 헤더 ─── */}
            <div className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-white">{svc.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{svc.description}</p>
              </div>

              <StatusBadge status={status} />

              {/* Anthropic 검증 버튼 */}
              {svc.hasValidation && exists && (
                <button
                  onClick={handleValidate}
                  disabled={store.isLoading}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 transition"
                >
                  {store.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  검증
                </button>
              )}

              {/* 삭제 버튼 */}
              {exists && (
                <button
                  onClick={() => setDeleteTarget(svc.id)}
                  className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition"
                >
                  삭제
                </button>
              )}

              {/* 변경 / 설정 토글 */}
              <button
                onClick={() => toggleExpand(svc.id)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 transition"
              >
                {exists ? '변경' : '설정'}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* ─── 확장 입력 폼 ─── */}
            {expanded && (
              <div className="px-5 pb-4 pt-3 space-y-2.5 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                {/* 현재 키 마스킹 표시 */}
                {exists && currentKey && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-xs font-mono text-gray-500 dark:text-gray-400">
                    {showKey[svc.id] ? currentKey : maskKey(currentKey)}
                    <button
                      onClick={() => setShowKey(prev => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                      className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      aria-label={showKey[svc.id] ? '키 숨기기' : '키 보기'}
                    >
                      {showKey[svc.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* 키 입력 */}
                <form onSubmit={e => { e.preventDefault(); handleSave(svc) }} className="flex gap-2">
                  {/* 브라우저 접근성: password form에 username 필드 필수 */}
                  <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden="true" readOnly />
                  <input
                    type="password"
                    value={inputs[svc.id]}
                    onChange={e => setInputs(prev => ({ ...prev, [svc.id]: e.target.value }))}
                    placeholder={exists ? '새 키로 교체하려면 입력하세요' : svc.placeholder}
                    autoComplete="new-password"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputs[svc.id].trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-40 transition"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    취소
                  </button>
                </form>

                {/* 키 발급 링크 */}
                <a
                  href={svc.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 underline"
                >
                  {svc.docsLabel} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )
      })}

      {/* ─── 보안 안내 (한 번만) ─── */}
      <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>모든 API 키는 본인 브라우저(IndexedDB)에만 저장됩니다. 공유 PC 사용을 피하세요.</span>
      </div>

      {/* ─── 삭제 확인 모달 ─── */}
      <ConfirmModal
        open={!!deleteSvc}
        title={deleteSvc ? `${deleteSvc.name} API 키 삭제` : ''}
        subText="이 키를 사용하는 기능이 비활성화됩니다."
        description={deleteSvc ? `저장된 ${deleteSvc.name} API 키를 삭제하시겠습니까?` : ''}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => deleteSvc && handleDelete(deleteSvc)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
