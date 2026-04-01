// 수익률 계산
export const calculateReturn = (buyPrice, currentPrice) => {
  return ((currentPrice - buyPrice) / buyPrice) * 100
}

// 포트폴리오 총 평가액
export const calculateTotalValue = (holdings, cash) => {
  const stockValue = holdings.reduce((sum, h) => sum + (h.quantity * h.current_price), 0)
  return stockValue + cash
}

// 포트폴리오 수익률
export const calculatePortfolioReturn = (holdings, initialInvestment) => {
  const currentValue = holdings.reduce((sum, h) => sum + (h.quantity * h.current_price), 0)
  return ((currentValue - initialInvestment) / initialInvestment) * 100
}
