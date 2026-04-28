import { useState } from 'react'
import { toast } from 'sonner'
import { useImportStore } from '../../store/importStore'
import { useJournalStore, BUY_PSYCHOLOGY, SELL_PSYCHOLOGY } from '../../store/journalStore'
import { usePortfolioStore } from '../../store/portfolioStore'

const ALL_PSYCHOLOGY = [
  '(심리 미설정)',
  ...BUY_PSYCHOLOGY.filter((p) => p !== '기타'),
  ...SELL_PSYCHOLOGY.filter((p) => p !== '기타'),
  '기타',
]

export default function ImportConfirmDialog({ onCancel, onApplied }) {
  const { previewRows, bulkPsychology, setBulkPsychology, reset } = useImportStore((s) => ({
    previewRows: s.previewRows,
    bulkPsychology: s.bulkPsychology,
    setBulkPsychology: s.setBulkPsychology,
    reset: s.reset,
  }))
  const addEntriesBulk = useJournalStore((s) => s.addEntriesBulk)
  const recomputeFromJournal = usePortfolioStore((s) => s.recomputeFromJournal)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">거래내역 적용 확인</h2>

        {/* 요약 */}
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-600">신규 추가</span>
            <span className="font-semibold text-green-700">{newRows.length}건</span>
          </div>
          {dupIncludedRows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">중복 포함 (강제 추가)</span>
              <span className="font-semibold text-yellow-700">{dupIncludedRows.length}건</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-600">제외 (skip)</span>
            <span className="font-semibold text-gray-400">{skippedRows.length}건</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-xl">
            <span className="font-medium text-gray-700">합계 적용</span>
            <span className="font-bold text-blue-700">{includedRows.length}건</span>
          </div>
        </div>

        {/* 심리 일괄 설정 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            매매 심리 일괄 설정 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <select
            value={bulkPsychology ?? '(심리 미설정)'}
            onChange={(e) =>
              setBulkPsychology(e.target.value === '(심리 미설정)' ? null : e.target.value)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ALL_PSYCHOLOGY.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400">
            선택하면 import되는 모든 거래에 동일 심리가 설정됩니다.
          </p>
        </div>

        {/* 보유종목 재계산 옵션 */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={recompute}
            onChange={(e) => setRecompute(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">보유 종목도 재계산</span>
        </label>

        {/* 버튼 */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={isSubmitting || includedRows.length === 0}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isSubmitting ? '저장 중…' : `${includedRows.length}건 적용`}
          </button>
        </div>
      </div>
    </div>
  )
}
