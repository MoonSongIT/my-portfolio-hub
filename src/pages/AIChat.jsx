// AI 분석 채팅 전용 페이지
import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Trash2, Bot } from 'lucide-react'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWatchlistStore } from '../store/watchlistStore'
import { useChatStore } from '../store/chatStore'
import { sendToAgent } from '../api/claudeApi'
import MessageBubble from '../components/chat/MessageBubble'
import QuickPromptButtons from '../components/chat/QuickPromptButtons'
import { Button } from '../components/ui/button'

export default function AIChat() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const {
    messages, isLoading, error,
    addUserMessage, addAIMessage, setLoading, setError, clearHistory,
  } = useChatStore()

  // 포트폴리오 & 관심종목 데이터 (에이전트 컨텍스트용)
  const { getSelectedHoldings, exchangeRate } = usePortfolioStore()
  const { watchlist } = useWatchlistStore()

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
    watchlist: watchlist.map(w => ({
      ticker: w.ticker,
      name: w.name,
      market: w.market,
    })),
  }), [holdings, exchangeRate, watchlist])

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 포커스
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSend(text) {
    const msg = text?.trim()
    if (!msg || isLoading) return

    addUserMessage(msg)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const result = await sendToAgent(msg, context)
      addAIMessage(result.text, result.agentType, result.agentInfo)
    } catch (err) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 페이지 헤더 */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-50 p-2 dark:bg-blue-950">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI 분석</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                종목 분석, 포트폴리오 관리, 시장 브리핑을 AI에게 물어보세요.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-gray-400 hover:text-red-500 gap-1"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">초기화</span>
          </Button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={isLoading ? 'AI가 분석 중입니다...' : '질문을 입력하세요... (예: 삼성전자 분석해줘)'}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <Button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            className="shrink-0 gap-1"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">전송</span>
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
          AI 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
        </p>
      </div>
    </div>
  )
}
