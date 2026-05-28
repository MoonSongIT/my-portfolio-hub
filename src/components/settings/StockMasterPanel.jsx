/**
 * StockMasterPanel.jsx — 종목 마스터 DB 관리 UI
 *
 * 국내/해외 exchange 카드 + 액션 버튼 + 진행바 + 커스텀 종목 폼
 */
import { useState, useRef, useEffect } from 'react'
import {
  Database, RefreshCw, Zap, Trash2,
  AlertCircle, ChevronDown, ChevronUp,
  Server, Upload, Download, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStockMasterStore } from '@/store/stockMasterStore'
import { useAuthStore } from '@/store/authStore'
import {
  syncAll, syncCategory, syncIncremental,
  EXCHANGES, EXCHANGE_LABELS,
} from '@/api/stockMasterApi'
import { stockMasterDb } from '@/utils/stockMasterDb'
import { fetchNaverSector } from '@/api/naverApi'
import {
  fetchServerMeta,
  downloadAllFromServer,
  uploadAllToServer,
} from '@/utils/stockMasterServerApi'
import CustomStockForm from './CustomStockForm'

// ── KRX sector 보강 헬퍼 ──────────────────────────────────────────────────
// KRX 일반종목: sector 비어있는 행만 Naver 조회 (개당 ~1초)
// KRX_ETF: 일괄 'ETF' 라벨 (API 호출 없이)
async function enrichKrxSectors({ onProgress, signal }) {
  // 1단계: KRX_ETF 일괄 처리 ([category+exchange] 복합 인덱스 사용)
  const etfRows = await stockMasterDb.stocks
    .where('[category+exchange]').equals(['DOMESTIC', 'KRX_ETF'])
    .filter(r => !r.sector)
    .toArray()
  if (etfRows.length > 0) {
    const now = new Date().toISOString()
    await stockMasterDb.stocks.bulkPut(
      etfRows.map(r => ({ ...r, sector: 'ETF', updatedAt: now }))
    )
  }

  // 2단계: KRX 일반종목 (KOSPI/KOSDAQ/NXT) 중 sector 미보유 행만 조회
  const targets = await stockMasterDb.stocks
    .where('[category+exchange]').anyOf([
      ['DOMESTIC', 'KOSPI'],
      ['DOMESTIC', 'KOSDAQ'],
      ['DOMESTIC', 'NXT'],
    ])
    .filter(r => !r.sector)
    .toArray()

  if (targets.length === 0) return { updated: 0, total: 0 }

  let updated = 0
  let consecutive409 = 0
  let aborted409 = false
  for (let i = 0; i < targets.length; i++) {
    if (signal?.aborted) break
    const row = targets[i]
    onProgress?.({ exchange: 'KRX_SECTOR', phase: 'sector', current: i + 1, total: targets.length })
    try {
      const sector = await fetchNaverSector(row.ticker)
      if (sector) {
        await stockMasterDb.stocks.update(row.id, {
          sector,
          updatedAt: new Date().toISOString(),
        })
        updated++
      }
      consecutive409 = 0
    } catch (err) {
      if (err?.response?.status === 409) {
        consecutive409++
        // 연속 10회 409 → Naver 차단 상태로 판단, 조기 중단
        if (consecutive409 >= 10) {
          aborted409 = true
          break
        }
      } else {
        consecutive409 = 0
      }
      /* 개별 실패 skip */
    }
  }
  return { updated, total: targets.length, aborted409 }
}

// ── exchange 카드 ─────────────────────────────────────────────────────────

function ExchangeCard({ exchange, count, isCurrent, hasError }) {
  const label = EXCHANGE_LABELS[exchange] || exchange
  return (
    <div
      className={[
        'rounded-lg p-3 text-center transition',
        hasError
          ? 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-700'
          : isCurrent
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
          : 'bg-gray-50 dark:bg-gray-700/50',
      ].join(' ')}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
      <p className={[
        'text-lg font-bold mt-0.5',
        hasError  ? 'text-red-500'
          : isCurrent ? 'text-blue-500'
          : 'text-gray-900 dark:text-white',
      ].join(' ')}>
        {hasError ? '오류' : count.toLocaleString()}
      </p>
      <p className="text-xs text-gray-400">{hasError ? '' : '종목'}</p>
    </div>
  )
}

