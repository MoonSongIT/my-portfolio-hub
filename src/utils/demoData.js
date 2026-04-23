/**
 * 데모 데이터 생성 유틸리티
 * 테스트 및 시연 목적으로 2개월간의 거래 데이터를 생성합니다.
 *
 * 구조: 일반계좌(KOSPI 3종목) + ISA계좌(KOSDAQ 2 + ETF 2 + NASDAQ 1)
 * 기간: 2026-02-16 ~ 2026-04-15 (약 42 거래일)
 * 목표: 순이익 ~2% (초기 자본 4,000만원 대비)
 */

// ─── 데모 사용자 설정 ───

export const DEMO_USER = {
  id: 'user-demo0001',
  name: '데모 사용자',
  email: 'demo@portfolio.hub',
  password: 'demo1234',
}

const DEMO_GENERAL_ID = 'demo-account-general'
const DEMO_ISA_ID = 'demo-account-isa'
const INITIAL_DEPOSIT = 20_000_000

// ─── 종목 설정 ───

const GENERAL_STOCKS = [
  { ticker: '005930', name: '삼성전자', market: 'KRX', basePrice: 71000, totalReturn: 0.025, vol: 0.015 },
  { ticker: '000660', name: 'SK하이닉스', market: 'KRX', basePrice: 178000, totalReturn: 0.030, vol: 0.020 },
  { ticker: '005380', name: '현대차', market: 'KRX', basePrice: 248000, totalReturn: 0.015, vol: 0.018 },
]

const ISA_STOCKS = [
  { ticker: '247540', name: '에코프로비엠', market: 'KOSDAQ', basePrice: 245000, totalReturn: 0.035, vol: 0.025 },
  { ticker: '028300', name: 'HLB', market: 'KOSDAQ', basePrice: 79000, totalReturn: -0.005, vol: 0.022 },
  { ticker: '069500', name: 'KODEX 200', market: 'KRX', basePrice: 37800, totalReturn: 0.018, vol: 0.010 },
  { ticker: '360750', name: 'TIGER 미국S&P500', market: 'KRX', basePrice: 17900, totalReturn: 0.022, vol: 0.012 },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'NASDAQ', basePrice: 128, totalReturn: 0.040, vol: 0.025 },
]

// ─── 심리 카테고리 ───

const BUY_PSYCHS_INITIAL = ['미래가치 투자', '분할매수 원칙']
const BUY_PSYCHS_DIP = ['저가 매수', '분할매수 원칙']
const BUY_PSYCHS_CHASE = ['추격매매', '뉴스 편승']
const SELL_PSYCHS_PROFIT = ['목표가 실현', '수익 실현 (조급)']
const SELL_PSYCHS_LOSS = ['손절 원칙', '공포에 매도']

// ─── 유틸리티 ───

/** 결정론적 의사 난수 생성기 (LCG) */
function createRng(seed) {
  let s = seed | 0
  return () => {
    s = ((s * 1103515245) + 12345) | 0
    return ((s >>> 16) & 0x7fff) / 0x7fff
  }
}

