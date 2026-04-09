// 계좌 유형 정의
export const ACCOUNT_TYPES = [
  { code: 'GENERAL', name: '일반(위탁)', description: '일반 주식 매매 계좌' },
  { code: 'IRP', name: 'IRP', description: '개인형 퇴직연금' },
  { code: 'ISA', name: 'ISA', description: '개인종합자산관리' },
  { code: 'PENSION', name: '연금저축', description: '연금저축펀드/ETF' },
]

// 사용자별 계좌 + 보유 종목 (사용자 → 계좌 → 종목)
export const sampleAccounts = []

// 고정 환율 샘플 (1 USD = 1,350 KRW)
export const EXCHANGE_RATE = 1350

// 섹터 목록
export const SECTORS = ['IT', 'Communication', 'Consumer', 'Materials', 'Finance', 'Healthcare', 'Energy', 'ETF']

// 시장 목록
export const MARKETS = ['KRX', 'NYSE', 'NASDAQ']
