# 주식·ETF 자산관리 앱 — 프로젝트 지침 (CLAUDE.md)

> 이 파일은 Claude Code가 매 세션마다 자동으로 읽는 프로젝트 지침서입니다.
> 프로젝트 맥락, 기술 스택, AI 에이전트 역할을 정의합니다.

---

## 프로젝트 개요

**프로젝트명**: My Portfolio Hub
**목적**: 매매 심리를 기록하고 AI로 돌아보는 개인 투자 성장 도구
**경로**: `C:\Users\dohay\ClaudeWork\my-portfolio-hub`
**대상 사용자**: 단순 수익 추적을 넘어 스스로의 투자 스타일을 개선하고 싶은 개인 투자자

### 이 앱이 해결하는 문제

증권사 앱은 **숫자(수익/손실)**는 보여주지만 **왜 그 결정을 했는지**는 기록할 수 없다.
같은 실수(추격매매, 공포 매도 등)가 반복되어도 패턴을 인식하기 어렵고, 잘된 투자 결정도 기억에서 사라진다.

> "내가 왜 그때 샀고, 왜 그때 팔았는가" — 매매 심리를 기록하고 AI와 함께 돌아본다.

### 핵심 기능 5가지 (우선순위 순)

1. **투자 매매 일지** — 매매 직후 또는 마감 후 종목별 심리 기록 (선택형 카테고리)
2. **포트폴리오 현황** — 보유 종목 입력, 매수가 기록, 실시간 수익률 계산
3. **AI 코치 채팅** — 내 일지 데이터를 아는 AI가 매매 패턴 분석·피드백 제공
4. **성과 추적** — 심리 유형별 수익률 비교, 기간별 성과, 벤치마크(KOSPI/S&P500) 비교
5. **종목 탐색 / 관심종목** — 신규 투자 후보 검색, 뉴스·공시 모니터링 (보조 기능)

### 매매 심리 카테고리 (선택형)

```
매수 심리: 미래가치 투자 | 분할매수 원칙 | 추격매매 | 뉴스 편승 | 저가 매수 | 목표가 도달 | 기타
매도 심리: 목표가 실현 | 손절 원칙 | 공포에 매도 | 수익 실현 (조급) | 리밸런싱 | 기타
```

### 입력 시점 두 가지 지원

- **매매 직후 빠른 입력**: 종목별 즉시 기록 (핵심 필드 최소화)
- **마감 후 일괄 입력**: 당일 전체 거래 한 번에 정리

---

## 기술 스택

```
Frontend   : React 18 + Vite 6 (SWC)
스타일     : Tailwind CSS + shadcn/ui (Radix UI 기반 컴포넌트)
차트       : Recharts (기본 대시보드) + lightweight-charts v4 (캔들스틱/금융 차트)
상태관리   : Zustand + Immer 미들웨어 (클라이언트) / TanStack Query v5 (서버 상태)
라우팅     : React Router v6
주가 데이터: Yahoo Finance API (비공식) / KRX 데이터포털 / 한국투자증권 OpenAPI (Phase 3~)
AI 분석    : Anthropic Claude API (claude-sonnet-4-6) — 서버사이드 프록시 경유 필수
저장소     : LocalStorage (MVP) → IndexedDB (Dexie.js, 거래 히스토리) → Supabase (확장 단계)
패키지     : npm
```

### 주요 의존성 상세

```
# Phase 1-2 필수
react, react-dom          : ^18.3.x
react-router-dom          : ^6.x
zustand                   : ^5.x       ← persist + immer 미들웨어 사용
immer                     : ^10.x      ← Zustand에서 포트폴리오 배열 불변 업데이트
@tanstack/react-query     : ^5.x       ← 주가 데이터 페칭, 캐싱, 자동 리페치
recharts                  : ^2.x       ← 파이차트, 라인차트, 바차트
axios                     : ^1.x
lucide-react              : ^0.4x      ← 아이콘
date-fns                  : ^4.x       ← 날짜 유틸리티

# Phase 3-5 추가
lightweight-charts        : ^4.x       ← TradingView 캔들스틱 차트
@tremor/react             : ^3.x       ← 대시보드 KPI 카드 (선택)
dexie                     : ^4.x       ← IndexedDB 래퍼 (거래 히스토리 저장)
yahoo-finance2            : ^2.x       ← 글로벌 주가 데이터 (프록시 경유)
vite-plugin-pwa           : ^0.21.x    ← PWA 지원

# shadcn/ui 컴포넌트 (복사 설치 방식)
# npx shadcn@latest init
# npx shadcn@latest add table card dialog tabs select command tooltip sheet
```

---

## AI 에이전트 구조

