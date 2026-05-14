import { useState } from 'react'
import { toast } from 'sonner'
import useAiCredentialStore from '../store/aiCredentialStore.js'

/**
 * AI 기능 진입 전 API 키 유무를 검사하는 훅
 * - ensureKey(): Promise<boolean> — true면 진행 가능, false면 차단
 * - guardProps: ApiKeyRequiredDialog에 spread할 props { open, onClose }
 */
export function useApiKeyGuard() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const store = useAiCredentialStore()

  async function ensureKey() {
    if (!store.isHydrated) {
      await store.hydrate()
    }

    if (!store.hasKey()) {
      setDialogOpen(true)
      return false
    }

    if (store.isValid === false) {
      toast.warning('API 키 검증이 실패했습니다. 설정에서 키를 확인해주세요.', { duration: 5000 })
    }

    return true
  }

  return {
    ensureKey,
    guardProps: { open: dialogOpen, onClose: () => setDialogOpen(false) },
  }
}
