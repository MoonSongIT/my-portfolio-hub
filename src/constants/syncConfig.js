// 동기화 대상 테이블 매핑 — upload/download API와 syncService가 공유
// 순서 = 업로드 순서 (FK 의존성 반영: userAccounts 먼저)
export const SYNC_TABLE_MAP = [
  { local: 'userAccounts',   server: 'user_accounts'   },
  { local: 'transactions',   server: 'transactions'    },
  { local: 'cashFlows',      server: 'cash_flows'      },
  { local: 'watchlist',      server: 'watchlist'       },
  { local: 'calendarEvents', server: 'calendar_events' },
  { local: 'reports',        server: 'reports'         },
]

// 동기화 제외 (이유 명시)
// aiCredentials  — 보안 필수, 서버 저장 금지
// priceHistory   — 실시간 API 재취득 가능
// dailyPnl       — transactions 파생값
// alertHistory   — 디바이스 로컬 전용
// chatHistory    — 선택적 (추후 결정)

// camelCase → snake_case 변환
export const toSnake = key =>
  key.replace(/([A-Z])/g, '_$1').toLowerCase()

// snake_case → camelCase 변환
export const toCamel = key =>
  key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

// 레코드 전체 필드명 변환 (값은 그대로)
export const recordToServer = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toSnake(k), v]))

export const recordToLocal = record =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [toCamel(k), v]))