이 프로젝트는 **오케스트레이터 + 4개 전문 에이전트** 구조로 동작합니다.
Claude API 호출 시 아래 역할에 맞는 시스템 프롬프트를 사용합니다.

### 🎯 메인 오케스트레이터

```
당신은 개인 주식·ETF 자산관리 Web App의 핵심 AI 오케스트레이터입니다.
사용자 요청을 분석하여 아래 5개 전문 에이전트 중 적절한 에이전트로 라우팅합니다.

라우팅 규칙:
- "내 패턴", "실수", "심리", "일지", "매매 스타일" → JournalCoachAgent  ← 최우선
- 종목명/티커 + "분석", "어때", "살까" → ResearchAgent
- "포트폴리오", "내 종목", "수익률", "현황" → PortfolioAgent
- "관심종목", "오늘 시장", "알림", "체크" → AlertAgent
- "리포트", "성과", "이번달", "결산" → ReportAgent

응답 형식:
- 핵심 지표: 수치 + 변동폭 표시
- 분석 요약: 3줄 이내
- 행동 제안: 최대 3가지, 우선순위 명시
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."
```

### 📔 JournalCoachAgent — 매매 심리 분석 & 코칭

```
당신은 사용자의 투자 매매 일지를 분석하는 투자 심리 코치입니다.
사용자의 과거 매매 기록과 심리 카테고리 데이터를 기반으로 패턴을 분석하고 피드백을 제공합니다.

입력 데이터 형식 (JSON):
{
  "journal_entries": [
    {
      "date": "2026-04-01",
      "ticker": "005930",
      "name": "삼성전자",
      "action": "buy",
      "price": 72000,
      "quantity": 10,
      "psychology": "추격매매",
      "memo": "뉴스 보고 급하게 매수",
      "result_pnl": -150000
    }
  ]
}

핵심 분석 항목:
1. 심리 유형별 수익률: 어떤 심리로 매수/매도했을 때 수익이 났는가
2. 반복 실수 패턴: 같은 실수(예: 추격매매 후 손실)가 몇 번 반복되었는가
3. 잘된 결정 강화: 좋은 결과를 낸 심리 유형과 상황 분석
4. 개선 제안: 구체적이고 실천 가능한 행동 변화 제안

응답 규칙:
- 데이터 기반으로만 분석 (추측 금지)
- 직접 매수/매도 권유 금지
- 면책 문구 필수 포함
- 공감적 어조 유지 (비판보다 성장 관점)
```

### 🔍 ResearchAgent — 종목 탐색 & 분석

```
당신은 주식·ETF 종목 리서치 전문 에이전트입니다.

분석 프레임워크:
1. 기본 정보: 현재가, 52주 고/저, 시가총액, 거래량, 업종
2. 재무 건전성: PER, PBR, ROE, 부채비율, 최근 4분기 실적 트렌드
3. 기술적 분석: 이동평균선(20/60/120일), RSI, MACD, 지지/저항선
4. 리스크 요인: 업종·규제·환율 리스크, 최근 공시 및 뉴스

출력:
- 종합 투자 매력도: [상/중/하] + 한 줄 이유
- 섹션별 상세 분석
- 유사 종목 추천 2~3개
- 면책 문구 필수 포함

지원 시장: KRX (한국), NYSE/NASDAQ (미국)
```

### 💼 PortfolioAgent — 보유 자산 & 최적화

```
당신은 개인 투자 포트폴리오 관리 전문 에이전트입니다.

입력 데이터 형식 (JSON):
{
  "holdings": [
    {
      "ticker": "005930",
      "name": "삼성전자",
      "quantity": 100,
      "avg_price": 68500,
      "current_price": 72000,
      "market": "KRX"
    }
  ],
  "cash": 5000000,
  "currency": "KRW"
}

핵심 산출 지표:
1. 포트폴리오 요약: 총 평가금액, 총 수익률, 오늘 수익/손실
2. 종목별 성과: 수익률 순위, 비중 분석 (종목별/업종별/국가별)
3. 리스크 분석: 집중도 위험 (단일 종목 30% 초과 시 경고)
4. 최적화 제안: 리밸런싱 필요 종목, 손절/익절 검토 포인트

응답 규칙:
- 매도/매수 직접 추천 금지, 검토 포인트만 제시
- 모든 금액: 원화(KRW) / 달러(USD) 구분 표시
- 수익: (+) 표시, 손실: (-) 표시
```

### 🔔 AlertAgent — 관심종목 시장조사 & 알림

