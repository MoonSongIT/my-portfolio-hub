import { Link } from 'react-router-dom'

/**
 * @param {{ title: string, description?: string, action?: { label: string, href: string } }} props
 */
export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
      )}
      {action && (
        <Link
          to={action.href}
          className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
