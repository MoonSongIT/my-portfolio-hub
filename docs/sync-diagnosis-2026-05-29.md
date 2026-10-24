# My Portfolio Hub 동기화 시스템 심층 진단 리포트

> 작성일: 2026-05-29  
> 분석 모델: Claude Opus (최신)  
> 대상: https://my-portfolio-hub-steel.vercel.app  
> 사용자: moonsongit@gmail.com

---

## 1. 시스템 아키텍처 현황

### 1.1 데이터 흐름 개요

```
로컬 (클라이언트)                    서버 (Vercel API)                 Supabase
─────────────────────────────────────────────────────────────────────────────
IndexedDB (Dexie)                   POST /api/sync/upload            PostgreSQL
├─ transactions (userId)   ──────┐   ├─ TABLE_MAP 검증             ├─ transactions
├─ cashFlows (userId)      ──┐   │   ├─ Conflict 감지               ├─ cash_flows
├─ calendarEvents (userId) ──┼───┤   └─ { data: record, ... }      ├─ calendar_events
└─ reports (userId)        ──┤   │       저장                        └─ user_sync_meta
                              │   │
Zustand (persist)             │   └─> PostgreSQL  ──┐
├─ accountStore            ────────────────────────┤
├─ journalStore                    GET /api/sync/download
├─ syncStore                       ├─ user_id 필터링
└─ ...                            ├─ since 파라미터 (증분)
                                  └─ records: [{ id, data, ... }]

                                  로컬로 반환 → record.data ?? record
                                  → db.put({ ...payload, syncedAt })
```

### 1.2 주요 컴포넌트

| 컴포넌트 | 역할 | 파일 |
|---------|------|------|
| **syncService** | 업로드/다운로드 오케스트레이션 | `src/services/syncService.js` |
| **upload API** | 서버에 레코드 저장 (충돌 감지) | `api/sync/upload.js` |
| **download API** | 서버에서 레코드 조회 (증분 지원) | `api/sync/download.js` |
| **migrateLocalUserData** | 로컬 user-* ID → Supabase UUID 재할당 | `src/utils/migrateLocalUser.js` |
| **authStore** | 로컬 auth + Supabase 세션 통합 | `src/store/authStore.js` |
| **IndexedDB** | 로컬 영속 저장소 (Dexie v11+) | `src/utils/db.js` |

---

## 2. 발견된 버그 목록

### 🔴 CRITICAL

#### BUG #1: API 응답 데이터 구조 불일치
**영향**: 다운로드 후 로컬에 저장되는 데이터가 메타 필드와 뒤섞임  
**위치**: `api/sync/upload.js` L59-66, `api/sync/download.js` L37-47, `src/services/syncService.js` L111

**문제 코드**:
```js
// upload.js: record 전체를 "data" 필드에 래핑해서 저장
await supabase.from(pgTable).upsert({
  id:        String(record.id),
  user_id:   user.id,
  data:      record,              // ← 전체 record를 JSON으로 감쌈
  sync_version: (record.syncVersion ?? 0) + 1,
  synced_at: new Date().toISOString(),
  deleted_at: record.deletedAt ?? null,
})

// download.js: SELECT * 결과 그대로 반환
res.status(200).json({
  records: data ?? [],  // ← { id, user_id, data: {...}, sync_version, synced_at } 구조
  version: meta?.global_version ?? 0,
})

// syncService.js: record.data ?? record로 unwrap 시도하지만 메타필드 혼재
for (const record of records) {
  const payload = record.data ?? record  // data 안의 원본 + 바깥 메타 혼재
  await db[table].put({
    ...payload,
    syncedAt: record.synced_at ?? new Date().toISOString(),
  })
}
```

**결과**: `sync_version` 같은 메타 필드가 IndexedDB에 불필요하게 저장되고, 구조가 불명확해서 다음 업로드 시 오동작 가능.

---

#### BUG #2: userId 불일치 — 로컬 ID vs Supabase UUID
**영향**: 마이그레이션 미완료 상태에서 업로드하면 서버 데이터의 `data.userId`가 구 ID로 남음  
**위치**: `src/store/authStore.js` L25, `src/utils/migrateLocalUser.js`, `api/sync/upload.js` L61

