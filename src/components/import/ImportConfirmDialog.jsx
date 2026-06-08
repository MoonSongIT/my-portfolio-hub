import { useState } from 'react'
import { toast } from 'sonner'
import { useImportStore } from '../../store/importStore'
import { useJournalStore, BUY_PSYCHOLOGY, SELL_PSYCHOLOGY } from '../../store/journalStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import { useAccountStore } from '../../store/accountStore'
import { useAuthStore } from '../../store/authStore'

const ALL_PSYCHOLOGY = [
  '(심리 미설정)',
  ...BUY_PSYCHOLOGY.filter((p) => p !== '기타'),
  ...SELL_PSYCHOLOGY.filter((p) => p !== '기타'),
  '기타',
]

const SELECT_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75rem_center] pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer'

export default function ImportConfirmDialog({ onCancel, onApplied }) {
  const previewRows = useImportStore((s) => s.previewRows)
  const bulkPsychology = useImportStore((s) => s.bulkPsychology)
  const setBulkPsychology = useImportStore((s) => s.setBulkPsychology)
  const reset = useImportStore((s) => s.reset)
  const addEntriesBulk = useJournalStore((s) => s.addEntriesBulk)
  const recomputeFromJournal = usePortfolioStore((s) => s.recomputeFromJournal)
  const currentUserId = useAuthStore((s) => s.currentUser?.id)
  const allAccounts = useAccountStore((s) => s.accounts)
  const accounts = allAccounts.filter((a) => a.userId === currentUserId)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [recompute, setRecompute] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const includedRows = previewRows.filter((r) => !r.isExcluded)
  const skippedRows = previewRows.filter((r) => r.isExcluded)
  const newRows = includedRows.filter((r) => !r.isDuplicate)
  const dupIncludedRows = includedRows.filter((r) => r.isDuplicate)

  async function handleApply() {
    if (includedRows.length === 0) {
      toast.error('적용할 데이터가 없습니다.')
      return
    }

    setIsSubmitting(true)
    try {
      const entries = includedRows.map((r) => ({
        ...r.entry,
        psychology:
          bulkPsychology && bulkPsychology !== '(심리 미설정)' ? bulkPsychology : undefined,
        accountId: selectedAccountId || undefined,
      }))
      await addEntriesBulk(entries)

      if (recompute) {
        recomputeFromJournal()
      }

      reset()
      onApplied({
        added: includedRows.length,
        skipped: skippedRows.length,
        recomputed: recompute,
      })
    } catch (err) {
      toast.error('저장 실패: ' + (err?.message ?? '알 수 없는 오류'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm space-y-0 overflow-hidden">

        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">거래내역 적용 확인</h2>
          <p className="text-xs text-gray-400 mt-0.5">아래 내용을 확인한 뒤 적용하세요</p>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* 요약 카드 */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-gray-500">신규 추가</span>
              <span className="font-semibold text-green-600">{newRows.length}건</span>
            </div>
            {dupIncludedRows.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">중복 포함</span>
                <span className="font-semibold text-amber-600">{dupIncludedRows.length}건</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-gray-500">제외 (skip)</span>
              <span className="font-semibold text-gray-400">{skippedRows.length}건</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
              <span className="font-semibold text-gray-700">합계 적용</span>
              <span className="font-bold text-blue-700 text-base">{includedRows.length}건</span>
            </div>
          </div>

          {/* 계좌 연결 */}
          <div className="space-y-1.5">
            <label htmlFor="import-account" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              계좌 연결 <span className="normal-case font-normal text-gray-400">(선택)</span>
            </label>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                등록된 계좌가 없습니다. 설정에서 계좌를 먼저 추가해주세요.
              </p>
            ) : (
              <select
                id="import-account"
                name="accountId"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">(계좌 미연결)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.broker ? ` · ${a.broker}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 심리 일괄 설정 */}
          <div className="space-y-1.5">
            <label htmlFor="import-bulk-psychology" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              매매 심리 일괄 설정 <span className="normal-case font-normal text-gray-400">(선택)</span>
            </label>
            <select
              id="import-bulk-psychology"
              name="bulkPsychology"
              value={bulkPsychology ?? '(심리 미설정)'}
              onChange={(e) =>
                setBulkPsychology(e.target.value === '(심리 미설정)' ? null : e.target.value)
              }
              className={SELECT_CLS}
            >
              {ALL_PSYCHOLOGY.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              선택 시 import되는 모든 거래에 동일 심리가 적용됩니다.
            </p>
          </div>

          {/* 보유종목 재계산 */}
          <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
            <input
              type="checkbox"
              checked={recompute}
              onChange={(e) => setRecompute(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">보유 종목도 재계산</p>
              <p className="text-xs text-gray-400">import 후 포트폴리오 자동 갱신</p>
            </div>
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2.5 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={isSubmitting || includedRows.length === 0}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition"
          >
            {isSubmitting ? '저장 중…' : `${includedRows.length}건 적용`}
          </button>
        </div>
      </div>
    </div>
  )
}
