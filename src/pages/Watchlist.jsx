import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, LayoutGrid, List, ExternalLink, RefreshCw, Bot, Bell,
  TrendingUp, TrendingDown, Pencil, Check, X, SlidersHorizontal, Tags,
  Download, GripVertical, ChevronDown,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { useWatchlistStore } from '../store/watchlistStore'
import { useBatchQuotes, useStockSearch, useWatchlistSparklines } from '../hooks/useStockData'
import { useDebounce } from '../hooks/useDebounce'
import { formatCurrency, formatPercent } from '../utils/formatters'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'
import ChatPanel from '../components/chat/ChatPanel'
import AlarmDialog from '../components/watchlist/AlarmDialog'
import GroupManager from '../components/watchlist/GroupManager'
import TargetPriceBar from '../components/watchlist/TargetPriceBar'
import AlertHistoryDrawer from '../components/watchlist/AlertHistoryDrawer'
import Sparkline from '../components/watchlist/Sparkline'

// ── 등락률 긴급/주의 배지 ──────────────────────────────────────
function AlertBadge({ changePercent }) {
  if (changePercent == null) return null
  const abs = Math.abs(changePercent)
  if (abs >= 10) return (
    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
      긴급
    </span>
  )
  if (abs >= 5) return (
    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
      주의
    </span>
  )
  return null
}

// ── 알림 개수 표시 ────────────────────────────────────────────
function AlarmIndicator({ ticker, alerts }) {
  const count = alerts.filter(a => a.ticker === ticker).length
  if (count === 0) return null
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      <Bell className="w-2.5 h-2.5" />
      {count}
    </span>
  )
}

