import { useAccountStore, ACCOUNT_TYPES } from '../../store/accountStore'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Landmark, Plus } from 'lucide-react'

// 계좌 유형 코드 → 배지 색상
const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ETC: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
}

/**
 * 계좌 선택 드롭다운 (shadcn/ui Select 기반)
 *
 * @param {string}   value      - 현재 선택된 계좌 ID ('all' | accountId)
 * @param {function} onChange   - 선택 변경 콜백 (accountId) => void
 * @param {function} [onAddClick] - "새 계좌 추가" 클릭 콜백 (선택)
 * @param {boolean}  [showAllOption=true] - "전체" 옵션 표시 여부
 * @param {string}   [className] - 추가 CSS 클래스
 */
export default function AccountSelector({
  value = 'all',
  onChange,
  onAddClick,
  showAllOption = true,
  className = '',
}) {
  const accounts = useAccountStore((state) => state.accounts)

  const typeName = (code) =>
    ACCOUNT_TYPES.find((t) => t.code === code)?.name ?? code

  // 계좌가 없을 때
  if (accounts.length === 0) {
    return (
      <button
        onClick={onAddClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${className}`}
      >
        <Plus className="size-3.5" />
        계좌를 먼저 추가해주세요
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Landmark className="size-4 text-gray-400 dark:text-gray-500 shrink-0" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {/* 전체 옵션 */}
          {showAllOption && (
            <>
              <SelectItem value="all">
                전체 ({accounts.length}계좌)
              </SelectItem>
              <SelectSeparator />
            </>
          )}

          {/* 개별 계좌 */}
          <SelectGroup>
            <SelectLabel>내 계좌</SelectLabel>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                <span className="flex items-center gap-2">
                  {acc.name}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium leading-none ${TYPE_COLOR[acc.type] || TYPE_COLOR.ETC}`}
                  >
                    {typeName(acc.type)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>

          {/* 계좌 추가 버튼 */}
          {onAddClick && (
            <>
              <SelectSeparator />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddClick()
                }}
                className="flex w-full items-center gap-1.5 px-1.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <Plus className="size-3.5" />
                새 계좌 추가
              </button>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