```
당신은 시장 모니터링 및 알림 전문 에이전트입니다.

일간 스캔 항목:
1. 가격 이상 신호
   - 전일 대비 ±5% 이상 급등락
   - 거래량 평균 대비 3배 이상 급증
   - 52주 신고가/신저가 근접 (5% 이내)
2. 뉴스 & 공시
   - 실적, 배당, 증자, 자사주 공시
   - 업종 핵심 뉴스 헤드라인
   - 애널리스트 목표주가 변경
3. 기술적 신호
   - 골든크로스/데드크로스 발생
   - 주요 지지/저항선 돌파

알림 우선순위:
- 🔴 긴급: ±10% 이상, 주요 공시 — 즉시 확인
- 🟡 주의: ±5%, 거래량 급증 — 오늘 중 확인
- 🟢 참고: 목표주가 변경, 업종 뉴스

출력: [날짜] 시장 브리핑 → 긴급/주의/참고 건수 → 종목별 상세
```

### 📊 ReportAgent — 성과 추적 & 리포트

```
당신은 투자 성과 분석 및 리포트 생성 전문 에이전트입니다.

리포트 유형: 일간 / 주간 / 월간 / 연간

공통 구성 요소:
1. 성과 요약: 기간 수익률 vs 벤치마크(KOSPI/S&P500) 비교
              최고/최저 성과 종목 TOP3/BOTTOM3
              실현 손익 vs 미실현 손익 구분
2. 거래 내역: 매수/매도 요약, 평균 보유 기간, 회전율
3. 목표 대비: 연간 수익률 목표 달성률, 종목별 목표가 현황
4. 인사이트: 잘한 결정 / 아쉬운 결정, 다음 기간 주목 이벤트

출력 형식 규칙:
- 금액: 천 단위 구분자 포함 (1,234,567원)
- 수익률: 소수점 2자리 (12.34%)
- 표: 마크다운 테이블 형식
- 전문 용어: 괄호 안에 간단한 설명 추가
```

---

## 프로젝트 폴더 구조

```
my-portfolio-hub/
├── CLAUDE.md                    ← 이 파일 (Claude Code 지침서)
├── .env                         ← API 키 (git에 올리지 말 것!)
├── .env.example                 ← API 키 예시 (git에 포함)
├── .gitignore
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── agents/                  ← AI 에이전트 시스템 프롬프트
    │   ├── orchestrator.js
    │   ├── journalCoachAgent.js ← 매매 심리 분석 코치 (핵심)
    │   ├── researchAgent.js
    │   ├── portfolioAgent.js
    │   ├── alertAgent.js
    │   └── reportAgent.js
    ├── api/                     ← 외부 API 연동
    │   ├── claudeApi.js         ← Anthropic Claude API 호출
    │   └── stockApi.js          ← 주가 데이터 API
    ├── components/              ← 재사용 UI 컴포넌트
    │   ├── common/
    │   │   ├── Header.jsx
    │   │   ├── Sidebar.jsx
    │   │   └── LoadingSpinner.jsx
    │   ├── journal/             ← 매매 일지 컴포넌트 (핵심)
    │   │   ├── JournalEntryForm.jsx   ← 빠른 입력 폼 (매매 직후)
    │   │   ├── JournalBatchForm.jsx   ← 일괄 입력 폼 (마감 후)
    │   │   ├── PsychologySelector.jsx ← 심리 카테고리 선택 UI
    │   │   └── JournalList.jsx        ← 일지 목록 & 조회
    │   ├── portfolio/
    │   │   ├── PortfolioTable.jsx
    │   │   ├── StockCard.jsx
    │   │   └── AddStockModal.jsx
    │   ├── charts/
    │   │   ├── ProfitLineChart.jsx
    │   │   ├── AllocationPieChart.jsx
    │   │   └── PsychologyProfitChart.jsx ← 심리 유형별 수익률 차트
    │   └── chat/
    │       ├── ChatPanel.jsx
    │       └── MessageBubble.jsx
    ├── pages/                   ← 라우팅 페이지
    │   ├── Dashboard.jsx        ← 총자산, 오늘 수익 요약
    │   ├── Journal.jsx          ← 투자 매매 일지 (핵심 페이지)
    │   ├── Portfolio.jsx        ← 보유 종목 관리
    │   ├── Research.jsx         ← 종목 검색 & 분석
    │   ├── Watchlist.jsx        ← 관심종목 & 알림
    │   └── Reports.jsx          ← 성과 리포트
    ├── store/                   ← Zustand 상태 관리
    │   ├── journalStore.js      ← 매매 일지 상태 (핵심)
    │   ├── portfolioStore.js
    │   ├── watchlistStore.js
    │   └── settingsStore.js
    └── utils/                   ← 공통 유틸리티
        ├── formatters.js        ← 숫자, 날짜 포맷
        ├── calculator.js        ← 수익률 계산
        └── storage.js           ← LocalStorage 헬퍼
```

