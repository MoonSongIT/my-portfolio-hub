import { EXCHANGE_RATE } from '../data/samplePortfolio'
import { CASH_FLOW_CATEGORIES } from '../store/cashFlowStore'

// 수익률 계산 (%)
export const calculateReturn = (buyPrice, currentPrice) => {
  if (buyPrice === 0) return 0
  return ((currentPrice - buyPrice) / buyPrice) * 100
}

// 종목 평가액
export const calculatePositionValue = (quantity, currentPrice) => {
  return quantity * currentPrice
}

// 종목 평가손익
export const calculatePositionPnL = (quantity, avgPrice, currentPrice) => {
  return (currentPrice - avgPrice) * quantity
}

// 종목 수익률
export const calculatePositionReturn = (avgPrice, currentPrice) => {
  return calculateReturn(avgPrice, currentPrice)
}

// 포트폴리오 총 평가액 (KRW 기준)
export const calculateTotalValue = (holdings, cashKRW = 0, cashUSD = 0, exchangeRate = EXCHANGE_RATE) => {
  const stockValue = holdings.reduce((sum, h) => {
    const posValue = h.quantity * h.currentPrice
    return sum + (h.currency === 'USD' ? posValue * exchangeRate : posValue)
  }, 0)
  return stockValue + cashKRW + (cashUSD * exchangeRate)
}

// 포트폴리오 총 투자금 (KRW 기준)
export const calculateTotalInvestment = (holdings, exchangeRate = EXCHANGE_RATE) => {
  return holdings.reduce((sum, h) => {
    const invested = h.quantity * h.avgPrice
    return sum + (h.currency === 'USD' ? invested * exchangeRate : invested)
  }, 0)
}

// 포트폴리오 총 수익률
export const calculatePortfolioReturn = (holdings, exchangeRate = EXCHANGE_RATE) => {
  const totalInvestment = calculateTotalInvestment(holdings, exchangeRate)
  const totalCurrent = holdings.reduce((sum, h) => {
    const posValue = h.quantity * h.currentPrice
    return sum + (h.currency === 'USD' ? posValue * exchangeRate : posValue)
  }, 0)
  if (totalInvestment === 0) return 0
  return ((totalCurrent - totalInvestment) / totalInvestment) * 100
}

// 포트폴리오 총 손익 (KRW)
export const calculateTotalPnL = (holdings, exchangeRate = EXCHANGE_RATE) => {
  return holdings.reduce((sum, h) => {
    const pnl = (h.currentPrice - h.avgPrice) * h.quantity
    return sum + (h.currency === 'USD' ? pnl * exchangeRate : pnl)
  }, 0)
}

// 종목별 비중 계산 (배열 반환)
export const calcAllocation = (holdings, exchangeRate = EXCHANGE_RATE) => {
  const totalKRW = holdings.reduce((sum, h) => {
    const value = h.quantity * h.currentPrice
    return sum + (h.currency === 'USD' ? value * exchangeRate : value)
  }, 0)

  return holdings.map(h => {
    const valueKRW = h.currency === 'USD'
      ? h.quantity * h.currentPrice * exchangeRate
      : h.quantity * h.currentPrice
    return {
      ticker: h.ticker,
      name: h.name,
      value: valueKRW,
      weight: totalKRW > 0 ? (valueKRW / totalKRW) * 100 : 0,
      sector: h.sector,
      market: h.market,
    }
  })
}

// 종목별 그룹핑 — 같은 종목(계좌가 달라도)을 하나로 합산
// 전체(여러 계좌) 조회 시 동일 종목이 계좌별로 따로 나오는 것을 방지
export const calcStockAllocation = (allocations) => {
  const stocks = {}
  allocations.forEach(a => {
    const key = `${a.market ?? ''}:${a.ticker}`
    if (!stocks[key]) {
      stocks[key] = { ticker: a.ticker, name: a.name, value: 0, weight: 0, sector: a.sector, market: a.market }
    }
    stocks[key].value += a.value
    stocks[key].weight += a.weight
  })
  return Object.values(stocks).sort((a, b) => b.value - a.value)
}

// 섹터별 그룹핑
export const calcSectorAllocation = (allocations) => {
  const sectors = {}
  allocations.forEach(a => {
    if (!sectors[a.sector]) sectors[a.sector] = { name: a.sector, value: 0, weight: 0 }
    sectors[a.sector].value += a.value
    sectors[a.sector].weight += a.weight
  })
  return Object.values(sectors)
}

