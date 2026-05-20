// AI 응답에서 구조화 JSON 블록을 추출하고 제거하는 유틸

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)```/

/**
 * AI 응답 텍스트에서 ```json ... ``` 블록을 파싱하여 객체로 반환.
 * 블록이 없거나 파싱 실패 시 null 반환.
 *
 * @param {string} text
 * @returns {object|null}
 */
export function extractStructuredData(text) {
  if (!text) return null
  const match = text.match(JSON_BLOCK_RE)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

/**
 * AI 응답 텍스트에서 ```json ... ``` 블록을 제거하여 사용자에게 보여줄 본문만 반환.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripJsonBlock(text) {
  if (!text) return ''
  return text.replace(JSON_BLOCK_RE, '').trimEnd()
}