**문제 시나리오**:
```
1. 로컬 로그인 (user-a1b2)
   IndexedDB: transactions[{ userId: "user-a1b2", ... }]

2. Supabase 가입 → session.user.id = "550e8400-..."

3. migrateLocalUserData("550e8400-...") 호출 (비동기, await 없이 진행)

4. [마이그레이션 진행 중에] 사용자가 거래 입력
   → journalStore.addEntry() → IndexedDB에 저장
   { id: "tx-new", userId: "user-a1b2", ... }  ← 여전히 구 ID!

5. 마이그레이션 완료 (기존 데이터만 재할당, 신규 입력 데이터는 누락)

6. 업로드
   서버 PostgreSQL: { user_id: "550e8400-...", data: { userId: "user-a1b2" } }
   ↳ user_id (외부 필터용) vs data.userId (내부 원본) 불일치
```

---

#### BUG #3: 테이블 매핑 불일치 (accounts, watchlist 누락)
**영향**: 계좌·관심종목 데이터는 다운로드로 복원 불가  
**위치**: `api/sync/upload.js` L12-18, `api/sync/download.js` L28-32, `src/services/syncService.js` L7

```js
// upload.js TABLE_MAP: accounts, watchlist 있음 ✅
// download.js TABLE_MAP: accounts, watchlist 없음 ❌
// syncService SYNC_TABLES: accounts, watchlist 없음 ❌

// 결과: 계좌/관심종목은 업로드는 가능하지만 다운로드가 안 됨
```

---

### 🟠 HIGH

#### BUG #4: 마이그레이션 동시성 문제 (Race Condition)
**영향**: 마이그레이션 중 입력된 데이터가 구 userId로 저장됨  
**위치**: `src/App.jsx` L96-110

```js
// 현재 코드: migrateLocalUserData를 await 없이 호출
migrateLocalUserData(session.user.id)  // Promise 반환하지만 대기하지 않음
  .then(migrated => { ... })

// 문제: .then 이전에 사용자가 데이터 입력 가능 → 구 ID로 저장됨
```

---

#### BUG #5: 최초 다운로드 시 로컬 데이터 무조건 덮어씌움
**영향**: 로컬에 입력했지만 아직 업로드 안 한 데이터가 서버 데이터로 사라질 수 있음  
**위치**: `src/services/syncService.js` L84-126

```js
// 현재 코드: 충돌 감지 없이 db.put()
await db[table].put({
  ...payload,
  syncedAt: record.synced_at ?? new Date().toISOString(),
})
// syncedAt=null인 미업로드 로컬 데이터를 서버 버전으로 덮어씌움
```

---

#### BUG #6: 업로드 후 로컬 syncVersion 갱신 불확실
**영향**: 다음 업로드 시 동일 데이터를 다시 업로드할 수 있음  
**위치**: `src/services/syncService.js` — `uploaded` 처리 로직

```js
// upload API가 반환하는 uploaded 배열에 새 syncVersion 포함되지만,
// bulkPut 시 syncVersion이 실제로 저장되는지 확인 필요
const { conflicts, uploaded } = await res.json()
await db[table].bulkPut(
  uploaded.map((r) => ({ ...r, syncedAt: now }))
)
```

---

### 🟡 MEDIUM

#### BUG #7: migrate 옵션이 upload API에서 무시됨
**영향**: 대량 마이그레이션 시 기존 데이터와 불필요한 충돌 감지 발생  
**위치**: `api/sync/upload.js` (migrate 파라미터 미처리)

```js
// syncService: migrate=true 플래그 전송
body: JSON.stringify({ table, records, migrate: true })

// upload.js: migrate 파라미터 무시
const { table, records } = req.body  // migrate 없음
```

---

## 3. 데이터 플로우 다이어그램

### 정상 플로우 (마이그레이션 완료 후)
```
Supabase 로그인
  └─ session.user.id = "UUID-A"
      └─ migrateLocalUserData("UUID-A")  [await 완료까지 대기]
          └─ IndexedDB: user-xxxx → UUID-A 재할당
              └─ 마이그레이션 완료
                  ├─ uploadPending()
                  │    └─ syncedAt=null인 레코드 모두 업로드
                  │         └─ Supabase: { user_id: "UUID-A", data: {...} }
                  └─ downloadFromServer()
                       └─ SELECT * WHERE user_id = "UUID-A"
                            └─ IndexedDB 갱신
```

### 현재 문제 플로우 (마이그레이션 Race Condition)
```
Supabase 로그인
  └─ migrateLocalUserData("UUID-A") [await 없이 호출]
      └─ [마이그레이션 진행 중...]
          └─ [동시에] 사용자가 거래 입력
              └─ IndexedDB에 { userId: "user-xxxx" } 저장 ← 구 ID!
  └─ 마이그레이션 완료 (신규 입력 데이터 재할당 누락)
      └─ uploadPending()
           └─ 구 userId 데이터가 서버에 업로드됨
               └─ Supabase: { user_id: "UUID-A", data: { userId: "user-xxxx" } } ← 불일치!
      └─ downloadFromServer()
           └─ 다운로드 성공하지만 data.userId = "user-xxxx" ← 구 ID로 복원됨
```

