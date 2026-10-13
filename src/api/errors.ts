export class LetsurApiError extends Error {
  status?: number
  code?: string
  retry?: number
  payload?: unknown

  constructor(message: string, init?: { status?: number; code?: string; retry?: number; payload?: unknown }) {
    super(message)
    this.name = 'LetsurApiError'
    this.status = init?.status
    this.code = init?.code
    this.retry = init?.retry
    this.payload = init?.payload
  }
}

export function parseRetryAfter(header: string | null) {
  if (!header) return 5000
  const asNumber = Number(header)
  const ms = Number.isNaN(asNumber) ? Date.parse(header) - Date.now() : asNumber * 1000
  const retry = Math.max(5000, ms)
  return Number.isFinite(retry) ? retry : 5000
}

/** 오류 응답에서 `queue_full`, `MEDIA_NOT_READY` 같은 코드를 찾습니다. 응답 형태가 고정돼 있지 않아 여러 위치를 확인합니다. */
export function extractErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const root = payload as Record<string, unknown>
  const error = root.error && typeof root.error === 'object' ? (root.error as Record<string, unknown>) : undefined
  for (const value of [error?.code, root.code, error?.type, root.type]) {
    if (typeof value === 'string' && value) return value
  }
  return undefined
}

export function isQueueFull(error: LetsurApiError) {
  return error.status === 429 && (error.code === 'queue_full' || /queue_full/.test(JSON.stringify(error.payload ?? '')))
}

export function isMediaNotReady(error: LetsurApiError) {
  return error.status === 503 && (error.code === 'MEDIA_NOT_READY' || /MEDIA_NOT_READY/.test(JSON.stringify(error.payload ?? '')))
}

/** 응답 시간 초과·연결 실패처럼 HTTP 상태를 받지 못한 오류 */
export function isTransportError(error: unknown) {
  return error instanceof LetsurApiError && error.status === undefined && error.code === undefined
}
