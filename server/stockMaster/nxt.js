/**
 * nxt.js — Nextrade ATS (NXT) 거래 가능 종목 플래그 처리
 *
 * Nextrade는 독립 거래소가 아닌 KOSPI/KOSDAQ 종목이 ATS에서도
 * 거래되는 구조입니다. 공식 REST API가 없으므로:
 *   1차: KRX 정보데이터시스템 OPT10001 계열 조회 (비공개 파라미터)
 *   2차: KRX 시장데이터 AJST 코드 조회
 *   폴백: 알려진 NXT 우선 시드 티커 목록
 *
 * 반환: KOSPI/KOSDAQ 전체 rows를 받아 NXT 거래 가능 종목의
 *       tradableOn 배열에 'NXT'를 추가한 새 배열 반환
 */

// NXT 거래 가능 주요 종목 시드 목록 (KRX 공개 자료 기준 2024년 기준)
// 실제 서비스에서는 KRX API 또는 Nextrade 공시로 교체 권장
const NXT_SEED_TICKERS = new Set([
  // KOSPI 대형주
  '005930', // 삼성전자
  '000660', // SK하이닉스
  '005380', // 현대차
  '035420', // NAVER
  '005490', // POSCO홀딩스
  '000270', // 기아
  '105560', // KB금융
  '055550', // 신한지주
  '012330', // 현대모비스
  '066570', // LG전자
  '051910', // LG화학
  '028260', // 삼성물산
  '086790', // 하나금융지주
  '032830', // 삼성생명
  '018260', // 삼성에스디에스
  '009150', // 삼성전기
  '003670', // 포스코퓨처엠
  '034020', // 두산에너빌리티
  '011200', // HMM
  '010950', // S-Oil
  '096770', // SK이노베이션
  '017670', // SK텔레콤
  '030200', // KT
  '015760', // 한국전력
  '024110', // 기업은행
  '000810', // 삼성화재
  '003550', // LG
  '009540', // 한국조선해양
  '010130', // 고려아연
  '011170', // 롯데케미칼
  // KOSDAQ 대형주
  '247540', // 에코프로비엠
  '086520', // 에코프로
  '373220', // LG에너지솔루션
  '196170', // 알테오젠
  '263750', // 펄어비스
  '357780', // 솔브레인
  '145020', // 휴젤
  '091990', // 셀트리온헬스케어
  '036810', // 에프에스티
  '064760', // 티씨케이
  '112040', // 위메이드
  '240810', // 원익IPS
  '095340', // ISC
  '131970', // 두산테스나
  '039030', // 이오테크닉스
])

/**
 * KRX 시장데이터 API로 NXT 거래 가능 종목 코드 조회 시도
 * 실패 시 빈 Set 반환 (폴백에서 시드 목록 사용)
 * @returns {Promise<Set<string>>}
 */
async function fetchNxtFromKrx() {
  try {
    // KRX 정보데이터시스템 종목 조회 (공개 엔드포인트)
    const res = await fetch(
      'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Referer': 'http://data.krx.co.kr',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: new URLSearchParams({
          bld: 'dbms/MDC/STAT/standard/MDCSTAT01901',
          locale: 'ko_KR',
          mktId: 'ATS',  // ATS = Nextrade
          trdDd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
          money: '1',
          csvxls_isNo: 'false',
        }).toString(),
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return new Set()

    const json = await res.json()
    const items = json.OutBlock_1 || json.block1 || []
    if (!items.length) return new Set()

    const tickers = new Set()
    for (const item of items) {
      const code = (item.ISU_SRT_CD || item.shortCode || '').trim()
      if (/^\d{6}$/.test(code)) tickers.add(code)
    }
    console.log(`[StockMaster] NXT KRX API: ${tickers.size}개 종목 확인`)
    return tickers
  } catch (err) {
    console.warn('[StockMaster] NXT KRX API 실패, 시드 목록 사용:', err.message)
    return new Set()
  }
}

/**
 * NXT 거래 가능 종목 티커 Set 반환
 * KRX 성공 시 KRX 목록 우선, 실패 시 시드 목록 폴백
 * @returns {Promise<Set<string>>}
 */
export async function fetchNxtTradableSet() {
  const krxSet = await fetchNxtFromKrx()
  if (krxSet.size > 0) return krxSet

  console.log(`[StockMaster] NXT 폴백 시드 목록 사용: ${NXT_SEED_TICKERS.size}개`)
  return new Set(NXT_SEED_TICKERS)
}

/**
 * KOSPI/KOSDAQ rows에 NXT tradableOn 플래그 병합
 * NXT 거래 가능 종목의 tradableOn에 'NXT' 추가 (원본 불변)
 *
 * @param {import('../../src/utils/stockMasterDb').StockMasterRow[]} dartRows - KOSPI/KOSDAQ rows
 * @param {Set<string>} nxtSet - NXT 거래 가능 티커 Set
 * @returns {import('../../src/utils/stockMasterDb').StockMasterRow[]}
 */
export function mergeNxtFlags(dartRows, nxtSet) {
  let nxtCount = 0
  const merged = dartRows.map(row => {
    if (!nxtSet.has(row.ticker)) return row
    if (row.tradableOn?.includes('NXT')) return row  // 이미 있으면 스킵
    nxtCount++
    return {
      ...row,
      tradableOn: [...(row.tradableOn || [row.exchange]), 'NXT'],
    }
  })
  console.log(`[StockMaster] NXT 플래그 병합: ${nxtCount}개 종목`)
  return merged
}
