// 매매 심리 카테고리 선택 UI — 그룹별 정렬, 이모지, 호버 힌트 팝업
import { useMemo, useState } from 'react'
import { getGroupedPsychology } from '../../utils/psychologyHelper'

export default function PsychologySelector({ action, value, onChange }) {
  const groups = useMemo(() => getGroupedPsychology(action), [action])
  const [hoveredCat, setHoveredCat] = useState(null)

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

          <div className="grid grid-cols-2 gap-1.5">
            {group.categories.map((cat) => (
              <div key={cat.value} className="relative">
                <button
                  type="button"
                  onClick={() => onChange(cat.value)}
                  onMouseEnter={() => setHoveredCat(cat.value)}
                  onMouseLeave={() => setHoveredCat(null)}
                  aria-label={`${cat.label}: ${cat.hint}`}
                  aria-pressed={value === cat.value}
                  className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-left text-sm font-medium ${
                    value === cat.value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 text-gray-800 dark:text-gray-100'
                  }`}
                >
                  {cat.label}
                </button>

                {hoveredCat === cat.value && (
                  <div className="absolute top-full left-0 mt-1 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
                    <div className="relative px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
                      {cat.hint}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
