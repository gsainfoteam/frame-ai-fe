import { useSessionStore } from '@/stores/sessionStore'
import { createLetsurClient } from '@/api/letsur/client'

export function useVideoApi() {
  useSessionStore((state) => state.apiKey)
  return createLetsurClient(() => useSessionStore.getState().apiKey)
}
