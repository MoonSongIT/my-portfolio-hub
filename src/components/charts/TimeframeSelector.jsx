/**
 * 타임프레임 선택 컴포넌트
 * 1D / 1W / 1M / 3M / 1Y 버튼
 */
const TIMEFRAMES = [
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '1Y', value: '1Y' },
]

export default function TimeframeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="타임프레임 선택">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          aria-pressed={value === tf.value}
          className={[
            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
            value === tf.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
          ].join(' ')}
        >
          {tf.label}
        </button>
      ))}
    </div>
  )
}
