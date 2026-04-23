import Dexie from 'dexie'

/**
 * @typedef {Object} StockMasterRow
 * @property {string} id           - 복합 PK: `${category}:${exchange}:${ticker}`
 * @property {string} ticker       - 순수 티커 (예: "005930", "AAPL")
 * @property {string} name         - 표시명 (한글 우선, 영문 fallback)
 * @property {string} [nameEn]     - 영문명 (한국 종목에만 의미)
 * @property {'DOMESTIC'|'OVERSEAS'} category - 국내 / 해외 (1차 축)
 * @property {'KOSPI'|'KOSDAQ'|'NXT'|'KRX_ETF'|'NYSE'|'NASDAQ'|'AMEX'|'US_ETF'} exchange
 * @property {'EQUITY'|'ETF'|'ETN'|'REIT'|'PREFERRED'} type
 * @property {'KR'|'US'} country
 * @property {'KRW'|'USD'} currency
 * @property {string} [sector]
 * @property {string} [industry]
 * @property {string} [isin]       - 국제증권식별번호
 * @property {string} [corpCode]   - DART corp_code (한국 전용, 8자리)
 * @property {string[]} [tradableOn] - 거래 가능 거래소 목록 (NXT 병합용)
 * @property {boolean} isCustom    - 사용자 수동 추가 여부
 * @property {boolean} isActive    - 상장폐지 soft delete 용
 * @property {string} firstSeenAt  - 최초 수집 시각 (ISO)
 * @property {string} updatedAt    - 마지막 갱신 시각 (ISO)
 * @property {'DART'|'KRX'|'NAVER'|'YAHOO'|'SEC'|'MANUAL'} source
 */

// ── DB 인스턴스 (PortfolioHub 와 완전히 별도) ──────────────────────────────
export const stockMasterDb = new Dexie('StockMasterDB')

stockMasterDb.version(1).stores({
  // PK = id (복합 문자열), 보조 인덱스 5개
  stocks:
    'id, ' +
    '[category+exchange], ' +   // 시장별 목록 조회
    '[category+ticker], ' +     // 시장 안에서 티커 검색
    'ticker, ' +                // 전역 티커 조회
    'name, ' +                  // 한글명 검색
    'nameEn',                   // 영문명 검색

  // 수집 이력 (관측·디버깅용)
  syncLogs: '++id, syncedAt, exchange, status',
})

// ── 상수 ─────────────────────────────────────────────────────────────────

const DOMESTIC_EXCHANGES = new Set(['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF'])

// ── 헬퍼 함수 ────────────────────────────────────────────────────────────

/** exchange → category 매핑 */
export function categoryOf(exchange) {
  return DOMESTIC_EXCHANGES.has(exchange) ? 'DOMESTIC' : 'OVERSEAS'
}

/** 복합 PK 생성: `${category}:${exchange}:${ticker}` */
export function makeId({ category, exchange, ticker }) {
  return `${category}:${exchange}:${ticker}`
}

/** id 기준 중복 제거 */
function dedupeById(rows) {
  const seen = new Set()
  return rows.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

// ── CRUD & 검색 ──────────────────────────────────────────────────────────

/**
 * rows 일괄 upsert
 * @param {StockMasterRow[]} rows
 */
export async function upsertMany(rows) {
  return stockMasterDb.stocks.bulkPut(rows)
}

/**
 * exchange 에 속하고 keepIds 에 없는 row 를 isActive=false 로 비활성화
 * isCustom=true 인 row 는 제외
 * @param {string} exchange
 * @param {Set<string>} keepIds
 */
export async function deactivateMissing(exchange, keepIds) {
  const category = categoryOf(exchange)
  const now = new Date().toISOString()
  await stockMasterDb.stocks
    .where('[category+exchange]').equals([category, exchange])
    .and(r => !keepIds.has(r.id) && !r.isCustom)
    .modify({ isActive: false, updatedAt: now })
}

/**
 * exchange 기준 조회
 * @param {string} exchange
 * @param {{ includeInactive?: boolean }} opts
 */
export async function getByExchange(exchange, { includeInactive = false } = {}) {
  const category = categoryOf(exchange)
  const rows = await stockMasterDb.stocks
    .where('[category+exchange]').equals([category, exchange])
    .toArray()
  return includeInactive ? rows : rows.filter(r => r.isActive)
}

/**
 * exchange 별 활성 종목 카운트 집계
 * @returns {Promise<Record<string, number>>}
 */
export async function getCountsByExchange() {
  const exchanges = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF', 'NYSE', 'NASDAQ', 'AMEX', 'US_ETF']
  const counts = {}
  await Promise.all(
    exchanges.map(async ex => {
      const category = categoryOf(ex)
      counts[ex] = await stockMasterDb.stocks
        .where('[category+exchange]').equals([category, ex])
        .and(r => r.isActive)
        .count()
    })
  )
  return counts
}

/**
 * 범용 검색: ticker 전방 일치 + name/nameEn 부분 일치
 * @param {string} query
 * @param {{ limit?: number, includeInactive?: boolean }} opts
 * @returns {Promise<StockMasterRow[]>}
 */
export async function searchByQuery(query, { limit = 20, includeInactive = false } = {}) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  // 1) ticker 전방 일치 (인덱스 활용, 빠름)
  const byTicker = await stockMasterDb.stocks
    .where('ticker').startsWithIgnoreCase(q)
    .limit(limit)
    .toArray()

  // 2) name/nameEn 부분 일치 (Collection.filter — 풀스캔이지만 5,000행 기준 충분)
  const byName = await stockMasterDb.stocks
    .filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.nameEn?.toLowerCase().includes(q) ?? false)
    )
    .limit(limit)
    .toArray()

  const merged = dedupeById([...byTicker, ...byName])
  return includeInactive ? merged : merged.filter(r => r.isActive)
}

