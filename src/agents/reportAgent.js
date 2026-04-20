// 성과 추적 & 리포트 에이전트 — ReportAgent
import { saveReport } from '../utils/db'

/**
 * ReportAgent 시스템 프롬프트
 */
export const REPORT_PROMPT = `당신은 투자 성과 분석 및 리포트 생성 전문 에이전트입니다.

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
- 면책 문구: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."

응답은 반드시 한국어로 작성하세요.`

/**
 * 주간 리포트 전용 시스템 프롬프트
 */
export const WEEKLY_REPORT_PROMPT = `당신은 투자 주간 성과 분석 전문 에이전트입니다.

이번 주 투자 활동을 아래 형식으로 요약해주세요:

## 📊 주간 투자 리포트

### 1. 이번 주 성과 요약
- 총 평가금액 변화 및 수익률
- 실현 손익 합계
- 거래 건수 (매수/매도)

### 2. 종목별 성과
| 종목 | 수익률 | 손익 |
|------|-------|------|
(데이터 기반 표 작성)

### 3. 매매 심리 분석
- 이번 주 주요 매매 심리 유형
- 잘된 결정과 아쉬운 결정

### 4. 다음 주 주목 포인트
- 보유 종목 중 주목할 이벤트 (실적 발표, 배당락 등)
- 개선 제안 1~2가지

출력 형식: 마크다운 | 금액: 천 단위 구분자 | 응답은 반드시 한국어로`

/**
 * 월간 리포트 전용 시스템 프롬프트
 */
export const MONTHLY_REPORT_PROMPT = `당신은 투자 월간 성과 분석 전문 에이전트입니다.

이번 달 투자 활동을 아래 형식으로 종합 분석해주세요:

## 📈 월간 투자 리포트

### 1. 월간 성과 요약
- 총 수익률 vs KOSPI/S&P500 벤치마크 비교
- 실현 손익 / 미실현 손익 구분
- 승률 (수익 거래 / 전체 거래)

### 2. TOP3 / BOTTOM3 종목
| 구분 | 종목 | 수익률 | 손익 |
|------|------|-------|------|

### 3. 매매 심리 패턴 분석
- 심리 유형별 평균 손익
- 반복된 패턴 (좋은 습관 / 개선 필요)

### 4. 월간 인사이트
- 잘한 투자 결정 (구체적 사례)
- 아쉬운 투자 결정 (구체적 사례)

### 5. 다음 달 계획
- 포트폴리오 조정 검토 포인트
- 주목할 이벤트 캘린더

출력 형식: 마크다운 | 금액: 천 단위 구분자 | 수익률: 소수점 2자리 | 응답은 반드시 한국어로`

/**
 * 보유 종목 + 기간 데이터를 기반으로 ReportAgent 컨텍스트 빌드
 * @param {Array} holdings - 보유 종목 배열
 * @param {string} period - 리포트 기간 ('daily' | 'weekly' | 'monthly' | 'yearly')
 * @param {number|null} exchangeRate - USD/KRW 환율
 * @returns {string} 컨텍스트 문자열
 */
export function buildReportContext(holdings, period, exchangeRate) {
  const periodLabels = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
    yearly: '연간',
  }
  const periodLabel = periodLabels[period] || '월간'

  if (!holdings || holdings.length === 0) {
    return `\n[${periodLabel} 리포트 — 보유 종목 없음]\n`
  }

  // 종목별 성과 산출
  const stockPerf = holdings.map((h) => {
    const currentValue = (h.currentPrice || 0) * (h.quantity || 0)
    const investedValue = (h.avgPrice || 0) * (h.quantity || 0)
    const profitLoss = currentValue - investedValue
    const profitRate = investedValue > 0
      ? ((profitLoss / investedValue) * 100).toFixed(2)
      : '0.00'

    return {
      name: h.name || h.ticker,
      ticker: h.ticker,
      profitRate: parseFloat(profitRate),
      profitLoss,
      currentValue,
      investedValue,
      market: h.market || 'KRX',
    }
  })

  // 수익률 순으로 정렬
  const sorted = [...stockPerf].sort((a, b) => b.profitRate - a.profitRate)
  const top3 = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  const totalCurrent = stockPerf.reduce((s, h) => s + h.currentValue, 0)
  const totalInvested = stockPerf.reduce((s, h) => s + h.investedValue, 0)
  const totalPL = totalCurrent - totalInvested
  const totalRate = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : '0.00'

  const lines = [
    `\n[${periodLabel} 성과 리포트]`,
    `리포트 기간: ${periodLabel}`,
    `총 보유 종목: ${holdings.length}개`,
    `총 투자금액: ${totalInvested.toLocaleString()}`,
    `총 평가금액: ${totalCurrent.toLocaleString()}`,
    `총 수익률: ${totalPL >= 0 ? '+' : ''}${totalRate}%`,
    `총 손익: ${totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString()}`,
    exchangeRate ? `환율(USD/KRW): ${exchangeRate.toLocaleString()}` : '',
    '',
    '[TOP 3 수익 종목]',
    ...top3.map((s, i) => `  ${i + 1}. ${s.name} (${s.ticker}): ${s.profitRate >= 0 ? '+' : ''}${s.profitRate}%`),
    '',
    '[BOTTOM 3 종목]',
    ...bottom3.map((s, i) => `  ${i + 1}. ${s.name} (${s.ticker}): ${s.profitRate >= 0 ? '+' : ''}${s.profitRate}%`),
    '',
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * 정기 리포트(주간/월간) 생성 후 IndexedDB에 저장
 * @param {string} type - 'weekly' | 'monthly'
 * @param {string} content - AI가 생성한 리포트 텍스트
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 저장된 레코드 ID
 */
export async function saveScheduledReport(type, content, userId) {
  const now = new Date()
  const title = type === 'weekly'
    ? `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${getWeekNumber(now)}주차 주간 리포트`
    : `${now.getFullYear()}년 ${now.getMonth() + 1}월 월간 리포트`

  return saveReport({
    type,
    title,
    content,
    userId,
    generatedAt: now.toISOString(),
  })
}

/**
 * 이번 주가 마지막으로 리포트를 생성한 주와 다른지 확인
 * @param {string|null} lastGeneratedAt - ISO 날짜 문자열
 * @returns {boolean}
 */
export function shouldGenerateWeeklyReport(lastGeneratedAt) {
  if (!lastGeneratedAt) return true
  const last = new Date(lastGeneratedAt)
  const now = new Date()
  const lastWeek = getWeekNumber(last) + last.getFullYear() * 53
  const thisWeek = getWeekNumber(now) + now.getFullYear() * 53
  return thisWeek > lastWeek
}

/**
 * 이번 달이 마지막 리포트 생성 달과 다른지 확인
 * @param {string|null} lastGeneratedAt - ISO 날짜 문자열
 * @returns {boolean}
 */
export function shouldGenerateMonthlyReport(lastGeneratedAt) {
  if (!lastGeneratedAt) return true
  const last = new Date(lastGeneratedAt)
  const now = new Date()
  return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth()
}

/** ISO 주차 번호 계산 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}
