import { Link, useLocation } from 'react-router-dom'
import { Home, Briefcase, Search, Eye, BarChart3 } from 'lucide-react'

export default function Sidebar() {
  const location = useLocation()

  const menu = [
    { label: '대시보드', path: '/', icon: Home },
    { label: '포트폴리오', path: '/portfolio', icon: Briefcase },
    { label: '종목 탐색', path: '/research', icon: Search },
    { label: '관심종목', path: '/watchlist', icon: Eye },
    { label: '리포트', path: '/reports', icon: BarChart3 },
  ]

  return (
    <aside className="w-64 bg-gray-900 text-white p-6 shadow-lg">
      <div className="mb-8">
        <h2 className="text-lg font-bold">Portfolio Hub</h2>
      </div>
      <nav className="space-y-2">
        {menu.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
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
  )
}
