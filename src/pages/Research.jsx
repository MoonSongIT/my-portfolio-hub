import { useState } from 'react'
import { Search, TrendingUp, BarChart3, FileText, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'

export default function Research() {
  const [query, setQuery] = useState('')

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">종목 탐색</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">신규 투자 후보를 찾고 분석하세요.</p>
      </div>

      {/* 검색창 */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 티커를 검색하세요 (예: 삼성전자, AAPL)"
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Phase 3 안내 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Phase 3에서 실시간 주가 데이터가 연동됩니다. 현재는 UI 레이아웃만 표시됩니다.
        </p>
      </div>

      {/* 종목 상세 분석 템플릿 (빈 상태) */}
      {query ? (
        <div className="space-y-4">
          {/* 기본 정보 카드 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['현재가', '52주 고가', '52주 저가', '시가총액', '거래량', 'PER', 'PBR', 'ROE'].map((label) => (
                  <div key={label} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                    <p className="text-lg font-semibold text-gray-400">---</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 가격 차트 영역 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                가격 차트
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-400">차트 데이터가 연동되면 표시됩니다</p>
              </div>
            </CardContent>
          </Card>

          {/* 재무 지표 */}
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                재무 지표
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-400">재무 데이터가 연동되면 표시됩니다</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-20">
          <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-lg text-gray-500 dark:text-gray-400">종목을 검색해주세요</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            티커 또는 종목명으로 검색하여 상세 분석을 확인할 수 있습니다
          </p>
        </div>
      )}
    </div>
  )
}
