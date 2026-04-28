import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function ImportResultDialog({ result }) {
  const navigate = useNavigate()
  const { added, skipped, recomputed } = result

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5 text-center">
        <div className="flex justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-800">Import 완료</h2>
          <p className="text-sm text-gray-500">거래내역이 일지에 추가되었습니다.</p>
        </div>

        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm text-left">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-600">추가된 거래</span>
            <span className="font-semibold text-green-700">{added}건</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-600">제외됨 (skip)</span>
            <span className="font-semibold text-gray-400">{skipped}건</span>
          </div>
          {recomputed && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">보유 종목</span>
              <span className="font-semibold text-blue-600">재계산 완료</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            일지 보기
          </button>
          <button
            onClick={() => navigate('/portfolio')}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            포트폴리오 보기
          </button>
        </div>
      </div>
    </div>
  )
}
