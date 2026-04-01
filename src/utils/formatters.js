// 숫자 포맷팅
export const formatCurrency = (value, currency = 'KRW') => {
  if (currency === 'KRW') {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

// 수익률 포맷팅
export const formatPercent = (value, decimals = 2) => {
  const formatted = value.toFixed(decimals)
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatted}%`
}

// 날짜 포맷팅
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}
