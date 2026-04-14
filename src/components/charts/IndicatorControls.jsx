/**
 * 기술 지표 토글 컨트롤 컴포넌트
 * 볼린저밴드 / RSI / MACD on/off 토글
 */
const INDICATORS = [
  { key: 'bb', label: 'BB', title: '볼린저밴드' },
  { key: 'rsi', label: 'RSI', title: 'RSI(14)' },
  { key: 'macd', label: 'MACD', title: 'MACD(12,26,9)' },
]

/**
 * @param {Object} props
 * @param {{ bb: boolean, rsi: boolean, macd: boolean }} props.active - 활성화 상태
 * @param {(key: string, value: boolean) => void} props.onToggle - 토글 핸들러
 */
export default function IndicatorControls({ active, onToggle }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="지표 선택">
      <span className="text-xs text-gray-400 mr-1">지표</span>
      {INDICATORS.map(({ key, label, title }) => (
        <button
          key={key}
          onClick={() => onToggle(key, !active[key])}
          title={title}
          aria-pressed={active[key]}
          className={[
            'px-2.5 py-1 text-xs font-medium rounded border transition-colors',
            active[key]
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
