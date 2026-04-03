// 매매 심리 분석 코치 에이전트 — JournalCoachAgent

/**
 * JournalCoachAgent 시스템 프롬프트 빌더
 * @param {string} journalContext - buildJournalContext()로 생성된 컨텍스트 문자열
 * @returns {string} 시스템 프롬프트
 */
export function buildJournalCoachPrompt(journalContext) {
  return `당신은 사용자의 투자 매매 일지를 분석하는 투자 심리 코치입니다.

아래는 사용자의 실제 매매 기록 데이터입니다:
${journalContext}

분석 프레임워크:
1. 심리 유형별 수익률: 어떤 심리로 매수/매도했을 때 수익이 났는가
2. 반복 실수 패턴: 같은 실수(예: 추격매매 후 손실)가 몇 번 반복되었는가
3. 잘된 결정 강화: 좋은 결과를 낸 심리 유형과 상황 분석
4. 개선 제안: 구체적이고 실천 가능한 행동 변화 제안

응답 규칙:
- 제공된 데이터에 없는 내용 추측 금지
- 직접 매수/매도 권유 금지
- 공감적 어조 유지 (비판보다 성장 관점)
- 데이터가 부족하면 "더 많은 기록이 쌓이면 더 정확한 분석이 가능합니다"라고 안내
- 면책 문구 필수: "이 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다."
- 응답은 반드시 한국어로 작성하세요.`
}

/**
 * journalStore entries를 AI 프롬프트용 컨텍스트 텍스트로 변환
 * @param {Array} entries - journalStore.entries 배열
 * @param {Array} [accounts] - accountStore.accounts 배열 (계좌 이름 치환용, 선택)
 * @returns {string} 컨텍스트 문자열
 */
export function buildJournalContext(entries, accounts = []) {
  if (!entries || entries.length === 0) {
    return '\n[매매 일지 데이터 없음 — 아직 기록된 거래가 없습니다]\n'
  }

  // 계좌 ID → 이름 매핑 헬퍼
  const getAccountName = (accountId) => {
    if (!accountId) return '기본 계좌'
    const acc = accounts.find(a => a.id === accountId)
    return acc ? acc.name : '기본 계좌'
  }

  // 최근 50건으로 제한 (토큰 초과 방지), 날짜 최신순
  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50)

  // 계좌별 거래 현황 집계
  const accountMap = {}
  entries.forEach(e => {
    const key = e.accountId || 'default'
    if (!accountMap[key]) {
      accountMap[key] = { buyCount: 0, sellCount: 0, totalPnl: 0, pnlCount: 0 }
    }
    if (e.action === 'buy') accountMap[key].buyCount += 1
    else accountMap[key].sellCount += 1
    if (e.pnl !== null && e.pnl !== undefined) {
      accountMap[key].pnlCount += 1
      accountMap[key].totalPnl += e.pnl
    }
  })

  const accountSummary = Object.entries(accountMap)
    .map(([accountId, stat]) => {
      const name = getAccountName(accountId)
      const pnlStr = stat.pnlCount > 0
        ? ` | 실현손익: ${stat.totalPnl >= 0 ? '+' : ''}${stat.totalPnl.toLocaleString()}원`
        : ''
      return `  [${name}] 거래 ${stat.buyCount + stat.sellCount}건 (매수 ${stat.buyCount} / 매도 ${stat.sellCount})${pnlStr}`
    })
    .join('\n')

  // 심리 유형별 수익률 집계
  const psychologyMap = {}
  entries.forEach(e => {
    if (!psychologyMap[e.psychology]) {
      psychologyMap[e.psychology] = { count: 0, pnlCount: 0, totalPnl: 0 }
    }
    psychologyMap[e.psychology].count += 1
    if (e.pnl !== null && e.pnl !== undefined) {
      psychologyMap[e.psychology].pnlCount += 1
      psychologyMap[e.psychology].totalPnl += e.pnl
    }
  })

  const psychologySummary = Object.entries(psychologyMap)
    .map(([psy, stat]) => {
      const avgPnl = stat.pnlCount > 0
        ? `평균손익: ${stat.totalPnl >= 0 ? '+' : ''}${Math.round(stat.totalPnl / stat.pnlCount).toLocaleString()}원`
        : '손익 데이터 없음'
      return `  - ${psy}: ${stat.count}건 (${avgPnl})`
    })
    .join('\n')

  // 거래 목록 (계좌명 포함)
  const entryLines = recent.map(e => {
    const action = e.action === 'buy' ? '매수' : '매도'
    const accountName = getAccountName(e.accountId)
    const pnlStr = e.pnl !== null && e.pnl !== undefined
      ? ` | 손익: ${e.pnl >= 0 ? '+' : ''}${e.pnl.toLocaleString()}원`
      : ''
    const memoStr = e.memo ? ` | 메모: ${e.memo}` : ''
    return `  [${e.date}][${accountName}] ${action} ${e.name}(${e.ticker}) ${e.price.toLocaleString()}원×${e.quantity}주 | 심리: ${e.psychology}${pnlStr}${memoStr}`
  }).join('\n')

  return [
    '\n[매매 일지 요약]',
    `총 거래 건수: ${entries.length}건 (표시: 최근 ${recent.length}건)`,
    `매수: ${entries.filter(e => e.action === 'buy').length}건 | 매도: ${entries.filter(e => e.action === 'sell').length}건`,
    '',
    '[계좌별 거래 현황]',
    accountSummary,
    '',
    '[심리 유형별 통계]',
    psychologySummary,
    '',
    '[최근 거래 기록]',
    entryLines,
    '',
  ].join('\n')
}
