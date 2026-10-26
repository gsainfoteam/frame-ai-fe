import { create } from 'zustand'
import { isGatewayId, type GatewayId } from '@/api/gateway'

const GATEWAY_KEY = 'frame.gateway'

function loadGateway(): GatewayId {
  try {
    const saved = localStorage.getItem(GATEWAY_KEY)
    return isGatewayId(saved) ? saved : 'letsur'
  } catch {
    return 'letsur'
  }
}

type SessionState = {
  /** 새 생성 요청을 보낼 게이트웨이. 이름만 브라우저에 기억합니다. */
  gateway: GatewayId
  /** 게이트웨이별 키. 저장하지 않고 이 페이지가 열린 동안만 씁니다. */
  keys: Record<GatewayId, string>
  /** 현재 게이트웨이의 키 */
  apiKey: string
  /** 키가 필요한 자리에서 바로 입력 대화상자를 열 수 있게 세션에 둡니다. */
  keyDialogOpen: boolean
  setGateway: (gateway: GatewayId) => void
  setApiKey: (value: string) => void
  clearKey: () => void
  setKeyDialogOpen: (open: boolean) => void
}

const initialGateway = loadGateway()

export const useSessionStore = create<SessionState>((set, get) => ({
  gateway: initialGateway,
  keys: { letsur: '', openrouter: '' },
  apiKey: '',
  keyDialogOpen: false,
  setGateway: (gateway) => {
    try {
      localStorage.setItem(GATEWAY_KEY, gateway)
    } catch {
      /* 기억하지 못해도 이번 세션에는 적용됩니다. */
    }
    set({ gateway, apiKey: get().keys[gateway] })
  },
  setApiKey: (apiKey) => set({ apiKey, keys: { ...get().keys, [get().gateway]: apiKey } }),
  clearKey: () => set({ apiKey: '', keys: { ...get().keys, [get().gateway]: '' } }),
  setKeyDialogOpen: (keyDialogOpen) => set({ keyDialogOpen }),
}))
