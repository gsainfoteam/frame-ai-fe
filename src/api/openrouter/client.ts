import type { VideoApi } from '@/api/videoApi'
import type {
  ApiErrorInfo,
  CreateJobResponse,
  GatewayJob,
  GenerationRequest,
  MediaReference,
  ResultMedia,
  UploadTrack,
} from '@/api/types'
import { isFinalizeRequest } from '@/api/types'
import { GatewayApiError } from '@/api/errors'
import { createRequester } from '@/api/http'
import { FRAME_DOWNLOAD_TIMEOUT_MS, IMAGE_MIMES, isAllowedMime } from '@/config/constants'
import { openRouterApiBase } from '@/config/env'
import { openRouterHint } from '@/domain/errors'
import type { OpenRouterVideoModel } from '@/domain/models'
import { createId } from '@/shared/lib/id'
import { LOCAL_IMAGE_SCHEME, isLocalImageRef } from '@/shared/lib/url'
import { imageRepository } from '@/storage/imageRepository'

/** OpenRouter로 보낼 data URL 이미지의 상한. 요청 본문이 커지면 413이 납니다. */
export const OPENROUTER_INLINE_IMAGE_MIB = 10

/** `GET /videos/{id}` 응답 */
type OpenRouterVideoJob = {
  id?: string
  status?: string
  generation_id?: string
  model?: string
  created_at?: string | number
  updated_at?: string | number
  error?: unknown
  /** 인증 헤더가 필요한 `/videos/{id}/content?index=N` 주소 */
  unsigned_urls?: string[] | null
  /** 키 없이 받을 수 있는 서명 링크. 보관 사본이 있을 때만 옵니다. */
  urls?: string[] | null
  expires_at?: string | number | null
  usage?: { cost?: number | string | null; is_byok?: boolean } | null
}

type OpenRouterImagePart = { type: 'image_url'; image_url: { url: string } }
type OpenRouterInputReference =
  | OpenRouterImagePart
  | { type: 'video_url'; video_url: { url: string } }
  | { type: 'audio_url'; audio_url: { url: string } }

const statusMap: Record<string, GatewayJob['status']> = {
  pending: 'queued',
  in_progress: 'running',
  completed: 'succeeded',
  failed: 'failed',
  cancelled: 'failed',
  expired: 'failed',
}

const endedLabel: Record<string, string> = {
  cancelled: '작업이 취소되었습니다.',
  expired: '결과 보관기한이 지나 더 이상 받을 수 없습니다.',
}

/** 결과 미디어 ID는 `{작업 ID}#{순번}`입니다. 렛서 미디어 ID에는 `#`이 없어 구분됩니다. */
export function openRouterMediaId(jobId: string, index: number) {
  return `${jobId}#${index}`
}

function parseMediaId(mediaId: string) {
  const at = mediaId.lastIndexOf('#')
  const index = Number(mediaId.slice(at + 1))
  if (at <= 0 || !Number.isInteger(index) || index < 0) throw new GatewayApiError('결과 파일 ID가 올바르지 않습니다.')
  return { jobId: mediaId.slice(0, at), index }
}

function toIso(value: string | number | null | undefined) {
  if (typeof value === 'number') return new Date(value * (value < 1e12 ? 1000 : 1)).toISOString()
  return typeof value === 'string' && value ? value : undefined
}

function toError(raw: OpenRouterVideoJob): ApiErrorInfo | undefined {
  const status = raw.status ?? ''
  if (!['failed', 'cancelled', 'expired'].includes(status)) return undefined
  const error = raw.error
  const info: ApiErrorInfo = { code: status }
  if (typeof error === 'string' && error) info.message = error
  else if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e.message === 'string') info.message = e.message
    if (typeof e.code === 'string' || typeof e.code === 'number') info.code = String(e.code)
  }
  if (!info.message) info.message = endedLabel[status] ?? '영상 생성에 실패했습니다.'
  return info
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}

/** `frame-local://` 참조를 이미지 보관함의 원본으로 바꿔 data URL로 보냅니다. */
async function resolveImageUrl(url: string) {
  if (!isLocalImageRef(url)) return url
  const asset = (await imageRepository.getAll()).find((item) => item.reference === url && item.blob)
  if (!asset?.blob) {
    throw new GatewayApiError('이 브라우저의 이미지 보관함에서 참조 원본을 찾지 못했습니다. 이미지를 다시 선택해주세요.')
  }
  if (asset.blob.size > OPENROUTER_INLINE_IMAGE_MIB * 1048576) {
    throw new GatewayApiError(`OpenRouter로 직접 보내는 이미지는 ${OPENROUTER_INLINE_IMAGE_MIB} MiB 이하여야 합니다. 크기를 줄이거나 HTTPS URL을 입력해주세요.`)
  }
  return blobToDataUrl(asset.blob)
}

