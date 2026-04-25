import { describe, it, expect } from 'vitest'
import { mergeOhlcvArrays } from '../utils/mergeHistory'

const day = (date, close = 100) => ({ date, open: close, high: close, low: close, close, volume: 1000 })

describe('mergeOhlcvArrays', () => {
  it('빈 배열 입력 → 빈 배열 반환', () => {
    expect(mergeOhlcvArrays([], [])).toEqual([])
    expect(mergeOhlcvArrays([], [day('2026-01-01')])).toEqual([day('2026-01-01')])
    expect(mergeOhlcvArrays([day('2026-01-01')], [])).toEqual([day('2026-01-01')])
  })

  it('완전 중복 → 기존(existing) 데이터 유지', () => {
    const existing = [day('2026-01-01', 200)]
    const incoming = [day('2026-01-01', 999)]
    const result = mergeOhlcvArrays(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].close).toBe(200)
  })

  it('부분 중복(앞 겹침) → 정상 병합, 기존 우선', () => {
    const existing = [day('2026-01-03'), day('2026-01-04'), day('2026-01-05')]
    const incoming = [day('2026-01-01'), day('2026-01-02'), day('2026-01-03', 999)]
    const result = mergeOhlcvArrays(existing, incoming)
    expect(result).toHaveLength(5)
    expect(result.map(d => d.date)).toEqual([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
    ])
    expect(result[2].close).toBe(100)
  })

  it('완전 비중복(앞에 추가) → 정렬된 전체 배열', () => {
    const existing = [day('2026-04-04'), day('2026-04-05')]
    const incoming = [day('2026-04-01'), day('2026-04-02'), day('2026-04-03')]
    const result = mergeOhlcvArrays(existing, incoming)
    expect(result).toHaveLength(5)
    expect(result.map(d => d.date)).toEqual([
      '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05',
    ])
  })

  it('날짜 필드 없는 항목 무시', () => {
    const existing = [day('2026-01-01'), { open: 100 }]
    const incoming = [null, day('2026-01-02')]
    const result = mergeOhlcvArrays(existing, incoming)
    expect(result).toHaveLength(2)
    expect(result.map(d => d.date)).toEqual(['2026-01-01', '2026-01-02'])
  })
})
