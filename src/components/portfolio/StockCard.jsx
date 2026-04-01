import { X } from 'lucide-react'
import { formatCurrency, formatPercent } from '../../utils/formatters'

export default function StockCard({ stock, onRemove }) {
  const isPositive = (stock.change || 0) >= 0

  return (
    <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      {onRemove && (
        <button
          onClick={() => onRemove(stock.ticker)}
          className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
          title="삭제"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="mb-2">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{stock.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{stock.ticker} · {stock.market}</p>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(stock.currentPrice, stock.currency)}
        </p>
        {stock.change !== undefined && (
          <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatPercent(stock.change)}
          </span>
        )}
      </div>
    </div>
  )
}
