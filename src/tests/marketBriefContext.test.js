// marketBriefContext.test.js — 시장 브리핑 컨텍스트 직렬화(선행지표 확장) 단위 테스트
import { describe, it, expect } from 'vitest'
import { buildMarketBriefContext } from '../agents/analysisAgent.js'

const indices = [
  { label: 'KOSPI', ticker: '^KS11', price: 2500, changePercent: -0.5 },
  { label: 'S&P500', ticker: '^GSPC', price: 5800, changePercent: 1.2 },
]

describe('buildMarketBriefContext — 하위호환', () => {
  it('기존 인자(indices, news)만으로 지수·뉴스를 렌더하고 신규 섹션은 없다', () => {
    const out = buildMarketBriefContext({ indices, news: [] })
    expect(out).toContain('[지수 현황]')
    expect(out).toContain('KOSPI')
    expect(out).not.toContain('선행지표')
    expect(out).not.toContain('overnightBias')
    expect(out).not.toContain('변동성 레짐')
  })

  it('빈 입력에도 깨지지 않는다', () => {
    expect(() => buildMarketBriefContext({})).not.toThrow()
  })
})

describe('buildMarketBriefContext — 선행지표 결합', () => {
  const leading = [
    { key: 'sox', label: 'SOX(반도체)', price: 13940, changePercent: 3.59, available: true },
    { key: 'vix', label: 'VIX(공포)', price: 18.89, changePercent: -3.08, available: true },
    { key: 'wti', label: 'WTI(유가)', price: null, changePercent: null, available: false },
  ]

  it('선행지표 섹션을 렌더하고 available=false는 제외한다', () => {
    const out = buildMarketBriefContext({ indices, leading, news: [] })
    expect(out).toContain('선행지표')
    expect(out).toContain('SOX(반도체)')
    expect(out).toContain('VIX(공포)')
    expect(out).not.toContain('WTI(유가)') // available=false → 제외
  })

  it('overnightBias 점수·라벨을 렌더한다', () => {
    const bias = { score: 1, label: '중립', contributions: {} }
    const out = buildMarketBriefContext({ indices, bias, news: [] })
    expect(out).toContain('overnightBias')
    expect(out).toContain('중립')
  })

  it('변동성 레짐을 한글 라벨로 렌더한다', () => {
    const regime = { regime: 'high', percentile: 72, p33: 15, p67: 25 }
    const out = buildMarketBriefContext({ indices, regime, news: [] })
    expect(out).toContain('변동성 레짐')
    expect(out).toContain('고변동')
  })
})
