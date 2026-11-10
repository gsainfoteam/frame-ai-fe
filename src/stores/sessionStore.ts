import { create } from 'zustand'
import type { GatewayId } from '@/api/gateway'
import { loadSession, saveSession } from '@/storage/sessionRepository'

type SessionState = {
  gateway: GatewayId
  /** 이 브라우저에 저장합니다. 프로젝트 백업·진단 정보에는 포함하지 않습니다. */
  keys: Record<GatewayId, string>
  apiKey: string
  storageFailed: boolean
  keyDialogOpen: boolean
  setGateway: (gateway: GatewayId) => void
  setApiKey: (value: string) => void
  clearKey: () => void
  setKeyDialogOpen: (open: boolean) => void
}

const initial = loadSession()

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initial,
  apiKey: initial.keys[initial.gateway],
  keyDialogOpen: false,
  setGateway: (gateway) => set({ gateway, apiKey: get().keys[gateway] }),
  setApiKey: (value) => {
    const apiKey = value.trim()
    set({ apiKey, keys: { ...get().keys, [get().gateway]: apiKey } })
  },
  clearKey: () => get().setApiKey(''),
  setKeyDialogOpen: (keyDialogOpen) => set({ keyDialogOpen }),
}))

useSessionStore.subscribe((state, previous) => {
  if (state.gateway === previous.gateway && state.keys === previous.keys) return
  let storageFailed = false
  try {
    saveSession(state)
  } catch {
    storageFailed = true
  }
  if (state.storageFailed !== storageFailed) useSessionStore.setState({ storageFailed })
})
