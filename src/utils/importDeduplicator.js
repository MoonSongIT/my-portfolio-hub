/**
 * HTS import 중복 방지 유틸
 * externalId = SHA-256(date|ticker|action|quantity|price) hex string
 */

/** 문자열 → SHA-256 hex (Web Crypto API) */
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 거래 엔트리의 externalId 생성
 * @param {{ date:string, ticker:string, action:string, quantity:number, price:number }} entry
 * @returns {Promise<string>} SHA-256 hex
 */
export async function generateExternalId(entry) {
  const key = [
    entry.date ?? '',
    entry.ticker ?? '',
    entry.action ?? '',
    entry.quantity ?? 0,
    entry.price ?? 0,
  ].join('|')
  return sha256Hex(key)
}

/**
 * 가져올 엔트리와 기존 엔트리를 비교해 신규/중복 분류
 * @param {object[]} incoming - externalId가 붙어있어야 함
 * @param {object[]} existing - journalStore의 현재 entries
 * @returns {{ newEntries: object[], duplicates: object[] }}
 */
export function findDuplicates(incoming, existing) {
  const existingIds = new Set(
    existing.map((e) => e.externalId).filter(Boolean)
  )

  const newEntries = []
  const duplicates = []

  for (const entry of incoming) {
    if (entry.externalId && existingIds.has(entry.externalId)) {
      duplicates.push(entry)
    } else {
      newEntries.push(entry)
    }
  }

  return { newEntries, duplicates }
}

/**
 * 엔트리 배열에 externalId를 일괄 부여
 * @param {object[]} entries
 * @returns {Promise<object[]>} externalId 필드가 추가된 엔트리 배열
 */
export async function attachExternalIds(entries) {
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      externalId: await generateExternalId(entry),
    }))
  )
}
