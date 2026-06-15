// claudeApiParser.test.js — extractTextAndCitations 단위 테스트
// web_search 멀티 블록 응답에서 본문 결합 + 인용 수집 검증
import { describe, it, expect } from 'vitest'
import { extractTextAndCitations } from '../api/claudeApi.js'

describe('extractTextAndCitations', () => {
  it('단일 text 블록은 그대로 반환한다', () => {
    const data = { content: [{ type: 'text', text: '안녕하세요' }] }
    const { text, citations } = extractTextAndCitations(data)
    expect(text).toBe('안녕하세요')
    expect(citations).toEqual([])
  })

  it('여러 text 블록을 순서대로 결합한다 (server_tool_use는 무시)', () => {
    const data = {
      content: [
        { type: 'text', text: '검색하겠습니다. ' },
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: '삼성전자' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
        { type: 'text', text: '삼성전자가 상승했습니다.' },
      ],
    }
    const { text } = extractTextAndCitations(data)
    expect(text).toBe('검색하겠습니다. 삼성전자가 상승했습니다.')
  })

  it('인용을 수집하고 url 기준 중복을 제거한다', () => {
    const data = {
      content: [
        {
          type: 'text',
          text: '실적이 개선되었습니다.',
          citations: [
            { type: 'web_search_result_location', url: 'https://a.com', title: 'A기사' },
            { type: 'web_search_result_location', url: 'https://a.com', title: 'A기사 중복' },
          ],
        },
        {
          type: 'text',
          text: ' 외국인이 순매수했습니다.',
          citations: [
            { type: 'web_search_result_location', url: 'https://b.com', title: 'B기사' },
          ],
        },
      ],
    }
    const { text, citations } = extractTextAndCitations(data)
    expect(text).toBe('실적이 개선되었습니다. 외국인이 순매수했습니다.')
    expect(citations).toEqual([
      { url: 'https://a.com', title: 'A기사' },
      { url: 'https://b.com', title: 'B기사' },
    ])
  })

  it('title이 없으면 url을 title로 대체한다', () => {
    const data = {
      content: [{ type: 'text', text: '내용', citations: [{ url: 'https://c.com' }] }],
    }
    const { citations } = extractTextAndCitations(data)
    expect(citations).toEqual([{ url: 'https://c.com', title: 'https://c.com' }])
  })

  it('content가 배열이 아니어도 안전하게 처리한다', () => {
    expect(extractTextAndCitations({}).text).toBe('')
    expect(extractTextAndCitations(null).text).toBe('')
    expect(extractTextAndCitations(undefined).citations).toEqual([])
  })
})
