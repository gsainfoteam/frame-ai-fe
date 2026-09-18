import type { VideoApi } from '@/api/videoApi'
import type {
  CreateJobResponse,
  GetJobResponse,
  MediaLinkResponse,
  UploadReferenceResponse,
  UploadTrack,
  VideoGenerationRequest,
} from '@/api/types'
import { LetsurApiError, parseRetryAfter } from '@/api/errors'
import { DEFAULT_REQUEST_TIMEOUT_MS, FRAME_DOWNLOAD_TIMEOUT_MS, IMAGE_MIMES, UPLOAD_TIMEOUT_MS, isAllowedMime } from '@/config/constants'
import { letsurApiBase } from '@/config/env'
import { describeError } from '@/domain/errors'

export function createLetsurClient(getKey: () => string): VideoApi {
  async function request<T>(path: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
    const key = getKey().trim()
    if (!key) throw new LetsurApiError('API 키를 입력해주세요.')

    const timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const headers = new Headers(options.headers)
      headers.set('Authorization', `Bearer ${key}`)
      if (typeof options.body === 'string') headers.set('Content-Type', 'application/json')

      const res = await fetch(`${letsurApiBase}${path}`, {
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
        throw new LetsurApiError(`응답을 해석할 수 없습니다 (HTTP ${res.status}).`)
      }

      if (!res.ok) {
        const payload = json as { error?: unknown }
        throw new LetsurApiError(`HTTP ${res.status} · ${describeError(payload.error ?? json)}`, {
          status: res.status,
          code: (payload.error as { code?: string } | undefined)?.code,
          retry: parseRetryAfter(res.headers.get('Retry-After')),
          payload: json,
        })
      }
      return json as T
    } catch (error) {
      if (error instanceof LetsurApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new LetsurApiError('응답 대기 시간이 초과되었습니다. 생성 요청은 접수되었을 수 있습니다.')
      }
      if (error instanceof TypeError) {
        throw new LetsurApiError(
          '연결에 실패했습니다. 네트워크 또는 브라우저 교차 출처 제한을 확인하세요. 생성 요청은 접수되었을 수 있습니다.',
        )
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async createJob(payload: VideoGenerationRequest) {
      return request<CreateJobResponse>('/video/generations', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    async getJob(id: string) {
      return request<GetJobResponse>(`/jobs/${encodeURIComponent(id)}`)
    },
    async uploadReference(file: File, track: UploadTrack) {
      const form = new FormData()
      form.append('file', file)
      return request<UploadReferenceResponse>(
        `/references${track === 'managed' ? '?track=managed' : ''}`,
        { method: 'POST', body: form, timeout: UPLOAD_TIMEOUT_MS },
      )
    },
    async issueMediaLink(mediaId: string) {
      return request<MediaLinkResponse>(`/media/${encodeURIComponent(mediaId)}/link`, { method: 'POST' })
    },
    async downloadMedia(mediaId: string) {
      const key = getKey().trim()
      if (!key) throw new LetsurApiError('API 키를 입력해주세요.')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FRAME_DOWNLOAD_TIMEOUT_MS)
      try {
        const res = await fetch(`${letsurApiBase}/media/${encodeURIComponent(mediaId)}/content`, {
          headers: { Authorization: `Bearer ${key}` },
          credentials: 'omit',
          signal: controller.signal,
        })
        if (!res.ok) {
          let detail = `HTTP ${res.status}`
          try {
            const json = (await res.json()) as { error?: { message?: string } }
            detail += ` · ${json.error?.message || '이미지 수신 실패'}`
          } catch {
            /* ignore parse */
          }
          throw new LetsurApiError(detail)
        }
        const blob = await res.blob()
        if (!isAllowedMime(IMAGE_MIMES, blob.type) || blob.size > 30 * 1024 * 1024 || !blob.size) {
          throw new LetsurApiError('참조로 사용할 수 없는 이미지 형식 또는 크기입니다.')
        }
        return blob
      } catch (error) {
        if (error instanceof LetsurApiError) throw error
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new LetsurApiError('이미지 다운로드 시간이 초과되었습니다. 새 생성은 요청하지 않았습니다.')
        }
        if (error instanceof TypeError) {
          throw new LetsurApiError(
            '로컬 도구에 연결할 수 없습니다. 실행 상태를 확인하거나 아래 파일 선택 방식으로 진행해주세요.',
          )
        }
        throw error
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
