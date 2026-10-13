export type MediaKind = 'image' | 'video' | 'audio'
export type MediaState = 'pending' | 'ready' | 'unavailable'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown'
export type VideoMode = 'reference' | 'edit' | 'extend'
export type Resolution = '480p' | '720p' | '1080p'
export type UploadTrack = 'file' | 'managed'

export type MediaReferenceRole =
  | 'reference_image'
  | 'first_frame'
  | 'last_frame'
  | 'reference_video'
  | 'reference_audio'

export type MediaReference = {
  type: MediaKind
  url: string
  role?: MediaReferenceRole
}

/** 일반 생성 요청. `draft: true`이면 480p 시안을 만듭니다. */
export type GenerationRequest = {
  model: string
  prompt: string
  references?: MediaReference[]
  image_url?: string
  mode?: VideoMode
  duration?: number
  resolution?: Resolution
  aspect_ratio?: string
  generate_audio: boolean
  seed?: number
  watermark?: boolean
  return_last_frame?: boolean
  store_media?: boolean
  draft?: boolean
}

/** 성공한 시안을 1080p로 확정하는 요청. 내용 필드는 보낼 수 없습니다. */
export type FinalizeRequest = {
  model: string
  draft_job: string
  resolution?: '1080p'
  generate_audio?: boolean
  watermark?: boolean
  seed?: number
  return_last_frame?: boolean
  store_media?: boolean
}

export type VideoGenerationRequest = GenerationRequest | FinalizeRequest

export function isFinalizeRequest(request: VideoGenerationRequest | null | undefined): request is FinalizeRequest {
  return Boolean(request && 'draft_job' in request && request.draft_job)
}

export function asGenerationRequest(request: VideoGenerationRequest | null | undefined): GenerationRequest | null {
  return request && !isFinalizeRequest(request) ? request : null
}

export type ResultMedia = {
  media_id: string
  kind: MediaKind
  state: MediaState
  url?: string
  url_expires_at?: number | string
  expires_at?: number | string
  url_unavailable_reason?: string | null
}

export type StoredMedia = Pick<ResultMedia, 'media_id' | 'kind' | 'state'>

export type MediaBinding = {
  index: number
  media_id: string
}

export type UsageItem = {
  unit?: string
  quantity?: string
  unit_price?: string
}

/** 금액·수량은 문자열로 보관하고 십진수 연산으로만 계산합니다. */
export type UsageInfo = {
  amount: string
  currency: string
  items?: UsageItem[]
}

export type ApiErrorInfo = {
  type?: string
  title?: string
  detail?: string
  vendor_code?: string
  message?: string
  code?: string
}

export type JobRecord = {
  id: string
  project_id: string
  created_at: string
  updated_at: string
  status: JobStatus
  request?: VideoGenerationRequest | null
  bindings: MediaBinding[]
  media: StoredMedia[]
  usage?: UsageInfo
  error?: ApiErrorInfo
}

export type Project = {
  id: string
  name: string
  prompt: string
  references: MediaReference[]
  updated_at: string
}

export type ProjectBackup = {
  version: 1 | 2
  activeProjectId: string
  projects: Project[]
  records: JobRecord[]
}

export type ImageAsset = {
  id: string
  project_id: string
  name: string
  type: string
  size: number
  created_at: string
  reference: string
  track: UploadTrack
  blob?: Blob
}

export type RawUsage = {
  amount?: string | number
  currency?: string
  items?: Array<{ unit?: string; quantity?: string | number; unit_price?: string | number }>
}

export type LetsurJob = {
  id?: string
  status: string
  model?: string
  created_at?: string
  updated_at?: string
  /** `letsur`이면 렛서에 보관, `none`이면 보관하지 않아 반복 조회로도 받을 수 없음 */
  result?: { storage?: string; media?: ResultMedia[] }
  usage?: RawUsage
  error?: ApiErrorInfo
}

export type CreateJobResponse = {
  id?: string
  /** 제출 시에는 금액을 제공하지 않습니다. null을 0으로 해석하지 않습니다. */
  estimated_cost?: unknown
}

export type GetJobResponse = {
  data?: { job?: LetsurJob }
}

export type UploadReferenceResponse = {
  reference?: string
  track?: UploadTrack
}

export type MediaLinkResponse = {
  url?: string
  /** 링크 만료 시각 */
  url_expires_at?: number | string
  /** 파일 보관 만료 시각. 링크를 다시 발급해도 늘어나지 않습니다. */
  expires_at?: number | string
}