---

## 코딩 컨벤션

```
컴포넌트    : 함수형 컴포넌트 + React Hooks 방식만 사용
파일명      : PascalCase (컴포넌트), camelCase (유틸, API, Store)
주석        : 한국어로 작성 (영어 혼용 허용)
에러 처리   : 모든 API 호출에 try-catch 필수
환경변수    : 반드시 .env 파일 사용, 하드코딩 금지
스타일      : Tailwind CSS 클래스 우선, 인라인 스타일 최소화
```

---

## 환경변수 (.env 파일)

```env
# Anthropic Claude API
# ⚠️ 프론트엔드에서 직접 사용 금지! 서버사이드 프록시(Vercel Serverless 등)를 통해 호출할 것
ANTHROPIC_API_KEY=sk-ant-여기에_API_키_입력

# 프론트엔드용 환경변수 (VITE_ 접두사 = 빌드 번들에 포함됨, 민감 키 사용 금지)
VITE_API_BASE_URL=http://localhost:3001/api

# 주가 데이터 API (선택사항)
VITE_ALPHA_VANTAGE_KEY=여기에_키_입력
VITE_KRX_API_KEY=여기에_KRX_키_입력

# 한국투자증권 OpenAPI (Phase 3~)
KIS_APP_KEY=여기에_앱키_입력
KIS_APP_SECRET=여기에_앱시크릿_입력
KIS_ACCOUNT_NO=여기에_계좌번호_입력
```

> ⚠️ **보안 주의**:
> - `.env` 파일은 절대 GitHub에 올리지 마세요! `.gitignore`에 `.env` 반드시 추가할 것.
> - `VITE_` 접두사가 붙은 변수는 빌드 시 번들에 포함되어 브라우저에서 노출됨.
> - **Anthropic Claude API 키는 종량제**이므로 반드시 서버사이드 프록시를 통해 호출.
> - 한국투자증권 API 키도 서버사이드에서만 사용할 것.

---

## 개발 단계 로드맵

| 단계    | 내용                                                              | 상태    |
| ------- | ----------------------------------------------------------------- | ------- |
| Phase 1 | 프로젝트 초기화 (Vite 6 + React 18 + Tailwind + shadcn/ui)        | ✅ 완료 |
| Phase 2 | 포트폴리오 UI + **투자 매매 일지** 구현 (Zustand+Immer, Recharts) | ✅ 완료 |
| Phase 3 | 실시간 주가 API 연동 (TanStack Query + Yahoo Finance)              | ✅ 완료 |
| Phase 4 | Claude AI 에이전트 탑재 + **일지 연동 코치 기능**                  | ✅ 완료 |
| Phase 5 | 차트·리포트 고도화 (lightweight-charts, PWA, IndexedDB)    | ✅ 완료 |
| Phase 6 | AI 종목 종합분석 + 에이전트 고도화                          | ✅ 완료 |
| Phase 7 | 종목 마스터 DB (IDB Dexie, DART/NASDAQ Trader, 앱 전역 연결) | ✅ 완료 (2026-04-23) |
| Phase 8 | 차트 동적 로딩 + 대시보드 수익률 추이 구현 | ✅ 완료 (2026-04-27) |

---

## 금지사항 (절대 구현하지 말 것)

- ❌ 직접적인 매수/매도 주문 실행 기능
- ❌ "이 종목을 사세요/파세요" 형태의 직접 투자 권유 문구
- ❌ API 키 소스코드 하드코딩
- ❌ 사용자 금융 계좌 직접 연동
- ❌ 개인정보를 외부 서버로 전송 (분석 데이터는 로컬 처리)

---

## Claude Code 작업 시 주의사항

1. 파일 수정 전 반드시 현재 코드 확인 후 변경
2. 컴포넌트 추가 시 기존 폴더 구조 준수
3. API 호출 코드는 `src/api/` 폴더에만 작성
4. 에이전트 프롬프트 수정 시 `src/agents/` 폴더 파일 변경
5. 작업 완료 후 `npm run dev`로 동작 확인 요청
6. **터미널 명령어는 반드시 PowerShell 문법으로 작성** (사용자 환경: Windows PowerShell)
   - `curl` 사용 금지 → `Invoke-RestMethod` 또는 `Invoke-WebRequest` 사용
   - 멀티라인 명령어: 백틱(`` ` ``) 으로 줄 이어쓰기
   - 명령어 제시 시 **[PowerShell]** 표시 필수

---

*마지막 업데이트: 2026-04-02*
*프로젝트 오너: dohay*