---

## 4. 개선 계획

### 우선순위 매트릭스

| 순위 | 버그 | 영향도 | 복잡도 | 예상 시간 |
|-----|------|--------|--------|-----------|
| 1️⃣ | BUG #3: 테이블 매핑 불일치 | CRITICAL | 낮음 | 30분 |
| 2️⃣ | BUG #4: 마이그레이션 Race Condition | CRITICAL | 중간 | 1-2시간 |
| 3️⃣ | BUG #1: API 데이터 구조 불일치 | CRITICAL | 중간 | 2-3시간 |
| 4️⃣ | BUG #2: userId 불일치 검증 강화 | HIGH | 높음 | 2-3시간 |
| 5️⃣ | BUG #5: 다운로드 충돌 감지 | HIGH | 중간 | 1-2시간 |
| 6️⃣ | BUG #6: syncVersion 갱신 확인 | HIGH | 낮음 | 30분 |
| 7️⃣ | BUG #7: migrate 옵션 처리 | MEDIUM | 낮음 | 30분 |

---

### Phase 1 — 즉시 수정 (오늘, ~2시간)

#### 1-1. 테이블 매핑 통일 (BUG #3)
```js
// 신규 파일: src/constants/syncTables.js
export const SYNC_TABLES = ['transactions', 'cashFlows', 'calendarEvents']
export const DEXIE_TO_PG_MAP = {
  transactions:   'transactions',
  cashFlows:      'cash_flows',
  calendarEvents: 'calendar_events',
}

// api/sync/download.js TABLE_MAP에도 동일하게 추가
const TABLE_MAP = {
  transactions:   'transactions',
  cashFlows:      'cash_flows',
  calendarEvents: 'calendar_events',
}
```

#### 1-2. 마이그레이션 Race Condition 수정 (BUG #4)
```js
// src/App.jsx
useEffect(() => {
  authService.getSession().then(async (session) => {
    if (session?.user?.id) {
      // ✅ 마이그레이션 완료까지 반드시 대기
      await migrateLocalUserData(session.user.id)

      const userId = session.user.id
      await useJournalStore.getState().loadFromDB(userId)
      await useCashFlowStore.getState().loadFromDB(userId)

      // 이후 동기화 활성화
      useSyncStore.getState().setReady(true)
    }
  })
}, [])
```

---

### Phase 2 — 단기 수정 (3일 내, ~5시간)

#### 2-1. API 데이터 구조 정규화 (BUG #1)
```js
// api/sync/download.js 수정
// data 필드를 unwrap해서 반환
const unwrapped = (data ?? []).map(row => ({
  ...row.data,          // 원본 레코드 필드
  _sync_version: row.sync_version,  // 메타 필드는 _ 접두사로 분리
  _synced_at:    row.synced_at,
  _deleted_at:   row.deleted_at,
}))
res.status(200).json({ records: unwrapped, version })

// syncService.js 수정
for (const record of records) {
  if (record._deleted_at) {
    await db[table].delete(String(record.id))
  } else {
    const { _sync_version, _synced_at, _deleted_at, ...payload } = record
    await db[table].put({
      ...payload,
      syncedAt: _synced_at ?? new Date().toISOString(),
      syncVersion: _sync_version,
    })
  }
}
```

#### 2-2. 업로드 전 userId 검증 강화 (BUG #2)
```js
// src/services/syncService.js
async uploadPending() {
  const { supabaseUserId } = useAuthStore.getState()
  if (!supabaseUserId) throw new Error('로그인이 필요합니다')

  // 마이그레이션 완료 확인
  const migratedKey = `migrated_to_${supabaseUserId}`
  if (!localStorage.getItem(migratedKey)) {
    throw new Error('사용자 데이터 마이그레이션이 완료되지 않았습니다')
  }

  // userId 불일치 레코드 사전 필터링 및 경고
  let records = await getPendingRecords()
  const staleRecords = records.filter(r => r.userId !== supabaseUserId)
  if (staleRecords.length > 0) {
    console.warn(`[sync] userId 불일치 레코드 ${staleRecords.length}건 — 자동 보정`)
    records = records.map(r => ({ ...r, userId: supabaseUserId }))
  }
  // ...
}
```

