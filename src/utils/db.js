import Dexie from 'dexie'

// ─── Dexie 인스턴스 ───
export const db = new Dexie('PortfolioHub')

// &id = 기존 UUID primary key 사용 (auto-increment 아님)
db.version(1).stores({
  transactions: '&id, ticker, action, date, accountId',
  priceHistory:  '++id, ticker, date',
  reports:       '++id, type, createdAt',
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
