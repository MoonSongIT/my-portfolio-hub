import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { sampleAccounts } from '../data/samplePortfolio'
import { useAccountStore } from './accountStore'
import { useJournalStore } from './journalStore'
import { useCashFlowStore } from './cashFlowStore'
import { calculateTotalValue } from '../utils/calculator'

export const usePortfolioStore = create(
  persist(
    immer((set, get) => ({
      accounts: [],              // 하위 호환용 (accountStore에서 동기화)
      selectedAccountId: 'all',
      exchangeRate: 1350,
      lastUpdated: null,
      prices: {},                // { ticker: currentPrice } — 실시간 시세

      // ─── 계좌 관련 ───

      /**
       * 로그인 시 계좌 + 거래내역 초기화
       * - accountStore에 계좌 생성
       * - journalStore에 샘플 보유종목을 매수 거래로 시드
       * - portfolioStore.accounts에 동기화 (하위 호환)
       */
      loadUserAccounts: (userId) => {
        const accountStore = useAccountStore.getState()
        const journalStore = useJournalStore.getState()

        // 현재 사용자의 계좌만 필터링 (엄격 매칭)
        const userAccs = accountStore.accounts.filter(
          a => a.userId === userId
        )

        // 이미 계좌가 있으면 accounts만 동기화하고 종료
        if (userAccs.length > 0) {
          set((state) => {
            state.accounts = userAccs.map(a => ({
              id: a.id,
              userId,
              accountType: a.type,
              accountName: a.name,
              broker: a.broker,
              cashKRW: 0,
              cashUSD: 0,
            }))
            state.selectedAccountId = 'all'
          })
          return
        }

        // 샘플 데이터에서 계좌 + 거래내역 시드
        const userAccounts = sampleAccounts.filter(a => a.userId === userId)
        const initialPrices = {}

        userAccounts.forEach(sa => {
          // accountStore에 계좌 추가
          accountStore.addAccount({
            id: sa.id,
            name: sa.accountName,
            broker: sa.broker,
            type: sa.accountType,
            currency: 'KRW',
          })

          // 샘플 보유종목 → 매수 거래로 변환
          sa.holdings.forEach(h => {
            journalStore.addEntry({
              accountId: sa.id,
              date: '2026-01-01',
              ticker: h.ticker,
              name: h.name,
              market: h.market,
              action: 'buy',
              price: h.avgPrice,
              quantity: h.quantity,
              fee: 0,
              psychology: '미래가치 투자',
              memo: '초기 보유 (샘플)',
            })
            initialPrices[h.ticker] = h.currentPrice
          })
        })

        // portfolioStore 상태 업데이트
        set((state) => {
          state.accounts = userAccounts.map(sa => ({
            id: sa.id,
            userId: sa.userId,
            accountType: sa.accountType,
            accountName: sa.accountName,
            broker: sa.broker,
            cashKRW: sa.cashKRW,
            cashUSD: sa.cashUSD,
          }))
          state.selectedAccountId = 'all'
          Object.assign(state.prices, initialPrices)
        })
      },

      selectAccount: (accountId) => set((state) => {
        state.selectedAccountId = accountId
      }),

      clearAccounts: () => {
        useAccountStore.getState().clearAccounts()
        set((state) => {
          state.accounts = []
          state.selectedAccountId = 'all'
          state.prices = {}
        })
      },

      // ─── 시세 관련 ───

      updateAllPrices: (priceMap) => set((state) => {
        Object.assign(state.prices, priceMap)
        state.lastUpdated = new Date().toISOString()
      }),

      updateExchangeRate: (rate) => set((state) => {
        state.exchangeRate = rate
      }),

      // ─── 파생 데이터 (journalStore 기반) ───

      /**
       * 선택된 계좌의 보유 종목 반환
       * journalStore.computeHoldings 결과 + 실시간 시세 병합
       */
      getSelectedHoldings: () => {
        const { selectedAccountId, prices, accounts } = get()
        const journalState = useJournalStore.getState()

        let holdings
        if (selectedAccountId === 'all') {
          holdings = journalState.computeAllHoldings()
        } else {
          holdings = journalState.computeHoldings(selectedAccountId)
        }

        return holdings.map(h => {
          const account = accounts.find(a => a.id === h.accountId)
          const currency = h.market === 'KRX' ? 'KRW' : 'USD'
          return {
            ...h,
            currentPrice: prices[h.ticker] ?? h.avgPrice,
            currency,
            sector: 'ETC',
            accountName: account?.accountName || '기본 계좌',
            accountType: account?.accountType || 'GENERAL',
          }
        })
      },

      getSelectedCash: () => {
        const { selectedAccountId } = get()
        const cashFlowStore = useCashFlowStore.getState()
        const journalStore  = useJournalStore.getState()
        const accountStore  = useAccountStore.getState()

        // 계좌별 투자 가능 금액 계산 (입금 - 출금 - 현재 투자원가)
        const calcAvailable = (accountId) => {
          const deposit    = cashFlowStore.getTotalDeposit(accountId)
          const withdrawal = cashFlowStore.getTotalWithdrawal(accountId)
          const invested   = journalStore.computeHoldings(accountId)
            .reduce((s, h) => s + (h.totalCost || 0), 0)
          return deposit - withdrawal - invested
        }

        if (selectedAccountId === 'all') {
          return accountStore.accounts.reduce((sum, acc) => {
            const available = calcAvailable(acc.id)
            return acc.currency === 'USD'
              ? { krw: sum.krw, usd: sum.usd + available }
              : { krw: sum.krw + available, usd: sum.usd }
          }, { krw: 0, usd: 0 })
        }

        const acc = accountStore.accounts.find(a => a.id === selectedAccountId)
        if (!acc) return { krw: 0, usd: 0 }
        const available = calcAvailable(selectedAccountId)
        return acc.currency === 'USD'
          ? { krw: 0, usd: available }
          : { krw: available, usd: 0 }
      },

      getTotalValue: () => {
        const { getSelectedHoldings, getSelectedCash, exchangeRate } = get()
        const holdings = getSelectedHoldings()
        const { krw, usd } = getSelectedCash()
        return calculateTotalValue(holdings, krw, usd, exchangeRate)
      },

      // ─── 비권장 (deprecated) ───

      addHolding: () => { console.warn('[portfolioStore] addHolding deprecated: use journalStore.addEntry()') },
      updateHolding: () => { console.warn('[portfolioStore] updateHolding deprecated') },
      removeHolding: () => { console.warn('[portfolioStore] removeHolding deprecated') },
      updatePrice: () => { console.warn('[portfolioStore] updatePrice deprecated: use updateAllPrices()') },
      updateCash: () => { console.warn('[portfolioStore] updateCash deprecated') },
    })),
    {
      name: 'portfolio-storage',
      version: 6,
      migrate: () => ({
        accounts: [],
        selectedAccountId: 'all',
        exchangeRate: 1350,
        lastUpdated: null,
        prices: {},
      }),
    }
  )
)
