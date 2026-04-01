// 관심종목은 사용자 레벨 (계좌 무관) — userId 키로 분리
export const sampleWatchlistByUser = {
  'user-001': [
    { ticker: '373220', name: 'LG에너지솔루션', market: 'KRX', currentPrice: 380000, change: -2.5, currency: 'KRW', sector: 'Materials' },
    { ticker: '006400', name: '삼성SDI', market: 'KRX', currentPrice: 420000, change: 1.8, currency: 'KRW', sector: 'Materials' },
    { ticker: 'TSLA', name: 'Tesla Inc.', market: 'NASDAQ', currentPrice: 245.00, change: 3.2, currency: 'USD', sector: 'Consumer' },
  ],
  'user-002': [
    { ticker: 'AMZN', name: 'Amazon.com', market: 'NASDAQ', currentPrice: 185.00, change: -0.5, currency: 'USD', sector: 'Consumer' },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust', market: 'NASDAQ', currentPrice: 440.00, change: 0.8, currency: 'USD', sector: 'ETF' },
  ],
}
