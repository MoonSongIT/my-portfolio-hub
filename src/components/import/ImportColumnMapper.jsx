import { useImportStore } from '../../store/importStore'

// 유진 HTS 고정 컬럼 — 파서가 이미 정규화하므로 표시용 레이블만 정의
const FIELD_LABELS = {
  date: '거래일자',
  name: '종목명',
  ticker: '종목코드',
  action: '매수/매도',
  price: '단가',
  quantity: '수량',
  amount: '거래금액',
  commission: '수수료',
  tax: '세금',
  realizedPnl: '실현손익',
}

const REQUIRED_FIELDS = ['date', 'ticker', 'action', 'price', 'quantity']

export default function ImportColumnMapper() {
  const parsedSheets = useImportStore((s) => s.parsedSheets)
  const selectedSheet = useImportStore((s) => s.selectedSheet)
  const setSelectedSheet = useImportStore((s) => s.setSelectedSheet)

  const currentSheet = parsedSheets.find((s) => s.sheetName === selectedSheet)
  const sampleEntry = currentSheet?.entries?.[0] ?? {}
  const availableFields = Object.keys(sampleEntry)

  return (
    <div className="space-y-4">
      {/* 시트 선택 (다중 시트인 경우만 표시) */}
      {parsedSheets.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-24 shrink-0">시트 선택</label>
          <select
            value={selectedSheet ?? ''}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {parsedSheets.map((s) => (
              <option key={s.sheetName} value={s.sheetName}>
                {s.sheetName} ({s.entries.length}건)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 컬럼 매핑 표시 */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">필드</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">파싱된 컬럼</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">샘플 값</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(FIELD_LABELS).map(([field, label]) => {
              const isRequired = REQUIRED_FIELDS.includes(field)
              const isMapped = availableFields.includes(field)
              const sampleValue = sampleEntry[field]

              return (
                <tr key={field} className={!isMapped ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-800">{label}</span>
                    {isRequired && (
                      <span className="ml-1 text-xs text-red-500">*필수</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {isMapped ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {field}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        미감지
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {sampleValue !== undefined && sampleValue !== null
                      ? String(sampleValue)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 필수 필드 미매핑 경고 */}
      {REQUIRED_FIELDS.some((f) => !availableFields.includes(f)) && (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5">
          ⚠ 일부 필수 필드가 감지되지 않았습니다. 유진투자증권 HTS 거래내역 파일인지 확인해주세요.
        </p>
      )}

      {/* 시트 요약 */}
      {currentSheet && (
        <p className="text-xs text-gray-400">
          총 {currentSheet.entries.length}건 / 원본 {currentSheet.totalRows}행 (헤더·합계 제외)
        </p>
      )}
    </div>
  )
}
