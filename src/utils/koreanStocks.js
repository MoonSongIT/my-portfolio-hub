// 주요 한국 종목 로컬 DB (한글 검색 지원용)
// Yahoo Finance는 한글 쿼리를 지원하지 않아 로컬 룩업으로 대체
export const KOREAN_STOCKS = [
  // KOSPI 대형주
  { ticker: '005930.KS', name: '삼성전자', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '000660.KS', name: 'SK하이닉스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '005380.KS', name: '현대차', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '035420.KS', name: 'NAVER', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '005490.KS', name: 'POSCO홀딩스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '051910.KS', name: 'LG화학', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '006400.KS', name: '삼성SDI', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '035720.KS', name: '카카오', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '068270.KS', name: '셀트리온', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '207940.KS', name: '삼성바이오로직스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '012330.KS', name: '현대모비스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '028260.KS', name: '삼성물산', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '105560.KS', name: 'KB금융', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '055550.KS', name: '신한지주', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '086790.KS', name: '하나금융지주', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '032830.KS', name: '삼성생명', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '066570.KS', name: 'LG전자', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '003550.KS', name: 'LG', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '017670.KS', name: 'SK텔레콤', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '030200.KS', name: 'KT', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '096770.KS', name: 'SK이노베이션', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '003490.KS', name: '대한항공', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '010950.KS', name: 'S-Oil', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '015760.KS', name: '한국전력', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '000810.KS', name: '삼성화재', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '011170.KS', name: '롯데케미칼', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '009150.KS', name: '삼성전기', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '034730.KS', name: 'SK', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '000270.KS', name: '기아', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '316140.KS', name: '우리금융지주', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '018260.KS', name: '삼성에스디에스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '009540.KS', name: '한국조선해양', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '042660.KS', name: '한화오션', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '329180.KS', name: 'HD현대중공업', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '000100.KS', name: '유한양행', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '128940.KS', name: '한미약품', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '373220.KS', name: 'LG에너지솔루션', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '247540.KS', name: '에코프로비엠', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '086280.KS', name: '현대글로비스', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  { ticker: '010130.KS', name: '고려아연', exchange: 'KSC', market: 'KRX', type: 'EQUITY' },
  // KOSDAQ 주요 종목
  { ticker: '263750.KQ', name: '펄어비스', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '293490.KQ', name: '카카오게임즈', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '323410.KQ', name: '카카오뱅크', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '259960.KQ', name: '크래프톤', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '112040.KQ', name: 'Withnews', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '041510.KQ', name: 'SM엔터테인먼트', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '035900.KQ', name: 'JYP엔터테인먼트', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '352820.KQ', name: '하이브', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '091990.KQ', name: '셀트리온헬스케어', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '145020.KQ', name: '휴젤', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '086900.KQ', name: '메디톡스', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '039030.KQ', name: '이오테크닉스', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '357780.KQ', name: '솔브레인', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '196170.KQ', name: '알테오젠', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
  { ticker: '214150.KQ', name: '클래시스', exchange: 'KOE', market: 'KRX', type: 'EQUITY' },
]

// 한글 포함 여부 확인
export const isKorean = (str) => /[가-힣]/.test(str)

// 한글 종목명 검색 (초성 검색 미지원, 단순 포함 검색)
export const searchKoreanStocks = (query) => {
  if (!query) return []
  const q = query.trim().toLowerCase()
  return KOREAN_STOCKS.filter(stock =>
    stock.name.toLowerCase().includes(q) ||
    stock.ticker.replace('.KS', '').replace('.KQ', '').includes(q)
  ).slice(0, 10)
}
