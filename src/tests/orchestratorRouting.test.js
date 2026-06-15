// orchestratorRouting.test.js — 의도 파싱 + 하이브리드 라우팅 단위 테스트
import { describe, it, expect } from 'vitest'
import { parseIntentResponse, routeToAgentSmart } from '../agents/orchestrator.js'

describe('parseIntentResponse', () => {
  it('유효한 에이전트 단어를 추출한다', () => {
    expect(parseIntentResponse('research')).toBe('research')
    expect(parseIntentResponse('analysis\n')).toBe('analysis')
    expect(parseIntentResponse('의도는 journal 입니다')).toBe('journal')
  })

  it('유효 에이전트가 없으면 null', () => {
    expect(parseIntentResponse('unknown')).toBeNull()
    expect(parseIntentResponse('')).toBeNull()
    expect(parseIntentResponse(null)).toBeNull()
  })
})

describe('routeToAgentSmart — 정적 경로 (LLM 미호출)', () => {
  it('명확한 키워드는 정적 라우팅으로 즉시 분류한다', async () => {
    expect(await routeToAgentSmart('삼성전자 분석해줘')).toBe('research')
    expect(await routeToAgentSmart('내 매매 패턴 봐줘')).toBe('journal')
    expect(await routeToAgentSmart('오늘 왜 급락했어')).toBe('analysis')
    expect(await routeToAgentSmart('이번달 성과 리포트')).toBe('report')
  })

  it('portfolio 키워드가 실제 있으면 portfolio로 라우팅한다', async () => {
    expect(await routeToAgentSmart('내 포트폴리오 수익률 알려줘')).toBe('portfolio')
  })

  it('빈 입력은 portfolio 폴백', async () => {
    expect(await routeToAgentSmart('')).toBe('portfolio')
    expect(await routeToAgentSmart(null)).toBe('portfolio')
  })
})
