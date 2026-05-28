// 관리자 전용 — 사용자 역할 조회 및 관리 UI
import { useState, useEffect } from 'react'
import { Shield, ShieldOff, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fetchAdminUsers, updateUserRole } from '@/utils/adminApi'

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
        <Shield className="w-3 h-3" />
        관리자
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      일반
    </span>
  )
}

export default function UserRoleManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(null)  // 변경 중인 userId

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchAdminUsers()
      setUsers(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const label = newRole === 'admin' ? '관리자 지정' : '관리자 해제'
    setUpdating(user.id)
    try {
      await updateUserRole(user.id, newRole)
      setUsers(prev => prev.map(u =>
        u.id === user.id
          ? { ...u, role: newRole, grantedAt: newRole === 'admin' ? new Date().toISOString() : null }
          : u
      ))
      toast.success(`${user.email} — ${label} 완료`)
    } catch (err) {
      toast.error(`${label} 실패: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500" />
          <p className="font-medium text-gray-900 dark:text-white">사용자 역할 관리</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          title="새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-4 text-center text-sm text-gray-400">불러오는 중...</div>
      )}

      {!loading && !error && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {users.length === 0 && (
            <p className="py-4 text-sm text-center text-gray-400">사용자 없음</p>
          )}
          {users.map(user => (
            <div key={user.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{user.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                  {user.lastSignIn && ` · 최근: ${new Date(user.lastSignIn).toLocaleDateString('ko-KR')}`}
                </p>
              </div>
              <RoleBadge role={user.role} />
              <button
                onClick={() => handleToggle(user)}
                disabled={updating === user.id}
                className={[
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50',
                  user.role === 'admin'
                    ? 'border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                ].join(' ')}
              >
                {user.role === 'admin'
                  ? <><ShieldOff className="w-3 h-3" />&nbsp;해제</>
                  : <><Shield className="w-3 h-3" />&nbsp;지정</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
