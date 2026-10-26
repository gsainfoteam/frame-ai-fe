import { getVideoApi } from '@/api'
import { GATEWAYS } from '@/api/gateway'
import { useSessionStore } from '@/stores/sessionStore'

/** 현재 선택한 게이트웨이의 클라이언트. 게이트웨이를 바꾸면 다시 렌더링됩니다. */
export function useVideoApi() {
  return getVideoApi(useSessionStore((state) => state.gateway))
}

export function useGateway() {
  return GATEWAYS[useSessionStore((state) => state.gateway)]
}
