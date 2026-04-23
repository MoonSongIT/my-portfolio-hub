/**
 * stockMasterApi.js — 종목 마스터 클라이언트 API 레이어
 *
 * 서버 `/api/stock-master` 호출 → IDB upsertSync 연결
 * rows 자체는 IDB(stockMasterDb)에 저장, 이 모듈은 fetch + sync 로직만 담당
 */

import { upsertSync, appendSyncLog } from '@/utils/stockMasterDb'

// ── 상수 ─────────────────────────────────────────────────────────────────

export const EXCHANGES = {
  DOMESTIC: ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF'],
  OVERSEAS: ['NYSE', 'NASDAQ', 'US_ETF'],
}

export const ALL_EXCHANGES = [...EXCHANGES.DOMESTIC, ...EXCHANGES.OVERSEAS]

export const EXCHANGE_LABELS = {
  KOSPI:   'KOSPI',
  KOSDAQ:  'KOSDAQ',
  NXT:     'Nextrade (NXT)',
  KRX_ETF: 'KRX ETF',
  NYSE:    'NYSE',
  NASDAQ:  'NASDAQ',
  US_ETF:  '미국 ETF',
}

const FETCH_TIMEOUT_MS = 5 * 60_000   // 단일 exchange 최대 5분 (DART 수집 포함)
const BASE_URL = '/api/stock-master'

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

/**
 * exchange 단일 조회 (raw 서버 응답 반환)
 * @param {string} exchange
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ exchange, rows: StockMasterRow[], count, errors, collectedAt, durationMs }>}
 */
async function fetchExchangeRaw(exchange, signal) {
  const timeoutId = setTimeout(() => {
    // AbortSignal.timeout 미지원 환경 대비 수동 타임아웃
  }, FETCH_TIMEOUT_MS)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS)
    const mergedSignal = signal
      ? anySignal([signal, controller.signal])
      : controller.signal

    const res = await fetch(`${BASE_URL}?exchange=${exchange}`, {
      signal: mergedSignal,
    })
    clearTimeout(timer)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 두 AbortSignal 중 하나라도 abort 되면 같이 abort 되는 signal 생성
 */
function anySignal(signals) {
  const controller = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(sig.reason); break }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true })
  }
  return controller.signal
}

// ── 공개 API ──────────────────────────────────────────────────────────────

/**
 * manifest(카운트 요약) 조회 — 변동 여부 사전 확인용
 * @returns {Promise<{ manifest: Record<string, { exchange, category, count, collectedAt }>, generatedAt: string }>}
 */
