import { useState, useEffect } from 'react'
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { useImportStore } from '../store/importStore'
import { useJournalStore } from '../store/journalStore'
import { attachExternalIds } from '../utils/importDeduplicator'
import HtsFileDropzone from '../components/import/HtsFileDropzone'
import ImportColumnMapper from '../components/import/ImportColumnMapper'
import ImportPreviewTable from '../components/import/ImportPreviewTable'
import ImportConfirmDialog from '../components/import/ImportConfirmDialog'
import ImportResultDialog from '../components/import/ImportResultDialog'

const STEPS = [
  { label: '파일 선택' },
  { label: '컬럼 확인' },
  { label: '미리보기' },
  { label: '적용' },
]

function StepIndicator({ current }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  done
                    ? 'bg-blue-600 text-white'
                    : active
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                    : 'bg-gray-100 text-gray-400',
                ].join(' ')}
              >
                {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={[
                  'mt-1 text-xs whitespace-nowrap',
                  active ? 'text-blue-700 font-medium' : 'text-gray-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-12 h-0.5 mb-4 mx-1',
                  i < current ? 'bg-blue-500' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function ImportHts() {
  const [step, setStep] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [applyResult, setApplyResult] = useState(null)

  const parsedSheets = useImportStore((s) => s.parsedSheets)
  const selectedSheet = useImportStore((s) => s.selectedSheet)
  const setPreviewRows = useImportStore((s) => s.setPreviewRows)
  const reset = useImportStore((s) => s.reset)
  const entries = useJournalStore((s) => s.entries)

  // 파일 파싱 완료 시 자동으로 컬럼 확인 단계로 이동
  useEffect(() => {
    if (step === 0 && parsedSheets.length > 0) {
      setStep(1)
    }
  }, [parsedSheets.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function preparePreview() {
    const sheet = parsedSheets.find((s) => s.sheetName === selectedSheet)
    if (!sheet) return

    const withIds = await attachExternalIds(sheet.entries)
    const existingIds = new Set(
      entries.filter((e) => e.externalId).map((e) => e.externalId)
    )

    const rows = withIds.map((entry) => ({
      entry,
      isDuplicate: existingIds.has(entry.externalId),
      isExcluded: existingIds.has(entry.externalId),
    }))
    setPreviewRows(rows)
    setStep(2)
  }

  function canGoNext() {
    if (step === 0) return parsedSheets.length > 0
    if (step === 1) return parsedSheets.length > 0
    if (step === 2) return true
    return false
  }

  async function handleNext() {
    if (step === 1) {
      await preparePreview()
    } else if (step === 2) {
      setShowConfirm(true)
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (step === 0) return
    if (step === 1) {
      reset()
      setStep(0)
    } else {
      setStep((s) => s - 1)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">HTS 거래내역 가져오기</h1>
        <p className="text-sm text-gray-500">
          유진투자증권 HTS에서 다운로드한 엑셀 파일을 일지에 일괄 import합니다.
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[260px]">
        {step === 0 && <HtsFileDropzone />}
        {step === 1 && <ImportColumnMapper />}
        {step === 2 && <ImportPreviewTable />}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          이전
        </button>

        {step < 3 && (
          <button
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex items-center gap-1 px-5 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {step === 2 ? '적용하기' : '다음'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {showConfirm && (
        <ImportConfirmDialog
          onCancel={() => setShowConfirm(false)}
          onApplied={(stats) => {
            setShowConfirm(false)
            setApplyResult(stats)
          }}
        />
      )}
      {applyResult && <ImportResultDialog result={applyResult} />}
    </div>
  )
}
