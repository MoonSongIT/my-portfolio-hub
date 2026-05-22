// 메시지 버블 컴포넌트
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AgentBadge from './AgentBadge'
import FeedbackButtons from './FeedbackButtons'
import { extractStructuredData, stripJsonBlock } from '../../utils/responseParser'
import { detectHallucination } from '../../utils/hallucinationGuard'

/**
 * 3점 점멸 로딩 애니메이션
 */
function LoadingDots() {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="text-xs text-blue-400 dark:text-blue-300 font-medium">분석 중</span>
      <span className="dot-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="dot-2 h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="dot-3 h-2.5 w-2.5 rounded-full bg-blue-500" />
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-6px); }
        }
        .dot-1 { animation: dotBounce 1.4s ease-in-out 0s infinite; }
        .dot-2 { animation: dotBounce 1.4s ease-in-out 0.2s infinite; }
        .dot-3 { animation: dotBounce 1.4s ease-in-out 0.4s infinite; }
      `}</style>
    </div>
  )
}

/**
 * 마크다운 커스텀 렌더러 (테이블, 코드 등 스타일링)
 */
const markdownComponents = {
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 text-sm dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold dark:border-gray-600">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-1.5 dark:border-gray-600">
      {children}
    </td>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-gray-100 px-1 py-0.5 text-sm text-red-600 dark:bg-gray-700 dark:text-red-400">
        {children}
      </code>
    ) : (
      <pre className="my-2 overflow-x-auto rounded bg-gray-900 p-3 text-sm text-gray-100">
        <code>{children}</code>
      </pre>
    ),
  h2: ({ children }) => (
    <h2 className="mb-1 mt-3 text-base font-bold text-gray-800 dark:text-gray-200">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-bold text-gray-700 dark:text-gray-300">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  p: ({ children }) => <p className="my-1 text-sm leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  hr: () => (
    <hr className="my-4 border-t-2 border-gray-300 dark:border-gray-600" />
  ),
}

/**
 * 타임스탬프 포맷 (시:분)
 * @param {string} iso - ISO 날짜 문자열
 */
function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 메시지 버블 컴포넌트
 * @param {{ message: object, loading?: boolean }} props
 */
const ATTRACTIVENESS_STYLE = {
  '상': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  '중': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  '하': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function MessageBubble({ message, loading = false, onFeedback }) {
  const isUser = message.role === 'user'

  // 로딩 상태 (AI 응답 대기 중)
  if (loading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-gray-800">
          <LoadingDots />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-blue-600 text-white'
            : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
        }`}
      >
        {/* AI 메시지: 에이전트 배지 표시 */}
        {!isUser && message.agentType && (
          <div className="mb-2">
            <AgentBadge agentType={message.agentType} agentInfo={message.agentInfo} />
          </div>
        )}

        {/* 메시지 본문 */}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (() => {
          const structured = extractStructuredData(message.content)
          const displayText = stripJsonBlock(message.content)
          return (
            <>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {displayText}
                </ReactMarkdown>
              </div>
              {/* research: 투자 매력도 배지 */}
              {message.agentType === 'research' && structured?.attractiveness && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ATTRACTIVENESS_STYLE[structured.attractiveness] ?? ''}`}>
                    투자 매력도 {structured.attractiveness}
                  </span>
                  {structured.reason && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{structured.reason}</span>
                  )}
                </div>
              )}
              {/* alert: 긴급/주의/참고 카운트 칩 */}
              {message.agentType === 'alert' && structured && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
                    🔴 긴급 {structured.urgent ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                    🟡 주의 {structured.caution ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-200">
                    🟢 참고 {structured.info ?? 0}
                  </span>
                </div>
              )}
            </>
          )
        })()}

        {/* 잘린 응답 안내 — stop_reason: max_tokens 시 표시 */}
        {!isUser && message.incomplete && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <span>⚠️</span>
            <span>응답이 길어 중간에 잘렸습니다. &quot;이어서 설명해줘&quot;라고 입력하면 계속 받을 수 있습니다.</span>
          </div>
        )}

        {/* 7-8: 환각 의심 경고 배지 */}
        {!isUser && (() => {
          const warnings = detectHallucination(message.content, message.agentType)
          return warnings ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300">
              <span className="shrink-0">🔍</span>
              <span>AI가 구체적 수치·날짜를 제시했습니다. 실제 공시·뉴스로 교차 확인 후 참고하세요. ({warnings.join(', ')})</span>
            </div>
          ) : null
        })()}

        {/* 7-5: 피드백 버튼 */}
        {!isUser && onFeedback && (
          <FeedbackButtons
            messageId={message.id}
            feedback={message.feedback ?? null}
            onFeedback={onFeedback}
          />
        )}

        {/* 타임스탬프 */}
        <div
          className={`mt-1 text-[10px] ${
            isUser ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
