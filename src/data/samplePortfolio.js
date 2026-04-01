// 계좌 유형 정의
export const ACCOUNT_TYPES = [
  { code: 'GENERAL', name: '일반(위탁)', description: '일반 주식 매매 계좌' },
  { code: 'IRP', name: 'IRP', description: '개인형 퇴직연금' },
  { code: 'ISA', name: 'ISA', description: '개인종합자산관리' },
  { code: 'PENSION', name: '연금저축', description: '연금저축펀드/ETF' },
]

// 사용자별 계좌 + 보유 종목 (사용자 → 계좌 → 종목)
export const sampleAccounts = [
  // ─── 홍길동(user-001) ───
  {
    id: 'acc-001',
    userId: 'user-001',
    accountType: 'GENERAL',
    accountName: '한투 일반계좌',
    broker: '한국투자증권',
    cashKRW: 3000000,
    cashUSD: 2000,
    holdings: [
      { ticker: '005930', name: '삼성전자', market: 'KRX', quantity: 100, avgPrice: 68500, currentPrice: 72000, sector: 'IT', currency: 'KRW' },
      { ticker: '000660', name: 'SK하이닉스', market: 'KRX', quantity: 50, avgPrice: 128000, currentPrice: 145000, sector: 'IT', currency: 'KRW' },
      { ticker: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ', quantity: 20, avgPrice: 165.00, currentPrice: 178.50, sector: 'IT', currency: 'USD' },
      { ticker: 'NVDA', name: 'NVIDIA Corp.', market: 'NASDAQ', quantity: 10, avgPrice: 450.00, currentPrice: 520.00, sector: 'IT', currency: 'USD' },
      { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'NYSE', quantity: 15, avgPrice: 410.00, currentPrice: 435.00, sector: 'ETF', currency: 'USD' },
    ],
  },
  {
    id: 'acc-002',
    userId: 'user-001',
    accountType: 'IRP',
    accountName: '한투 IRP',
    broker: '한국투자증권',
    cashKRW: 1000000,
    cashUSD: 0,
    holdings: [
      { ticker: '069500', name: 'KODEX 200', market: 'KRX', quantity: 200, avgPrice: 35000, currentPrice: 36500, sector: 'ETF', currency: 'KRW' },
      { ticker: '132030', name: 'KODEX 골드선물(H)', market: 'KRX', quantity: 100, avgPrice: 14500, currentPrice: 15200, sector: 'ETF', currency: 'KRW' },
    ],
  },
  {
    id: 'acc-003',
    userId: 'user-001',
    accountType: 'ISA',
    accountName: '삼성 ISA',
    broker: '삼성증권',
    cashKRW: 2000000,
    cashUSD: 0,
    holdings: [
      { ticker: '035420', name: 'NAVER', market: 'KRX', quantity: 30, avgPrice: 215000, currentPrice: 198000, sector: 'Communication', currency: 'KRW' },
      { ticker: '005380', name: '현대차', market: 'KRX', quantity: 20, avgPrice: 185000, currentPrice: 210000, sector: 'Consumer', currency: 'KRW' },
      { ticker: '051910', name: 'LG화학', market: 'KRX', quantity: 10, avgPrice: 520000, currentPrice: 480000, sector: 'Materials', currency: 'KRW' },
    ],
  },
  // ─── 김투자(user-002) ───
  {
    id: 'acc-004',
    userId: 'user-002',
    accountType: 'GENERAL',
    accountName: '키움 일반계좌',
    broker: '키움증권',
    cashKRW: 5000000,
    cashUSD: 1000,
    holdings: [
      { ticker: 'MSFT', name: 'Microsoft Corp.', market: 'NASDAQ', quantity: 15, avgPrice: 340.00, currentPrice: 375.00, sector: 'IT', currency: 'USD' },
      { ticker: 'SCHD', name: 'Schwab US Dividend ETF', market: 'NYSE', quantity: 25, avgPrice: 72.00, currentPrice: 76.50, sector: 'ETF', currency: 'USD' },
    ],
  },
  {
    id: 'acc-005',
    userId: 'user-002',
    accountType: 'PENSION',
    accountName: '미래 연금저축',
    broker: '미래에셋증권',
    cashKRW: 500000,
    cashUSD: 0,
    holdings: [
      { ticker: '360750', name: 'TIGER 미국S&P500', market: 'KRX', quantity: 150, avgPrice: 16000, currentPrice: 17200, sector: 'ETF', currency: 'KRW' },
    ],
  },
]

// 고정 환율 샘플 (1 USD = 1,350 KRW)
export const EXCHANGE_RATE = 1350

// 섹터 목록
export const SECTORS = ['IT', 'Communication', 'Consumer', 'Materials', 'Finance', 'Healthcare', 'Energy', 'ETF']

// 시장 목록
export const MARKETS = ['KRX', 'NYSE', 'NASDAQ']
