// 매매 심리 카테고리 선택 UI — 그룹별 정렬, 이모지, 힌트 텍스트 포함
import { useMemo } from 'react'
import { getGroupedPsychology } from '../../utils/psychologyHelper'

export default function PsychologySelector({ action, value, onChange }) {
  const groups = useMemo(() => getGroupedPsychology(action), [action])

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.groupKey}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50"
        >
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <span>{group.emoji}</span>
            <span>{group.groupName}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {group.categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => onChange(cat.value)}
                title={`${cat.label} — ${cat.hint}`}
                aria-label={`${cat.label}: ${cat.hint}`}
                aria-pressed={value === cat.value}
                className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                  value === cat.value
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                <div className={`text-sm font-medium ${
                  value === cat.value
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-800 dark:text-gray-100'
                }`}>
                  {cat.label}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {cat.hint}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
