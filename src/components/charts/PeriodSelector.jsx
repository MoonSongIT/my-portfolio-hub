/**
 * 차트 기간 선택 컴포넌트
 * 1M | 3M | 6M | 1Y | ALL 버튼 — 차트 visible range 제어용
 */
const PERIODS = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
]

export default function PeriodSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="기간 선택">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          aria-pressed={value === p.value}
          className={[
            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
            value === p.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
          ].join(' ')}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
