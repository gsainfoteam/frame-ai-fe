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

export type VideoGenerationRequest = {
  model: string
  prompt: string
  references?: MediaReference[]
  image_url?: string
  mode?: VideoMode
  duration?: number
  resolution: Resolution
  aspect_ratio?: string
  generate_audio: boolean
  seed?: number
  watermark?: boolean
  return_last_frame?: boolean
  store_media?: boolean
}

export type ResultMedia = {
  media_id: string
  kind: MediaKind
  state: MediaState
  url?: string
  url_expires_at?: number
  url_unavailable_reason?: string
}

export type StoredMedia = Pick<ResultMedia, 'media_id' | 'kind' | 'state'>

export type MediaBinding = {
  index: number
  media_id: string
}

export type UsageInfo = {
  amount: string
  currency: string
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

export type LetsurJob = {
  id?: string
  status: string
  created_at?: string
  updated_at?: string
  result?: { media?: ResultMedia[] }
  usage?: UsageInfo
  error?: ApiErrorInfo
}

export type CreateJobResponse = {
  id?: string
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
  url_expires_at?: number
}