// 국가별 그룹핑 (KR / US)
export const calcCountryAllocation = (allocations) => {
  const countries = {
    한국: { name: '한국', value: 0, weight: 0 },
    미국: { name: '미국', value: 0, weight: 0 },
  }
  allocations.forEach(a => {
    const key = a.market === 'KRX' ? '한국' : '미국'
    countries[key].value += a.value
    countries[key].weight += a.weight
  })
  return Object.values(countries)
}

// 계좌별 자산 비중 계산
export const calcAccountAllocation = (accounts, exchangeRate = EXCHANGE_RATE) => {
  return accounts.map(acc => {
    const holdings = acc.holdings || []
    const holdingsValue = holdings.reduce((sum, h) => {
      const value = h.quantity * (h.currentPrice || 0)
      return sum + (h.currency === 'USD' ? value * exchangeRate : value)
    }, 0)
    const cashValue = (acc.cashKRW || 0) + (acc.cashUSD || 0) * exchangeRate
    return {
      name: acc.accountName || acc.name,
      accountId: acc.id,
      accountType: acc.accountType || acc.type,
      value: holdingsValue + cashValue,
      weight: 0,
    }
  }).map((acc, _i, arr) => {
    const total = arr.reduce((sum, a) => sum + a.value, 0)
    return { ...acc, weight: total > 0 ? (acc.value / total) * 100 : 0 }
  })
}

// 일간 변동 (전일 대비)
export const calcDailyChange = (prevValue, currentValue) => ({
  amount: currentValue - prevValue,
  rate: prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0,
})

// 아침대비 손익: (현재가 - 전일종가) × 수량 합산 (실시간)
export const calcMorningComparePnl = (holdings, batchData, exchangeRate = 1300) => {
  if (!batchData) return { amount: 0, rate: 0 }
  let pnl = 0
  let prevTotal = 0
  batchData.forEach(r => {
    if (!r.success || !r.data?.previousClose) return
    const { currentPrice, previousClose } = r.data
    holdings
      .filter(h => h.ticker === r.ticker)
      .forEach(h => {
        const rate = h.currency === 'USD' ? exchangeRate : 1
        pnl += (currentPrice - previousClose) * h.quantity * rate
        prevTotal += previousClose * h.quantity * rate
      })
  })
  return {
    amount: Math.round(pnl),
    rate: prevTotal > 0 ? (pnl / prevTotal) * 100 : 0,
  }
}

// 오늘 실현손익: 당일 매도 entry.pnl 합산
export const calcRealizedTodayPnl = (entries, today) => {
  const todaySells = entries.filter(e => e.action === 'sell' && e.date === today)
  const amount = todaySells.reduce((sum, e) => sum + (e.pnl ?? 0), 0)
  return { amount: Math.round(amount), count: todaySells.length }
}

// ─── 매매 일지 헬퍼 ───

// 기간 코드 → 시작 날짜 문자열 (YYYY-MM-DD)
export const getStartDate = (dateRange) => {
  const now = new Date()
  switch (dateRange) {
    case '1d': {
      return now.toISOString().split('T')[0]
    }
    case '1w': {
      now.setDate(now.getDate() - 7)
      return now.toISOString().split('T')[0]
    }
    case '1m': {
      now.setMonth(now.getMonth() - 1)
      return now.toISOString().split('T')[0]
    }
    case '3m': {
      now.setMonth(now.getMonth() - 3)
      return now.toISOString().split('T')[0]
    }
    case '1y': {
      now.setFullYear(now.getFullYear() - 1)
      return now.toISOString().split('T')[0]
    }
    default:
      return '2000-01-01'
  }
}

// 기간 필터링
export const filterByDateRange = (entries, dateRange) => {
  const start = getStartDate(dateRange)
  const today = new Date().toISOString().split('T')[0]
  return entries.filter(e => e.date >= start && e.date <= today)
}

// 승률 계산 (pnl 기록된 항목 기준)
export const calculateWinRate = (entries) => {
  const pnlEntries = entries.filter(e => e.pnl != null)
  if (pnlEntries.length === 0) return null
  const wins = pnlEntries.filter(e => e.pnl > 0).length
  return Math.round((wins / pnlEntries.length) * 100)
}

// 일지 기반 누적 실현손익 합산 (매도 entry.pnl 합계, USD는 환율 적용)
export const calculateTotalRealizedPnl = (entries, exchangeRate = EXCHANGE_RATE) => {
  return entries
    .filter(e => e.action === 'sell' && e.pnl != null)
    .reduce((sum, e) => {
      const pnl = e.currency === 'USD' ? e.pnl * exchangeRate : e.pnl
      return sum + pnl
    }, 0)
}

