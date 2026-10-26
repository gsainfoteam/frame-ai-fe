import type { GatewayId } from '@/api/gateway'
import { GatewayApiError, extractErrorCode, extractErrorRef, parseRetryAfter } from '@/api/errors'
import { DEFAULT_REQUEST_TIMEOUT_MS } from '@/config/constants'
import { describeError } from '@/domain/errors'

type RequesterOptions = {
  gateway: GatewayId
  base: string
  getKey: () => string
  /** 모든 요청에 붙일 헤더 (인증 헤더 제외) */
  headers?: Record<string, string>
  /** HTTP 상태와 오류 코드별 안내 */
  hint: (status: number, code?: string, raw?: string) => string
}

export type RequestOptions = RequestInit & { timeout?: number }

/** 게이트웨이 공통 JSON 요청. 키·시간 초과·오류 형식 처리를 한곳에서 합니다. */
export function createRequester({ gateway, base, getKey, headers: extra, hint }: RequesterOptions) {
  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const key = getKey().trim()
    if (!key) throw new GatewayApiError('API 키를 입력해주세요.', { code: 'missing_api_key' })

    const timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const headers = new Headers(options.headers)
      for (const [name, value] of Object.entries(extra ?? {})) headers.set(name, value)
      headers.set('Authorization', `Bearer ${key}`)
      if (typeof options.body === 'string') headers.set('Content-Type', 'application/json')

      const res = await fetch(`${base}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      })
      const raw = await res.text()
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch {
        const note = res.ok ? '' : hint(res.status, undefined, raw)
        throw new GatewayApiError(`응답을 해석할 수 없습니다 (HTTP ${res.status}).${note ? `\n${note}` : ''}`, {
          gateway,
          status: res.status,
          retry: parseRetryAfter(res.headers.get('Retry-After')),
        })
      }

      if (!res.ok) {
        const payload = json as { error?: unknown }
        const code = extractErrorCode(json)
        const note = hint(res.status, code, raw)
        throw new GatewayApiError(`HTTP ${res.status} · ${describeError(payload.error ?? json)}${note ? `\n${note}` : ''}`, {
          gateway,
          status: res.status,
          code,
          ref: extractErrorRef(json),
          retry: parseRetryAfter(res.headers.get('Retry-After')),
          payload: json,
        })
      }
      return json as T
    } catch (error) {
      if (error instanceof GatewayApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GatewayApiError('응답 대기 시간이 초과되었습니다. 생성 요청은 접수되었을 수 있습니다.')
      }
      if (error instanceof TypeError) {
        throw new GatewayApiError(
          '연결에 실패했습니다. 네트워크 또는 브라우저 교차 출처 제한을 확인하세요. 생성 요청은 접수되었을 수 있습니다.',
        )
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
