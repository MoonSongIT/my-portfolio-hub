import { useState } from 'react'
import { useImportStore } from '../../store/importStore'

const PAGE_SIZE = 50

function ActionBadge({ action }) {
  return action === 'buy' ? (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">매수</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">매도</span>
  )
}

function StatusBadge({ isDuplicate, isExcluded }) {
  if (isExcluded) {
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">제외</span>
  }
  if (isDuplicate) {
    return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">중복</span>
  }
  return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">신규</span>
}

export default function ImportPreviewTable() {
  const previewRows = useImportStore((s) => s.previewRows)
  const togglePreviewRow = useImportStore((s) => s.togglePreviewRow)
  const excludeAllDuplicates = useImportStore((s) => s.excludeAllDuplicates)

  const [page, setPage] = useState(0)

  const newCount = previewRows.filter((r) => !r.isDuplicate && !r.isExcluded).length
  const dupCount = previewRows.filter((r) => r.isDuplicate && !r.isExcluded).length
  const exCount = previewRows.filter((r) => r.isExcluded).length

  const totalPages = Math.ceil(previewRows.length / PAGE_SIZE)
  const pageRows = previewRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pageOffset = page * PAGE_SIZE

  if (previewRows.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        미리보기할 데이터가 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* 요약 바 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-green-700">신규 {newCount}건</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-yellow-700">중복 {dupCount}건</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-500">제외 {exCount}건</span>
        </div>
        {previewRows.some((r) => r.isDuplicate && !r.isExcluded) && (
          <button
            onClick={excludeAllDuplicates}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            중복 전체 제외
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600 w-10">포함</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">상태</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">날짜</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">종목</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">구분</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">단가</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">수량</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">금액</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">수수료</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">세금</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((row, i) => {
              const idx = pageOffset + i
              const { entry, isDuplicate, isExcluded } = row
              return (
                <tr
                  key={idx}
                  className={[
                    isDuplicate && !isExcluded ? 'bg-yellow-50' : '',
                    isExcluded ? 'bg-gray-50 opacity-50' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-2">
                    <input
                      id={`preview-row-${idx}`}
                      name={`preview-row-${idx}`}
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => togglePreviewRow(idx)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge isDuplicate={isDuplicate} isExcluded={isExcluded} />
                  </td>
                  <td className="px-3 py-2 text-gray-700">{entry.date}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{entry.name}</div>
                    <div className="text-xs text-gray-400">{entry.ticker}</div>
                  </td>
                  <td className="px-3 py-2">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {entry.price?.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {entry.quantity?.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {entry.amount?.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {entry.commission ? entry.commission.toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {entry.tax ? entry.tax.toLocaleString('ko-KR') : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
