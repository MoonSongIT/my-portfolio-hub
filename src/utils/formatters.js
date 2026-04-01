// 통화 포맷팅
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

// 짧은 날짜 (M/D)
export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 숫자 포맷팅 (천 단위 구분)
export const formatNumber = (value) => {
  return new Intl.NumberFormat('ko-KR').format(value)
}

// 큰 숫자 축약 (억/만 단위)
export const formatLargeNumber = (value) => {
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(1)}억`
  if (Math.abs(value) >= 10000) return `${Math.round(value / 10000).toLocaleString()}만`
  return formatNumber(value)
}

// 큰 숫자 통화 포맷 (₩52.3M 스타일 대신 한국식)
export const formatCurrencyShort = (value, currency = 'KRW') => {
  if (currency === 'KRW') {
    const prefix = '₩'
    if (Math.abs(value) >= 100000000) return `${prefix}${(value / 100000000).toFixed(1)}억`
    if (Math.abs(value) >= 10000) return `${prefix}${Math.round(value / 10000).toLocaleString()}만`
    return formatCurrency(value, currency)
  }
  const prefix = '$'
  if (Math.abs(value) >= 1000000) return `${prefix}${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `${prefix}${(value / 1000).toFixed(1)}K`
  return formatCurrency(value, currency)
}
