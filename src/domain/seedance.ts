import type { VideoGenerationRequest } from '@/api/types'
import type { MediaKind, MediaReference, MediaReferenceRole, VideoMode } from '@/api/types'
import { MODEL_ID, PENDING_VIDEO_URL, REF_LIMITS } from '@/config/constants'
import { validRef } from '@/shared/lib/url'

export type DraftReference = {
  type: MediaKind
  url: string
  role?: string
  mediaId?: string
  managed?: boolean
  filePending?: boolean
}

export type PayloadDraft = {
  commonPrompt: string
  useCommon: boolean
  scenePrompt: string
  imageUrl: string
  imagePerson: boolean
  sceneReferences: DraftReference[]
  sharedReferences: MediaReference[]
  useShared: boolean
  mode: string
  duration: string
  customDuration: number
  resolution: string
  ratio: string
  generateAudio: boolean
  seed: string
  watermark: string
  lastFrame: string
  store: string
}

type SelectedRef = {
  type: MediaKind
  url: string
  role?: MediaReferenceRole
  mediaId?: string
}

export function selectedReferences(draft: PayloadDraft): SelectedRef[] {
  const scene = draft.sceneReferences
  const shared = draft.useShared ? draft.sharedReferences : []
  return [
    ...scene.map((ref) => ({
      type: ref.type,
      url: ref.url.trim() || (ref.mediaId ? PENDING_VIDEO_URL : ''),
      ...(ref.role ? { role: ref.role as MediaReferenceRole } : {}),
      mediaId: ref.mediaId,
    })),
    ...shared.map((ref) => ({ type: ref.type, url: ref.url, role: ref.role })),
  ]
}

export function buildPayload(draft: PayloadDraft): VideoGenerationRequest {
  const payload: VideoGenerationRequest = {
    model: MODEL_ID,
    prompt: [draft.useCommon ? draft.commonPrompt.trim() : '', draft.scenePrompt.trim()]
      .filter(Boolean)
      .join('\n\n'),
    resolution: draft.resolution as VideoGenerationRequest['resolution'],
    generate_audio: draft.generateAudio,
  }

  const refs = selectedReferences(draft).map((item) => ({
    type: item.type,
    url: item.url,
    ...(item.role ? { role: item.role } : {}),
  }))
  if (refs.length) payload.references = refs
  if (draft.imageUrl.trim()) payload.image_url = draft.imageUrl.trim()
  if (draft.mode) payload.mode = draft.mode as VideoMode
  if (draft.duration) {
    payload.duration = Number(draft.duration === 'custom' ? draft.customDuration : draft.duration)
  }
  if (draft.ratio) payload.aspect_ratio = draft.ratio
  if (draft.seed !== '') payload.seed = Number(draft.seed)
  if (draft.watermark !== '') payload.watermark = draft.watermark === 'true'
  if (draft.lastFrame !== '') payload.return_last_frame = draft.lastFrame === 'true'
  if (draft.store !== '') payload.store_media = draft.store === 'true'
  return payload
}

