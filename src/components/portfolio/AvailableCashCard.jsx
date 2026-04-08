import { useState, useMemo } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertCircle } from 'lucide-react'
import { useCashFlowStore } from '../../store/cashFlowStore'
import { useJournalStore } from '../../store/journalStore'
import { useUserAccounts } from '../../store/accountStore'
import { formatCurrency, formatCurrencyShort } from '../../utils/formatters'
import CashFlowModal from './CashFlowModal'

export default function AvailableCashCard({ accountId = 'all', compact = false }) {
  // 상태 직접 구독 — 변경 시 재렌더링 보장
  const cashFlows = useCashFlowStore(s => s.cashFlows)
  const entries   = useJournalStore(s => s.entries)
  const { getTotalDeposit, getTotalWithdrawal, getAvailableCash } = useCashFlowStore()
  const { computeHoldings, computeAllHoldings } = useJournalStore()
  const accounts = useUserAccounts()

  const [modalOpen, setModalOpen]   = useState(false)
  const [modalType, setModalType]   = useState('deposit')

  // 계좌명 표시
  const accountLabel = useMemo(() => {
    if (accountId === 'all') return '전체 계좌'
    const account = accounts.find(a => a.id === accountId)
    return account ? account.name : '선택된 계좌'
  }, [accountId, accounts])

  // 현재 보유 종목 매수 원가 합산 — entries/cashFlows 변경 시 재계산
  const holdingsTotalCost = useMemo(() => {
    if (accountId === 'all') {
      return computeAllHoldings().reduce((sum, h) => sum + (h.totalCost || 0), 0)
    }
    return computeHoldings(accountId).reduce((sum, h) => sum + (h.totalCost || 0), 0)
  }, [accountId, entries])

  const totalDeposit    = useMemo(() => getTotalDeposit(accountId),                    [accountId, cashFlows])
  const totalWithdrawal = useMemo(() => getTotalWithdrawal(accountId),                 [accountId, cashFlows])
  const availableCash   = useMemo(() => getAvailableCash(accountId, holdingsTotalCost),[accountId, cashFlows, holdingsTotalCost])
  const isNegative      = availableCash < 0

  const openModal = (type) => {
    setModalType(type)
    setModalOpen(true)
  }

  // 간소화 버전 (Dashboard용)
  if (compact) {
    return (
      <>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Wallet size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">투자 가능 금액</span>
            </div>
            {isNegative && <AlertCircle size={16} className="text-red-500" />}
          </div>
          <p className={`text-xl font-bold ${isNegative ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {formatCurrencyShort(availableCash)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{accountLabel}</p>
        </div>
        <CashFlowModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          defaultType={modalType}
          defaultAccountId={accountId === 'all' ? '' : accountId}
        />
      </>
    )
  }

  // 전체 버전
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">자금 현황</h3>
            <span className="text-xs text-gray-400">— {accountLabel}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openModal('deposit')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
            >
              <ArrowDownCircle size={14} />
              입금
            </button>
            <button
              onClick={() => openModal('withdrawal')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition"
            >
              <ArrowUpCircle size={14} />
              출금
            </button>
          </div>
        </div>

        {/* KPI 4개 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-700">
          <KpiItem
            label="총 입금액"
            value={formatCurrency(totalDeposit)}
            icon={<ArrowDownCircle size={14} className="text-blue-500" />}
          />
          <KpiItem
            label="총 출금액"
            value={formatCurrency(totalWithdrawal)}
            icon={<ArrowUpCircle size={14} className="text-orange-400" />}
          />
          <KpiItem
            label="현재 투자금"
            value={formatCurrency(holdingsTotalCost)}
            icon={<TrendingUp size={14} className="text-purple-500" />}
          />
          <KpiItem
            label="투자 가능 금액"
            value={formatCurrency(availableCash)}
            icon={<Wallet size={14} className={isNegative ? 'text-red-500' : 'text-green-500'} />}
            highlight
            negative={isNegative}
          />
        </div>

        {/* 잔고 부족 경고 */}
        {isNegative && (
          <div className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">
              투자 가능 금액이 부족합니다. 입금 후 매매를 진행해주세요.
            </p>
          </div>
        )}
      </div>

      <CashFlowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultType={modalType}
        defaultAccountId={accountId === 'all' ? '' : accountId}
      />
    </>
  )
}

function KpiItem({ label, value, icon, highlight = false, negative = false }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-base font-bold truncate ${
        highlight
          ? negative
            ? 'text-red-500'
            : 'text-blue-600 dark:text-blue-400'
          : 'text-gray-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}
