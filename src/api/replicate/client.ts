import type { VideoApi } from '@/api/videoApi'
import type {
  ApiErrorInfo,
  CreateJobResponse,
  GatewayJob,
  GenerationRequest,
  ResultMedia,
  UploadTrack,
} from '@/api/types'
import { isFinalizeRequest } from '@/api/types'
import { GatewayApiError } from '@/api/errors'
import { createRequester } from '@/api/http'
import { UPLOAD_TIMEOUT_MS } from '@/config/constants'
import { replicateApiBase } from '@/config/env'
import { replicateHint } from '@/domain/errors'

/** Replicate Files API (`POST /v1/files`) 최대 파일 크기 */
export const REPLICATE_MAX_FILE_MIB = 100

const MEDIA_PREFIX = 'replicate:'

/** `GET /v1/predictions/{id}` 응답 */
type ReplicatePrediction = {
  id?: string
  model?: string
  version?: string
  status?: string
  created_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  data_removed?: boolean
  output?: unknown
  error?: unknown
  logs?: string | null
  metrics?: Record<string, unknown> | null
  urls?: { get?: string; cancel?: string; web?: string }
}

type ReplicateFileResponse = {
  id?: string
  name?: string
  content_type?: string
  size?: number
  expires_at?: string
  urls?: { get?: string }
}

const statusMap: Record<string, GatewayJob['status']> = {
  starting: 'queued',
  processing: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  canceled: 'failed',
  aborted: 'failed',
}

const endedLabel: Record<string, string> = {
  canceled: '작업이 취소되었습니다.',
  aborted: '작업이 시작 전 시간 초과로 중단되었습니다.',
}

/** 결과 미디어 ID는 `replicate:{predictionId}#{순번}`입니다. 다른 게이트웨이와 겹치지 않게 접두사를 붙입니다. */
export function replicateMediaId(jobId: string, index: number) {
  return `${MEDIA_PREFIX}${jobId}#${index}`
}

function parseMediaId(mediaId: string) {
  if (!mediaId.startsWith(MEDIA_PREFIX)) throw new GatewayApiError('결과 파일 ID가 올바르지 않습니다.')
  const rest = mediaId.slice(MEDIA_PREFIX.length)
  const at = rest.lastIndexOf('#')
  const index = Number(rest.slice(at + 1))
  if (at <= 0 || !Number.isInteger(index) || index < 0) throw new GatewayApiError('결과 파일 ID가 올바르지 않습니다.')
  return { jobId: rest.slice(0, at), index }
}

function parseModelPath(model: string) {
  const parts = model.split('/').filter(Boolean)
  if (parts.length !== 2) throw new GatewayApiError(`Replicate 모델 형식(owner/name)이 올바르지 않습니다: ${model}`)
  return { owner: parts[0], name: parts[1] }
}

function toError(raw: ReplicatePrediction): ApiErrorInfo | undefined {
  const status = raw.status ?? ''
  if (!['failed', 'canceled', 'aborted'].includes(status)) return undefined
  const error = raw.error
  const info: ApiErrorInfo = { code: status }
  if (typeof error === 'string' && error) info.message = error
  else if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e.message === 'string') info.message = e.message
    if (typeof e.detail === 'string') info.detail = e.detail
    if (typeof e.code === 'string' || typeof e.code === 'number') info.code = String(e.code)
  }
  if (!info.message && !info.detail) info.message = endedLabel[status] ?? '영상 생성에 실패했습니다.'
  return info
}

function extractOutputUrls(output: unknown): string[] {
  if (typeof output === 'string') return output.startsWith('https://') ? [output] : []
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === 'string' && item.startsWith('https://'))
  }
  return []
}

function toMedia(jobId: string, raw: ReplicatePrediction): ResultMedia[] {
  const urls = extractOutputUrls(raw.output)
  if (urls.length) {
    return urls.map((url, index) => ({
      media_id: replicateMediaId(jobId, index),
      kind: 'video',
      state: 'ready',
      url,
    }))
  }
  if (raw.data_removed) {
    return [
      {
        media_id: replicateMediaId(jobId, 0),
        kind: 'video',
        state: 'unavailable',
        url_unavailable_reason: 'retention_expired',
      },
    ]
  }
  return []
}

/**
 * 공통 요청을 Replicate `bytedance/seedance-2.5` 입력 스키마(`input`)로 바꿉니다.
 * - 첫 프레임: `image`, 끝 프레임: `last_frame_image`
 * - 일반 참조: `reference_images`, `reference_videos`, `reference_audios`
 * - 첫·끝 프레임 사용 시 `aspect_ratio`가 비어 있으면 스키마 요구대로 `'adaptive'`를 보냅니다.
 */