/**
 * id 단건 조회
 * @param {string} id
 */
export async function getById(id) {
  return stockMasterDb.stocks.get(id)
}

/**
 * ticker + (선택) category 로 조회
 * @param {string} ticker
 * @param {'DOMESTIC'|'OVERSEAS'|null} [category]
 */
export async function getByTicker(ticker, category = null) {
  if (category) {
    return stockMasterDb.stocks
      .where('[category+ticker]').equals([category, ticker])
      .first()
  }
  return stockMasterDb.stocks.where('ticker').equals(ticker).first()
}

/**
 * 동기화 로그 추가
 * @param {{ exchange: string, status: string, stats?: object, durationMs?: number, error?: string|null }} opts
 */
export async function appendSyncLog({ exchange, status, stats = {}, durationMs = 0, error = null }) {
  return stockMasterDb.syncLogs.add({
    exchange,
    status,
    stats,
    durationMs,
    error,
    syncedAt: new Date().toISOString(),
  })
}

// ── Diff & Upsert 엔진 ────────────────────────────────────────────────────

/**
 * 단일 exchange 의 remote rows 를 local IDB 와 diff → 트랜잭션 upsert
 *
 * 반환: { added, changed, removed, durationMs }
 *
 * @param {string} exchange
 * @param {StockMasterRow[]} remoteRows
 */
export async function upsertSync(exchange, remoteRows) {
  const startTime = Date.now()
  const category = categoryOf(exchange)
  const now = new Date().toISOString()

  // 필수 필드 보완 (서버가 id 를 안 줄 경우 대비)
  const normalized = remoteRows.map(r => ({
    ...r,
    id:         r.id || makeId({ category, exchange, ticker: r.ticker }),
    category:   r.category || category,
    exchange:   r.exchange || exchange,
    isCustom:   r.isCustom ?? false,
    isActive:   r.isActive ?? true,
    firstSeenAt: r.firstSeenAt || now,
    updatedAt:  r.updatedAt || now,
  }))

  // 1. 기존 local rows 조회 (인덱스 기반)
  const local = await stockMasterDb.stocks
    .where('[category+exchange]').equals([category, exchange])
    .toArray()

  const localById  = new Map(local.map(r => [r.id, r]))
  const remoteById = new Map(normalized.map(r => [r.id, r]))

  // 2. Set 기반 Diff
  const added = normalized.filter(r => !localById.has(r.id))

  // isCustom row 는 remote 에서 사라져도 removed 후보 제외
  const removed = local.filter(r => !remoteById.has(r.id) && !r.isCustom)

  const changed = normalized
    .filter(r => localById.has(r.id))
    .map(r => {
      const loc = localById.get(r.id)
      const isDirty =
        loc.name !== r.name ||
        loc.nameEn !== r.nameEn ||
        loc.sector !== r.sector ||
        loc.corpCode !== r.corpCode ||
        loc.type !== r.type ||
        JSON.stringify(loc.tradableOn) !== JSON.stringify(r.tradableOn)
      if (!isDirty) return null
      return {
        ...loc,                           // firstSeenAt, isCustom 보존
        ...r,                             // 서버 최신 필드 덮어쓰기
        firstSeenAt: loc.firstSeenAt,     // 최초 감지일 불변
        isCustom: loc.isCustom || r.isCustom,
        updatedAt: now,
      }
    })
    .filter(Boolean)

  // 3. 트랜잭션 내 일괄 쓰기 (중간 실패 시 롤백)
  await stockMasterDb.transaction('rw', stockMasterDb.stocks, async () => {
    if (added.length)   await stockMasterDb.stocks.bulkPut(added)
    if (changed.length) await stockMasterDb.stocks.bulkPut(changed)
    if (removed.length) {
      await stockMasterDb.stocks
        .where('id').anyOf(removed.map(r => r.id))
        .modify({ isActive: false, updatedAt: now })
    }
  })

  const durationMs = Date.now() - startTime
  const stats = { added: added.length, changed: changed.length, removed: removed.length }

  await appendSyncLog({ exchange, status: 'success', stats, durationMs })

  return { ...stats, durationMs }
}

// ── 커스텀 종목 ───────────────────────────────────────────────────────────

/**
 * 커스텀 종목 추가
 * @param {Partial<StockMasterRow> & { ticker: string, exchange: string, name: string }} row
 * @returns {Promise<boolean>} 성공 여부 (중복이면 false)
 */
export async function addCustom(row) {
  const category = categoryOf(row.exchange)
  const id = makeId({ category, exchange: row.exchange, ticker: row.ticker })
  const now = new Date().toISOString()

  const existing = await stockMasterDb.stocks.get(id)
  if (existing) return false

  await stockMasterDb.stocks.put({
    ...row,
    id,
    category,
    isCustom: true,
    isActive: true,
    source: 'MANUAL',
    firstSeenAt: now,
    updatedAt: now,
  })
  return true
}

/**
 * 커스텀 종목 삭제 (isCustom=true 인 row 만 허용)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function removeCustom(id) {
  const row = await stockMasterDb.stocks.get(id)
  if (!row || !row.isCustom) return false
  await stockMasterDb.stocks.delete(id)
  return true
}