// ── 메모 인라인 편집 ─────────────────────────────────────────
function MemoEditor({ ticker, memo, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memo || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleSave = () => {
    onSave(ticker, draft.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(memo || '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          placeholder="간단한 메모..."
          className="flex-1 text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
          maxLength={80}
        />
        <button onClick={handleSave} className="p-1 text-emerald-600 hover:text-emerald-700">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCancel} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 group w-full text-left"
    >
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      <span className={memo ? 'text-gray-500 dark:text-gray-400' : 'italic'}>
        {memo || '메모 추가...'}
      </span>
    </button>
  )
}

// ── 태그 칩 + 토글 팝오버 ────────────────────────────────────
function TagChipsEditor({ ticker, groupIds, groups, onUpdate }) {
  const [open, setOpen] = useState(false)
  const attached = groupIds ?? []

  const toggle = (gid) => {
    const next = attached.includes(gid)
      ? attached.filter(id => id !== gid)
      : [...attached, gid]
    onUpdate(ticker, next)
  }

  return (
    <div className="relative mt-2 flex flex-wrap items-center gap-1">
      {attached.map(gid => {
        const g = groups.find(gr => gr.id === gid)
        if (!g) return null
        return (
          <span
            key={gid}
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: g.color }}
            onClick={() => toggle(gid)}
            title="클릭하여 제거"
          >
            {g.name}
          </span>
        )
      })}
      {groups.length > 0 && (
        <button
          onClick={() => setOpen(v => !v)}
          className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="태그 추가"
        >
          + 태그
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-6 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 min-w-[130px]">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => { toggle(g.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className={attached.includes(g.id) ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}>
                {g.name}
              </span>
              {attached.includes(g.id) && <Check className="w-3 h-3 ml-auto text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 정렬 옵션 ─────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'change_desc', label: '등락률 ↓' },
  { value: 'change_asc',  label: '등락률 ↑' },
  { value: 'name',        label: '이름 순' },
  { value: 'price_desc',  label: '현재가 ↓' },
  { value: 'added',       label: '추가일 순' },
  { value: 'custom',      label: '수동 정렬 ✦' },
]

// ── 섹터 파이차트 색상 ──────────────────────────────────────────
const SECTOR_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

// ── 추가일 대비 수익률 배지 ───────────────────────────────────
function SinceReturnBadge({ priceAtAdded, currentPrice }) {
  if (!priceAtAdded || !currentPrice || priceAtAdded <= 0) return null
  const pct = ((currentPrice - priceAtAdded) / priceAtAdded) * 100
  const isPos = pct >= 0
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
      isPos
        ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
        : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
    }`}>
      since {isPos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ── 섹터 분포 파이차트 패널 ────────────────────────────────────
function SectorMiniChart({ items }) {
  const [open, setOpen] = useState(false)

  const data = useMemo(() => {
    const counts = {}
    items.forEach(s => {
      const sector = s.sector || '기타'
      counts[sector] = (counts[sector] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [items])

  if (data.length === 0 || items.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750"
      >
        <span>섹터 분포</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4 mt-3">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={55}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v, n) => [`${v}종목`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {data.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                  <span className="text-gray-600 dark:text-gray-400 flex-1 truncate">{d.name}</span>
                  <span className="text-gray-500 dark:text-gray-300 font-medium tabular-nums">{d.value}종목</span>
                  <span className="text-gray-400 tabular-nums">
                    {Math.round(d.value / items.length * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DnD 정렬 가능 카드 래퍼 ───────────────────────────────────
function SortableCard({ id, isDndActive, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isDndActive,
  })
  const style = isDndActive ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  } : {}

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isDndActive && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 p-0.5 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
          title="드래그하여 순서 변경"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
    </div>
  )
}

// ── 시장 필터 탭 ──────────────────────────────────────────────
const MARKET_FILTERS = ['전체', 'KRX', 'KOSDAQ', 'NASDAQ', 'NYSE']

export default function Watchlist() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    watchlist, alerts, groups, alertHistory,
    addToWatchlist, removeFromWatchlist, updateWatchlistMemo,
    updateWatchlistGroups, checkAlerts, addAlertHistory, reorderWatchlist,
  } = useWatchlistStore()

  const [viewMode, setViewMode] = useState('card')
  const [addOpen, setAddOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [alarmStock, setAlarmStock] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  const [sortBy, setSortBy] = useState('change_desc')
  const [marketFilter, setMarketFilter] = useState('전체')
  const [groupFilter, setGroupFilter] = useState(null)
  const [showSortPanel, setShowSortPanel] = useState(false)
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 삭제된 태그가 필터로 선택된 채 남지 않도록 자동 초기화
  useEffect(() => {
    if (groupFilter && !groups.find(g => g.id === groupFilter)) {
      setGroupFilter(null)
    }
  }, [groups])

  // 이미 알림이 발생한 alert id 추적 (중복 toast 방지)
  const firedAlertsRef = useRef(new Set())

  // ── 일괄 시세 조회 ────────────────────────────────────────
  const watchHoldings = useMemo(() =>
    watchlist.map(w => ({ ticker: w.ticker, market: w.market })),
    [watchlist]
  )
  const { data: batchData, isLoading: priceLoading } = useBatchQuotes(watchHoldings)

  // ── 스파크라인 히스토리 (병렬 fetch, 1h 캐시) ─────────────
  const sparklineMap = useWatchlistSparklines(watchlist)

  // ── 실시간 가격 맵 ─────────────────────────────────────────
  const priceMap = useMemo(() => {
    const map = {}
    if (batchData) {
      batchData.forEach(r => {
        if (r.success && r.data) map[r.ticker] = r.data
      })
    }
    return map
  }, [batchData])

  // ── 가격 알림 트리거 체크 ─────────────────────────────────
  useEffect(() => {
    if (!batchData || alerts.length === 0) return
    const triggered = checkAlerts(priceMap)
    triggered.forEach(alert => {
      if (firedAlertsRef.current.has(alert.id)) return
      firedAlertsRef.current.add(alert.id)

      // 알림 이력 기록
      addAlertHistory({
        ticker: alert.ticker,
        name: alert.name,
        condition: alert.condition,
        targetPrice: alert.targetPrice,
        currentPrice: alert.currentPrice,
        currency: alert.currency,
      })

      const icon = alert.condition === 'above' ? '📈' : '📉'
      const condLabel = alert.condition === 'above' ? '이상' : '이하'
      toast.warning(
        `${icon} ${alert.name} 알림 도달`,
        {
          description: `현재가 ${formatCurrency(alert.currentPrice, alert.currency)} — 목표가 ${formatCurrency(alert.targetPrice, alert.currency)} ${condLabel}`,
          duration: 8000,
        }
      )
    })
  }, [priceMap, alerts, batchData, checkAlerts])

  // ── 관심종목 + 실시간 가격 병합 ───────────────────────────
  const enrichedWatchlist = useMemo(() =>
    watchlist.map(w => {
      const live = priceMap[w.ticker]
      return {
        ...w,
        currentPrice: live?.currentPrice ?? w.currentPrice,
        change: live?.changePercent ?? w.change,
        currency: live?.currency ?? w.currency,
      }
    }),
    [watchlist, priceMap]
  )

  // ── 필터 + 정렬 ──────────────────────────────────────────
  const filteredAndSorted = useMemo(() => {
    let list = marketFilter === '전체'
      ? [...enrichedWatchlist]
      : enrichedWatchlist.filter(w => w.market === marketFilter)

    if (groupFilter) {
      list = list.filter(w => (w.groupIds ?? []).includes(groupFilter))
    }

    switch (sortBy) {
      case 'change_desc': list.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity)); break
      case 'change_asc':  list.sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity)); break
      case 'name':        list.sort((a, b) => a.name.localeCompare(b.name, 'ko')); break
      case 'price_desc':  list.sort((a, b) => (b.currentPrice ?? 0) - (a.currentPrice ?? 0)); break
      case 'added':       list.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0)); break
      case 'custom':      /* watchlist 원본 순서 유지 — 정렬 없음 */ break
    }
    return list
  }, [enrichedWatchlist, marketFilter, sortBy])

  // ── 검색 자동완성 ─────────────────────────────────────────
  const { data: searchResults } = useStockSearch(debouncedSearch)

  const handleAddFromSearch = (item) => {
    const alreadyExists = watchlist.some(w => w.ticker === item.ticker)
    if (alreadyExists) {
      toast.warning(`${item.name}은(는) 이미 관심종목에 있습니다.`)
      return
    }
    addToWatchlist({
      ticker: item.ticker,
      name: item.name,
      market: item.market,
      currentPrice: 0,
      change: 0,
      currency: (item.market === 'NYSE' || item.market === 'NASDAQ') ? 'USD' : 'KRW',
      sector: '',
    })
    toast.success(`${item.name} 관심종목 추가`)
    setSearchQuery('')
    setAddOpen(false)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batchQuotes'] })
  }

  const handleOpenAlarm = (stock) => setAlarmStock(stock)

  // ── DnD 센서 (5px 이상 움직여야 드래그 시작) ──────────────
  const isDndActive = sortBy === 'custom'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = watchlist.findIndex(w => w.ticker === active.id)
    const newIdx = watchlist.findIndex(w => w.ticker === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    reorderWatchlist(arrayMove([...watchlist], oldIdx, newIdx))
  }

  // ── CSV 내보내기 ──────────────────────────────────────────
  const handleCsvExport = () => {
    const BOM = '\uFEFF'
    const headers = ['티커', '종목명', '시장', '현재가', '변동률(%)', '추가일', '메모', '목표가', '손절가', '추가후수익률(%)']
    const rows = filteredAndSorted.map(s => {
      const since = (s.priceAtAdded && s.currentPrice && s.priceAtAdded > 0)
        ? ((s.currentPrice - s.priceAtAdded) / s.priceAtAdded * 100).toFixed(2)
        : ''
      return [
        s.ticker, s.name, s.market,
        s.currentPrice || '', s.change != null ? s.change.toFixed(2) : '',
        s.addedAt ? s.addedAt.slice(0, 10) : '',
        s.memo || '', s.targetPrice || '', s.stopLoss || '', since,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = BOM + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `watchlist_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── 마켓별 종목 수 ────────────────────────────────────────
  const marketCounts = useMemo(() => {
    const counts = { 전체: enrichedWatchlist.length }
    MARKET_FILTERS.slice(1).forEach(m => {
      counts[m] = enrichedWatchlist.filter(w => w.market === m).length
    })
    return counts
  }, [enrichedWatchlist])

  return (
    <div className="p-6 space-y-5">
      {/* ── 페이지 헤더 ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">관심종목</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {watchlist.length}종목 모니터링 중
            {alerts.length > 0 && (
              <span className="ml-2 text-blue-500 text-sm">· 알림 {alerts.length}개 활성</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatOpen(true)}
            className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
          >
            <Bot className="w-4 h-4" />
            오늘 브리핑
          </Button>

          {/* 알림 이력 벨 배지 */}
          <button
            onClick={() => setHistoryOpen(true)}
            className="relative p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="알림 이력"
          >
            <Bell className="w-4 h-4" />
            {alertHistory.filter(h => !h.read).length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                {alertHistory.filter(h => !h.read).length > 99 ? '99+' : alertHistory.filter(h => !h.read).length}
              </span>
            )}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupManagerOpen(true)}
            className="gap-1.5 text-gray-600 dark:text-gray-400"
          >
            <Tags className="w-4 h-4" />
            태그 관리
          </Button>

          {/* 정렬 패널 토글 */}
          <div className="relative">
            <button
              onClick={() => setShowSortPanel(v => !v)}
              className={`p-2 rounded-lg border transition-colors ${
                showSortPanel
                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950 dark:border-blue-700'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
              }`}
              title="정렬"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {showSortPanel && (
              <div className="absolute right-0 top-10 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 min-w-[140px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setShowSortPanel(false) }}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      sortBy === opt.value
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredAndSorted.length > 0 && (
            <button
              onClick={handleCsvExport}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="CSV 내보내기"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${priceLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            추가
          </Button>
        </div>
      </div>

      {/* ── 시장 필터 탭 ───────────────────────────────── */}
      {watchlist.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {MARKET_FILTERS.map(m => {
            const count = marketCounts[m] ?? 0
            if (m !== '전체' && count === 0) return null
            return (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  marketFilter === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {m}
                <span className={`ml-1 text-xs ${marketFilter === m ? 'text-blue-100' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 태그 필터 탭 ───────────────────────────────── */}
      {groups.length > 0 && watchlist.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setGroupFilter(null)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              groupFilter === null
                ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            전체 태그
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full border transition-colors ${
                groupFilter === g.id
                  ? 'text-white border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              style={groupFilter === g.id ? { backgroundColor: g.color, borderColor: g.color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* ── 섹터 분포 차트 ─────────────────────────────── */}
      {filteredAndSorted.length > 1 && (
        <SectorMiniChart items={filteredAndSorted} />
      )}

      {/* ── 관심종목 리스트 ─────────────────────────────── */}
      {filteredAndSorted.length === 0 && watchlist.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">관심종목이 없습니다</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
            종목을 추가하여 가격 변동을 모니터링하세요
          </p>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            첫 종목 추가하기
          </Button>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>
            {groupFilter
              ? `선택한 태그에 해당하는 종목이 없습니다`
              : `${marketFilter} 시장에 관심종목이 없습니다`
            }
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* ── 카드 뷰 ──────────────────────────────────── */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredAndSorted.map(s => s.ticker)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSorted.map((stock) => {
                const isPositive = (stock.change ?? 0) >= 0
                const sparkData = sparklineMap[stock.ticker]

                return (
                  <SortableCard key={stock.ticker} id={stock.ticker} isDndActive={isDndActive}>
                    <div
                      className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                {/* 삭제 버튼 */}
                <button
                  onClick={() => removeFromWatchlist(stock.ticker)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-300 hover:text-red-500 text-xs transition-colors"
                  title="삭제"
                >
                  ✕
                </button>

                {/* 종목 정보 헤더 */}
                <div className="flex items-start justify-between pr-5">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight flex items-center">
                      {stock.name}
                      <AlarmIndicator ticker={stock.ticker} alerts={alerts} />
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{stock.ticker} · {stock.market}</p>
                  </div>
                </div>

                {/* 현재가 + 스파크라인 */}
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                      {stock.currentPrice > 0 ? formatCurrency(stock.currentPrice, stock.currency) : '---'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {/* 한국 주식 관례: 상승=빨강, 하락=초록 */}
                  {isPositive
                        ? <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                        : <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      }
                      <span className={`text-sm font-semibold ${isPositive ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stock.change != null ? formatPercent(stock.change) : '---'}
                      </span>
                      <AlertBadge changePercent={stock.change} />
                      <SinceReturnBadge priceAtAdded={stock.priceAtAdded} currentPrice={stock.currentPrice} />
                    </div>
                  </div>

                  {/* 미니 스파크라인 */}
                  <div className="opacity-90">
                    <Sparkline
                      data={sparkData}
                      width={88}
                      height={36}
                      positive={isPositive}
                    />
                  </div>
                </div>

                {/* 메모 */}
                <MemoEditor
                  ticker={stock.ticker}
                  memo={stock.memo}
                  onSave={updateWatchlistMemo}
                />

                {/* 태그 칩 */}
                {groups.length > 0 && (
                  <TagChipsEditor
                    ticker={stock.ticker}
                    groupIds={stock.groupIds}
                    groups={groups}
                    onUpdate={updateWatchlistGroups}
                  />
                )}

                {/* 목표가·손절가 달성률 바 */}
                <TargetPriceBar stock={stock} />

                {/* 하단 액션 */}
                <div className="mt-3 flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/research/${stock.ticker}?market=${stock.market}`)}
                    className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> 상세보기
                  </button>
                  <button
                    onClick={() => handleOpenAlarm(stock)}
                    className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <Bell className="w-3 h-3" />
                    알림 설정
                  </button>
                </div>
                    </div>
                  </SortableCard>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* ── 테이블 뷰 ────────────────────────────────── */
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목명</TableHead>
                  <TableHead className="hidden sm:table-cell">시장</TableHead>
                  <TableHead className="text-right">현재가</TableHead>
                  <TableHead className="text-right">변동률</TableHead>
                  <TableHead className="hidden md:table-cell w-24">추이</TableHead>
                  <TableHead className="hidden lg:table-cell text-right w-24">추가후 변동</TableHead>
                  <TableHead className="text-center w-32">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((stock) => {
                  const isPositive = (stock.change ?? 0) >= 0
                  const sparkData = sparklineMap[stock.ticker]
                  return (
                    <TableRow key={stock.ticker}>
                      <TableCell>
                        <div>
                          <span className="font-medium flex items-center gap-1">
                            {stock.name}
                            <AlarmIndicator ticker={stock.ticker} alerts={alerts} />
                          </span>
                          {stock.memo && (
                            <span className="text-xs text-gray-400 block">{stock.memo}</span>
                          )}
                          {groups.length > 0 && (
                            <TagChipsEditor
                              ticker={stock.ticker}
                              groupIds={stock.groupIds}
                              groups={groups}
                              onUpdate={updateWatchlistGroups}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                        {stock.ticker} · {stock.market}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {stock.currentPrice > 0 ? formatCurrency(stock.currentPrice, stock.currency) : '---'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${isPositive ? 'text-red-500' : 'text-emerald-600'}`}>
                          {stock.change != null ? formatPercent(stock.change) : '---'}
                        </span>
                        <AlertBadge changePercent={stock.change} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Sparkline data={sparkData} width={72} height={28} positive={isPositive} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        <SinceReturnBadge priceAtAdded={stock.priceAtAdded} currentPrice={stock.currentPrice} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/research/${stock.ticker}?market=${stock.market}`)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            상세
                          </button>
                          <button
                            onClick={() => handleOpenAlarm(stock)}
                            className="text-gray-400 hover:text-blue-600 text-xs flex items-center gap-0.5"
                          >
                            <Bell className="w-3 h-3" /> 알림
                          </button>
                          <button
                            onClick={() => removeFromWatchlist(stock.ticker)}
                            className="text-gray-400 hover:text-red-500 text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── 활성 알림 요약 ──────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              활성 가격 알림 ({alerts.length}개)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <span
                key={alert.id}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-gray-700 dark:text-gray-300"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${alert.condition === 'above' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {alert.name} {alert.condition === 'above' ? '↑' : '↓'} {formatCurrency(alert.targetPrice, alert.currency)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 종목 추가 모달 ──────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>관심종목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">종목 검색</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="종목명 또는 티커 입력 (예: 삼성전자, AAPL)"
                className="mt-1"
                autoFocus
              />
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {searchResults.map((item) => {
                  const alreadyAdded = watchlist.some(w => w.ticker === item.ticker)
                  return (
                    <button
                      key={item.ticker}
                      onClick={() => !alreadyAdded && handleAddFromSearch(item)}
                      disabled={alreadyAdded}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between disabled:opacity-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.ticker} · {item.market}</p>
                      </div>
                      {alreadyAdded
                        ? <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">추가됨</span>
                        : <Plus className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  )
                })}
              </div>
            )}
            {debouncedSearch && searchResults?.length === 0 && (
              <p className="text-sm text-gray-400 py-2 text-center">검색 결과가 없습니다</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSearchQuery('') }}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 가격 알림 설정 다이얼로그 ───────────────────── */}
      <AlarmDialog
        open={!!alarmStock}
        onOpenChange={(v) => { if (!v) setAlarmStock(null) }}
        stock={alarmStock}
      />

      {/* ── 알림 이력 드로어 ────────────────────────────── */}
      <AlertHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} />

      {/* ── 태그 관리 다이얼로그 ────────────────────────── */}
      <Dialog open={groupManagerOpen} onOpenChange={setGroupManagerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-blue-600" />
              태그 관리
            </DialogTitle>
          </DialogHeader>
          <GroupManager />
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupManagerOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI 채팅 패널 ────────────────────────────────── */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={{
          watchlist: watchlist.map(w => ({ ticker: w.ticker, name: w.name, market: w.market })),
          quotesMap: priceMap,
        }}
        forceAgent="alert"
        initialMessage="오늘 관심종목 시장 브리핑해줘"
      />
    </div>
  )
}
