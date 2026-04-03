// AI 채팅 패널 — 우측 슬라이드 + 드래그 리사이즈
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, Bot, X, GripVertical } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import MessageBubble from './MessageBubble'
import QuickPromptButtons from './QuickPromptButtons'
import { useChatStore } from '../../store/chatStore'
import { sendToAgent } from '../../api/claudeApi'

const MIN_WIDTH = 360
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 480

/**
 * AI 채팅 패널 (우측 슬라이드 + 드래그 리사이즈)
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, context?: object, forceAgent?: string|null, initialMessage?: string|null }} props
 */
export default function ChatPanel({
  open,
  onOpenChange,
  context = {},
  forceAgent = null,
  initialMessage = null,
}) {
  const [input, setInput] = useState('')
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const initialMessageSent = useRef(false)
  const isDragging = useRef(false)

  const {
    messages,
    isLoading,
    error,
    addUserMessage,
    addAIMessage,
    setLoading,
    setError,
    clearHistory,
  } = useChatStore()

  // 최신 메시지로 자동 스크롤 (메시지 변경 시)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 패널 열릴 때: 맨 아래로 즉시 스크롤 + 입력창 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        inputRef.current?.focus()
      }, 300)
    }
  }, [open])

  // initialMessage 자동 전송 (한 번만)
  useEffect(() => {
    if (open && initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true
      handleSend(initialMessage)
    }
    if (!open) {
      initialMessageSent.current = false
    }
  }, [open, initialMessage])

  // 드래그 리사이즈 핸들러
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e) => {
      if (!isDragging.current) return
      const newWidth = window.innerWidth - e.clientX
      setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  /**
   * 메시지 전송 처리
   * @param {string} text - 전송할 메시지
   */
  async function handleSend(text) {
    const msg = text?.trim()
    if (!msg || isLoading) return

    addUserMessage(msg)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const result = await sendToAgent(msg, context, forceAgent)
      addAIMessage(result.text, result.agentType, result.agentInfo)
    } catch (err) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.')
    }
  }

  /**
   * Enter 키로 메시지 전송
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        style={{ width: `${panelWidth}px`, maxWidth: `${MAX_WIDTH}px` }}
        className={`flex h-full flex-col p-0 sm:max-w-none ${isLoading ? 'cursor-wait' : ''}`}
      >
        {/* 드래그 리사이즈 핸들 (왼쪽 가장자리) */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400/40 transition-colors z-10 flex items-center justify-center"
          title="드래그하여 너비 조절"
        >
          <GripVertical className="h-4 w-4 text-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
        </div>

        {/* 헤더 */}
        <SheetHeader className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <SheetTitle>AI 분석 채팅</SheetTitle>
            </div>
            {/* 아이콘: 초기화 + 닫기 (겹치지 않게 나란히) */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearHistory}
                title="대화 초기화"
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                title="닫기"
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">
            AI 에이전트와 대화하여 투자 분석을 받을 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {messages.length === 0 ? (
            // 빈 대화 시 안내
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-blue-50 p-4 dark:bg-blue-950">
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  AI 투자 분석 어시스턴트
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  종목 분석, 포트폴리오 관리, 시장 브리핑을 도와드립니다.
                </p>
              </div>
              <QuickPromptButtons onSelect={handleSend} />
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <MessageBubble
                  message={{ role: 'assistant', content: '' }}
                  loading
                />
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mx-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 입력 영역 */}
        <div className="border-t px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={isLoading ? 'AI가 분석 중입니다...' : '질문을 입력하세요...'}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <Button
              size="icon-sm"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {/* 면책 문구 */}
          <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
            AI 분석은 참고용이며 투자 결정의 책임은 본인에게 있습니다.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
