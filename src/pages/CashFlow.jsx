import { useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Pencil, Building2 } from 'lucide-react'
import { useAccountStore, useUserAccounts, ACCOUNT_TYPES } from '../store/accountStore'
import AccountSelector from '../components/account/AccountSelector'
import AccountSetupModal from '../components/account/AccountSetupModal'
import AvailableCashCard from '../components/portfolio/AvailableCashCard'
import CashFlowHistory from '../components/portfolio/CashFlowHistory'
import CashFlowModal from '../components/portfolio/CashFlowModal'

const DATE_FILTERS = [
  { value: 'all',        label: '전체' },
  { value: 'this_month', label: '이번달' },
  { value: '3month',     label: '3개월' },
]

// 계좌 유형 배지 색상
const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ETC: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function CashFlow() {
  const accounts = useUserAccounts()
  const [selectedAccountId, setSelectedAccountId] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('deposit')
  const [accountModalOpen, setAccountModalOpen] = useState(false)

  const openModal = (type) => {
    setModalType(type)
    setModalOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Wallet size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">자금 관리</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">계좌별 입출금 및 투자 가능 금액</p>
          </div>
        </div>

        {/* 입금 / 출금 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => openModal('deposit')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition"
          >
            <ArrowDownCircle size={16} />
            <span className="hidden sm:inline">입금</span>
          </button>
          <button
            onClick={() => openModal('withdrawal')}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition"
          >
            <ArrowUpCircle size={16} />
            <span className="hidden sm:inline">출금</span>
          </button>
        </div>
      </div>

      {/* 계좌 선택 + 선택된 계좌 정보 카드 */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <AccountSelector
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          showAllOption={true}
          onAddClick={() => setAccountModalOpen(true)}
        />

        {/* 선택된 단일 계좌 정보 카드 */}
        {selectedAccountId !== 'all' && (() => {
          const acc = accounts.find(a => a.id === selectedAccountId)
          if (!acc) return null
          const typeName = ACCOUNT_TYPES.find(t => t.code === acc.type)?.name ?? acc.type
          return (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm min-w-0">
              <Building2 size={16} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{acc.name}</span>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLOR[acc.type] || TYPE_COLOR.ETC}`}>
                    {typeName}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {[acc.broker, acc.currency].filter(Boolean).join(' · ')}
                  {acc.memo && <span className="ml-1 italic">{acc.memo}</span>}
                </p>
              </div>
              <button
                onClick={() => setAccountModalOpen(true)}
                className="ml-auto shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="계좌 수정"
              >
                <Pencil size={13} />
              </button>
            </div>
          )
        })()}
      </div>

      {/* 투자 가능 금액 KPI 카드 */}
      <AvailableCashCard accountId={selectedAccountId} />

      {/* 입출금 내역 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* 내역 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">입출금 내역</h3>
          {/* 날짜 필터 탭 */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {DATE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  dateFilter === f.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <CashFlowHistory
          accountId={selectedAccountId}
          dateFilter={dateFilter}
        />
      </div>

      {/* 계좌 없을 때 안내 */}
      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
          <Wallet size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 계좌가 없습니다.</p>
          <p className="text-xs mt-1 mb-4">계좌를 추가하면 입출금 내역을 관리할 수 있습니다.</p>
          <button
            onClick={() => setAccountModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border border-dashed border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Plus size={15} />
            계좌 추가하기
          </button>
        </div>
      )}

      {/* 계좌 추가 모달 */}
      <AccountSetupModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />

      {/* 입출금 모달 */}
      <CashFlowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultType={modalType}
        defaultAccountId={selectedAccountId === 'all' ? '' : selectedAccountId}
      />
    </div>
  )
}
