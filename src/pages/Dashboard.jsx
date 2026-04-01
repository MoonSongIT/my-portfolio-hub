export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h2>
        <p className="text-gray-600">전체 포트폴리오 현황을 한눈에 확인하세요.</p>
      </div>

      {/* Phase 2에서 샘플 데이터와 차트로 구현될 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">총 자산</p>
          <p className="text-3xl font-bold text-gray-900">---</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">수익률</p>
          <p className="text-3xl font-bold text-gray-900">---</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm mb-2">오늘 수익</p>
          <p className="text-3xl font-bold text-gray-900">---</p>
        </div>
      </div>
    </div>
  )
}
