// 이벤트 카테고리 배지 컴포넌트 및 카테고리 색상 맵

export const CATEGORY_COLORS = {
  earnings: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', fc: '#3b82f6', label: '실적' },
  dividend: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', fc: '#10b981', label: '배당' },
  ipo:      { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', fc: '#f59e0b', label: 'IPO' },
  economic: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', fc: '#8b5cf6', label: '경제' },
  custom:   { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', fc: '#6b7280', label: '기타' },
}

export default function EventBadge({ category }) {
  const c = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.custom
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