export async function fetchManifest() {
  const res = await fetch(`${BASE_URL}/manifest`)
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`)
  return res.json()
}

/**
 * 단일 exchange 서버 수집 → IDB upsertSync
 *
 * @param {string} exchange
 * @param {{
 *   onProgress?: (info: { exchange, phase: 'fetch'|'sync', stats? }) => void,
 *   signal?: AbortSignal,
 * }} [opts]
 * @returns {Promise<{ exchange, added, changed, removed, serverErrors, durationMs }>}
 */
export async function syncExchange(exchange, { onProgress, signal } = {}) {
  const start = Date.now()

  onProgress?.({ exchange, phase: 'fetch' })

  // 1. 서버 수집
  const serverData = await fetchExchangeRaw(exchange, signal)
  const rows = serverData.rows || []
  const serverErrors = serverData.errors || []

  if (rows.length === 0 && serverErrors.length > 0) {
    await appendSyncLog({
      exchange,
      status: 'error',
      stats: { added: 0, changed: 0, removed: 0 },
      durationMs: Date.now() - start,
      error: serverErrors.join('; '),
    })
    throw new Error(`[${exchange}] 서버 수집 실패: ${serverErrors.join(', ')}`)
  }

  onProgress?.({ exchange, phase: 'sync' })

  // 2. IDB diff & upsert
  const stats = await upsertSync(exchange, rows)

  return {
    exchange,
    ...stats,
    serverErrors,
    durationMs: Date.now() - start,
  }
}

/**
 * 카테고리 단위 순차 sync (DOMESTIC 또는 OVERSEAS)
 *
 * KOSPI/KOSDAQ 는 DART rate limit 때문에 서버에서 이미 순차 처리하지만,
 * 클라이언트에서도 순차 호출하여 중간 진행 상황을 onProgress 로 보고합니다.
 *
 * @param {'DOMESTIC'|'OVERSEAS'} category
 * @param {{
 *   onProgress?: (info: { exchange, phase, current, total, stats? }) => void,
 *   signal?: AbortSignal,
 * }} [opts]
 * @returns {Promise<{ results: Record<string, object>, totalAdded, totalChanged, totalRemoved }>}
 */
export async function syncCategory(category, { onProgress, signal } = {}) {
  const exchanges = EXCHANGES[category]
  if (!exchanges) throw new Error(`알 수 없는 category: ${category}`)

  const results = {}
  let totalAdded = 0, totalChanged = 0, totalRemoved = 0

  for (let i = 0; i < exchanges.length; i++) {
    if (signal?.aborted) break
    const exchange = exchanges[i]

    try {
      const result = await syncExchange(exchange, {
        signal,
        onProgress: info =>
          onProgress?.({ ...info, current: i + 1, total: exchanges.length }),
      })
      results[exchange] = { ...result, status: 'success' }
      totalAdded   += result.added
      totalChanged += result.changed
      totalRemoved += result.removed
    } catch (err) {
      results[exchange] = { status: 'error', error: err.message }
    }
  }

  return { results, totalAdded, totalChanged, totalRemoved }
}

/**
 * 전체 sync (DOMESTIC → OVERSEAS 순서)
 *
 * @param {{
 *   onProgress?: (info) => void,
 *   signal?: AbortSignal,
 * }} [opts]
 * @returns {Promise<{ domestic: object, overseas: object, totalAdded, totalChanged, totalRemoved }>}
 */
export async function syncAll({ onProgress, signal } = {}) {
  const domestic = await syncCategory('DOMESTIC', { onProgress, signal })
  if (signal?.aborted) return { domestic, overseas: null, ...totals(domestic) }

  const overseas = await syncCategory('OVERSEAS', { onProgress, signal })

  return {
    domestic,
    overseas,
    totalAdded:   domestic.totalAdded   + overseas.totalAdded,
    totalChanged: domestic.totalChanged + overseas.totalChanged,
    totalRemoved: domestic.totalRemoved + overseas.totalRemoved,
  }
}

/**
 * manifest 비교 기반 증분 sync
 * 서버 manifest count 와 로컬 counts 를 비교하여 변동된 exchange 만 sync
 *
 * @param {Record<string, number>} localCounts - exchange → count (stockMasterStore.counts)
 * @param {{ onProgress?, signal? }} [opts]
 * @returns {Promise<{ skipped: string[], synced: Record<string, object> }>}
 */
export async function syncIncremental(localCounts, { onProgress, signal } = {}) {
  const { manifest } = await fetchManifest()
  const skipped = []
  const synced  = {}

  for (const exchange of ALL_EXCHANGES) {
    if (signal?.aborted) break
    const serverCount = manifest[exchange]?.count ?? 0
    const localCount  = localCounts[exchange]    ?? 0

    if (serverCount === 0 || serverCount === localCount) {
      skipped.push(exchange)
      continue
    }

    try {
      const result = await syncExchange(exchange, { onProgress, signal })
      synced[exchange] = result
    } catch (err) {
      synced[exchange] = { status: 'error', error: err.message }
    }
  }

  return { skipped, synced }
}

// ── 내부 util ─────────────────────────────────────────────────────────────

function totals({ totalAdded = 0, totalChanged = 0, totalRemoved = 0 } = {}) {
  return { totalAdded, totalChanged, totalRemoved }
}
