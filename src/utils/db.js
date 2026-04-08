import Dexie from 'dexie'

// ─── Dexie 인스턴스 ───
export const db = new Dexie('PortfolioHub')

// &id = 기존 UUID primary key 사용 (auto-increment 아님)
db.version(1).stores({
  transactions: '&id, ticker, action, date, accountId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
})

// v2: 입출금 내역 테이블 추가
db.version(2).stores({
  transactions: '&id, ticker, action, date, accountId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
  cashFlows:     '&id, accountId, type, date, isAuto',
})

// v3: 일별 손익 스냅샷 테이블 추가
db.version(3).stores({
  transactions: '&id, ticker, action, date, accountId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
  cashFlows:     '&id, accountId, type, date, isAuto',
  dailyPnl:      '&[ticker+date+accountId], ticker, date, accountId',
})

// v4: 테스트 데이터 초기화
db.version(4).stores({
  transactions: '&id, ticker, action, date, accountId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
  cashFlows:     '&id, accountId, type, date, isAuto',
  dailyPnl:      '&[ticker+date+accountId], ticker, date, accountId',
}).upgrade(tx => {
  tx.table('transactions').clear()
  tx.table('cashFlows').clear()
  tx.table('dailyPnl').clear()
  tx.table('reports').clear()
})

// v5: 사용자별 데이터 격리 — userId 인덱스 추가 + 기존 비격리 데이터 초기화
db.version(5).stores({
  transactions: '&id, ticker, action, date, accountId, userId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
  cashFlows:     '&id, accountId, type, date, isAuto, userId',
  dailyPnl:      '&[ticker+date+accountId], ticker, date, accountId, userId',
}).upgrade(tx => {
  // userId 없는 기존 데이터 전체 삭제 (사용자 혼재 방지)
  tx.table('transactions').clear()
  tx.table('cashFlows').clear()
  tx.table('dailyPnl').clear()
})

// ─── transactions CRUD ───

export async function addTransaction(entry) {
  return db.transactions.put(entry) // put = upsert (id 충돌 시 업데이트)
}

export async function updateTransaction(id, updates) {
  return db.transactions.update(id, updates)
}

export async function deleteTransaction(id) {
  return db.transactions.delete(id)
}

export async function getAllTransactions() {
  return db.transactions.toArray()
}

export async function getTransactionsByUser(userId) {
  return db.transactions.where('userId').equals(userId).toArray()
}

export async function deleteTransactionsByUser(userId) {
  return db.transactions.where('userId').equals(userId).delete()
}

export async function deleteCashFlowsByUser(userId) {
  return db.cashFlows.where('userId').equals(userId).delete()
}

export async function getTransactionsByTicker(ticker) {
  return db.transactions.where('ticker').equals(ticker).toArray()
}

export async function getTransactionsByDate(startDate, endDate) {
  return db.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray()
}

// ─── priceHistory CRUD ───

export async function getPriceHistory(ticker, days = 365) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startStr = startDate.toISOString().split('T')[0]

  return db.priceHistory
    .where('ticker').equals(ticker)
    .and(entry => entry.date >= startStr)
    .toArray()
}

export async function savePriceHistory(ticker, historyData) {
  const entries = historyData.map(h => ({ ticker, ...h }))
  return db.priceHistory.bulkPut(entries)
}

// 캐시 유효성 확인 (hours 시간 이내 데이터가 있으면 유효)
export async function isCacheValid(ticker, hours = 24) {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hours)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const count = await db.priceHistory
    .where('ticker').equals(ticker)
    .and(entry => entry.date >= cutoffStr)
    .count()

  return count > 0
}

// ─── reports CRUD ───

export async function saveReport(reportData) {
  return db.reports.add({
    ...reportData,
    createdAt: new Date().toISOString(),
  })
}

export async function getReportsByType(type) {
  return db.reports.where('type').equals(type).toArray()
}

// ─── cashFlows CRUD ───

export async function addCashFlow(entry) {
  return db.cashFlows.put(entry)
}

export async function updateCashFlow(id, updates) {
  return db.cashFlows.update(id, updates)
}

export async function deleteCashFlow(id) {
  return db.cashFlows.delete(id)
}

export async function getAllCashFlows() {
  return db.cashFlows.toArray()
}

export async function getCashFlowsByUser(userId) {
  return db.cashFlows.where('userId').equals(userId).toArray()
}

export async function getCashFlowsByAccount(accountId) {
  return db.cashFlows.where('accountId').equals(accountId).toArray()
}

export async function deleteCashFlowsByAccount(accountId) {
  return db.cashFlows.where('accountId').equals(accountId).delete()
}

// ─── dailyPnl CRUD ───

export async function upsertDailyPnl(snapshot) {
  return db.dailyPnl.put(snapshot)
}

export async function bulkUpsertDailyPnl(snapshots) {
  return db.dailyPnl.bulkPut(snapshots)
}

export async function getDailyPnlByTicker(ticker) {
  return db.dailyPnl.where('ticker').equals(ticker).sortBy('date')
}

export async function getDailyPnlByDate(date) {
  return db.dailyPnl.where('date').equals(date).toArray()
}

export async function getAllDailyPnl() {
  return db.dailyPnl.toArray()
}

export async function getDailyPnlByUser(userId) {
  return db.dailyPnl.where('userId').equals(userId).toArray()
}

export async function clearDailyPnl() {
  return db.dailyPnl.clear()
}
