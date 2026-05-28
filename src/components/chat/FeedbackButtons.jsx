// AI 응답 품질 평점 UI — 👍/👎 버튼
import { useState } from 'react'

/**
 * @param {{ messageId: string, feedback: string|null, onFeedback: (id: string, value: string) => void }} props
 */
export default function FeedbackButtons({ messageId, feedback, onFeedback }) {
  const [clicked, setClicked] = useState(null)
  const current = feedback ?? clicked

  function handleClick(value) {
    if (current) return
    setClicked(value)
    onFeedback(messageId, value)
  }

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <button
        onClick={() => handleClick('helpful')}
        disabled={!!current}
        title="도움됐어요"
        className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
          current === 'helpful'
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-40 disabled:cursor-default'
        }`}
      >
        👍
      </button>
      <button
        onClick={() => handleClick('unhelpful')}
        disabled={!!current}
        title="별로예요"
        className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
          current === 'unhelpful'
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-default'
        }`}
      >
        👎
      </button>
    </div>
  )
}