function referencePart(ref: MediaReference, url: string): OpenRouterInputReference {
  if (ref.type === 'video') return { type: 'video_url', video_url: { url } }
  if (ref.type === 'audio') return { type: 'audio_url', audio_url: { url } }
  return { type: 'image_url', image_url: { url } }
}

/**
 * 공통 요청을 OpenRouter `POST /videos` 본문으로 바꿉니다.
 * 첫·마지막 프레임은 `frame_images`, 나머지 참조는 `input_references`로 보냅니다.
 * 렛서 전용 필드(draft, store_media, mode, return_last_frame)는 보내지 않습니다.
 */
export async function toOpenRouterBody(payload: GenerationRequest) {
  const frames: Array<OpenRouterImagePart & { frame_type: 'first_frame' | 'last_frame' }> = []
  const references: OpenRouterInputReference[] = []
  if (payload.image_url) {
    frames.push({ type: 'image_url', image_url: { url: await resolveImageUrl(payload.image_url) }, frame_type: 'first_frame' })
  }
  for (const ref of payload.references ?? []) {
    const url = ref.type === 'image' ? await resolveImageUrl(ref.url) : ref.url
    if (ref.role === 'first_frame' || ref.role === 'last_frame') {
      frames.push({ type: 'image_url', image_url: { url }, frame_type: ref.role })
    } else {
      references.push(referencePart(ref, url))
    }
  }

  const body: Record<string, unknown> = { model: payload.model, prompt: payload.prompt, generate_audio: payload.generate_audio }
  if (payload.duration !== undefined) body.duration = payload.duration
  if (payload.resolution) body.resolution = payload.resolution
  if (payload.aspect_ratio) body.aspect_ratio = payload.aspect_ratio
  if (payload.seed !== undefined) body.seed = payload.seed
  if (frames.length) body.frame_images = frames
  if (references.length) body.input_references = references
  // Seedance(BytePlus) 전용 파라미터는 공급사 슬러그 아래로 넘깁니다. 다른 공급사로 연결되면 무시됩니다.
  if (payload.watermark !== undefined && payload.model.startsWith('bytedance/')) {
    body.provider = { options: { byteplus: { watermark: payload.watermark } } }
  }
  return body
}

