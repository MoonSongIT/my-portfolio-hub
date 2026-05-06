// Anthropic API 키 형식 검증 & 마스킹 유틸 — 순수 함수, 외부 의존 없음

const SK_ANT_PREFIX = 'sk-ant-'
const MIN_KEY_LENGTH = 60

/**
 * API 키 형식 검증 (경고용 — 차단 아님)
 * @param {string} key
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function isValidFormat(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'API 키를 입력해주세요.' }
  }
  if (!key.startsWith(SK_ANT_PREFIX)) {
    return { valid: false, reason: `API 키는 "${SK_ANT_PREFIX}"로 시작해야 합니다.` }
  }
  if (key.length < MIN_KEY_LENGTH) {
    return { valid: false, reason: `API 키가 너무 짧습니다. (최소 ${MIN_KEY_LENGTH}자)` }
  }
  return { valid: true, reason: null }
}

/**
 * API 키 마스킹 — 앞 7자 + 마지막 4자만 노출
 * 예) sk-ant-•••••••••••abcd
 * @param {string} key
 * @returns {string}
 */
export function maskKey(key) {
  if (!key || key.length < 12) return '••••••••••••'
  const prefix = key.slice(0, 7)   // "sk-ant-"
  const suffix = key.slice(-4)
  return `${prefix}•••••••••••${suffix}`
}
