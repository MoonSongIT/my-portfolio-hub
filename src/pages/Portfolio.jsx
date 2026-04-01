export default function Portfolio() {
  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">포트폴리오</h2>
      <p className="text-gray-600 mb-8">보유 중인 주식과 ETF를 관리하세요.</p>

      {/* Phase 2에서 포트폴리오 테이블과 추가 기능으로 구현될 영역 */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <p className="text-gray-500">아직 보유 종목이 없습니다.</p>
      </div>
    </div>
  )
}
