// AI 채팅 상태 관리 — Zustand + persist + 세션 관리
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { saveChatSession, getChatSessionsByUser, getChatSessionById } from '../utils/db'

/** 세션 하나의 기본 구조 */
function createSession(agentType = 'journal') {
  const now = new Date().toISOString()
  return {
    id: `session_${Date.now()}`,
    agentType,
    title: '새 대화',
    messages: [],
    startedAt: now,
    updatedAt: now,
  }
}

/**
 * 채팅 스토어
 * - sessions: 세션 목록 (메모리 캐시)
 * - currentSessionId: 현재 활성 세션 ID
 * - isLoading: AI 응답 대기 중
 * - error: 에러 메시지
 * - lastAgentType: 마지막 사용 에이전트 타입
 */
export const useChatStore = create(
  persist(
    (set, get) => ({
      // 초기 상태
      sessions: [],           // [{ id, agentType, title, messages[], startedAt, updatedAt }]
      currentSessionId: null,
      isLoading: false,
      error: null,
      lastAgentType: null,

      // ─── 세션 관리 액션 ───

      /**
       * 새 세션 생성 후 활성화
       * @param {string} agentType
       * @returns {string} 생성된 세션 ID
       */
      createSession: (agentType = 'journal') => {
        const session = createSession(agentType)
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          error: null,
        }))
        return session.id
      },

      /**
       * 세션 전환
       * @param {string} sessionId
       */
      switchSession: (sessionId) => {
        set({ currentSessionId: sessionId, error: null })
      },

      /**
       * 현재 세션 삭제 후 최근 세션으로 전환
       */
      deleteCurrentSession: () => {
        const { sessions, currentSessionId } = get()
        const remaining = sessions.filter(s => s.id !== currentSessionId)
        set({
          sessions: remaining,
          currentSessionId: remaining[0]?.id || null,
          error: null,
        })
      },

      /**
       * IndexedDB에서 사용자 세션 목록 로드
       * @param {string} userId
       */
      loadSessionsFromDB: async (userId) => {
        try {
          const dbSessions = await getChatSessionsByUser(userId)
          if (dbSessions.length === 0) return
          set((state) => {
            // 메모리에 없는 세션만 병합 (중복 방지)
            const existingIds = new Set(state.sessions.map(s => s.id))
            const newSessions = dbSessions.filter(s => !existingIds.has(s.sessionId))
              .map(s => ({
                id: s.sessionId,
                agentType: s.agentType,
                title: s.title || '저장된 대화',
                messages: s.messages || [],
                startedAt: s.startedAt,
                updatedAt: s.updatedAt,
              }))
            return { sessions: [...state.sessions, ...newSessions] }
          })
        } catch (err) {
          console.warn('[chatStore] 세션 로드 실패:', err)
        }
      },

      /**
       * 현재 세션을 IndexedDB에 저장
       * @param {string} userId
       */
      saveCurrentSession: async (userId) => {
        const { sessions, currentSessionId } = get()
        const session = sessions.find(s => s.id === currentSessionId)
        if (!session || !userId) return
        try {
          await saveChatSession({
            sessionId: session.id,
            userId,
            agentType: session.agentType,
            title: session.title,
            messages: session.messages.slice(-100), // 최대 100개 저장
            startedAt: session.startedAt,
            updatedAt: new Date().toISOString(),
          })
        } catch (err) {
          console.warn('[chatStore] 세션 저장 실패:', err)
        }
      },

      // ─── 메시지 액션 ───

      /**
       * 사용자 메시지 추가 (현재 세션에 추가, 없으면 새 세션 생성)
       * @param {string} text
       */
      addUserMessage: (text) => {
        set((state) => {
          let { sessions, currentSessionId } = state

          // 현재 세션이 없으면 새로 생성
          if (!currentSessionId || !sessions.find(s => s.id === currentSessionId)) {
            const session = createSession('journal')
            sessions = [session, ...sessions]
            currentSessionId = session.id
          }

          const msg = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
          }

          const updatedSessions = sessions.map(s =>
            s.id === currentSessionId
              ? { ...s, messages: [...s.messages, msg], updatedAt: new Date().toISOString() }
              : s
          )

          return { sessions: updatedSessions, currentSessionId, error: null }
        })
      },

      /**
       * AI 응답 메시지 추가 + 10턴 초과 시 세션 제목 자동 설정
       * @param {string} text
       * @param {string} agentType
       * @param {object} agentInfo
       */
      addAIMessage: (text, agentType, agentInfo) => {
        set((state) => {
          const { sessions, currentSessionId } = state
          const msg = {
            id: Date.now().toString(),
            role: 'assistant',
            content: text,
            agentType,
            agentInfo,
            timestamp: new Date().toISOString(),
          }

          const updatedSessions = sessions.map(s => {
            if (s.id !== currentSessionId) return s
            const newMessages = [...s.messages, msg]
            // 첫 AI 응답 시 세션 제목 자동 설정 (사용자 첫 메시지 기반)
            const firstUserMsg = newMessages.find(m => m.role === 'user')
            const title = s.title === '새 대화' && firstUserMsg
              ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '')
              : s.title
            return { ...s, messages: newMessages, title, updatedAt: new Date().toISOString() }
          })

          return { sessions: updatedSessions, lastAgentType: agentType, isLoading: false }
        })
      },

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
       * 현재 세션 메시지 초기화 (세션은 유지)
       */
      clearHistory: () => {
        set((state) => {
          const { sessions, currentSessionId } = state
          const updatedSessions = sessions.map(s =>
            s.id === currentSessionId
              ? { ...s, messages: [], title: '새 대화', updatedAt: new Date().toISOString() }
              : s
          )
          return { sessions: updatedSessions, error: null, lastAgentType: null }
        })
      },
    }),
    {
      name: 'chat-sessions-v2',  // v2: 이전 손상된 데이터 무시하고 초기화
      // 최근 5개 세션, 각 세션 최근 50개 메시지만 localStorage에 저장
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        lastAgentType: state.lastAgentType,
        sessions: Array.isArray(state.sessions)
          ? state.sessions.slice(0, 5).map(s => ({
              ...s,
              messages: Array.isArray(s.messages) ? s.messages.slice(-50) : [],
            }))
          : [],
      }),
    }
  )
)
