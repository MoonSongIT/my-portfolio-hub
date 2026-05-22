// 응답 품질 피드백 감지 및 집계 유틸리티
const NEGATIVE_KEYWORDS = ['틀렸어', '아니야', '다시', '잘못됐어', '다시 해줘', '틀림', '틀렸는데', '잘못된', '다시해']

/** 부정 키워드 포함 여부 감지 */
export function detectNegativeIntent(message) {
  return NEGATIVE_KEYWORDS.some(kw => message.includes(kw))
}

/**
 * 암묵적 품질 신호 계산
 * @param {string} nextMessage - 다음 사용자 메시지
 * @param {number} timeDelta - 이전 AI 응답으로부터 경과 시간 (ms)
 * @returns {{ negativeKeyword: boolean, followUpWithin60s: boolean, qualityScore: number }}
 */
export function recordImplicitFeedback(nextMessage, timeDelta) {
  const isNegative = detectNegativeIntent(nextMessage)
  const isFollowUp = timeDelta < 60_000
  const qualityScore = isNegative ? 20 : isFollowUp ? 50 : 70
  return { negativeKeyword: isNegative, followUpWithin60s: isFollowUp, qualityScore }
}

/**
 * 에이전트별 품질 리포트 출력 (개발 모드 전용)
 * @param {Array} messages - 세션 메시지 배열
 */
export function generateQualityReport(messages) {
  if (!import.meta.env.DEV) return
  const byAgent = {}
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.agentType) continue
    const agent = msg.agentType
    if (!byAgent[agent]) byAgent[agent] = { count: 0, totalScore: 0, unhelpful: 0 }
    byAgent[agent].count++
    byAgent[agent].totalScore += msg.qualityScore ?? 70
    if (msg.feedback === 'unhelpful') byAgent[agent].unhelpful++
  }
  for (const [agent, data] of Object.entries(byAgent)) {
    console.info(
      `[QualityReport] ${agent}: avg=${(data.totalScore / data.count).toFixed(1)}, unhelpful=${data.unhelpful}/${data.count}`
    )
  }
}
