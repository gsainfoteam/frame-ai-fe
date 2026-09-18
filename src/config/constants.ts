export const MODEL_ID = 'byteplus-seedance-2.5'
export const MODEL_LABEL = 'Seedance 2.5'
export const API_DOCS_URL =
  'https://docs.platform.letsur.ai/ai-gateway/api-reference/endpoints/video-generations'
export const SEEDANCE_GUIDE_URL = 'https://docs.platform.letsur.ai/ai-gateway/model-guides/seedance'

export const POLL_INTERVAL_MS = 5000
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
export const UPLOAD_TIMEOUT_MS = 180_000
export const FRAME_DOWNLOAD_TIMEOUT_MS = 120_000

export const HISTORY_KEY = 'frame.projects.v2'
export const HISTORY_KEY_V1 = 'frame.history.v1'
export const IMAGE_DB = 'frame-images'
export const IMAGE_STORE = 'images'

export const PENDING_VIDEO_URL = 'https://pending.local/generated-video'

export const FILE_SIZE_MIB = { image: 30, video: 200, audio: 15 } as const
export const REF_LIMITS = { image: 30, video: 10, audio: 10 } as const
export const HISTORY_BACKUP_MIB = 20
export const IMAGE_EXPORT_MIB = 100
export const IMAGE_IMPORT_MIB = 140
export const FRAME_MAX_MIB = 30
export const PROJECT_NAME_MAX = 100

export const IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
] as const

export const VIDEO_MIMES = ['video/mp4', 'video/quicktime'] as const
export const AUDIO_MIMES = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3'] as const

export const MIME_BY_TYPE = {
  image: IMAGE_MIMES,
  video: VIDEO_MIMES,
  audio: AUDIO_MIMES,
} as const

export function isAllowedMime(list: readonly string[], type: string) {
  return list.includes(type)
}

export const ROLES = {
  image: [
    ['reference_image', '외형·스타일 참고 (일반 참조)'],
    ['first_frame', '영상 시작 화면 (첫 프레임)'],
    ['last_frame', '영상 끝 화면 (마지막 프레임)'],
  ],
  video: [['reference_video', '참조 영상']],
  audio: [['reference_audio', '참조 오디오']],
} as const

export const WORKSPACES = [
  { id: 'create', path: '/', label: '영상 만들기' },
  { id: 'project', path: '/project', label: '공통 설정' },
  { id: 'history', path: '/history', label: '생성 기록' },
  { id: 'images', path: '/library', label: '이미지 보관함' },
] as const
