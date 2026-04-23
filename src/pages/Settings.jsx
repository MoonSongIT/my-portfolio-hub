import { useRef, useState } from 'react'
import { Moon, Sun, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '../store/settingsStore'
import StorageInfo from '../components/common/StorageInfo'
import { exportAllData, importData } from '../utils/dataExport'
import StockMasterPanel from '../components/settings/StockMasterPanel'

export default function Settings() {
  const { theme, toggleTheme, benchmarkIndex, setBenchmark } = useSettingsStore()

  const fileInputRef = useRef(null)

  const [importing, setImporting]           = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [confirmOpen, setConfirmOpen]       = useState(false)
  const [pendingFile, setPendingFile]       = useState(null)

  // ─── 내보내기 ───
  const handleExport = async () => {
    try {
      await exportAllData()
      toast.success('백업 파일이 다운로드되었습니다.')
    } catch (err) {
      console.error(err)
      toast.error('내보내기 중 오류가 발생했습니다.')
    }
  }

  // ─── 가져오기: 파일 선택 ───
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('.json 파일만 가져올 수 있습니다.')
      return
    }
    setPendingFile(file)
    setConfirmOpen(true)
    e.target.value = '' // 같은 파일 재선택 가능하도록 초기화
  }

  // ─── 가져오기: 확인 후 실행 ───
  const handleImportConfirm = async () => {
    if (!pendingFile) return
    setConfirmOpen(false)
    setImporting(true)
    setImportProgress({ step: 0, total: 5, label: '준비 중...' })

    try {
      const result = await importData(pendingFile, {
        onProgress: (step, total, label) => setImportProgress({ step, total, label }),
      })
      toast.success(`가져오기 완료 (백업일: ${new Date(result.importedAt).toLocaleDateString('ko-KR')})`)
    } catch (err) {
      console.error(err)
      toast.error(`가져오기 실패: ${err.message}`)
    } finally {
      setImporting(false)
      setImportProgress(null)
      setPendingFile(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">설정</h1>

      {/* ─── 앱 설정 ─── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">앱 설정</h2>

        {/* 테마 */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">테마</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              현재: {theme === 'dark' ? '다크 모드' : '라이트 모드'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? '라이트로 전환' : '다크로 전환'}
          </button>
        </div>

        {/* 벤치마크 */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">벤치마크 지수</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">리포트 비교 기준</p>
          </div>
          <select
            value={benchmarkIndex}
            onChange={(e) => setBenchmark(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="KOSPI">KOSPI</option>
            <option value="SP500">S&P 500</option>
          </select>
        </div>
      </section>

      {/* ─── 종목 DB 관리 ─── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">종목 DB 관리</h2>
        <StockMasterPanel />
      </section>

      {/* ─── 데이터 관리 ─── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">데이터 관리</h2>

        {/* 내보내기 / 가져오기 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">백업 & 복원</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              모든 거래 내역, 관심종목, 설정을 JSON 파일로 저장하거나 복원합니다.
            </p>
          </div>

          <div className="flex gap-3">
            {/* 내보내기 */}
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              내보내기 (JSON)
            </button>

            {/* 가져오기 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition disabled:opacity-40"
            >
              <Upload className="w-4 h-4" />
              가져오기 (JSON)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* 진행률 표시 */}
          {importing && importProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{importProgress.label}</span>
                <span>{importProgress.step} / {importProgress.total}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.step / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 경고 문구 */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>가져오기를 실행하면 기존 데이터 위에 덮어씁니다. 먼저 내보내기로 백업하세요.</span>
          </div>
        </div>

        {/* 저장소 현황 */}
        <StorageInfo />
      </section>

      {/* ─── 앱 정보 ─── */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">앱 정보</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between"><span>앱 이름</span><span className="text-gray-900 dark:text-white font-medium">My Portfolio Hub</span></div>
          <div className="flex justify-between"><span>버전</span><span className="text-gray-900 dark:text-white font-medium">0.9.0 (Phase 5)</span></div>
          <div className="flex justify-between"><span>저장 방식</span><span className="text-gray-900 dark:text-white font-medium">로컬 전용 (IndexedDB + LocalStorage)</span></div>
        </div>
      </section>

      {/* ─── 확인 다이얼로그 ─── */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">데이터 가져오기</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{pendingFile?.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              백업 파일의 데이터를 현재 데이터 위에 덮어씁니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmOpen(false); setPendingFile(null) }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                취소
              </button>
              <button
                onClick={handleImportConfirm}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                가져오기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
