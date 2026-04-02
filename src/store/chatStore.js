// AI 채팅 상태 관리 — Zustand + persist
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 채팅 스토어
 * - messages: 대화 히스토리
 * - isLoading: AI 응답 대기 중
 * - error: 에러 메시지
 * - lastAgentType: 마지막 사용 에이전트 타입
 */
export const useChatStore = create(
  persist(
    (set) => ({
      // 초기 상태
      messages: [],
      isLoading: false,
      error: null,
      lastAgentType: null,

      /**
       * 사용자 메시지 추가
       * @param {string} text - 메시지 내용
       */
      addUserMessage: (text) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: Date.now().toString(),
              role: 'user',
              content: text,
              timestamp: new Date().toISOString(),
            },
          ],
          error: null,
        })),

      /**
       * AI 응답 메시지 추가
       * @param {string} text - 응답 내용
       * @param {string} agentType - 에이전트 타입
       * @param {object} agentInfo - 에이전트 라벨 정보
       */
      addAIMessage: (text, agentType, agentInfo) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: text,
              agentType,
              agentInfo,
              timestamp: new Date().toISOString(),
            },
          ],
          lastAgentType: agentType,
          isLoading: false,
        })),

      /**
       * 로딩 상태 변경
       * @param {boolean} bool
       */
      setLoading: (bool) => set({ isLoading: bool }),

      /**
       * 에러 설정
       * @param {string|null} msg
       */
      setError: (msg) => set({ error: msg, isLoading: false }),

      /**
       * 대화 히스토리 초기화
       */
      clearHistory: () =>
        set({
          messages: [],
          error: null,
          lastAgentType: null,
        }),
    }),
    {
      name: 'chat-history',
      // 최근 50개 메시지만 localStorage에 저장
      partialize: (state) => ({
        messages: state.messages.slice(-50),
        lastAgentType: state.lastAgentType,
      }),
    }
  )
)
