// 종목 분석 번들 React Query 캐싱 훅
// queryKey: ['research', ticker, market]
// staleTime 5분 — 동일 종목 재질문 시 API 재호출 없음 (T10 테스트 통과)
// gcTime 10분 — 캐시 메모리 유지
import { useQuery } from '@tanstack/react-query'
import { assembleResearchBundle } from '../services/researchOrchestrator'

export const RESEARCH_QUERY_KEY = (ticker, market) => ['research', ticker, market]

/**
 * 종목 분석 번들 조회 훅
 *
 * @param {string} ticker - 종목 코드
 * @param {string} market - 시장 코드 (KRX, NASDAQ 등)
 * @param {{ enabled?: boolean, prefetched?: object }} options
 *   - enabled: false (기본) — 수동 트리거 모드 (버튼 클릭 시에만 fetch)
 *   - prefetched: StockDetail 페이지에서 이미 가져온 quote/detail/history 재사용
 */
export function useResearchBundle(ticker, market, { enabled = false, prefetched = {} } = {}) {
  return useQuery({
    queryKey: RESEARCH_QUERY_KEY(ticker, market),
    queryFn: () => assembleResearchBundle({ ticker, market, prefetched }),
    staleTime: 5 * 60 * 1000,   // 5분: 캐시 신선도 유지
    gcTime:    10 * 60 * 1000,  // 10분: 언마운트 후 캐시 보존
    enabled,
    retry: false,  // 실패 시 폴백으로 처리 (재시도 불필요)
  })
}