// ── 진행 바 ──────────────────────────────────────────────────────────────

function ProgressBar({ progress }) {
  if (!progress) return null
  const { exchange, phase, current, total } = progress
  const pct = total ? Math.round((current / total) * 100) : null
  const label = exchange === 'KRX_SECTOR'
    ? 'KRX 업종 정보'
    : (EXCHANGE_LABELS[exchange] || exchange)
  const phaseLabel =
    phase === 'fetch'    ? '서버 수집 중' :
    phase === 'sector'   ? '업종 조회 중' :
    phase === 'download' ? '서버 다운로드 중' :
    phase === 'upload'   ? '서버 업로드 중' :
    'DB 동기화 중'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {label} — {phaseLabel}
        </span>
        {pct != null && <span>{current} / {total}</span>}
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: pct != null ? `${pct}%` : '100%' }}
        />
      </div>
    </div>
  )
}

// ── 결과 요약 배지 ────────────────────────────────────────────────────────

function SyncResultBadge({ stats }) {
  if (!stats) return null
  const { added = 0, changed = 0, removed = 0 } = stats
  if (added === 0 && changed === 0 && removed === 0) return null

  return (
    <div className="flex items-center gap-1.5 text-xs flex-wrap">
      {added   > 0 && <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">+{added.toLocaleString()} 신규</span>}
      {changed > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-400" >변경 {changed.toLocaleString()}</span>}
      {removed > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400"  >해제 {removed.toLocaleString()}</span>}
    </div>
  )
}

// ── 메인 패널 ─────────────────────────────────────────────────────────────

export default function StockMasterPanel() {
  const {
    counts, lastSync, lastStats, progress,
    setProgress, setSyncResult, refreshCounts, reset,
    preferredSource, setPreferredSource,
  } = useStockMasterStore()
  const { isAdmin, isSupabaseUser } = useAuthStore()

  const [confirmClear, setConfirmClear] = useState(false)
  const [showDomestic, setShowDomestic] = useState(true)
  const [showOverseas,  setShowOverseas]  = useState(true)
  const [serverMeta, setServerMeta] = useState(null)
  const abortRef = useRef(null)

  const isSyncing = progress !== null
  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0)

  // 서버 선택 시 메타 정보 자동 조회
  useEffect(() => {
    if (preferredSource !== 'server') return
    fetchServerMeta()
      .then(setServerMeta)
      .catch(err => console.warn('[StockMasterPanel] 서버 메타 조회 실패:', err.message))
  }, [preferredSource])

  // ── 공통 onProgress 콜백 ─────────────────────────────────────────────
  const makeOnProgress = () => (info) => setProgress(info)

  // ── KRX 종목 sector 보강 (sync 후 자동 실행) ─────────────────────────
  const runSectorEnrichment = async (signal) => {
    try {
      const { updated, total, aborted409 } = await enrichKrxSectors({
        onProgress: makeOnProgress(),
        signal,
      })
      if (aborted409) {
        toast.warning(`Naver 차단 감지 — ${updated}/${total} 종목까지 보강 후 중단 (잠시 후 재시도 권장)`)
      } else if (total > 0) {
        toast.success(`업종 정보 보강 — ${updated}/${total} 종목`)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[StockMaster] sector enrichment 실패:', err)
      }
    }
  }

  // ── 완료 후 처리 ─────────────────────────────────────────────────────
  const handleDone = async (result, label) => {
    const stats = {
      added:    result.totalAdded    ?? result.added    ?? 0,
      changed:  result.totalChanged  ?? result.changed  ?? 0,
      removed:  result.totalRemoved  ?? result.removed  ?? 0,
    }
    setSyncResult(stats)
    await refreshCounts()

    const { added, changed, removed } = stats
    const parts = []
    if (added)   parts.push(`+${added.toLocaleString()} 신규`)
    if (changed) parts.push(`변경 ${changed.toLocaleString()}`)
    if (removed) parts.push(`해제 ${removed.toLocaleString()}`)
    const summary = parts.length ? parts.join(' / ') : '변경 없음'

    toast.success(`${label} 완료 — ${summary}`)
  }

  // ── 전체 업데이트 ─────────────────────────────────────────────────────
  const handleSyncAll = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await syncAll({
        onProgress: makeOnProgress(),
        signal: controller.signal,
      })
      await handleDone(result, '전체 업데이트')
      await runSectorEnrichment(controller.signal)
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`업데이트 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  // ── 국내 업데이트 ─────────────────────────────────────────────────────
  const handleSyncDomestic = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await syncCategory('DOMESTIC', {
        onProgress: makeOnProgress(),
        signal: controller.signal,
      })
      await handleDone(result, '국내 업데이트')
      await runSectorEnrichment(controller.signal)
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`업데이트 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  // ── 해외 업데이트 ─────────────────────────────────────────────────────
  const handleSyncOverseas = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await syncCategory('OVERSEAS', {
        onProgress: makeOnProgress(),
        signal: controller.signal,
      })
      await handleDone(result, '해외 업데이트')
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`업데이트 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  // ── 증분 동기화 ───────────────────────────────────────────────────────
  const handleIncremental = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { skipped, synced } = await syncIncremental(counts, {
        onProgress: makeOnProgress(),
        signal: controller.signal,
      })

      const syncedKeys = Object.keys(synced)
      if (syncedKeys.length === 0) {
        toast.success('변경된 시장이 없습니다.')
        return
      }

      const totalStats = syncedKeys.reduce(
        (acc, ex) => {
          const r = synced[ex]
          if (r.status !== 'error') {
            acc.added   += r.added   || 0
            acc.changed += r.changed || 0
            acc.removed += r.removed || 0
          }
          return acc
        },
        { added: 0, changed: 0, removed: 0 }
      )

      await handleDone({ totalAdded: totalStats.added, totalChanged: totalStats.changed, totalRemoved: totalStats.removed }, '증분 동기화')
      await runSectorEnrichment(controller.signal)
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`동기화 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  // ── DB 초기화 ─────────────────────────────────────────────────────────
  const handleClear = async () => {
    try {
      await stockMasterDb.stocks.clear()
      reset()
      toast.success('종목 DB를 초기화했습니다.')
    } catch (err) {
      toast.error(`초기화 실패: ${err.message}`)
    } finally {
      setConfirmClear(false)
    }
  }

  // ── 취소 ─────────────────────────────────────────────────────────────
  const handleCancel = () => {
    abortRef.current?.abort()
  }

  // ── 서버에서 다운로드 ─────────────────────────────────────────────────
  const handleDownloadFromServer = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const results = await downloadAllFromServer({
        onProgress: (phase, exchange, done, total) =>
          setProgress({ exchange, phase, current: done, total }),
        signal: controller.signal,
      })
      const totals = Object.values(results).reduce(
        (acc, r) => ({ added: acc.added + r.added, changed: acc.changed + r.changed, removed: acc.removed + r.removed }),
        { added: 0, changed: 0, removed: 0 }
      )
      await handleDone(totals, '서버 다운로드')
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`다운로드 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  // ── 서버로 업로드 (관리자 전용) ────────────────────────────────────────
  const handleUploadToServer = async () => {
    if (!isAdmin) return
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { upserted } = await uploadAllToServer({
        onProgress: (phase, exchange, done, total) =>
          setProgress({ exchange, phase, current: done, total }),
        signal: controller.signal,
      })
      setProgress(null)
      const meta = await fetchServerMeta()
      setServerMeta(meta)
      toast.success(`서버 업로드 완료 — ${upserted.toLocaleString()}행 upserted`)
    } catch (err) {
      if (err.name !== 'AbortError') toast.error(`업로드 실패: ${err.message}`)
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  return (
    <div className="space-y-4">

      {/* ── 헤더 카드 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" />
              <p className="font-medium text-gray-900 dark:text-white">종목 데이터베이스</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              KOSPI · KOSDAQ · NXT · KRX ETF · NYSE · NASDAQ · 미국 ETF
            </p>
          </div>
          {totalCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
              총 {totalCount.toLocaleString()}개
            </span>
          )}
        </div>

        {/* 마지막 결과 & 시각 */}
        {(lastSync || lastStats) && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            {lastSync && <span>마지막 동기화: {new Date(lastSync).toLocaleString('ko-KR')}</span>}
            {lastStats && <SyncResultBadge stats={lastStats} />}
          </div>
        )}

        {/* 진행바 */}
        <ProgressBar progress={progress} />

        {/* 액션 버튼 — origin 출처 선택 시만 표시 */}
        {preferredSource === 'origin' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                전체 업데이트
              </button>
              <button
                onClick={handleIncremental}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                <Zap className="w-3.5 h-3.5" />
                증분 동기화
              </button>
              <button
                onClick={handleSyncDomestic}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition"
              >
                국내 업데이트
              </button>
              <button
                onClick={handleSyncOverseas}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition"
              >
                해외 업데이트
              </button>
            </div>

            {/* 실행 중 취소 */}
            {isSyncing && (
              <button
                onClick={handleCancel}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
              >
                취소
              </button>
            )}
          </>
        )}

        {/* 초기화 — 항상 표시 */}
        <div className="flex items-center gap-2">
          {totalCount > 0 && !isSyncing && (
            <button
              onClick={() => setConfirmClear(true)}
              className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition"
              title="DB 초기화"
            >
              <Trash2 className="w-3.5 h-3.5" />
              초기화
            </button>
          )}
        </div>

        {preferredSource === 'origin' && (
          <>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ※ 개발 서버 실행 중에만 업데이트 가능합니다 (API 프록시 경유).
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ※ 종목 수집 후 KRX 업종(sector) 정보를 자동 보강합니다 — 최초 1회 약 30~50분 소요(이후 증분만 처리).
            </p>
          </>
        )}
      </div>

      {/* ── 데이터 출처 선택 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">데이터 출처</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPreferredSource('origin')}
            className={[
              'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition',
              preferredSource === 'origin'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            <span>원본 직접 수집</span>
          </button>
          <button
            onClick={() => setPreferredSource('server')}
            className={[
              'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition',
              preferredSource === 'server'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            <Server className="w-4 h-4 flex-shrink-0" />
            <span>서버에서 받기</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {preferredSource === 'origin'
            ? 'DART · KRX · NASDAQ 에서 직접 수집합니다. 개발 서버 프록시 필요.'
            : '관리자가 미리 올린 서버 데이터를 받아옵니다. 로그인 불필요.'}
        </p>
      </div>

      {/* ── 서버 다운로드 섹션 ── */}
      {preferredSource === 'server' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">서버 종목 데이터</p>
            </div>
            {serverMeta && serverMeta.total != null && (
              <span className="text-xs text-gray-400">
                총 {serverMeta.total.toLocaleString()}개
                {serverMeta.uploadedAt && ` · ${new Date(serverMeta.uploadedAt).toLocaleDateString('ko-KR')} 업데이트`}
              </span>
            )}
          </div>

          <ProgressBar progress={progress} />

          <button
            onClick={handleDownloadFromServer}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition"
          >
            <Download className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
            서버에서 다운로드
          </button>

          {isSyncing && (
            <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
              취소
            </button>
          )}

          {/* 관리자 전용 업로드 */}
          {isAdmin && isSupabaseUser && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">관리자</span>
                로컬 IDB의 종목 데이터를 서버에 업로드합니다.
              </p>
              <button
                onClick={handleUploadToServer}
                disabled={isSyncing || totalCount === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                <Upload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse' : ''}`} />
                서버에 업로드 ({totalCount.toLocaleString()}개)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 국내 거래소 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowDomestic(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
        >
          <span>국내 거래소</span>
          {showDomestic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDomestic && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-4 gap-2">
              {EXCHANGES.DOMESTIC.map(ex => (
                <ExchangeCard
                  key={ex}
                  exchange={ex}
                  count={counts[ex] || 0}
                  isCurrent={progress?.exchange === ex}
                  hasError={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 해외 거래소 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowOverseas(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
        >
          <span>해외 거래소</span>
          {showOverseas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showOverseas && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {EXCHANGES.OVERSEAS.map(ex => (
                <ExchangeCard
                  key={ex}
                  exchange={ex}
                  count={counts[ex] || 0}
                  isCurrent={progress?.exchange === ex}
                  hasError={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 커스텀 종목 ── */}
      <CustomStockForm onChanged={refreshCounts} />

      {/* ── DB 초기화 확인 모달 ── */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">종목 DB 초기화</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  커스텀 종목을 포함한 모든 데이터가 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                취소
              </button>
              <button
                onClick={handleClear}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
              >
                <Trash2 className="w-4 h-4" />
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