export function createOpenRouterClient(getKey: () => string): VideoApi {
  const request = createRequester({
    gateway: 'openrouter',
    base: openRouterApiBase,
    getKey,
    headers: { 'X-OpenRouter-Title': 'Frame', 'HTTP-Referer': window.location.origin },
    hint: openRouterHint,
  })
  /** 인증이 필요한 결과 파일을 한 번만 내려받아 페이지가 열린 동안 재사용합니다. */
  const objectUrls = new Map<string, string>()

  async function fetchContent(jobId: string, index: number) {
    const key = getKey().trim()
    if (!key) throw new GatewayApiError('API 키를 입력해주세요.', { code: 'missing_api_key' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FRAME_DOWNLOAD_TIMEOUT_MS)
    try {
      const res = await fetch(`${openRouterApiBase}/videos/${encodeURIComponent(jobId)}/content?index=${index}`, {
        headers: { Authorization: `Bearer ${key}` },
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!res.ok) {
        const note = openRouterHint(res.status)
        throw new GatewayApiError(`결과 파일을 받지 못했습니다 (HTTP ${res.status}).${note ? `\n${note}` : ''}`, {
          gateway: 'openrouter',
          status: res.status,
        })
      }
      return await res.blob()
    } catch (error) {
      if (error instanceof GatewayApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GatewayApiError('결과 파일 다운로드 시간이 초과되었습니다. 링크 갱신으로 다시 받아주세요.')
      }
      throw new GatewayApiError('결과 파일을 받지 못했습니다. 네트워크를 확인한 뒤 링크 갱신으로 다시 받아주세요.')
    } finally {
      clearTimeout(timer)
    }
  }

  async function contentUrl(jobId: string, index: number) {
    const cacheKey = openRouterMediaId(jobId, index)
    const cached = objectUrls.get(cacheKey)
    if (cached) return cached
    const url = URL.createObjectURL(await fetchContent(jobId, index))
    objectUrls.set(cacheKey, url)
    return url
  }

  /** 서명 링크가 있으면 그대로, 없으면 내려받은 사본(blob:)으로 재생합니다. */
  async function toMedia(jobId: string, raw: OpenRouterVideoJob): Promise<ResultMedia[]> {
    const signed = raw.urls ?? []
    const count = Math.max(raw.unsigned_urls?.length ?? 0, signed.length)
    const expires = toIso(raw.expires_at)
    const media: ResultMedia[] = []
    for (let index = 0; index < count; index += 1) {
      const item: ResultMedia = { media_id: openRouterMediaId(jobId, index), kind: 'video', state: 'ready' }
      if (expires) item.expires_at = expires
      const link = signed[index]
      if (link?.startsWith('https://')) item.url = link
      else {
        try {
          item.url = await contentUrl(jobId, index)
        } catch {
          // 재생 사본을 못 받아도 작업은 완료입니다. 링크 갱신으로 다시 받습니다.
          item.url_unavailable_reason = 'download_failed'
        }
      }
      media.push(item)
    }
    return media
  }

  async function readJob(id: string) {
    return request<OpenRouterVideoJob>(`/videos/${encodeURIComponent(id)}`)
  }

  return {
    gateway: 'openrouter',
    async createJob(payload) {
      if (isFinalizeRequest(payload)) {
        throw new GatewayApiError('OpenRouter는 시안 확정을 지원하지 않습니다. 렛서로 바꾼 뒤 확정해주세요.')
      }
      const body = await toOpenRouterBody(payload)
      const res = await request<{ id?: string; status?: string; polling_url?: string }>('/videos', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res satisfies CreateJobResponse
    },
    async getJob(id) {
      const raw = await readJob(id)
      const status = raw.status ?? ''
      const cost = raw.usage?.cost
      const job: GatewayJob = {
        id: raw.id || id,
        status: statusMap[status] ?? status,
        ...(raw.model ? { model: raw.model } : {}),
        ...(toIso(raw.created_at) ? { created_at: toIso(raw.created_at) } : {}),
        ...(toIso(raw.updated_at) ? { updated_at: toIso(raw.updated_at) } : {}),
        result: { storage: 'openrouter', media: status === 'completed' ? await toMedia(raw.id || id, raw) : [] },
        ...(cost !== undefined && cost !== null && cost !== '' ? { usage: { amount: cost, currency: 'USD' } } : {}),
        ...(toError(raw) ? { error: toError(raw) } : {}),
      }
      return { job, raw }
    },
    async uploadReference(file: File, track: UploadTrack) {
      // OpenRouter에는 업로드 API가 없습니다. 이미지는 이 브라우저의 보관함에 두고 보낼 때 data URL로 바꿉니다.
      if (track === 'managed') throw new GatewayApiError('OpenRouter에는 관리형 업로드가 없습니다.')
      if (!isAllowedMime(IMAGE_MIMES, file.type)) {
        throw new GatewayApiError('OpenRouter에는 영상·오디오 파일을 올릴 수 없습니다. 공개 HTTPS URL을 입력해주세요.')
      }
      if (file.size > OPENROUTER_INLINE_IMAGE_MIB * 1048576) {
        throw new GatewayApiError(`OpenRouter로 직접 보내는 이미지는 ${OPENROUTER_INLINE_IMAGE_MIB} MiB 이하여야 합니다.`)
      }
      return { reference: `${LOCAL_IMAGE_SCHEME}${createId('img')}`, track: 'file' }
    },
    async issueMediaLink(mediaId) {
      const { jobId, index } = parseMediaId(mediaId)
      const raw = await readJob(jobId)
      if (raw.status === 'expired') throw new GatewayApiError(endedLabel.expired, { gateway: 'openrouter', status: 410 })
      const link = raw.urls?.[index]
      const expires = toIso(raw.expires_at)
      if (link?.startsWith('https://')) return { url: link, ...(expires ? { expires_at: expires } : {}) }
      objectUrls.delete(mediaId)
      return { url: await contentUrl(jobId, index), ...(expires ? { expires_at: expires } : {}) }
    },
    async downloadMedia() {
      throw new GatewayApiError('OpenRouter 결과에는 마지막 프레임 이미지가 없습니다.')
    },
  }
}

/** 영상 생성 모델 목록. 키 없이 조회할 수 있습니다. */
export async function fetchOpenRouterModels(): Promise<OpenRouterVideoModel[]> {
  const res = await fetch(`${openRouterApiBase}/videos/models`, { credentials: 'omit' })
  if (!res.ok) throw new GatewayApiError(`OpenRouter 모델 목록을 불러오지 못했습니다 (HTTP ${res.status}).`, { status: res.status })
  const json = (await res.json()) as { data?: OpenRouterVideoModel[] }
  return Array.isArray(json.data) ? json.data : []
}
