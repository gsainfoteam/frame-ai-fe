import type { VideoApi } from '@/api/videoApi'
import { isFinalizeRequest } from '@/api/types'
import type {
  CreateJobResponse,
  GatewayJob,
  MediaLinkResponse,
  UploadReferenceResponse,
  UploadTrack,
  VideoGenerationRequest,
} from '@/api/types'
import { GatewayApiError } from '@/api/errors'
import { createRequester } from '@/api/http'
import { isKlingModel, toKlingBody } from '@/api/letsur/kling'
import { FRAME_DOWNLOAD_TIMEOUT_MS, IMAGE_MIMES, UPLOAD_TIMEOUT_MS, isAllowedMime } from '@/config/constants'
import { letsurApiBase } from '@/config/env'
import { httpHint } from '@/domain/errors'

type GetJobResponse = {
  data?: { job?: GatewayJob }
}

export function createLetsurClient(getKey: () => string): VideoApi {
  const request = createRequester({ gateway: 'letsur', base: letsurApiBase, getKey, hint: httpHint })

  return {
    gateway: 'letsur',
    async createJob(payload: VideoGenerationRequest) {
      const kling = !isFinalizeRequest(payload) && isKlingModel(payload.model)
      const res = await request<CreateJobResponse & { Response?: { TaskId?: string } }>('/video/generations', {
        method: 'POST',
        body: JSON.stringify(kling ? toKlingBody(payload) : payload),
      })
      // 작업 ID 위치가 모델마다 다릅니다: Seedance는 `id`, Kling은 `Response.TaskId`.
      return { ...res, id: res.id ?? res.Response?.TaskId }
    },
    async listModelIds() {
      const res = await request<{ data?: Array<{ id?: string }> }>('/models')
      return (res.data ?? []).flatMap((item) => (typeof item.id === 'string' ? [item.id] : []))
    },
    async getJob(id: string) {
      const raw = await request<GetJobResponse>(`/jobs/${encodeURIComponent(id)}`)
      const job = raw.data?.job
      if (!job) throw new GatewayApiError('응답에서 작업 정보를 찾지 못했습니다.', { code: 'missing_job', payload: raw })
      return { job, raw }
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
      if (!key) throw new GatewayApiError('API 키를 입력해주세요.')
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
          throw new GatewayApiError(detail)
        }
        const blob = await res.blob()
        if (!isAllowedMime(IMAGE_MIMES, blob.type) || blob.size > 30 * 1024 * 1024 || !blob.size) {
          throw new GatewayApiError('참조로 사용할 수 없는 이미지 형식 또는 크기입니다.')
        }
        return blob
      } catch (error) {
        if (error instanceof GatewayApiError) throw error
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new GatewayApiError('이미지 다운로드 시간이 초과되었습니다. 새 생성은 요청하지 않았습니다.')
        }
        if (error instanceof TypeError) {
          throw new GatewayApiError(
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