export function validatePayload(payload: VideoGenerationRequest) {
  if (!payload.prompt) throw new Error('장면 설명을 입력해주세요.')
  if (
    payload.duration !== undefined &&
    (!Number.isInteger(payload.duration) ||
      (payload.duration !== -1 && (payload.duration < 4 || payload.duration > 30)))
  ) {
    throw new Error('영상 길이는 4–30초 정수 또는 자동 선택이어야 합니다.')
  }
  if (payload.seed !== undefined && !Number.isSafeInteger(payload.seed)) {
    throw new Error('시드는 안전하게 표현 가능한 정수로 입력해주세요.')
  }
  if (payload.image_url && !validRef(payload.image_url)) {
    throw new Error('첫 프레임에 HTTPS URL 또는 업로드 참조를 입력해주세요.')
  }

  const refs = payload.references ?? []
  const count = { image: 0, video: 0, audio: 0 }
  const allowed: Record<MediaKind, string[]> = {
    image: ['first_frame', 'last_frame', 'reference_image'],
    video: ['reference_video'],
    audio: ['reference_audio'],
  }

  for (const ref of refs) {
    if (!['image', 'video', 'audio'].includes(ref.type)) {
      throw new Error('지원되지 않는 참조 종류입니다.')
    }
    if (!validRef(ref.url)) {
      throw new Error('모든 참조에 HTTPS URL 또는 업로드 참조를 입력해주세요.')
    }
    if (ref.role && !allowed[ref.type].includes(ref.role)) {
      throw new Error('참조 종류와 역할이 맞지 않습니다.')
    }
    count[ref.type] += 1
  }

  if (count.image > REF_LIMITS.image || count.video > REF_LIMITS.video || count.audio > REF_LIMITS.audio) {
    throw new Error('참조 배열 상한은 이미지 30개, 영상 10개, 오디오 10개입니다.')
  }

  const first = refs.filter((ref) => ref.role === 'first_frame').length + (payload.image_url ? 1 : 0)
  const last = refs.filter((ref) => ref.role === 'last_frame').length
  if (first > 1) throw new Error('첫 프레임은 하나만 지정할 수 있습니다.')
  if (last > 1) throw new Error('마지막 프레임은 하나만 지정할 수 있습니다.')
  if (last && !first) throw new Error('마지막 프레임을 쓰려면 첫 프레임도 지정해주세요.')

  const framed = first > 0 || last > 0
  if (framed && refs.some((ref) => !['first_frame', 'last_frame'].includes(ref.role ?? ''))) {
    throw new Error(
      '첫·마지막 프레임은 일반 이미지·영상·오디오 참조와 함께 사용할 수 없습니다. 프레임 지정 또는 일반 참조 중 하나를 선택해주세요.',
    )
  }
  if (payload.mode && !count.video) {
    throw new Error('영상 참고·편집·연장 방식에는 영상 참조가 필요합니다.')
  }
  if (payload.mode && !['reference', 'edit', 'extend'].includes(payload.mode)) {
    throw new Error('지원되지 않는 영상 사용 방식입니다.')
  }
  if ((framed || payload.mode === 'edit' || payload.mode === 'extend') && payload.aspect_ratio && payload.aspect_ratio !== 'adaptive') {
    throw new Error('프레임 지정 또는 영상 편집·연장은 화면 비율을 기본값 또는 자동 맞춤으로 설정해주세요.')
  }
  if (payload.mode === 'edit' && payload.duration !== undefined && payload.duration !== -1) {
    throw new Error('영상 편집은 길이를 모델 기본값 또는 자동 선택으로 설정해주세요.')
  }
  return payload
}

export function validateDraftInputs(draft: PayloadDraft) {
  if (draft.imagePerson && draft.imageUrl.trim() && !draft.imageUrl.trim().startsWith('letsur-asset://')) {
    throw new Error('인물이 포함된 첫 프레임은 관리형으로 업로드한 letsur-asset:// 참조가 필요합니다.')
  }
  for (const ref of selectedReferences(draft)) {
    const source = draft.sceneReferences.find(
      (item) => item.mediaId === ref.mediaId && item.url === (ref.url === PENDING_VIDEO_URL ? '' : ref.url),
    )
    if (source?.filePending && !source.url) {
      throw new Error('선택한 파일을 먼저 업로드해주세요.')
    }
    if (source?.managed && source.url && !source.url.startsWith('letsur-asset://')) {
      throw new Error(
        '인물·관리형 참조에는 letsur-asset:// 값이 필요합니다. 관리형 업로드로 파일을 다시 올려주세요. 기존 letsur-file:// 문자열을 바꾸면 안 됩니다.',
      )
    }
  }
  for (const ref of draft.sceneReferences) {
    if (ref.filePending && !ref.url) throw new Error('선택한 파일을 먼저 업로드해주세요.')
    if (ref.managed && ref.url && !ref.url.startsWith('letsur-asset://')) {
      throw new Error(
        '인물·관리형 참조에는 letsur-asset:// 값이 필요합니다. 관리형 업로드로 파일을 다시 올려주세요. 기존 letsur-file:// 문자열을 바꾸면 안 됩니다.',
      )
    }
  }
}

export function inputHint(payload: VideoGenerationRequest) {
  const framed =
    Boolean(payload.image_url) ||
    (payload.references ?? []).some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')
  if (framed) return '프레임 지정 · 비율은 기본값/자동 맞춤만 사용 · 일반 참조와 혼합 불가'
  if (payload.mode === 'edit') return '영상 편집 · 길이는 기본값/자동 선택 · 비율은 기본값/자동 맞춤'
  if (payload.mode === 'extend') return '영상 연장 · 기본 길이 자동 · 비율은 기본값/자동 맞춤'
  return '일반 생성 · 기본 길이 5초 · 인물이 포함된 참조는 관리형 업로드 사용'
}

export function captureBindings(draft: PayloadDraft) {
  return selectedReferences(draft).flatMap((ref, index) =>
    ref.mediaId ? [{ index, media_id: ref.mediaId }] : [],
  )
}
