// 빠른 질문 버튼 컴포넌트
import { Search, Briefcase, Bell, BarChart3 } from 'lucide-react'

const QUICK_PROMPTS = [
  {
    label: '종목 분석',
    prompt: '삼성전자 종합 분석해줘',
    icon: Search,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: '포트폴리오 현황',
    prompt: '내 포트폴리오 현황을 분석해줘',
    icon: Briefcase,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    label: '오늘 브리핑',
    prompt: '오늘 관심종목 시장 브리핑해줘',
    icon: Bell,
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: '성과 리포트',
    prompt: '이번달 투자 성과 리포트 만들어줘',
    icon: BarChart3,
    color: 'text-purple-600 dark:text-purple-400',
  },
]

/**
 * 빠른 질문 버튼 4개
 * @param {{ onSelect: (prompt: string) => void }} props
 */
export default function QuickPromptButtons({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {QUICK_PROMPTS.map(({ label, prompt, icon: Icon, color }) => (
        <button
          key={label}
          onClick={() => onSelect(prompt)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <Icon className={`h-4 w-4 shrink-0 ${color}`} />
          <span className="text-gray-700 dark:text-gray-300">{label}</span>
        </button>
      ))}
    </div>
  )
}
