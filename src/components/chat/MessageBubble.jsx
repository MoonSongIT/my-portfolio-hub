// 메시지 버블 컴포넌트
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AgentBadge from './AgentBadge'

/**
 * 3점 점멸 로딩 애니메이션
 */
function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
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
export default function MessageBubble({ message, loading = false }) {
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
            <AgentBadge agentType={message.agentType} />
          </div>
        )}

        {/* 메시지 본문 */}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
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
