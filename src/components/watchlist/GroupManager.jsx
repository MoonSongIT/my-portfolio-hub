// 관심종목 태그(그룹) CRUD UI — 색상 선택 + 인라인 이름 수정
import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useWatchlistStore } from '../../store/watchlistStore'

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
]

export default function GroupManager() {
  const { groups, addGroup, renameGroup, removeGroup } = useWatchlistStore()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  const handleAdd = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    addGroup(trimmed, newColor)
    setNewName('')
    setNewColor(PRESET_COLORS[0])
  }

  const startEdit = (group) => {
    setEditingId(group.id)
    setEditingName(group.name)
  }

  const commitEdit = () => {
    const trimmed = editingName.trim()
    if (trimmed) renameGroup(editingId, trimmed)
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const atLimit = groups.length >= 10

  return (
    <div className="space-y-4">
      {/* 태그 목록 */}
      <div className="space-y-2">
        {groups.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">
            태그가 없습니다. 아래에서 추가하세요.
          </p>
        )}
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            {/* 색상 칩 */}
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.color }}
            />

            {/* 이름 또는 인라인 수정 */}
            {editingId === group.id ? (
              <Input
                className="h-6 text-sm flex-1 py-0 px-1"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{group.name}</span>
            )}

            {/* 액션 버튼 */}
            {editingId === group.id ? (
              <>
                <button onClick={commitEdit} className="p-1 text-emerald-500 hover:text-emerald-600">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(group)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="이름 수정"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeGroup(group.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="태그 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 태그 추가 폼 */}
      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          새 태그 {atLimit && <span className="text-red-400">(최대 10개)</span>}
        </p>

        {/* 색상 선택 */}
        <div className="flex gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setNewColor(color)}
              className={`w-6 h-6 rounded-full transition-transform ${
                newColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !atLimit && handleAdd()}
            placeholder="태그 이름"
            className="h-8 text-sm"
            disabled={atLimit}
            maxLength={20}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={atLimit || !newName.trim()}
            className="gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </Button>
        </div>
      </div>
    </div>
  )
}
