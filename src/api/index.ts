import type { GatewayId } from '@/api/gateway'
import type { VideoApi } from '@/api/videoApi'
import { createLetsurClient } from '@/api/letsur/client'
import { createOpenRouterClient } from '@/api/openrouter/client'
import { useSessionStore } from '@/stores/sessionStore'

const clients = new Map<GatewayId, VideoApi>()

/** 게이트웨이별 클라이언트. 키는 호출할 때마다 세션에서 그 게이트웨이의 값을 읽습니다. */
export function getVideoApi(gateway: GatewayId): VideoApi {
  let client = clients.get(gateway)
  if (!client) {
    const getKey = () => useSessionStore.getState().keys[gateway]
    client = gateway === 'openrouter' ? createOpenRouterClient(getKey) : createLetsurClient(getKey)
    clients.set(gateway, client)
  }
  return client
}

/** 지금 선택한 게이트웨이. 새 생성 요청과 업로드에 씁니다. */
export function currentVideoApi() {
  return getVideoApi(useSessionStore.getState().gateway)
}

/** 결과 미디어를 만든 게이트웨이. OpenRouter 미디어 ID에만 `#`이 있습니다. */
export function gatewayOfMedia(mediaId: string): GatewayId {
  return mediaId.includes('#') ? 'openrouter' : 'letsur'
}

export function videoApiForMedia(mediaId: string) {
  return getVideoApi(gatewayOfMedia(mediaId))
}
