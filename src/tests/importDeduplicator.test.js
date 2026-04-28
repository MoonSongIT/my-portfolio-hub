import { describe, it, expect } from 'vitest'
import {
  generateExternalId,
  findDuplicates,
  attachExternalIds,
} from '../utils/importDeduplicator'

const baseEntry = {
  date: '2026-04-01',
  ticker: '005930',
  action: 'buy',
  quantity: 10,
  price: 72000,
}

describe('generateExternalId', () => {
  it('동일 입력 → 동일 해시', async () => {
    const id1 = await generateExternalId(baseEntry)
    const id2 = await generateExternalId(baseEntry)
    expect(id1).toBe(id2)
  })

  it('다른 입력 → 다른 해시', async () => {
    const id1 = await generateExternalId(baseEntry)
    const id2 = await generateExternalId({ ...baseEntry, quantity: 20 })
    expect(id1).not.toBe(id2)
  })

  it('hex string 64자 반환', async () => {
    const id = await generateExternalId(baseEntry)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('action 차이 → 다른 해시 (매수/매도 구분)', async () => {
    const buyId = await generateExternalId({ ...baseEntry, action: 'buy' })
    const sellId = await generateExternalId({ ...baseEntry, action: 'sell' })
    expect(buyId).not.toBe(sellId)
  })
})

describe('findDuplicates', () => {
  it('기존 엔트리 없으면 전부 신규', () => {
    const incoming = [{ externalId: 'abc' }, { externalId: 'def' }]
    const { newEntries, duplicates } = findDuplicates(incoming, [])
    expect(newEntries).toHaveLength(2)
    expect(duplicates).toHaveLength(0)
  })

  it('동일 externalId → 중복 분류', () => {
    const incoming = [{ externalId: 'abc' }, { externalId: 'xyz' }]
    const existing = [{ externalId: 'abc' }]
    const { newEntries, duplicates } = findDuplicates(incoming, existing)
    expect(newEntries).toHaveLength(1)
    expect(newEntries[0].externalId).toBe('xyz')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].externalId).toBe('abc')
  })

  it('externalId 없는 incoming → 신규로 처리', () => {
    const incoming = [{ externalId: null }, { externalId: undefined }]
    const existing = [{ externalId: 'abc' }]
    const { newEntries, duplicates } = findDuplicates(incoming, existing)
    expect(newEntries).toHaveLength(2)
    expect(duplicates).toHaveLength(0)
  })

  it('기존 엔트리에 externalId 없는 경우 무시', () => {
    const incoming = [{ externalId: 'abc' }]
    const existing = [{ externalId: null }, {}]
    const { newEntries, duplicates } = findDuplicates(incoming, existing)
    expect(newEntries).toHaveLength(1)
    expect(duplicates).toHaveLength(0)
  })
})

describe('attachExternalIds', () => {
  it('각 엔트리에 externalId 추가', async () => {
    const entries = [baseEntry, { ...baseEntry, quantity: 5 }]
    const result = await attachExternalIds(entries)
    expect(result).toHaveLength(2)
    expect(result[0].externalId).toMatch(/^[0-9a-f]{64}$/)
    expect(result[1].externalId).toMatch(/^[0-9a-f]{64}$/)
    expect(result[0].externalId).not.toBe(result[1].externalId)
  })

  it('원본 필드 유지', async () => {
    const [result] = await attachExternalIds([baseEntry])
    expect(result.date).toBe(baseEntry.date)
    expect(result.ticker).toBe(baseEntry.ticker)
    expect(result.quantity).toBe(baseEntry.quantity)
  })
})
