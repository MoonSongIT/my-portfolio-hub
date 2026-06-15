// sentimentApi.test.js — 감성 파싱/병합 순수 함수 단위 테스트
import { describe, it, expect } from 'vitest'
import { parseSentimentResponse, mergeSentiment } from '../api/sentimentApi.js'

describe('parseSentimentResponse', () => {
  it('정상 JSON 배열을 파싱한다', () => {
    const text = '[{"i":0,"sentiment":-0.7,"strength":"high","reason":"실적 부진"}]'
    expect(parseSentimentResponse(text)).toEqual([
      { i: 0, sentiment: -0.7, strength: 'high', reason: '실적 부진' },
    ])
  })

  it('코드펜스로 감싼 JSON도 추출한다', () => {
    const text = '```json\n[{"i":1,"sentiment":0.5,"strength":"mid","reason":"수주 호재"}]\n```'
    expect(parseSentimentResponse(text)).toEqual([
      { i: 1, sentiment: 0.5, strength: 'mid', reason: '수주 호재' },
    ])
  })

  it('sentiment를 -1~1로 클램프하고 잘못된 strength는 low로 보정한다', () => {
    const text = '[{"i":0,"sentiment":5,"strength":"weird","reason":"x"}]'
    const [r] = parseSentimentResponse(text)
    expect(r.sentiment).toBe(1)
    expect(r.strength).toBe('low')
  })

  it('i가 없는 항목은 제외한다', () => {
    const text = '[{"sentiment":0.3},{"i":2,"sentiment":0.1,"strength":"low","reason":""}]'
    const result = parseSentimentResponse(text)
    expect(result).toHaveLength(1)
    expect(result[0].i).toBe(2)
  })

  it('깨진 JSON·비배열·빈 입력은 빈 배열로 폴백한다', () => {
    expect(parseSentimentResponse('not json')).toEqual([])
    expect(parseSentimentResponse('{"i":0}')).toEqual([])
    expect(parseSentimentResponse('')).toEqual([])
    expect(parseSentimentResponse(null)).toEqual([])
  })
})

describe('mergeSentiment', () => {
  const news = [{ title: 'A' }, { title: 'B' }, { title: 'C' }]

  it('인덱스 기준으로 감성을 병합한다', () => {
    const sentiments = [
      { i: 0, sentiment: -0.5, strength: 'high', reason: 'r0' },
      { i: 2, sentiment: 0.4, strength: 'low', reason: 'r2' },
    ]
    const merged = mergeSentiment(news, sentiments)
    expect(merged[0]).toMatchObject({ title: 'A', sentiment: -0.5, strength: 'high', sentimentReason: 'r0' })
    expect(merged[1].sentiment).toBeUndefined()
    expect(merged[2]).toMatchObject({ title: 'C', sentiment: 0.4, sentimentReason: 'r2' })
  })

  it('감성 배열이 비면 원본을 그대로 반환한다', () => {
    expect(mergeSentiment(news, [])).toBe(news)
  })
})
