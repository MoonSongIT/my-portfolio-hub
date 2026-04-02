// 에이전트 타입 배지 컴포넌트
import { AGENT_LABELS } from '../../agents/orchestrator'

const COLOR_MAP = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

/**
 * 에이전트 타입에 따른 색상 배지
 * @param {{ agentType: string }} props
 */
export default function AgentBadge({ agentType }) {
  const info = AGENT_LABELS[agentType]
  if (!info) return null

  const colorClass = COLOR_MAP[info.color] || COLOR_MAP.blue

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </span>
  )
}
