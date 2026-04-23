/**
 * stockMasterStore.js — 종목 마스터 Zustand 메타 스토어
 *
 * rows 자체는 IDB(StockMasterDB)에 보관.
 * 이 스토어는 UI 렌더링에 필요한 메타 정보(카운트, 진행상태, 마지막 sync 결과)만 관리합니다.
 *
 * persist: name='stock-master-meta-v1' (LocalStorage)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCountsByExchange } from '@/utils/stockMasterDb'

const INITIAL_COUNTS = {
  KOSPI: 0, KOSDAQ: 0, NXT: 0, KRX_ETF: 0,
  NYSE: 0, NASDAQ: 0, US_ETF: 0,
}

export const useStockMasterStore = create(
  persist(
    (set, get) => ({
      // ── 상태 ───────────────────────────────────────────────────────────

      /** exchange 별 활성 종목 카운트 (IDB 조회 결과) */
      counts: { ...INITIAL_COUNTS },

      /** 마지막 sync 완료 시각 (ISO string) */
      lastSync: null,

      /** 마지막 sync 결과 요약 */
      lastStats: null,
      // { added: N, changed: N, removed: N, durationMs: N, exchanges: [...] }

      /** 현재 진행 중인 작업 상태 (null = idle) */
      progress: null,
      // { exchange, phase: 'fetch'|'sync', current?: N, total?: N }

      // ── 액션 ───────────────────────────────────────────────────────────

      /**
       * 진행 상태 갱신 (sync 실행 중 onProgress 콜백에서 호출)
       * @param {{ exchange, phase, current?, total? }|null} info
       */
      setProgress: (info) => set({ progress: info }),

      /**
       * sync 완료 후 결과 저장 + progress 초기화
       * @param {{ added, changed, removed, durationMs, exchanges? }} stats
       */
      setSyncResult: (stats) =>
        set({
          lastSync:  new Date().toISOString(),
          lastStats: stats,
          progress:  null,
        }),

      /**
       * IDB에서 exchange별 카운트를 읽어 counts 상태 갱신
       * 앱 기동 시 또는 sync 완료 후 호출
       */
      refreshCounts: async () => {
        try {
          const counts = await getCountsByExchange()
          set({ counts })
        } catch (err) {
          console.warn('[StockMasterStore] refreshCounts 실패:', err.message)
        }
      },

      /**
       * 특정 exchange의 카운트만 업데이트
       * @param {string} exchange
       * @param {number} count
       */
      setExchangeCount: (exchange, count) =>
        set(state => ({
          counts: { ...state.counts, [exchange]: count },
        })),

      /**
       * 진행 중 여부 확인
       */
      isSyncing: () => get().progress !== null,

      /**
       * 총 종목 수 계산
       */
      getTotalCount: () =>
        Object.values(get().counts).reduce((s, n) => s + n, 0),

      /**
       * 국내/해외 카운트 요약
       */
      getCategoryCounts: () => {
        const { counts } = get()
        return {
          DOMESTIC: (counts.KOSPI || 0) + (counts.KOSDAQ || 0) + (counts.NXT || 0) + (counts.KRX_ETF || 0),
          OVERSEAS: (counts.NYSE || 0) + (counts.NASDAQ || 0) + (counts.US_ETF || 0),
        }
      },

      /** 상태 전체 초기화 (DB 초기화 시 함께 호출) */
      reset: () =>
        set({
          counts:    { ...INITIAL_COUNTS },
          lastSync:  null,
          lastStats: null,
          progress:  null,
        }),
    }),
    {
      name: 'stock-master-meta-v1',
      // rows 는 IDB에 있으므로 persist 대상에서 명시적 제외 (기본 전체 포함이므로 allowlist 방식)
      partialize: (state) => ({
        counts:    state.counts,
        lastSync:  state.lastSync,
        lastStats: state.lastStats,
        // progress 는 재기동 시 초기화 (저장 불필요)
      }),
    }
  )
)
