import { EXCHANGE_RATE } from '../data/samplePortfolio'

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
