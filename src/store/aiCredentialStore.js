import { create } from 'zustand'
import { getAiCredential, saveAiCredential, deleteAiCredential } from '../utils/db.js'
import { isValidFormat } from '../utils/apiKeyValidator.js'

const PROVIDER = 'anthropic'
const DART_PROVIDER = 'dart'
const FINNHUB_PROVIDER = 'finnhub'

const useAiCredentialStore = create((set, get) => ({
  // ── Anthropic ──
  apiKey: null,
  isValid: null,       // null=미검증, true=검증완료, false=검증실패
  validatedAt: null,
  isLoading: false,
  isHydrated: false,

  // ── DART ──
  dartApiKey: null,
  dartSavedAt: null,

  // ── Finnhub ──
  finnhubApiKey: null,
  finnhubSavedAt: null,

  // 앱 시작 시 IDB → 메모리 로드 (Anthropic + DART + Finnhub)
  hydrate: async () => {
    if (get().isHydrated) return
    try {
      const [credential, dartCredential, finnhubCredential] = await Promise.all([
        getAiCredential(PROVIDER),
        getAiCredential(DART_PROVIDER),
        getAiCredential(FINNHUB_PROVIDER),
      ])
      set({
        apiKey: credential?.apiKey || null,
        isValid: credential?.isValid ?? null,
        validatedAt: credential?.validatedAt || null,
        dartApiKey: dartCredential?.apiKey || null,
        dartSavedAt: dartCredential?.updatedAt || null,
        finnhubApiKey: finnhubCredential?.apiKey || null,
        finnhubSavedAt: finnhubCredential?.updatedAt || null,
        isHydrated: true,
      })
    } catch {
      set({ isHydrated: true })
    }
  },

  // 키 저장 (형식 검증 + IDB 저장)
  setApiKey: async (key) => {
    const { valid } = isValidFormat(key)
    set({ apiKey: key, isValid: valid ? null : false, validatedAt: null })
    await saveAiCredential({
      provider: PROVIDER,
      apiKey: key,
      isValid: valid ? null : false,
      validatedAt: null,
    })
  },

  // 서버에 키 유효성 검증 요청
  validateKey: async () => {
    const { apiKey } = get()
    if (!apiKey) return false

    set({ isLoading: true })
    try {
      const response = await fetch('/api/claude/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      const data = await response.json()
      const isValid = data.valid === true
      const validatedAt = new Date().toISOString()

      set({ isValid, validatedAt, isLoading: false })
      await saveAiCredential({ provider: PROVIDER, apiKey, isValid, validatedAt })
      return isValid
    } catch {
      set({ isLoading: false })
      return false
    }
  },

  // 키 삭제 + 상태 전체 리셋
  clearKey: async () => {
    await deleteAiCredential(PROVIDER)
    set({ apiKey: null, isValid: null, validatedAt: null, isLoading: false })
  },

  // 키 존재 여부 셀렉터
  hasKey: () => get().apiKey !== null && get().apiKey !== '',

  // ── DART 키 저장/삭제 ──
  setDartKey: async (key) => {
    const now = new Date().toISOString()
    set({ dartApiKey: key, dartSavedAt: now })
    await saveAiCredential({
      provider: DART_PROVIDER,
      apiKey: key,
      isValid: null,
      validatedAt: null,
    })
  },

  clearDartKey: async () => {
    await deleteAiCredential(DART_PROVIDER)
    set({ dartApiKey: null, dartSavedAt: null })
  },

  hasDartKey: () => {
    const key = get().dartApiKey
    return key !== null && key !== ''
  },

  // ── Finnhub 키 저장/삭제 ──
  setFinnhubKey: async (key) => {
    const now = new Date().toISOString()
    set({ finnhubApiKey: key, finnhubSavedAt: now })
    await saveAiCredential({
      provider: FINNHUB_PROVIDER,
      apiKey: key,
      isValid: null,
      validatedAt: null,
    })
  },

  clearFinnhubKey: async () => {
    await deleteAiCredential(FINNHUB_PROVIDER)
    set({ finnhubApiKey: null, finnhubSavedAt: null })
  },

  hasFinnhubKey: () => {
    const key = get().finnhubApiKey
    return key !== null && key !== ''
  },
}))

export default useAiCredentialStore
