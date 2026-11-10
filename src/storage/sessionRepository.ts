import { isGatewayId, type GatewayId } from '@/api/gateway'

export const SESSION_KEY = 'frame.connection.v1'
export type SavedSession = { gateway: GatewayId; keys: Record<GatewayId, string> }

export function loadSession(): SavedSession & { storageFailed: boolean } {
  const fallback: SavedSession = { gateway: 'openrouter', keys: { openrouter: '', letsur: '' } }
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      const legacy = localStorage.getItem('frame.gateway')
      return { ...fallback, gateway: isGatewayId(legacy) ? legacy : 'openrouter', storageFailed: false }
    }
    const data = JSON.parse(raw)
    if (data?.version !== 1 || !isGatewayId(data.gateway)) throw new Error('Invalid saved connection')
    return {
      gateway: data.gateway,
      keys: {
        openrouter: typeof data.keys?.openrouter === 'string' ? data.keys.openrouter : '',
        letsur: typeof data.keys?.letsur === 'string' ? data.keys.letsur : '',
      },
      storageFailed: false,
    }
  } catch {
    return { ...fallback, storageFailed: true }
  }
}

export function saveSession(session: SavedSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, gateway: session.gateway, keys: session.keys }))
}