// 종합수익률 = (미실현손익 + 실현손익합계 + 배당금) / 투자원금 × 100
export const calculateComprehensiveReturn = (unrealizedPnl, realizedPnl, dividends, totalInvestment) => {
  if (totalInvestment <= 0) return 0
  return ((unrealizedPnl + realizedPnl + dividends) / totalInvestment) * 100
}

// ─── 심리 분석 헬퍼 ───

// 심리 유형별 그룹핑
export const groupByPsychology = (entries) => {
  return entries.reduce((acc, e) => {
    const key = e.psychology || '미분류'
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})
}

// 심리 유형별 평균손익·승률·거래수 통계
export const calcPsychologyStats = (entries) => {
  const groups = groupByPsychology(entries)
  return Object.entries(groups).map(([psychology, items]) => {
    const pnlItems = items.filter(e => e.pnl != null)
    const avgPnl = pnlItems.length > 0
      ? pnlItems.reduce((sum, e) => sum + e.pnl, 0) / pnlItems.length
      : null
    const wins = pnlItems.filter(e => e.pnl > 0).length
    const winRate = pnlItems.length > 0
      ? Math.round((wins / pnlItems.length) * 100)
      : null
    return { psychology, count: items.length, avgPnl, winRate }
  }).sort((a, b) => (b.avgPnl ?? -Infinity) - (a.avgPnl ?? -Infinity))
}

// 반복 실수 패턴: 같은 심리 유형으로 3회 이상 손실
export const findRepeatedMistakes = (entries) => {
  const groups = groupByPsychology(entries)
  return Object.entries(groups)
    .map(([psychology, items]) => {
      const losses = items.filter(e => e.pnl != null && e.pnl < 0)
      return { psychology, lossCount: losses.length }
    })
    .filter(({ lossCount }) => lossCount >= 3)
    .sort((a, b) => b.lossCount - a.lossCount)
}