/** 문자열 해시 (종목별 고유 위상 생성용) */
function hashStr(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

/** 거래일 생성 (월~금, 법정공휴일 제외) */
function getTradingDays() {
  const holidays = new Set([
    '2026-03-02', // 삼일절 대체공휴일 (3/1 일요일 → 3/2 월요일)
  ])
  const start = new Date('2026-02-16T00:00:00')
  const end = new Date('2026-04-15T00:00:00')
  const days = []

  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${day}`
      if (!holidays.has(dateStr)) {
        days.push(dateStr)
      }
    }
    d.setDate(d.getDate() + 1)
  }

  return days
}

/** 주가 시뮬레이션 (결정론적: 트렌드 + 사인파 변동) */
function getPrice(stock, dayIndex, totalDays) {
  const progress = dayIndex / totalDays
  const trend = stock.basePrice * (1 + stock.totalReturn * progress)
  const phase = hashStr(stock.ticker) * 0.01
  const cycle = stock.basePrice * stock.vol * Math.sin(dayIndex * 0.3 + phase)
  return roundPrice(trend + cycle, stock.market)
}

/** 시장 규칙에 맞게 가격 반올림 */
function roundPrice(raw, market) {
  if (market === 'NASDAQ' || market === 'NYSE') {
    return Math.round(raw * 100) / 100
  }
  if (raw >= 100000) return Math.round(raw / 500) * 500
  if (raw >= 50000) return Math.round(raw / 100) * 100
  if (raw >= 10000) return Math.round(raw / 50) * 50
  return Math.round(raw / 10) * 10
}

/** 배열에서 결정론적 선택 */
function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}

// ─── 거래 생성 ───

/**
 * 특정 계좌의 거래 내역을 생성합니다.
 * addEntry를 통해 추가하므로 pnl은 포함하지 않습니다 (store가 자동 계산).
 */
function generateAccountTrades(accountId, stocks, tradingDays, seed) {
  const rng = createRng(seed)
  const totalDays = tradingDays.length
  const trades = []

  // 포지션 추적
  const positions = {}
  for (const s of stocks) {
    positions[s.ticker] = { quantity: 0, totalCost: 0 }
  }

  // USD 종목은 별도 캐시 관리 (근사값)
  const isUSD = (market) => market === 'NASDAQ' || market === 'NYSE'
  let cashKRW = INITIAL_DEPOSIT
  let cashUSD = 0 // NVDA용 (근사 $2000 환전 가정)
  const EXCHANGE_RATE = 1350

  // 초기 USD 환전 (ISA 계좌에 NVDA가 있는 경우)
  const hasUSDStock = stocks.some(s => isUSD(s.market))
  if (hasUSDStock) {
    const usdAllocation = 2_700_000 // ~$2000
    cashKRW -= usdAllocation
    cashUSD = Math.floor(usdAllocation / EXCHANGE_RATE)
  }

  const stockCount = stocks.length
  const krwStocks = stocks.filter(s => !isUSD(s.market))
  const usdStocks = stocks.filter(s => isUSD(s.market))

  // 종목별 투자 목표 금액
  const krwPerStock = Math.floor((INITIAL_DEPOSIT * 0.80 - (hasUSDStock ? 2_700_000 : 0)) / krwStocks.length)
  const usdPerStock = hasUSDStock ? Math.floor(cashUSD / usdStocks.length) : 0

  // ── Phase 1: 초기 매수 (Day 0~5) ──

  let buySchedule = []
  // 각 종목을 2~3회에 나눠 매수
  for (const s of stocks) {
    const isUs = isUSD(s.market)
    const targetAmount = isUs ? usdPerStock : krwPerStock
    const numBuys = 2 + Math.floor(rng() * 2) // 2~3회
    for (let i = 0; i < numBuys; i++) {
      buySchedule.push({
        stock: s,
        targetAmount: Math.floor(targetAmount / numBuys),
      })
    }
  }
  // 셔플 (결정론적)
  for (let i = buySchedule.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[buySchedule[i], buySchedule[j]] = [buySchedule[j], buySchedule[i]]
  }

  const phase1Days = Math.min(6, totalDays)
  let schedIdx = 0
  for (let d = 0; d < phase1Days; d++) {
    const tradesPerDay = Math.min(2, buySchedule.length - schedIdx)
    for (let t = 0; t < tradesPerDay; t++) {
      if (schedIdx >= buySchedule.length) break
      const { stock, targetAmount } = buySchedule[schedIdx]
      const price = getPrice(stock, d, totalDays)
      const isUs = isUSD(stock.market)
      const qty = Math.max(1, Math.floor(targetAmount / price))
      const cost = price * qty
      const fee = isUs ? 0 : Math.round(cost * 0.00015)
      const cash = isUs ? cashUSD : cashKRW

      if (cash >= cost + fee && qty > 0) {
        trades.push({
          date: tradingDays[d],
          ticker: stock.ticker,
          name: stock.name,
          market: stock.market,
          action: 'buy',
          price,
          quantity: qty,
          fee,
          psychology: pick(BUY_PSYCHS_INITIAL, rng),
          memo: '초기 포트폴리오 구성',
          accountId,
        })
        positions[stock.ticker].quantity += qty
        positions[stock.ticker].totalCost += cost + fee
        if (isUs) cashUSD -= cost + fee
        else cashKRW -= cost + fee
      }
      schedIdx++
    }
  }

  // ── Phase 2: 매매 혼합 (Day 6 ~ Day totalDays-4) ──

  const phase2Start = phase1Days
  const phase2End = totalDays - 4

  for (let d = phase2Start; d < phase2End; d++) {
    const tradesPerDay = rng() > 0.35 ? 1 : 2

    for (let t = 0; t < tradesPerDay; t++) {
      // 종목 선택 (로테이션 + 약간의 랜덤)
      const stockIdx = (d + t + Math.floor(rng() * 2)) % stockCount
      const stock = stocks[stockIdx]
      const isUs = isUSD(stock.market)
      const pos = positions[stock.ticker]
      const price = getPrice(stock, d, totalDays)
      const avgPrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0
      const priceVsAvg = avgPrice > 0 ? (price - avgPrice) / avgPrice : 0
      const cash = isUs ? cashUSD : cashKRW

      // 매도 조건: 보유 중 + 수익률 1% 이상 + 확률
      const canSell = pos.quantity > 0 && priceVsAvg > 0.008
      // 매수 조건: 현금 여유 + 가격 하락 또는 포지션 작음
      const canBuy = cash > price * 3 && (priceVsAvg < -0.003 || pos.quantity === 0)

      if (canSell && rng() > 0.42) {
        // 매도
        const sellPct = 0.2 + rng() * 0.35 // 20~55%
        const sellQty = Math.max(1, Math.floor(pos.quantity * sellPct))
        const expectedPnl = (price - avgPrice) * sellQty
        const psychs = expectedPnl > 0 ? SELL_PSYCHS_PROFIT : SELL_PSYCHS_LOSS
        const memo = expectedPnl > 0 ? '목표 수익률 달성' : '손실 최소화'

        trades.push({
          date: tradingDays[d],
          ticker: stock.ticker,
          name: stock.name,
          market: stock.market,
          action: 'sell',
          price,
          quantity: sellQty,
          fee: 0,
          psychology: pick(psychs, rng),
          memo,
          accountId,
        })

        // 포지션 업데이트
        pos.totalCost -= avgPrice * sellQty
        pos.quantity -= sellQty
        if (isUs) cashUSD += price * sellQty
        else cashKRW += price * sellQty

      } else if (canBuy && rng() > 0.38) {
        // 매수
        const budgetPct = 0.15 + rng() * 0.2 // 캐시의 15~35%
        const budget = Math.floor(cash * budgetPct)
        const qty = Math.max(1, Math.floor(budget / price))
        const cost = price * qty
        const fee = isUs ? 0 : Math.round(cost * 0.00015)

        if (cash >= cost + fee && qty > 0) {
          const psychs = priceVsAvg < -0.01 ? BUY_PSYCHS_DIP : BUY_PSYCHS_CHASE
          const memo = priceVsAvg < -0.01 ? '하락 시 추가 매수' : '상승 추세 매수'

          trades.push({
            date: tradingDays[d],
            ticker: stock.ticker,
            name: stock.name,
            market: stock.market,
            action: 'buy',
            price,
            quantity: qty,
            fee,
            psychology: pick(psychs, rng),
            memo,
            accountId,
          })

          pos.quantity += qty
          pos.totalCost += cost + fee
          if (isUs) cashUSD -= cost + fee
          else cashKRW -= cost + fee
        }
      }
    }
  }

  // Phase 3 (마지막 4일): 거래 없음 — 보유 유지

  return trades
}

// ─── 메인 시드 함수 ───

/**
 * 데모 데이터를 생성하고 스토어 + IndexedDB에 저장합니다.
 * 이미 데모 데이터가 존재하면 스킵합니다.
 *
 * @returns {Promise<boolean>} 새로 생성되었으면 true
 */
export async function seedDemoData() {
  // 동적 임포트 (순환 참조 방지)
  const { useAccountStore } = await import('../store/accountStore')
  const { useJournalStore } = await import('../store/journalStore')
  const { useCashFlowStore } = await import('../store/cashFlowStore')

  // 이미 데모 데이터가 있는지 확인
  const accounts = useAccountStore.getState().accounts
  if (accounts.some(a => a.id === DEMO_GENERAL_ID)) {
    console.log('[Demo] 데모 데이터가 이미 존재합니다. 스킵합니다.')
    return false
  }

  console.log('[Demo] 데모 데이터 생성을 시작합니다...')
  const startTime = performance.now()

  // ── 1. 계좌 생성 ──

  useAccountStore.getState().addAccount({
    id: DEMO_GENERAL_ID,
    name: 'KB증권 주식계좌',
    broker: 'KB증권',
    type: 'GENERAL',
    currency: 'KRW',
    initialBalance: INITIAL_DEPOSIT,
    memo: '데모 일반(위탁) 계좌',
  })

  useAccountStore.getState().addAccount({
    id: DEMO_ISA_ID,
    name: '삼성증권 ISA',
    broker: '삼성증권',
    type: 'ISA',
    currency: 'KRW',
    initialBalance: INITIAL_DEPOSIT,
    memo: '데모 ISA 계좌',
  })

  // ── 2. 초기 입금 (수동 입출금) ──

  const baseDate = '2026-02-16'

  useCashFlowStore.getState().addCashFlow({
    accountId: DEMO_GENERAL_ID,
    date: baseDate,
    type: 'deposit',
    amount: INITIAL_DEPOSIT,
    currency: 'KRW',
    memo: '초기 투자금 입금',
  })

  useCashFlowStore.getState().addCashFlow({
    accountId: DEMO_ISA_ID,
    date: baseDate,
    type: 'deposit',
    amount: INITIAL_DEPOSIT,
    currency: 'KRW',
    memo: '초기 투자금 입금',
  })

  // ── 3. 거래 생성 ──

  const tradingDays = getTradingDays()
  console.log(`[Demo] 거래일 수: ${tradingDays.length}일 (${tradingDays[0]} ~ ${tradingDays[tradingDays.length - 1]})`)

  const generalTrades = generateAccountTrades(DEMO_GENERAL_ID, GENERAL_STOCKS, tradingDays, 42)
  const isaTrades = generateAccountTrades(DEMO_ISA_ID, ISA_STOCKS, tradingDays, 137)

  // 전체 거래를 날짜순 정렬 (같은 날짜면 계좌별 순서 유지)
  const allTrades = [...generalTrades, ...isaTrades].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    // 같은 날짜: 일반계좌 먼저
    if (a.accountId !== b.accountId) return a.accountId.localeCompare(b.accountId)
    return 0
  })

  // 하나씩 추가 (addEntry가 pnl 자동 계산 + cashFlow 자동 생성)
  const addEntry = useJournalStore.getState().addEntry
  for (const trade of allTrades) {
    addEntry(trade)
  }

  const elapsed = Math.round(performance.now() - startTime)
  const buyCount = allTrades.filter(t => t.action === 'buy').length
  const sellCount = allTrades.filter(t => t.action === 'sell').length

  console.log(`[Demo] 데모 데이터 생성 완료 (${elapsed}ms)`)
  console.log(`[Demo] 총 ${allTrades.length}건 거래 (매수 ${buyCount}건 / 매도 ${sellCount}건)`)
  console.log(`[Demo] 일반계좌: ${generalTrades.length}건, ISA계좌: ${isaTrades.length}건`)

  return true
}

/**
 * 데모 데이터 요약 정보를 반환합니다 (검증용).
 */
export function getDemoDataSummary() {
  const tradingDays = getTradingDays()
  const generalTrades = generateAccountTrades(DEMO_GENERAL_ID, GENERAL_STOCKS, tradingDays, 42)
  const isaTrades = generateAccountTrades(DEMO_ISA_ID, ISA_STOCKS, tradingDays, 137)

  const summarize = (trades, label) => {
    const buyCount = trades.filter(t => t.action === 'buy').length
    const sellCount = trades.filter(t => t.action === 'sell').length
    const tickers = [...new Set(trades.map(t => t.ticker))]
    return { label, total: trades.length, buyCount, sellCount, tickers }
  }

  return {
    tradingDays: tradingDays.length,
    period: `${tradingDays[0]} ~ ${tradingDays[tradingDays.length - 1]}`,
    general: summarize(generalTrades, '일반계좌'),
    isa: summarize(isaTrades, 'ISA계좌'),
    totalTrades: generalTrades.length + isaTrades.length,
  }
}