#### 2-3. 다운로드 충돌 감지 (BUG #5)
```js
// src/services/syncService.js
async downloadFromServer(since = null) {
  if (!since) {
    // 최초 다운로드 시 로컬 데이터 존재 여부 확인
    const localCount = await db.transactions.count()
    if (localCount > 0) {
      // syncStore에 conflict 상태 설정 → UI에서 사용자 확인 요청
      useSyncStore.getState().setSyncStatus('conflict_on_initial_download')
      throw new Error('최초 동기화: 로컬 데이터가 있습니다. UI에서 확인이 필요합니다.')
    }
  }
  // ...
}
```

---

### Phase 3 — 중기 개선 (1주 내, ~3시간)

#### 3-1. migrate 옵션 처리 (BUG #7)
```js
// api/sync/upload.js
const { table, records, migrate } = req.body

for (const record of records) {
  if (migrate) {
    // 마이그레이션 모드: 버전 비교 없이 upsert
    await supabase.from(pgTable).upsert({ ... })
  } else {
    // 일반 모드: sync_version 비교
    const { data: existing } = await supabase
      .from(pgTable).select('sync_version').eq('id', String(record.id)).single()
    if (existing?.sync_version > (record.syncVersion ?? 0)) {
      conflicts.push(record)
      continue
    }
    await supabase.from(pgTable).upsert({ ... })
  }
}
```

#### 3-2. syncVersion 갱신 명시화 (BUG #6)
```js
// 업로드 후 로컬 syncVersion 업데이트 확인
const { conflicts, uploaded } = await res.json()
await db[table].bulkPut(
  uploaded.map((r) => ({
    ...r,
    syncVersion: r.syncVersion,  // 서버 응답의 syncVersion 명시
    syncedAt: now,
  }))
)
```

---

## 5. Supabase 데이터 상태 점검 쿼리

문제 진단을 위해 Supabase SQL Editor에서 다음 쿼리 실행 권장.

```sql
-- userId 불일치 레코드 확인 (data.userId != user_id)
SELECT id, user_id, data->>'userId' as data_userid,
       CASE WHEN user_id = data->>'userId' THEN '일치' ELSE '불일치' END as status
FROM transactions
WHERE user_id IS NOT NULL
ORDER BY synced_at DESC
LIMIT 50;

-- 테이블별 데이터 건수
SELECT 'transactions' as tbl, count(*) FROM transactions
UNION ALL
SELECT 'cash_flows', count(*) FROM cash_flows
UNION ALL
SELECT 'calendar_events', count(*) FROM calendar_events;

-- 최근 업로드된 레코드 확인
SELECT id, user_id, sync_version, synced_at
FROM transactions
ORDER BY synced_at DESC
LIMIT 20;
```

---

## 6. 검증 시나리오

### 시나리오 A: 신규 기기에서 로그인 후 복원
```
1. 신규 기기에서 moonsongit@gmail.com 로그인
2. IndexedDB 비어있음 (로컬 데이터 없음)
3. downloadFromServer() 실행
4. 거래내역, 입출금내역, 캘린더 이벤트 모두 복원됨
5. 포트폴리오 현황 정상 표시
```

### 시나리오 B: 두 기기 동시 사용 (증분 동기화)
```
1. 기기 A: 거래 tx-100 입력 → 업로드
2. 기기 B: 로그인 → 다운로드 → tx-100 수신
3. 기기 B: 거래 tx-101 입력 → 업로드
4. 기기 A: 다운로드 (since=마지막 동기화 시간) → tx-101 수신
5. 양쪽 데이터 일치 확인
```

### 시나리오 C: 오프라인 후 동기화
```
1. 오프라인 상태에서 거래 3건 입력 (syncedAt=null)
2. 네트워크 연결 복구
3. uploadPending() 실행 → 3건 업로드
4. 서버에 3건 저장됨 확인
5. 다른 기기에서 다운로드 → 3건 수신 확인
```

---

## 7. 요약

| 항목 | 현황 |
|------|------|
| 업로드 기능 | 작동하지만 userId 불일치 위험 있음 |
| 다운로드 기능 | accounts/watchlist 누락, 데이터 구조 불일치 |
| 마이그레이션 | Race Condition으로 신규 입력 데이터 누락 가능 |
| 충돌 감지 | 최초 다운로드 시 없음 (로컬 데이터 덮어씌움) |
| 테이블 커버리지 | transactions, cashFlows, calendarEvents만 동기화됨 |

**가장 중요한 즉시 조치 2가지.**

1. `migrateLocalUserData()` 앞에 `await` 추가 — Race Condition 제거
2. `api/sync/download.js` TABLE_MAP에 누락된 테이블 추가

이 두 가지만 해도 현재 경험하는 문제의 상당 부분이 해소될 것으로 예상됩니다.
