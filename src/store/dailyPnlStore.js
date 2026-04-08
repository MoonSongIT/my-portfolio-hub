import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  upsertDailyPnl,
  bulkUpsertDailyPnl,
  getAllDailyPnl,
} from '../utils/db'

export const useDailyPnlStore = create(
  persist(
    immer((set, get) => ({
      // { 'ticker|date|accountId': snapshot }  — 빠른 조회용
      snapshots: {},

      // ─── 액션 ───

      saveSnapshot: (snapshot) => {
        const key = `${snapshot.ticker}|${snapshot.date}|${snapshot.accountId}`
        set((state) => { state.snapshots[key] = snapshot })
        upsertDailyPnl(snapshot).catch(err => console.warn('[DB] upsertDailyPnl failed:', err))
      },

      bulkSave: (snapshots) => {
        set((state) => {
          snapshots.forEach(s => {
            const key = `${s.ticker}|${s.date}|${s.accountId}`
            state.snapshots[key] = s
          })
        })
        bulkUpsertDailyPnl(snapshots).catch(err => console.warn('[DB] bulkUpsertDailyPnl failed:', err))
      },

      clearAll: () => {
        set((state) => { state.snapshots = {} })
      },

      // 앱 시작 시 IndexedDB에서 로드 (최근 180일치만)
      loadFromDB: async () => {
        try {
          const all = await getAllDailyPnl()
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - 180)
          const cutoffStr = cutoff.toISOString().split('T')[0]
          const recent = all.filter(s => s.date >= cutoffStr)
          if (recent.length > 0) {
            const map = {}
            recent.forEach(s => {
              const key = `${s.ticker}|${s.date}|${s.accountId}`
              map[key] = s
            })
            set((state) => { state.snapshots = map })
          }
        } catch (err) {
          console.warn('[DB] dailyPnl loadFromDB failed:', err)
        }
      },

      // ─── 셀렉터 ───

      // 특정 종목·계좌의 스냅샷 배열 (날짜 오름차순)
      getSnapshotsByTicker: (ticker, accountId) => {
        const all = Object.values(get().snapshots)
        return all
          .filter(s => s.ticker === ticker && (!accountId || s.accountId === accountId))
          .sort((a, b) => a.date.localeCompare(b.date))
      },

      // 특정 날짜의 전체 스냅샷
      getSnapshotsByDate: (date, accountId) => {
        const all = Object.values(get().snapshots)
        return all.filter(s =>
          s.date === date &&
          (!accountId || accountId === 'all' || s.accountId === accountId)
        )
      },

      // 특정 종목의 가장 최근 스냅샷
      getLatestSnapshot: (ticker, accountId) => {
        const list = get().getSnapshotsByTicker(ticker, accountId)
        return list.length > 0 ? list[list.length - 1] : null
      },

      // 오늘 스냅샷 이미 저장됐는지 확인 (ticker 미지정 시 전체 확인)
      hasSnapshotToday: (ticker, accountId) => {
        const today = new Date().toISOString().split('T')[0]
        const all   = Object.values(get().snapshots)
        return all.some(s =>
          s.date === today &&
          (!ticker    || s.ticker    === ticker) &&
          (!accountId || s.accountId === accountId)
        )
      },

      // 그래프용 누적 수익률 데이터 (날짜 오름차순)
      // returns [{ date, cumulativePnl, cumulativePnlRate, closePrice, dailyPnl }]
      getCumulativeData: (ticker, accountId) => {
        return get().getSnapshotsByTicker(ticker, accountId).map(s => ({
          date:               s.date,
          closePrice:         s.closePrice,
          dailyPnl:           s.dailyPnl,
          dailyPnlRate:       s.dailyPnlRate,
          cumulativePnl:      s.cumulativePnl,
          cumulativePnlRate:  s.cumulativePnlRate,
        }))
      },

      // 전체 보유 종목의 누적 수익률 오버레이 데이터
      // returns { ticker: [{ date, cumulativePnlRate }] }
      getAllCumulativeData: (accountId) => {
        const all = Object.values(get().snapshots)
        const filtered = accountId && accountId !== 'all'
          ? all.filter(s => s.accountId === accountId)
          : all
        const byTicker = {}
        filtered.forEach(s => {
          if (!byTicker[s.ticker]) byTicker[s.ticker] = []
          byTicker[s.ticker].push(s)
        })
        const result = {}
        Object.entries(byTicker).forEach(([ticker, list]) => {
          result[ticker] = list
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(s => ({
              date:              s.date,
              cumulativePnl:     s.cumulativePnl,
              cumulativePnlRate: s.cumulativePnlRate,
              name:              s.name,
            }))
        })
        return result
      },
    })),
    {
      name: 'daily-pnl-storage',
      version: 1,
      // localStorage에는 최근 30일치만 캐시 (나머지는 IndexedDB)
      partialize: (state) => {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const cutoffStr = cutoff.toISOString().split('T')[0]
        const recent = {}
        Object.entries(state.snapshots).forEach(([key, s]) => {
          if (s.date >= cutoffStr) recent[key] = s
        })
        return { snapshots: recent }
      },
      migrate: () => ({ snapshots: {} }),
    }
  )
)
