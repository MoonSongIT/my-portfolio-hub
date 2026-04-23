// 종목 DB 스토어
// 서버 API로 다운로드한 종목 목록을 시장별로 localStorage에 persist
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const EMPTY_MARKETS = {
  KOSPI:      [],
  KOSDAQ:     [],
  KRX_ETF:   [],
  NASDAQ:     [],
  NYSE:       [],
  NASDAQ_ETF: [],
  NYSE_ETF:  [],
}

export const useStockDbStore = create(
  persist(
    (set, get) => ({
      // 시장별 다운로드 종목 목록
      stocksByMarket: { ...EMPTY_MARKETS },

      // 마지막 업데이트 시각 (ISO string)
      updatedAt: null,

      // 시장별 에러 메시지
      errors: {},

      // 사용자 커스텀 추가 종목
      customStocks: [],

      // ── 업데이트 ──────────────────────────────────────────────────

      /** 서버에서 받아온 byMarket 데이터를 저장 */
      setDownloadedStocks: ({ byMarket, errors, updatedAt }) =>
        set({
          stocksByMarket: { ...EMPTY_MARKETS, ...byMarket },
          errors: errors || {},
          updatedAt,
        }),

      /** 단일 시장만 덮어쓰기 */
      setMarketStocks: (market, stocks) =>
        set(state => ({
          stocksByMarket: { ...state.stocksByMarket, [market]: stocks },
        })),

      // ── 커스텀 종목 ───────────────────────────────────────────────

      addCustomStock: (stock) => {
        const { customStocks, stocksByMarket } = get()
        // 전체 DB 중복 확인
        const allTickers = [
          ...customStocks,
          ...Object.values(stocksByMarket).flat(),
        ].map(s => s.ticker)
        if (allTickers.includes(stock.ticker)) return false
        set({ customStocks: [...customStocks, { ...stock, isCustom: true }] })
        return true
      },

      removeCustomStock: (ticker) =>
        set(state => ({
          customStocks: state.customStocks.filter(s => s.ticker !== ticker),
        })),

      // ── 조회 헬퍼 ─────────────────────────────────────────────────

      /** 전체 종목 수 */
      getTotalCount: () => {
        const { stocksByMarket, customStocks } = get()
        return Object.values(stocksByMarket).reduce((s, arr) => s + arr.length, 0)
             + customStocks.length
      },

      /** 특정 시장 종목 반환 */
      getMarketStocks: (market) => get().stocksByMarket[market] || [],

      /** 전체 종목 플랫 배열 (커스텀 포함) */
      getAllStocks: () => {
        const { stocksByMarket, customStocks } = get()
        return [...Object.values(stocksByMarket).flat(), ...customStocks]
      },

      /** DB가 비어있는지 (한 번도 업데이트 안 된 상태) */
      isEmpty: () => {
        const { stocksByMarket } = get()
        return Object.values(stocksByMarket).every(arr => arr.length === 0)
      },

      /** ticker로 corp_code 조회 (DART 공시 API 사용 시) */
      getCorpCode: (ticker) => {
        const { stocksByMarket, customStocks } = get()
        const all = [...Object.values(stocksByMarket).flat(), ...customStocks]
        return all.find(s => s.ticker === ticker)?.corp_code || ''
      },

      // ── 초기화 ────────────────────────────────────────────────────
      clearAll: () =>
        set({ stocksByMarket: { ...EMPTY_MARKETS }, updatedAt: null, errors: {} }),
    }),
    { name: 'stock-db-v1' }
  )
)
