// 미국 주요 종목 로컬 DB (NASDAQ / NYSE)
// Research 종목 탐색 및 한글/영문 검색에서 참조됨

export const US_STOCKS = [
  // ── NASDAQ 대형주 (Magnificent 7 외) ──
  { ticker: 'AAPL',  name: 'Apple Inc.',            nameKo: '애플',           market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',        nameKo: '마이크로소프트',  market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',           nameKo: '엔비디아',        market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (A)',      nameKo: '알파벳(구글)',    market: 'NASDAQ', type: 'EQUITY', sector: 'Communication' },
  { ticker: 'GOOG',  name: 'Alphabet Inc. (C)',      nameKo: '알파벳(구글)',    market: 'NASDAQ', type: 'EQUITY', sector: 'Communication' },
  { ticker: 'META',  name: 'Meta Platforms',         nameKo: '메타',            market: 'NASDAQ', type: 'EQUITY', sector: 'Communication' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',        nameKo: '아마존',          market: 'NASDAQ', type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',             nameKo: '테슬라',          market: 'NASDAQ', type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',          nameKo: '브로드컴',        market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'ASML',  name: 'ASML Holding NV',        nameKo: 'ASML',            market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices', nameKo: 'AMD',             market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'INTC',  name: 'Intel Corp.',            nameKo: '인텔',            market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'QCOM',  name: 'Qualcomm Inc.',          nameKo: '퀄컴',            market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'MU',    name: 'Micron Technology',      nameKo: '마이크론',        market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'AMAT',  name: 'Applied Materials',      nameKo: '어플라이드 머티리얼즈', market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'LRCX',  name: 'Lam Research',           nameKo: '램 리서치',       market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'KLAC',  name: 'KLA Corp.',              nameKo: 'KLA',             market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'MRVL',  name: 'Marvell Technology',     nameKo: '마벨 테크놀로지', market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'PANW',  name: 'Palo Alto Networks',     nameKo: '팔로알토 네트웍스', market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'CRWD',  name: 'CrowdStrike Holdings',   nameKo: '크라우드스트라이크', market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'ADBE',  name: 'Adobe Inc.',             nameKo: '어도비',          market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'CRM',   name: 'Salesforce Inc.',        nameKo: '세일즈포스',      market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'NOW',   name: 'ServiceNow Inc.',        nameKo: '서비스나우',      market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'SNOW',  name: 'Snowflake Inc.',         nameKo: '스노우플레이크',  market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'PLTR',  name: 'Palantir Technologies',  nameKo: '팔란티어',        market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'UBER',  name: 'Uber Technologies',      nameKo: '우버',            market: 'NASDAQ', type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'ABNB',  name: 'Airbnb Inc.',            nameKo: '에어비앤비',      market: 'NASDAQ', type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'NFLX',  name: 'Netflix Inc.',           nameKo: '넷플릭스',        market: 'NASDAQ', type: 'EQUITY', sector: 'Communication' },
  { ticker: 'SPOT',  name: 'Spotify Technology',     nameKo: '스포티파이',      market: 'NASDAQ', type: 'EQUITY', sector: 'Communication' },
  { ticker: 'COIN',  name: 'Coinbase Global',        nameKo: '코인베이스',      market: 'NASDAQ', type: 'EQUITY', sector: 'Finance' },
  { ticker: 'HOOD',  name: 'Robinhood Markets',      nameKo: '로빈후드',        market: 'NASDAQ', type: 'EQUITY', sector: 'Finance' },
  { ticker: 'MSTR',  name: 'MicroStrategy Inc.',     nameKo: '마이크로스트래티지', market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'SMCI',  name: 'Super Micro Computer',   nameKo: '슈퍼마이크로',    market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'ARM',   name: 'Arm Holdings',           nameKo: 'ARM 홀딩스',      market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'ORCL',  name: 'Oracle Corp.',           nameKo: '오라클',          market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'CSCO',  name: 'Cisco Systems',          nameKo: '시스코',          market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'PYPL',  name: 'PayPal Holdings',        nameKo: '페이팔',          market: 'NASDAQ', type: 'EQUITY', sector: 'Finance' },
  { ticker: 'INTU',  name: 'Intuit Inc.',            nameKo: '인튜이트',        market: 'NASDAQ', type: 'EQUITY', sector: 'IT' },
  { ticker: 'ISRG',  name: 'Intuitive Surgical',     nameKo: '인튜이티브 서지컬', market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'MRNA',  name: 'Moderna Inc.',           nameKo: '모더나',          market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'BNTX',  name: 'BioNTech SE',           nameKo: '바이오엔텍',      market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'GILD',  name: 'Gilead Sciences',        nameKo: '길리어드 사이언스', market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'REGN',  name: 'Regeneron Pharmaceuticals', nameKo: '리제네론',   market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'BIIB',  name: 'Biogen Inc.',            nameKo: '바이오젠',        market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'VRTX',  name: 'Vertex Pharmaceuticals', nameKo: '버텍스 파마슈티컬즈', market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'DXCM',  name: 'Dexcom Inc.',            nameKo: '덱스컴',          market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'IDXX',  name: 'IDEXX Laboratories',     nameKo: 'IDEXX',           market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'ALGN',  name: 'Align Technology',       nameKo: '얼라인 테크놀로지', market: 'NASDAQ', type: 'EQUITY', sector: 'Healthcare' },

  // ── NYSE 대형주 ──
  { ticker: 'BRK.B', name: 'Berkshire Hathaway B',   nameKo: '버크셔해서웨이',  market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'JPM',   name: 'JPMorgan Chase & Co.',   nameKo: 'JP모건',          market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'BAC',   name: 'Bank of America Corp.',  nameKo: '뱅크오브아메리카', market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'WFC',   name: 'Wells Fargo & Co.',      nameKo: '웰스파고',        market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'GS',    name: 'Goldman Sachs Group',    nameKo: '골드만삭스',      market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'MS',    name: 'Morgan Stanley',         nameKo: '모건스탠리',      market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'C',     name: 'Citigroup Inc.',         nameKo: '씨티그룹',        market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'V',     name: 'Visa Inc.',              nameKo: '비자',            market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'MA',    name: 'Mastercard Inc.',        nameKo: '마스터카드',      market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'AXP',   name: 'American Express Co.',   nameKo: '아메리칸익스프레스', market: 'NYSE', type: 'EQUITY', sector: 'Finance' },
  { ticker: 'BLK',   name: 'BlackRock Inc.',         nameKo: '블랙록',          market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'SCHW',  name: 'Charles Schwab Corp.',   nameKo: '찰스슈왑',        market: 'NYSE',   type: 'EQUITY', sector: 'Finance' },
  { ticker: 'UNH',   name: 'UnitedHealth Group',     nameKo: '유나이티드헬스',  market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',      nameKo: '존슨앤존슨',      market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'LLY',   name: 'Eli Lilly and Co.',      nameKo: '일라이릴리',      market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'PFE',   name: 'Pfizer Inc.',            nameKo: '화이자',          market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'ABT',   name: 'Abbott Laboratories',    nameKo: '애보트',          market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'MRK',   name: 'Merck & Co.',            nameKo: '머크',            market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'ABBV',  name: 'AbbVie Inc.',            nameKo: '애브비',          market: 'NYSE',   type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'BMY',   name: 'Bristol-Myers Squibb',   nameKo: '브리스톨마이어스스퀴브', market: 'NYSE', type: 'EQUITY', sector: 'Healthcare' },
  { ticker: 'XOM',   name: 'Exxon Mobil Corp.',      nameKo: '엑슨모빌',        market: 'NYSE',   type: 'EQUITY', sector: 'Energy' },
  { ticker: 'CVX',   name: 'Chevron Corp.',          nameKo: '셰브런',          market: 'NYSE',   type: 'EQUITY', sector: 'Energy' },
  { ticker: 'COP',   name: 'ConocoPhillips',         nameKo: '코노코필립스',    market: 'NYSE',   type: 'EQUITY', sector: 'Energy' },
  { ticker: 'SLB',   name: 'Schlumberger NV',        nameKo: '슐럼버거',        market: 'NYSE',   type: 'EQUITY', sector: 'Energy' },
  { ticker: 'PG',    name: 'Procter & Gamble',       nameKo: 'P&G',             market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'KO',    name: 'Coca-Cola Co.',          nameKo: '코카콜라',        market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'PEP',   name: 'PepsiCo Inc.',           nameKo: '펩시코',          market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'WMT',   name: 'Walmart Inc.',           nameKo: '월마트',          market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'COST',  name: 'Costco Wholesale',       nameKo: '코스트코',        market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'HD',    name: 'Home Depot Inc.',        nameKo: '홈디포',          market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'MCD',   name: "McDonald's Corp.",       nameKo: '맥도날드',        market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'NKE',   name: 'Nike Inc.',              nameKo: '나이키',          market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'SBUX',  name: 'Starbucks Corp.',        nameKo: '스타벅스',        market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'DIS',   name: 'Walt Disney Co.',        nameKo: '디즈니',          market: 'NYSE',   type: 'EQUITY', sector: 'Communication' },
  { ticker: 'T',     name: 'AT&T Inc.',              nameKo: 'AT&T',            market: 'NYSE',   type: 'EQUITY', sector: 'Communication' },
  { ticker: 'VZ',    name: 'Verizon Communications', nameKo: '버라이즌',        market: 'NYSE',   type: 'EQUITY', sector: 'Communication' },
  { ticker: 'PM',    name: 'Philip Morris Int.',     nameKo: '필립모리스',      market: 'NYSE',   type: 'EQUITY', sector: 'Consumer' },
  { ticker: 'NEE',   name: 'NextEra Energy',         nameKo: '넥스트에라 에너지', market: 'NYSE',  type: 'EQUITY', sector: 'Energy' },
  { ticker: 'CAT',   name: 'Caterpillar Inc.',       nameKo: '캐터필러',        market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'BA',    name: 'Boeing Co.',             nameKo: '보잉',            market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'GE',    name: 'GE Vernova Inc.',        nameKo: 'GE 버노바',       market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'RTX',   name: 'RTX Corp.',              nameKo: 'RTX(레이시온)',    market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'LMT',   name: 'Lockheed Martin',        nameKo: '록히드마틴',      market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'NOC',   name: 'Northrop Grumman',       nameKo: '노스럽그루먼',    market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'DE',    name: 'Deere & Company',        nameKo: '디어앤컴퍼니(존디어)', market: 'NYSE', type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'UPS',   name: 'United Parcel Service',  nameKo: 'UPS',             market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'FDX',   name: 'FedEx Corp.',            nameKo: '페덱스',          market: 'NYSE',   type: 'EQUITY', sector: 'Industrial' },
  { ticker: 'FCX',   name: 'Freeport-McMoRan Inc.',  nameKo: '프리포트-맥모란', market: 'NYSE',   type: 'EQUITY', sector: 'Materials' },
  { ticker: 'NEM',   name: 'Newmont Corp.',          nameKo: '뉴몬트',          market: 'NYSE',   type: 'EQUITY', sector: 'Materials' },

  // ── 나스닥 ETF ──
  { ticker: 'QQQ',   name: 'Invesco QQQ Trust',              nameKo: '나스닥100 ETF(QQQ)', market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'TQQQ',  name: 'ProShares UltraPro QQQ',         nameKo: '나스닥100 3배 레버리지', market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'SQQQ',  name: 'ProShares UltraPro Short QQQ',   nameKo: '나스닥100 3배 인버스', market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'QQQM',  name: 'Invesco NASDAQ 100 ETF',         nameKo: '나스닥100 ETF(QQQM)', market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'XLK',   name: 'Technology Select Sector SPDR',  nameKo: '기술 섹터 ETF',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'ARKK',  name: 'ARK Innovation ETF',             nameKo: '아크 이노베이션 ETF', market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'ARKW',  name: 'ARK Next Generation Internet',   nameKo: '아크 인터넷 ETF',     market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'ARKG',  name: 'ARK Genomic Revolution ETF',     nameKo: '아크 유전체 ETF',     market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SOXL',  name: 'Direxion Daily Semicon Bull 3X', nameKo: '반도체 3배 레버리지 ETF', market: 'NYSE', type: 'ETF', sector: 'ETF' },
  { ticker: 'SOXS',  name: 'Direxion Daily Semicon Bear 3X', nameKo: '반도체 3배 인버스 ETF', market: 'NYSE', type: 'ETF', sector: 'ETF' },
  { ticker: 'SMH',   name: 'VanEck Semiconductor ETF',       nameKo: '반도체 ETF(SMH)',      market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'SOXX',  name: 'iShares Semiconductor ETF',      nameKo: '반도체 ETF(SOXX)',     market: 'NASDAQ', type: 'ETF', sector: 'ETF' },

  // ── NYSE 지수 추종 ETF ──
  { ticker: 'SPY',   name: 'SPDR S&P 500 ETF Trust',         nameKo: 'S&P500 ETF(SPY)',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VOO',   name: 'Vanguard S&P 500 ETF',           nameKo: 'S&P500 ETF(VOO)',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'IVV',   name: 'iShares Core S&P 500 ETF',       nameKo: 'S&P500 ETF(IVV)',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VTI',   name: 'Vanguard Total Stock Market ETF', nameKo: '미국 전체시장 ETF',   market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SPXL',  name: 'Direxion Daily S&P500 Bull 3X',  nameKo: 'S&P500 3배 레버리지',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SPXS',  name: 'Direxion Daily S&P500 Bear 3X',  nameKo: 'S&P500 3배 인버스',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SSO',   name: 'ProShares Ultra S&P500',          nameKo: 'S&P500 2배 레버리지',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SDS',   name: 'ProShares UltraShort S&P500',     nameKo: 'S&P500 2배 인버스',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'IWM',   name: 'iShares Russell 2000 ETF',        nameKo: '러셀2000 ETF',         market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'DIA',   name: 'SPDR Dow Jones Industrial ETF',   nameKo: '다우존스 ETF(DIA)',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },

  // ── 섹터 ETF ──
  { ticker: 'XLF',   name: 'Financial Select Sector SPDR',   nameKo: '금융 섹터 ETF',        market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLV',   name: 'Health Care Select Sector SPDR', nameKo: '헬스케어 섹터 ETF',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLE',   name: 'Energy Select Sector SPDR',      nameKo: '에너지 섹터 ETF',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLI',   name: 'Industrial Select Sector SPDR',  nameKo: '산업 섹터 ETF',        market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLY',   name: 'Consumer Discret. Sector SPDR',  nameKo: '임의소비재 섹터 ETF',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLP',   name: 'Consumer Staples Sector SPDR',   nameKo: '필수소비재 섹터 ETF',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLB',   name: 'Materials Select Sector SPDR',   nameKo: '소재 섹터 ETF',        market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLU',   name: 'Utilities Select Sector SPDR',   nameKo: '유틸리티 섹터 ETF',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'XLRE',  name: 'Real Estate Select Sector SPDR', nameKo: '부동산 섹터 ETF',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },

  // ── 채권 ETF ──
  { ticker: 'TLT',   name: 'iShares 20+ Year Treasury ETF',  nameKo: '미국 장기국채 ETF',    market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'IEF',   name: 'iShares 7-10 Year Treasury ETF', nameKo: '미국 중기국채 ETF',    market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'SHY',   name: 'iShares 1-3 Year Treasury ETF',  nameKo: '미국 단기국채 ETF',    market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'AGG',   name: 'iShares Core US Aggregate Bond', nameKo: '미국 종합채권 ETF',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'BND',   name: 'Vanguard Total Bond Market ETF', nameKo: '뱅가드 채권 ETF',      market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'HYG',   name: 'iShares High Yield Corporate',   nameKo: '하이일드채권 ETF',     market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'LQD',   name: 'iShares Investment Grade Corp.', nameKo: '투자등급 회사채 ETF',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'TMF',   name: 'Direxion Daily 20+ Yr Bull 3X',  nameKo: '장기국채 3배 레버리지', market: 'NYSE',  type: 'ETF', sector: 'ETF' },
  { ticker: 'TMV',   name: 'Direxion Daily 20+ Yr Bear 3X',  nameKo: '장기국채 3배 인버스',   market: 'NYSE',  type: 'ETF', sector: 'ETF' },

  // ── 원자재 ETF ──
  { ticker: 'GLD',   name: 'SPDR Gold Shares',               nameKo: '금 ETF(GLD)',          market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'IAU',   name: 'iShares Gold Trust',             nameKo: '금 ETF(IAU)',          market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'SLV',   name: 'iShares Silver Trust',           nameKo: '은 ETF(SLV)',          market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'USO',   name: 'United States Oil Fund',         nameKo: '원유 ETF(USO)',        market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'BOIL',  name: 'ProShares Ultra Bloomberg NG',   nameKo: '천연가스 2배 레버리지', market: 'NYSE',  type: 'ETF', sector: 'ETF' },

  // ── 변동성·인버스 ──
  { ticker: 'UVXY',  name: 'ProShares Ultra VIX Short-Term', nameKo: 'VIX 2배 ETF',         market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'VXX',   name: 'iPath Series B S&P 500 VIX',    nameKo: 'VIX 선물 ETN',        market: 'CBOE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VIXY',  name: 'ProShares VIX Short-Term',       nameKo: 'VIX ETF(VIXY)',       market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'SH',    name: 'ProShares Short S&P500',         nameKo: 'S&P500 인버스 ETF',   market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'PSQ',   name: 'ProShares Short QQQ',            nameKo: '나스닥100 인버스 ETF', market: 'NYSE',  type: 'ETF', sector: 'ETF' },

  // ── 배당 ETF ──
  { ticker: 'SCHD',  name: 'Schwab US Dividend Equity ETF',  nameKo: '미국 배당 ETF(SCHD)', market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VIG',   name: 'Vanguard Dividend Appreciation', nameKo: '배당성장 ETF(VIG)',    market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'DVY',   name: 'iShares Select Dividend ETF',    nameKo: '고배당 ETF(DVY)',      market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'VYM',   name: 'Vanguard High Dividend Yield',   nameKo: '고배당 ETF(VYM)',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'JEPI',  name: 'JPMorgan Equity Premium Income', nameKo: '커버드콜 ETF(JEPI)',   market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'JEPQ',  name: 'JPMorgan Nasdaq Equity Prem.',   nameKo: '커버드콜 ETF(JEPQ)',   market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'XYLD',  name: 'Global X S&P 500 Covered Call',  nameKo: 'S&P500 커버드콜 ETF', market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'QYLD',  name: 'Global X NASDAQ 100 Covered Call', nameKo: '나스닥 커버드콜 ETF', market: 'NASDAQ', type: 'ETF', sector: 'ETF' },

  // ── 글로벌 ETF ──
  { ticker: 'EWY',   name: 'iShares MSCI South Korea ETF',   nameKo: '한국 MSCI ETF',       market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'MCHI',  name: 'iShares MSCI China ETF',         nameKo: '중국 MSCI ETF',       market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'FXI',   name: 'iShares China Large-Cap ETF',    nameKo: '중국 대형주 ETF',     market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'EWJ',   name: 'iShares MSCI Japan ETF',         nameKo: '일본 MSCI ETF',       market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VEA',   name: 'Vanguard Developed Markets ETF', nameKo: '선진국시장 ETF',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'VWO',   name: 'Vanguard Emerging Markets ETF',  nameKo: '신흥시장 ETF',        market: 'NYSE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'EEM',   name: 'iShares MSCI Emerging Markets',  nameKo: '이머징마켓 ETF',      market: 'NYSE',   type: 'ETF', sector: 'ETF' },

  // ── 비트코인/암호화폐 ETF ──
  { ticker: 'IBIT',  name: 'iShares Bitcoin Trust',          nameKo: '비트코인 ETF(IBIT)',  market: 'NASDAQ', type: 'ETF', sector: 'ETF' },
  { ticker: 'FBTC',  name: 'Fidelity Wise Origin Bitcoin',   nameKo: '비트코인 ETF(FBTC)',  market: 'CBOE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'GBTC',  name: 'Grayscale Bitcoin Trust',        nameKo: '비트코인 ETF(GBTC)',  market: 'CBOE',   type: 'ETF', sector: 'ETF' },
  { ticker: 'BITB',  name: 'Bitwise Bitcoin ETF',            nameKo: '비트코인 ETF(BITB)',  market: 'NYSE',   type: 'ETF', sector: 'ETF' },
]

// 한글명 포함 검색
export const searchUsStocks = (query, limit = 15) => {
  if (!query || query.length < 1) return []
  const q = query.trim().toLowerCase()
  const isKo = /[가-힣]/.test(q)

  return US_STOCKS.filter(stock => {
    if (isKo) {
      return stock.nameKo?.includes(query.trim())
    }
    return (
      stock.name.toLowerCase().includes(q) ||
      stock.nameKo?.toLowerCase().includes(q) ||
      stock.ticker.toLowerCase().startsWith(q)
    )
  }).slice(0, limit)
}
