import { Link, useLocation } from 'react-router-dom'
import { Home, Briefcase, Search, Eye, BarChart3, Bot, X } from 'lucide-react'

const menu = [
  { label: '대시보드', path: '/', icon: Home },
  { label: '포트폴리오', path: '/portfolio', icon: Briefcase },
  { label: '종목 탐색', path: '/research', icon: Search },
  { label: '관심종목', path: '/watchlist', icon: Eye },
  { label: '리포트', path: '/reports', icon: BarChart3 },
  { label: 'AI 분석', path: '/ai-chat', icon: Bot },
]

export default function Sidebar({ open, onClose }) {
  const location = useLocation()

  return (
    <>
      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 text-white p-6 shadow-lg
        transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold">Portfolio Hub</h2>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-2">
          {menu.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
