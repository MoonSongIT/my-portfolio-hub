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
    const holdingsValue = acc.holdings.reduce((sum, h) => {
      const value = h.quantity * h.currentPrice
      return sum + (h.currency === 'USD' ? value * exchangeRate : value)
    }, 0)
    const cashValue = (acc.cashKRW || 0) + (acc.cashUSD || 0) * exchangeRate
    return {
      name: acc.accountName,
      accountId: acc.id,
      accountType: acc.accountType,
      value: holdingsValue + cashValue,
      weight: 0, // 아래에서 계산
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
