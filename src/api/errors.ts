import type { GatewayId } from '@/api/gateway'

export class GatewayApiError extends Error {
  /** 응답을 보낸 게이트웨이. 연결 실패처럼 응답이 없으면 비어 있습니다. */
  gateway?: GatewayId
  status?: number
  code?: string
  /** 공통 오류 형식의 `error_ref`. 문의 시 전달합니다. */
  ref?: string
  retry?: number
  payload?: unknown

  constructor(
    message: string,
    init?: { gateway?: GatewayId; status?: number; code?: string; ref?: string; retry?: number; payload?: unknown },
  ) {
    super(message)
    this.name = 'GatewayApiError'
    this.gateway = init?.gateway
    this.status = init?.status
    this.code = init?.code
    this.ref = init?.ref
    this.retry = init?.retry
    this.payload = init?.payload
  }
}

export function parseRetryAfter(header: string | null) {
  if (!header) return undefined
  const asNumber = Number(header)
  const ms = Number.isNaN(asNumber) ? Date.parse(header) - Date.now() : asNumber * 1000
  const retry = Math.max(5000, ms)
  return Number.isFinite(retry) ? retry : undefined
}

function errorObject(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { root: undefined, error: undefined }
  const root = payload as Record<string, unknown>
  const error = root.error && typeof root.error === 'object' ? (root.error as Record<string, unknown>) : undefined
  return { root, error }
}

/**
 * 오류 코드를 찾습니다. 작업·파일 API는 최상위 `error.code`, 공통 모델 호출 오류는 최상위 `type`을 씁니다.
 */
export function extractErrorCode(payload: unknown): string | undefined {
  const { root, error } = errorObject(payload)
  for (const value of [error?.code, root?.code, root?.type, error?.type]) {
    if (typeof value === 'string' && value) return value
  }
  return undefined
}

export function extractErrorRef(payload: unknown): string | undefined {
  const { root, error } = errorObject(payload)
  for (const value of [root?.error_ref, error?.error_ref]) {
    if (typeof value === 'string' && value) return value
  }
  return undefined
}

/**
 * 간격을 두고 다시 보내도 되는 429. 렛서는 대기열 한도(`queue_full`)와 `rate_limit_exceeded`만 해당하며,
 * 사용량·정책 한도(`usage_limit_exceeded`, `policy_limit_exceeded`)는 재시도하지 않습니다.
 * OpenRouter의 429는 요청 빈도 제한이므로 Retry-After 뒤에 다시 보낼 수 있습니다(크레딧 부족은 402).
 */
export function isRetryableRateLimit(error: GatewayApiError) {
  if (error.status !== 429) return false
  if (error.gateway === 'openrouter') return true
  return error.code === 'queue_full' || error.code === 'rate_limit_exceeded' || /queue_full/.test(JSON.stringify(error.payload ?? ''))
}

export function isMediaNotReady(error: GatewayApiError) {
  return error.status === 503 && (error.code === 'MEDIA_NOT_READY' || /MEDIA_NOT_READY/.test(JSON.stringify(error.payload ?? '')))
}

/** 응답 시간 초과·연결 실패처럼 HTTP 상태를 받지 못한 오류 */
export function isTransportError(error: unknown) {
  return error instanceof GatewayApiError && error.status === undefined && error.code === undefined
}
