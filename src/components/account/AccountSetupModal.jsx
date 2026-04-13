import { useState } from 'react'
import { useAccountStore, useUserAccounts, ACCOUNT_TYPES } from '../../store/accountStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Pencil, Trash2, Plus, Building2, ArrowLeft } from 'lucide-react'

// 통화 옵션
const CURRENCIES = [
  { code: 'KRW', name: '원화 (KRW)' },
  { code: 'USD', name: '달러 (USD)' },
]

// 계좌 유형 배지 색상
const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ETC: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
}

// 빈 폼 초기값
const EMPTY_FORM = {
  name: '',
  broker: '',
  type: 'GENERAL',
  currency: 'KRW',
  memo: '',
}

/**
 * 계좌 관리 모달 (생성 / 수정 / 삭제)
 *
 * @param {boolean}  open     - 모달 열림 여부
 * @param {function} onClose  - 모달 닫기 콜백
 */
export default function AccountSetupModal({ open, onClose }) {
  const { addAccount, updateAccount, deleteAccount } = useAccountStore()
  const accounts = useUserAccounts()

  // mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState({})

  // ─── 폼 헬퍼 ───

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setEditingId(null)
  }

  const goToList = () => {
    resetForm()
    setMode('list')
  }

  const goToAdd = () => {
    resetForm()
    setMode('add')
  }

  const goToEdit = (account) => {
    setForm({
      name: account.name,
      broker: account.broker || '',
      type: account.type || 'GENERAL',
      currency: account.currency || 'KRW',
      memo: account.memo || '',
    })
    setEditingId(account.id)
    setErrors({})
    setMode('edit')
  }

  const handleClose = () => {
    goToList()
    onClose?.()
  }

  // ─── 유효성 검사 ───

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = '계좌 이름은 필수입니다'
    if (!form.type) errs.type = '계좌 유형을 선택하세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ─── 저장 ───

  const handleSave = () => {
    if (!validate()) return

    if (mode === 'add') {
      addAccount({
        name: form.name.trim(),
        broker: form.broker.trim(),
        type: form.type,
        currency: form.currency,
        memo: form.memo.trim(),
      })
    } else if (mode === 'edit' && editingId) {
      updateAccount(editingId, {
        name: form.name.trim(),
        broker: form.broker.trim(),
        type: form.type,
        currency: form.currency,
        memo: form.memo.trim(),
      })
    }

    goToList()
  }

  // ─── 삭제 ───

  const handleDelete = (id, accountName) => {
    if (!window.confirm(`'${accountName}' 계좌를 삭제하시겠습니까?\n\n⚠️ 계좌만 삭제되며, 기존 매매 기록은 유지됩니다.`)) {
      return
    }
    deleteAccount(id)
  }

  // ─── 유형 이름 ───

  const typeName = (code) =>
    ACCOUNT_TYPES.find((t) => t.code === code)?.name ?? code

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode !== 'list' && (
              <button
                onClick={goToList}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            {mode === 'list' && '계좌 관리'}
            {mode === 'add' && '새 계좌 추가'}
            {mode === 'edit' && '계좌 수정'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'list' && '투자 계좌를 추가하고 관리하세요.'}
            {mode === 'add' && '새로운 증권 계좌 정보를 입력하세요.'}
            {mode === 'edit' && '계좌 정보를 수정하세요.'}
          </DialogDescription>
        </DialogHeader>

        {/* ─── 계좌 목록 모드 ─── */}
        {mode === 'list' && (
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="size-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">등록된 계좌가 없습니다.</p>
                <p className="text-xs mt-1">아래 버튼을 눌러 첫 계좌를 추가하세요.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {acc.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLOR[acc.type] || TYPE_COLOR.ETC}`}
                        >
                          {typeName(acc.type)}
                        </span>
                      </div>
                      {acc.broker && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {acc.broker} · {acc.currency}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => goToEdit(acc)}
                        title="수정"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(acc.id, acc.name)}
                        title="삭제"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 하단: 추가 버튼 */}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                닫기
              </Button>
              <Button onClick={goToAdd}>
                <Plus className="size-4" data-icon="inline-start" />
                계좌 추가
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── 추가 / 수정 폼 ─── */}
        {(mode === 'add' || mode === 'edit') && (
          <div className="space-y-4">
            {/* 계좌 이름 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                계좌 이름 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="예: 키움 주식계좌"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* 증권사 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">증권사</label>
              <Input
                placeholder="예: 키움증권"
                value={form.broker}
                onChange={(e) => setForm({ ...form, broker: e.target.value })}
              />
            </div>

            {/* 계좌 유형 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                계좌 유형 <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm({ ...form, type: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name} — {t.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs text-destructive">{errors.type}</p>
              )}
            </div>

            {/* 통화 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                기본 통화 <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setForm({ ...form, currency: c.code })}
                    className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                      form.currency === c.code
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">메모</label>
              <Input
                placeholder="메모 (선택사항)"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </div>

            {/* 하단 버튼 */}
            <DialogFooter>
              <Button variant="outline" onClick={goToList}>
                취소
              </Button>
              <Button onClick={handleSave}>
                {mode === 'add' ? '추가' : '저장'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
