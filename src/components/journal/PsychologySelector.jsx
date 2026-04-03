import { BUY_PSYCHOLOGY, SELL_PSYCHOLOGY } from '../../store/journalStore'

export default function PsychologySelector({ action, value, onChange }) {
  const options = action === 'buy' ? BUY_PSYCHOLOGY : SELL_PSYCHOLOGY

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            value === option
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