// 잘된 결정 강화: 수익률 상위 30% 거래의 공통 심리 유형 (최대 3개)
export const findBestPatterns = (entries) => {
  const pnlEntries = entries.filter(e => e.pnl != null)
  if (pnlEntries.length === 0) return []
  const sorted = [...pnlEntries].sort((a, b) => b.pnl - a.pnl)
  const top30 = sorted.slice(0, Math.ceil(sorted.length * 0.3))
  const groups = groupByPsychology(top30)
  return Object.entries(groups)
    .map(([psychology, items]) => ({ psychology, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

// 순 투자원금 계산 — isCapital=true 카테고리 입출금만 합산
// 배당금·이자·조정 항목은 잔고에는 반영되나 수익률 분모에서 제외
// 요일별 평균 손익·건수 — 1=월 ~ 5=금, 0=일/6=토 제외
export const calcDayOfWeekStats = (entries) => {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
  const groups = {}
  entries.forEach((e) => {
    if (!e.date || e.pnl == null) return
    const dow = new Date(e.date).getDay()
    if (dow === 0 || dow === 6) return
    if (!groups[dow]) groups[dow] = []
    groups[dow].push(e.pnl)
  })
  return Object.entries(groups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([dow, pnls]) => ({
      day: DAY_NAMES[dow],
      avgPnl: Math.round(pnls.reduce((s, v) => s + v, 0) / pnls.length),
      count: pnls.length,
    }))
}

// 보유기간 분포 — 매수→매도 쌍으로 보유일 계산
export const calcHoldingPeriodDistribution = (entries) => {
  const sells = entries.filter(e => e.action === 'sell' && e.date && e.buyDate)
  const buckets = { '당일': 0, '2~7일': 0, '8~30일': 0, '30일+': 0 }
  sells.forEach((e) => {
    const diff = Math.round((new Date(e.date) - new Date(e.buyDate)) / 86400000)
    if (diff <= 1) buckets['당일']++
    else if (diff <= 7) buckets['2~7일']++
    else if (diff <= 30) buckets['8~30일']++
    else buckets['30일+']++
  })
  return Object.entries(buckets).map(([range, count]) => ({ range, count }))
}

// 업종별 평균 손익 — tickerSectorMap: { ticker: sectorName }
export const calcSectorStats = (entries, tickerSectorMap = {}) => {
  const groups = {}
  entries.forEach((e) => {
    if (e.pnl == null) return
    const sector = tickerSectorMap[e.ticker] || '기타'
    if (!groups[sector]) groups[sector] = []
    groups[sector].push(e.pnl)
  })
  return Object.entries(groups)
    .map(([sector, pnls]) => ({
      sector,
      avgPnl: Math.round(pnls.reduce((s, v) => s + v, 0) / pnls.length),
      count: pnls.length,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl)
}

// 최대낙폭(MDD) 계산 — 입력: [{ date, value }] 누적 수익률 시계열
export const calculateMDD = (series) => {
  if (!series || series.length < 2) return null
  let peak = series[0].value
  let mdd = 0
  for (const { value } of series) {
    if (value > peak) peak = value
    const drawdown = peak !== 0 ? (value - peak) / Math.abs(peak) : 0
    if (drawdown < mdd) mdd = drawdown
  }
  return Math.round(mdd * 10000) / 100 // % (음수)
}

// 연환산 변동성 계산 — 입력: 일간 수익률 배열 (소수), 출력: 연환산 변동성 %
export const calculateVolatility = (dailyReturns) => {
  if (!dailyReturns || dailyReturns.length < 2) return null
  const n = dailyReturns.length
  const mean = dailyReturns.reduce((s, v) => s + v, 0) / n
  const variance = dailyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  const annualized = Math.sqrt(variance * 252) * 100
  return Math.round(annualized * 100) / 100 // %
}

// ─── 수익성 고도화 인사이트 헬퍼 ───

// 특정 심리 카테고리의 최근 N회 이력 조회
export const getPsychologyHistory = (entries, psychology, action, recentN = 10) => {
  const filtered = entries
    .filter(e => e.psychology === psychology && e.action === action)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, recentN)

  const count = filtered.length
  if (count === 0) return { count: 0, lossCount: 0, lossRate: 0, avgPnl: 0, entries: [] }

  const lossCount = filtered.filter(e => (e.pnl ?? 0) < 0).length
  const avgPnl = Math.round(
    filtered.reduce((sum, e) => sum + (e.pnl ?? 0), 0) / count
  )

  return {
    count,
    lossCount,
    lossRate: Math.round((lossCount / count) * 100),
    avgPnl,
    entries: filtered,
  }
}

// 심리 성숙도 점수 계산 (0~100). 규칙 기반 거래 비율 50% + 전체 승률 50%
export const calcPsychologyMaturityScore = (entries) => {
  if (entries.length < 5) return null

  const ruleBasedList = ['미래가치 투자', '분할매수 원칙', '목표가 실현', '손절 원칙', '리밸런싱']
  const ruleBasedRatio = entries.filter(e => ruleBasedList.includes(e.psychology)).length / entries.length
  const winRate = entries.filter(e => (e.pnl ?? 0) > 0).length / entries.length

  return Math.min(100, Math.max(0, Math.round(ruleBasedRatio * 50 + winRate * 50)))
}

// 종목-심리 2D 매트릭스 데이터 생성. { [ticker]: { [psychology]: { avgPnl, count, winRate } } }
export const buildStockPsychologyMatrix = (entries) => {
  const matrix = {}

  for (const entry of entries) {
    const ticker = entry.ticker || '미분류'
    const psych = entry.psychology
    if (!psych) continue

    if (!matrix[ticker]) matrix[ticker] = {}
    if (!matrix[ticker][psych]) matrix[ticker][psych] = { total: 0, wins: 0, pnlSum: 0 }

    matrix[ticker][psych].total += 1
    matrix[ticker][psych].pnlSum += entry.pnl ?? 0
    if ((entry.pnl ?? 0) > 0) matrix[ticker][psych].wins += 1
  }

  for (const ticker of Object.keys(matrix)) {
    for (const psych of Object.keys(matrix[ticker])) {
      const cell = matrix[ticker][psych]
      cell.avgPnl = Math.round(cell.pnlSum / cell.total)
      cell.winRate = Math.round((cell.wins / cell.total) * 100)
      delete cell.pnlSum
      delete cell.wins
    }
  }

  return matrix
}

export const calculateNetCapital = (cashFlows, accountId = 'all', exchangeRate = EXCHANGE_RATE) => {
  const allCategories = Object.values(CASH_FLOW_CATEGORIES)
  const capitalFlows = cashFlows.filter(f => {
    if (f.isAuto) return false
    if (accountId !== 'all' && f.accountId !== accountId) return false
    const cat = allCategories.find(c => c.code === f.category)
    return cat ? cat.isCapital : true // category 없는 레거시 레코드는 자본으로 처리
  })
  const krw = capitalFlows
    .filter(f => f.currency !== 'USD')
    .reduce((sum, f) => sum + (f.type === 'deposit' ? f.amount : -f.amount), 0)
  const usd = capitalFlows
    .filter(f => f.currency === 'USD')
    .reduce((sum, f) => sum + (f.type === 'deposit' ? f.amount : -f.amount), 0)
  return { krw, usd, total: krw + usd * exchangeRate }
}
