/**
 * 업로드된 Excel의 컬럼 구조가 유진투자증권 HTS 포맷인지 감지
 * 향후 다른 증권사 포맷 추가 시 여기에 감지 로직 추가
 */

import * as XLSX from 'xlsx'

/** 유진 HTS: 0행에 "일자", 14열 이상 존재 여부로 판별 */
function isEugeneFormat(rows) {
  if (rows.length < 3) return false
  const header = rows[0]
  if (!header || header.length < 15) return false
  const firstCell = String(header[0] ?? '').trim()
  return firstCell === '일자'
}

/**
 * File 객체를 받아 증권사 포맷 문자열 반환
 * @returns {Promise<'eugene' | 'unknown'>}
 */
export async function detectHtsFormat(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', range: 0 })

  if (isEugeneFormat(rows)) return 'eugene'
  return 'unknown'
}
