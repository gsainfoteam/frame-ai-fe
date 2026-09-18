import { create } from 'zustand'

type SessionState = {
  apiKey: string
  /** 키가 필요한 자리에서 바로 입력 대화상자를 열 수 있게 세션에 둡니다. */
  keyDialogOpen: boolean
  setApiKey: (value: string) => void
  clearKey: () => void
  setKeyDialogOpen: (open: boolean) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  apiKey: '',
  keyDialogOpen: false,
  setApiKey: (apiKey) => set({ apiKey }),
  clearKey: () => set({ apiKey: '' }),
  setKeyDialogOpen: (keyDialogOpen) => set({ keyDialogOpen }),
}))
