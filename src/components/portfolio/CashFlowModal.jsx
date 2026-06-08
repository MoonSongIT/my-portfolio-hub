import { useState, useEffect } from 'react'
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useCashFlowStore, DEPOSIT_CATEGORIES, WITHDRAWAL_CATEGORIES } from '../../store/cashFlowStore'
// 자금 입출금 등록·수정 모달 (editTarget 전달 시 수정 모드)
import { useUserAccounts } from '../../store/accountStore'
import { formatNumber } from '../../utils/formatters'

// 카테고리별 부가 설명
const CATEGORY_DESC = {
  investment_in:  '수익률 계산에 포함',
  realized_gain:  '실현손익으로 집계 (분모 제외)',
  dividend:       '배당 수익으로 집계',
  interest:       '수익률 분모 제외',
  adjust_plus:    '수익률 분모 제외',
  investment_out: '수익률 계산에 포함',
  fee_tax:        '수익률 분모 제외',
  adjust_minus:   '수익률 분모 제외',
}

// defaultType: 'deposit' | 'withdrawal'
// defaultAccountId: 특정 계좌 미리 선택
// editTarget: 수정 대상 cashFlow 객체 (있으면 수정 모드)
export default function CashFlowModal({ open, onClose, defaultType = 'deposit', defaultAccountId = '', editTarget = null }) {
  const { addCashFlow, updateCashFlow } = useCashFlowStore()
  const accounts = useUserAccounts()
  const isEdit = !!editTarget

  const [type, setType]           = useState(defaultType)
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '')
  const [category, setCategory]   = useState('')
  const [amount, setAmount]       = useState('')
  const [currency, setCurrency]   = useState('KRW')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [memo, setMemo]           = useState('')
  const [error, setError]         = useState('')

  // 모달이 열릴 때 초기값 동기화 — 수정 모드면 editTarget 값으로 채움
  useEffect(() => {
    if (!open) return
    setError('')
    if (editTarget) {
      setType(editTarget.type || 'deposit')
      setAccountId(editTarget.accountId || accounts[0]?.id || '')
      setCategory(editTarget.category || '')
      setAmount(editTarget.amount != null ? String(editTarget.amount) : '')
      setCurrency(editTarget.currency || 'KRW')
      setDate(editTarget.date || new Date().toISOString().split('T')[0])
      setMemo(editTarget.memo || '')
    } else {
      setType(defaultType)
      setAccountId(defaultAccountId || accounts[0]?.id || '')
      setCategory('')
      setAmount('')
      setMemo('')
      setDate(new Date().toISOString().split('T')[0])
    }
  }, [open, defaultType, defaultAccountId, editTarget])

  // 입금 ↔ 출금 탭을 직접 누를 때만 카테고리 초기화 (handleTypeChange에서 처리)
  const handleTypeChange = (next) => {
    setType(next)
    setCategory('')
  }

  // 계좌 통화에 맞춰 currency 자동 설정
  useEffect(() => {
    const account = accounts.find(a => a.id === accountId)
    if (account) setCurrency(account.currency || 'KRW')
  }, [accountId, accounts])

  if (!open) return null

  const handleAmountChange = (e) => {
    // 숫자만 허용
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setAmount(raw)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!accountId) { setError('계좌를 선택해주세요.'); return }
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) { setError('금액을 올바르게 입력해주세요.'); return }
    if (!date) { setError('날짜를 입력해주세요.'); return }

    const payload = { accountId, type, category: category || undefined, amount: numAmount, currency, date, memo }
    if (isEdit) {
      updateCashFlow(editTarget.id, payload)
    } else {
      addCashFlow(payload)
    }
    onClose()
  }

  const amountDisplay = amount ? formatNumber(Number(amount)) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEdit ? '입출금 수정' : '자금 입출금'}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 입금 / 출금 탭 */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('deposit')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
                type === 'deposit'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ArrowDownCircle size={16} />
              입금
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('withdrawal')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
                type === 'withdrawal'
                  ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ArrowUpCircle size={16} />
              출금
            </button>
          </div>

          {/* 계좌 선택 */}
          <div>
            <label htmlFor="cashflow-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계좌</label>
            <select
              id="cashflow-account"
              name="accountId"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.length === 0 && <option value="">계좌 없음</option>}
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.broker || a.type})</option>
              ))}
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label htmlFor="cashflow-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
            <select
              id="cashflow-category"
              name="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {(type === 'deposit' ? DEPOSIT_CATEGORIES : WITHDRAWAL_CATEGORIES).map(cat => (
                <option key={cat.code} value={cat.code}>
                  {cat.label} — {CATEGORY_DESC[cat.code]}
                </option>
              ))}
            </select>
          </div>

          {/* 금액 */}
          <div>
            <label htmlFor="cashflow-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">금액</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="cashflow-amount"
                  type="text"
                  name="amount"
                  inputMode="numeric"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  {currency}
                </span>
              </div>
              <select
                id="cashflow-currency"
                name="currency"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="KRW">KRW</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* 날짜 */}
          <div>
            <label htmlFor="cashflow-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">날짜</label>
            <input
              id="cashflow-date"
              type="date"
              name="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label htmlFor="cashflow-memo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">메모 (선택)</label>
            <input
              id="cashflow-memo"
              type="text"
              name="memo"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 급여 입금, 생활비 출금 등"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* 저장 버튼 */}
          <button
            type="submit"
            className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition ${
              type === 'deposit'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {isEdit ? '수정 저장' : (type === 'deposit' ? '입금 저장' : '출금 저장')}
          </button>
        </form>
      </div>
    </div>
  )
}
