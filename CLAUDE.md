# My Portfolio Hub — 프로젝트 지침

## 프로젝트 개요
- **목적**: 매매 심리를 기록하고 AI로 돌아보는 개인 투자 성장 도구
- **대상**: 투자 스타일을 스스로 개선하고 싶은 개인 투자자

### 핵심 기능 (우선순위)
1. 투자 매매 일지 — 심리 카테고리 기록
2. 포트폴리오 현황 — 보유 종목, 수익률
3. AI 코치 채팅 — 매매 패턴 분석·피드백
4. 성과 추적 — 심리 유형별 수익률, 벤치마크 비교
5. 종목 탐색 / 관심종목 (보조)

### 매매 심리 카테고리
- 매수: 미래가치 투자 | 분할매수 원칙 | 추격매매 | 뉴스 편승 | 저가 매수 | 목표가 도달 | 기타
- 매도: 목표가 실현 | 손절 원칙 | 공포에 매도 | 수익 실현(조급) | 리밸런싱 | 기타

## AI 에이전트 구조
오케스트레이터 + 5개 전문 에이전트. 구조/라우팅 키워드/시스템 프롬프트 전문은 [src/agents/CLAUDE.md](src/agents/CLAUDE.md) 참고(해당 폴더 작업 시에만 로드됨).

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

전체 변수 목록은 [.env.example](.env.example) 참고(항상 최신 상태로 유지됨).

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
| Phase 9 | HTS 거래내역 일괄 import (유진투자증권 Excel → 일지) | ✅ 완료 (2026-04-28) |
| Phase 10 | AI API 키 관리 (사용자 본인 키 — IDB 저장, 가드, 검증) | ✅ 완료 (2026-05-06) |
| Phase 10.2 | 일일손익 계산방법 개선 (아침대비/실현손익 분리, 업종 sector DB 연동) | ✅ 완료 (2026-05-08) |
| Phase 11 | 증시 일정 캘린더 (월간/주간/연간 뷰 + 이벤트 CRUD + 필터) | ✅ 완료 (2026-05-23) |

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

## 코드 설명 방식 (AI 응답 규칙)

사용자가 코드 설명을 요청할 때 반드시 아래 포맷을 따를 것.

1. **단계 번호** — ①②③ 순서로 흐름을 끊지 않고 따라가기
2. **실제 코드 + 라인 번호** — `// L265~274` 형식으로 파일 어디를 보면 되는지 명확하게 표시
3. **`// ← 화살표 주석`** — 해당 줄이 왜 필요한지 코드 바로 옆에서 설명
4. **마지막에 흐름 요약** — 전체 그림을 텍스트 다이어그램으로 정리

### 예시 포맷

```js
// L291~294
function savePopular(next) {
  setPopularTickers(next)                              // ← React 리렌더 트리거
  localStorage.setItem('popularTickers', JSON.stringify(next))  // ← 영구 저장
}
```

```
전체 흐름 요약
  └─ onDragStart  → dragRef에 정보 기록
       └─ onDragOver  → 파란 테두리 ON
            └─ onDrop  → 배열 업데이트 + localStorage 저장
```

---

*마지막 업데이트: 2026-05-15*
*프로젝트 오너: dohay*
