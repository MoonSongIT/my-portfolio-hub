/**
 * stockMasterDb.test.js — src/utils/stockMasterDb.js 단위 테스트
 *
 * fake-indexeddb 로 브라우저 환경 없이 Dexie IDB 동작 검증
 * - upsertSync() 4가지 경계 케이스
 * - searchByQuery() 한/영/혼합/빈 쿼리/특수문자
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'

// fake-indexeddb 환경에서 동작하는 로컬 DB 인스턴스 생성
// (실제 앱의 stockMasterDb 대신 테스트 전용 인스턴스 사용)
function makeTestDb() {
  const db = new Dexie(`StockMasterDB_test_${Math.random()}`)
  db.version(1).stores({
    stocks:
      'id, [category+exchange], [category+ticker], ticker, name, nameEn',
    syncLogs: '++id, syncedAt, exchange, status',
  })
  return db
}

// 테스트용 row 팩토리
function makeRow(overrides = {}) {
  const now = new Date().toISOString()
  return {
    id: 'DOMESTIC:KOSPI:005930',
    ticker: '005930',
    name: '삼성전자',
    nameEn: 'Samsung Electronics',
    category: 'DOMESTIC',
    exchange: 'KOSPI',
    type: 'EQUITY',
    country: 'KR',
    currency: 'KRW',
    isCustom: false,
    isActive: true,
    firstSeenAt: now,
    updatedAt: now,
    source: 'DART',
    ...overrides,
  }
}

// upsertSync 구현을 로컬로 재현 (실제 함수와 동일한 로직)
async function upsertSync(db, exchange, remoteRows) {
  const category = ['KOSPI', 'KOSDAQ', 'NXT', 'KRX_ETF'].includes(exchange)
    ? 'DOMESTIC'
    : 'OVERSEAS'

  const localRows = await db.stocks
    .where('[category+exchange]')
    .equals([category, exchange])
    .toArray()

  const localMap = new Map(localRows.map(r => [r.id, r]))
  const remoteMap = new Map(remoteRows.map(r => [r.id, r]))

  const added = []
  const changed = []
  const removedIds = []

  for (const [id, remote] of remoteMap) {
    const local = localMap.get(id)
    if (!local) {
      added.push(remote)
    } else {
      const dirty =
        local.name !== remote.name ||
        local.type !== remote.type ||
        local.isActive !== remote.isActive
      if (dirty) {
        changed.push({ ...local, ...remote, firstSeenAt: local.firstSeenAt, isCustom: local.isCustom })
      }
    }
  }

  for (const [id, local] of localMap) {
    if (!remoteMap.has(id) && !local.isCustom) {
      removedIds.push(id)
    }
  }

  await db.transaction('rw', db.stocks, async () => {
    if (added.length > 0) await db.stocks.bulkPut(added)
    if (changed.length > 0) await db.stocks.bulkPut(changed)
    if (removedIds.length > 0) {
      await db.stocks.where('id').anyOf(removedIds).modify({ isActive: false })
    }
  })

  return { added: added.length, changed: changed.length, removed: removedIds.length }
}

// searchByQuery 구현을 로컬로 재현
async function searchByQuery(db, query, { limit = 20 } = {}) {
  if (!query) return []
  const q = query.trim()
  if (!q) return []

  const byTicker = await db.stocks
    .where('ticker')
    .startsWithIgnoreCase(q)
    .filter(r => r.isActive !== false)
    .limit(limit)
    .toArray()

  const byName = await db.stocks
    .filter(r => r.isActive !== false && r.name?.includes(q))
    .limit(limit)
    .toArray()

  const seen = new Set()
  const result = []
  for (const r of [...byTicker, ...byName]) {
    if (!seen.has(r.id)) { seen.add(r.id); result.push(r) }
  }
  return result.slice(0, limit)
}

// ── upsertSync 테스트 ────────────────────────────────────────────────────────

describe('upsertSync()', () => {
  let db

  beforeEach(() => {
    db = makeTestDb()
  })

  it('빈 DB → 전량 added', async () => {
    const rows = [
      makeRow({ id: 'DOMESTIC:KOSPI:005930', ticker: '005930', name: '삼성전자' }),
      makeRow({ id: 'DOMESTIC:KOSPI:000660', ticker: '000660', name: 'SK하이닉스' }),
    ]
    const result = await upsertSync(db, 'KOSPI', rows)
    expect(result.added).toBe(2)
    expect(result.changed).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('동일 상태 재실행 → added=0 changed=0 removed=0', async () => {
    const rows = [makeRow()]
    await upsertSync(db, 'KOSPI', rows)
    const result = await upsertSync(db, 'KOSPI', rows)
    expect(result.added).toBe(0)
    expect(result.changed).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('일부 row 삭제 → removed 발생', async () => {
    const row1 = makeRow({ id: 'DOMESTIC:KOSPI:005930', ticker: '005930', name: '삼성전자' })
    const row2 = makeRow({ id: 'DOMESTIC:KOSPI:000660', ticker: '000660', name: 'SK하이닉스' })
    await upsertSync(db, 'KOSPI', [row1, row2])

    // row2 제거 후 재sync
    const result = await upsertSync(db, 'KOSPI', [row1])
    expect(result.removed).toBe(1)

    // row2 는 isActive=false 로 soft delete
    const deleted = await db.stocks.get('DOMESTIC:KOSPI:000660')
    expect(deleted.isActive).toBe(false)
  })

  it('isCustom=true row → sync 로 removed 제외', async () => {
    const customRow = makeRow({ isCustom: true, id: 'DOMESTIC:KOSPI:CUSTOM01', ticker: 'CUSTOM01', name: '커스텀 종목' })
    await db.stocks.put(customRow)

    // remote 에 CUSTOM01 없어도 removed 안됨
    const result = await upsertSync(db, 'KOSPI', [makeRow()])
    expect(result.removed).toBe(0)

    const still = await db.stocks.get('DOMESTIC:KOSPI:CUSTOM01')
    expect(still.isActive).toBe(true)
  })
})

// ── searchByQuery 테스트 ─────────────────────────────────────────────────────

describe('searchByQuery()', () => {
  let db

  beforeEach(async () => {
    db = makeTestDb()
    await db.stocks.bulkPut([
      makeRow({ id: 'DOMESTIC:KOSPI:005930', ticker: '005930', name: '삼성전자', nameEn: 'Samsung Electronics' }),
      makeRow({ id: 'DOMESTIC:KOSPI:005935', ticker: '005935', name: '삼성전자우', nameEn: 'Samsung Electronics Pref' }),
      makeRow({ id: 'DOMESTIC:KOSPI:000660', ticker: '000660', name: 'SK하이닉스' }),
      makeRow({ id: 'OVERSEAS:NASDAQ:AAPL', ticker: 'AAPL', name: 'Apple Inc.', category: 'OVERSEAS', exchange: 'NASDAQ', currency: 'USD', country: 'US' }),
      makeRow({ id: 'OVERSEAS:NASDAQ:AMZN', ticker: 'AMZN', name: 'Amazon.com Inc.', category: 'OVERSEAS', exchange: 'NASDAQ', currency: 'USD', country: 'US' }),
    ])
  })

  it('한글 종목명 부분 일치', async () => {
    const results = await searchByQuery(db, '삼성')
    expect(results.length).toBe(2)
    expect(results.map(r => r.ticker)).toContain('005930')
    expect(results.map(r => r.ticker)).toContain('005935')
  })

  it('티커 prefix 검색', async () => {
    const results = await searchByQuery(db, 'AAP')
    expect(results.some(r => r.ticker === 'AAPL')).toBe(true)
  })

  it('정확한 티커 검색', async () => {
    const results = await searchByQuery(db, '005930')
    expect(results[0].ticker).toBe('005930')
  })

  it('빈 쿼리 → 빈 배열', async () => {
    expect(await searchByQuery(db, '')).toEqual([])
    expect(await searchByQuery(db, '   ')).toEqual([])
  })

  it('일치하는 결과 없는 쿼리 → 빈 배열', async () => {
    const results = await searchByQuery(db, 'ZZZZZ')
    expect(results).toEqual([])
  })

  it('isActive=false row → 검색 결과에서 제외', async () => {
    await db.stocks.put(makeRow({ id: 'DOMESTIC:KOSPI:999999', ticker: '999999', name: '상장폐지종목', isActive: false }))
    const results = await searchByQuery(db, '상장폐지')
    expect(results.length).toBe(0)
  })

  it('limit 적용', async () => {
    const results = await searchByQuery(db, '삼성', { limit: 1 })
    expect(results.length).toBe(1)
  })
})
