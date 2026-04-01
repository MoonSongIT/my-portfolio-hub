import { usePortfolioStore } from '../../store/portfolioStore'
import { ACCOUNT_TYPES } from '../../data/samplePortfolio'

// 계좌 유형 코드 → 배지 색상
const TYPE_COLOR = {
  GENERAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IRP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ISA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENSION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export default function AccountSelector() {
  const { accounts, selectedAccountId, selectAccount } = usePortfolioStore()

  if (accounts.length === 0) return null

  const typeName = (code) => ACCOUNT_TYPES.find(t => t.code === code)?.name ?? code

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">계좌 선택:</span>
      <div className="flex gap-1.5 flex-wrap">
        {/* 전체 버튼 */}
        <button
          onClick={() => selectAccount('all')}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            selectedAccountId === 'all'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          }`}
        >
          전체 ({accounts.length}계좌)
        </button>

        {/* 개별 계좌 버튼 */}
        {accounts.map(acc => (
          <button
            key={acc.id}
            onClick={() => selectAccount(acc.id)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
              selectedAccountId === acc.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {acc.accountName}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              selectedAccountId === acc.id
                ? 'bg-white/20 text-white'
                : TYPE_COLOR[acc.accountType]
            }`}>
              {typeName(acc.accountType)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
