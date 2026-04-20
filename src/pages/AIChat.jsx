// AI 분석 채팅 전용 페이지 — 세션 관리 포함
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Send, Trash2, Bot, Loader2, WifiOff,
  Plus, MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { useJournalStore } from '../store/journalStore'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { sendToAgent, summarizeAndCompressHistory } from '../api/claudeApi'
import { buildJournalCoachPrompt, buildJournalContext } from '../agents/journalCoachAgent'
import MessageBubble from '../components/chat/MessageBubble'
import QuickPromptButtons from '../components/chat/QuickPromptButtons'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'

/** 날짜 표시 헬퍼 */
function formatSessionDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}시간 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function AIChat() {
  const [input, setInput] = useState('')
  const [localLoading, setLocalLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { isOnline } = useOnlineStatus()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const currentUser = useAuthStore(s => s.currentUser)

  const {
    sessions, currentSessionId,
    createSession, switchSession, deleteCurrentSession,
    addUserMessage, addAIMessage, setLoading, setError, clearHistory,
    saveCurrentSession, loadSessionsFromDB,
    error,
  } = useChatStore()

  // 현재 세션 messages
  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId)
    return session?.messages || []
  }, [sessions, currentSessionId])

  // 포트폴리오 & 관심종목 & 매매 일지 데이터 (에이전트 컨텍스트용)
  const { getSelectedHoldings, exchangeRate, accounts } = usePortfolioStore()
  const { watchlist } = useWatchlistStore()
  const { entries: journalEntries } = useJournalStore()

  const holdings = useMemo(() => getSelectedHoldings(), [getSelectedHoldings])

  const context = useMemo(() => ({
    holdings: holdings.map(h => ({
      ticker: h.ticker,
      name: h.name,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      currentPrice: h.currentPrice,
      market: h.market,
    })),
    exchangeRate,
    watchlist: watchlist.map(w => ({ ticker: w.ticker, name: w.name, market: w.market })),
    journalEntries,
    accounts,
  }), [holdings, exchangeRate, watchlist, journalEntries, accounts])

  const isLoading = localLoading

  // 앱 시작 시 IndexedDB에서 세션 로드
  useEffect(() => {
    if (currentUser?.id) {
      loadSessionsFromDB(currentUser.id)
    }
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 세션이 없으면 기본 세션 생성
  useEffect(() => {
    if (sessions.length === 0) {
      createSession('journal')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 포커스
  useEffect(() => {
    inputRef.current?.focus()
  }, [currentSessionId])

  async function handleSend(text) {
    const msg = text?.trim()
    if (!msg || isLoading || !isOnline) return

    addUserMessage(msg)
    setInput('')
    setLocalLoading(true)
    setLoading(true)
    setError(null)

    try {
      // 10턴 초과 시 대화 요약 압축
      let messagesToSend = messages.map(m => ({ role: m.role, content: m.content }))
      if (messagesToSend.length > 20) {
        const journalContext = buildJournalContext(journalEntries, accounts)
        const systemPrompt = buildJournalCoachPrompt(journalContext)
        messagesToSend = await summarizeAndCompressHistory(messagesToSend, systemPrompt)
      }

      const result = await sendToAgent(msg, context)
      addAIMessage(result.text, result.agentType, result.agentInfo)

      // IndexedDB에 세션 저장
      if (currentUser?.id) {
        await saveCurrentSession(currentUser.id)
      }
    } catch (err) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLocalLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  function handleNewSession() {
    createSession('journal')
  }

  function handleDeleteSession() {
    if (sessions.length <= 1) {
      clearHistory()
      return
    }
    deleteCurrentSession()
  }

  return (
    <div className="flex h-full">
      {/* ─── 세션 사이드바 ─── */}
      <div
        className={cn(
          'flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'
        )}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            대화 목록
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewSession}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto py-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                session.id === currentSessionId
                  ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-blue-500'
                  : 'border-l-2 border-transparent'
              )}
            >
              <div className="flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-700 dark:text-gray-300">
                    {session.title}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 mt-0.5">
                    {session.messages.length}개 메시지 · {formatSessionDate(session.updatedAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 메인 채팅 영역 ─── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* 로딩 배너 */}
        {isLoading && (
          <div className="bg-blue-600 text-white text-center py-3 text-sm font-bold animate-pulse shrink-0">
            🔄 AI가 분석 중입니다... 잠시만 기다려 주세요
          </div>
        )}

        {/* 페이지 헤더 */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 사이드바 토글 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? '대화 목록 닫기' : '대화 목록 열기'}
              >
                {sidebarOpen
                  ? <ChevronLeft className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />
                }
              </Button>
              <div className="rounded-full bg-blue-50 p-1.5 dark:bg-blue-950">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">AI 분석</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  종목 분석, 포트폴리오, 시장 브리핑을 물어보세요.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewSession}
                className="text-gray-400 hover:text-blue-500 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">새 대화</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSession}
                className="text-gray-400 hover:text-red-500 gap-1 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">초기화</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="rounded-full bg-blue-50 p-6 dark:bg-blue-950">
                <Bot className="h-12 w-12 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  AI 투자 분석 어시스턴트
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  아래 빠른 질문을 선택하거나 자유롭게 질문해보세요.
                </p>
              </div>
              <div className="w-full max-w-md">
                <QuickPromptButtons onSelect={handleSend} />
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <MessageBubble message={{ role: 'assistant', content: '' }} loading />
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 오프라인 안내 */}
        {!isOnline && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>오프라인 상태에서는 AI 분석을 사용할 수 없습니다. 인터넷 연결 후 이용해 주세요.</span>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mx-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 로딩 프로그레스 바 */}
        {isLoading && (
          <div className="h-1 w-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div className="h-full w-1/3 animate-[slideRight_1.2s_ease-in-out_infinite] bg-blue-500 rounded-full" />
            <style>{`
              @keyframes slideRight {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
          </div>
        )}

        {/* 입력 영역 */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !isOnline}
              placeholder={
                !isOnline ? '오프라인 상태입니다...'
                : isLoading ? 'AI가 분석 중입니다...'
                : '질문을 입력하세요... (예: 삼성전자 분석해줘)'
              }
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <Button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading || !isOnline}
              className="shrink-0 gap-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isLoading ? '분석 중...' : '전송'}</span>
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-gray-400 dark:text-gray-500">
            AI 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