export function toReplicateInput(payload: GenerationRequest): Record<string, unknown> {
  let image: string | undefined = payload.image_url || undefined
  let lastFrameImage: string | undefined
  const referenceImages: string[] = []
  const referenceVideos: string[] = []
  const referenceAudios: string[] = []

  for (const ref of payload.references ?? []) {
    if (ref.role === 'first_frame') image = ref.url
    else if (ref.role === 'last_frame') lastFrameImage = ref.url
    else if (ref.type === 'video') referenceVideos.push(ref.url)
    else if (ref.type === 'audio') referenceAudios.push(ref.url)
    else referenceImages.push(ref.url)
  }

  const input: Record<string, unknown> = { prompt: payload.prompt }
  if (image) input.image = image
  if (lastFrameImage) input.last_frame_image = lastFrameImage
  if (referenceImages.length) input.reference_images = referenceImages
  if (referenceVideos.length) input.reference_videos = referenceVideos
  if (referenceAudios.length) input.reference_audios = referenceAudios
  if (payload.duration !== undefined) input.duration = payload.duration
  if (payload.resolution) input.resolution = payload.resolution
  if (payload.aspect_ratio) input.aspect_ratio = payload.aspect_ratio
  else if (image || lastFrameImage) input.aspect_ratio = 'adaptive'
  if (payload.generate_audio !== undefined) input.generate_audio = payload.generate_audio
  if (payload.watermark !== undefined) input.watermark = payload.watermark
  if (payload.seed !== undefined) input.seed = payload.seed
  return input
}

export function toReplicateBody(payload: GenerationRequest) {
  return { input: toReplicateInput(payload) }
}

export function createReplicateClient(getKey: () => string): VideoApi {
  const request = createRequester({
    gateway: 'replicate',
    base: replicateApiBase,
    getKey,
    hint: replicateHint,
  })

  async function readPrediction(id: string) {
    return request<ReplicatePrediction>(`/predictions/${encodeURIComponent(id)}`)
  }

  return {
    gateway: 'replicate',
    async createJob(payload) {
      if (isFinalizeRequest(payload)) {
        throw new GatewayApiError('Replicate는 시안 확정을 지원하지 않습니다. 렛서로 바꾼 뒤 확정해주세요.')
      }
      const { owner, name } = parseModelPath(payload.model)
      const res = await request<ReplicatePrediction>(
        `/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
        {
          method: 'POST',
          body: JSON.stringify(toReplicateBody(payload)),
        },
      )
      return { id: res.id } satisfies CreateJobResponse
    },
    async getJob(id) {
      const raw = await readPrediction(id)
      const status = raw.status ?? ''
      const jobId = raw.id || id
      const updated = raw.completed_at || raw.started_at || raw.created_at || undefined
      const job: GatewayJob = {
        id: jobId,
        status: statusMap[status] ?? status,
        ...(raw.model ? { model: raw.model } : {}),
        ...(raw.created_at ? { created_at: raw.created_at } : {}),
        ...(updated ? { updated_at: updated } : {}),
        result: { storage: 'replicate', media: status === 'succeeded' ? toMedia(jobId, raw) : [] },
        ...(toError(raw) ? { error: toError(raw) } : {}),
      }
      return { job, raw }
    },
    async uploadReference(file: File, track: UploadTrack) {
      if (track === 'managed') throw new GatewayApiError('Replicate에는 관리형 업로드가 없습니다.')
      if (file.size > REPLICATE_MAX_FILE_MIB * 1048576) {
        throw new GatewayApiError(
          `Replicate 파일 업로드는 ${REPLICATE_MAX_FILE_MIB} MiB 이하여야 합니다. 크기를 줄이거나 공개 HTTPS URL을 입력해주세요.`,
        )
      }
      const form = new FormData()
      form.append('content', file, file.name)
      const res = await request<ReplicateFileResponse>('/files', {
        method: 'POST',
        body: form,
        timeout: UPLOAD_TIMEOUT_MS,
      })
      const url = res.urls?.get
      if (!url || !url.startsWith('https://')) {
        throw new GatewayApiError('Replicate 파일 업로드 응답에 파일 URL이 없습니다.', {
          gateway: 'replicate',
          payload: res,
        })
      }
      return { reference: url, track: 'file' }
    },
    async issueMediaLink(mediaId) {
      const { jobId, index } = parseMediaId(mediaId)
      const raw = await readPrediction(jobId)
      if (raw.data_removed) {
        throw new GatewayApiError('결과 보관기한(약 1시간)이 지나 더 이상 받을 수 없습니다.', {
          gateway: 'replicate',
          status: 410,
        })
      }
      const urls = extractOutputUrls(raw.output)
      const url = urls[index]
      if (!url) {
        throw new GatewayApiError('결과 파일 링크를 찾지 못했습니다. 보관기한이 지났을 수 있습니다.', {
          gateway: 'replicate',
          status: 410,
        })
      }
      return { url }
    },
    async downloadMedia() {
      throw new GatewayApiError('Replicate 결과에는 마지막 프레임 이미지가 없습니다.')
    },
  }
}
