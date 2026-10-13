import type {
  FinalizeRequest,
  GenerationRequest,
  JobRecord,
  MediaKind,
  MediaReference,
  MediaReferenceRole,
  VideoMode,
} from '@/api/types'
import { asGenerationRequest, isFinalizeRequest } from '@/api/types'
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
  /** Seedance Draft: 480p 시안으로 생성 */
  preview: boolean
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

export function buildPayload(draft: PayloadDraft): GenerationRequest {
  const payload: GenerationRequest = {
    model: MODEL_ID,
    prompt: [draft.useCommon ? draft.commonPrompt.trim() : '', draft.scenePrompt.trim()]
      .filter(Boolean)
      .join('\n\n'),
    generate_audio: draft.generateAudio,
  }
  // 시안은 resolution을 생략해 480p를 적용합니다. 1080p에 draft만 붙이면 400입니다.
  if (draft.preview) payload.draft = true
  else payload.resolution = draft.resolution as GenerationRequest['resolution']

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

export function validatePayload(payload: GenerationRequest) {
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
  if (payload.draft) {
    if (payload.resolution && payload.resolution !== '480p') {
      throw new Error('시안은 480p로만 만들 수 있습니다. 1080p는 시안을 확정할 때 적용됩니다.')
    }
    if (count.video || payload.mode) {
      throw new Error('영상 참조·편집·연장에는 시안을 사용할 수 없습니다. 바로 생성으로 바꾸거나 영상 참조를 제거해주세요.')
    }
  }
  return payload
}

export type FinalizeOptions = {
  generateAudio: string
  watermark: string
  seed: string
  lastFrame: string
  store: string
}

export const emptyFinalizeOptions: FinalizeOptions = {
  generateAudio: '',
  watermark: '',
  seed: '',
  lastFrame: '',
  store: '',
}

/** 확정 요청에는 허용 필드만 넣습니다. 프롬프트·길이·비율은 원본 시안에서 이어받습니다. */
export function buildFinalizePayload(draftJobId: string, options: FinalizeOptions): FinalizeRequest {
  const payload: FinalizeRequest = { model: MODEL_ID, draft_job: draftJobId.trim() }
  if (options.generateAudio !== '') payload.generate_audio = options.generateAudio === 'true'
  if (options.watermark !== '') payload.watermark = options.watermark === 'true'
  if (options.seed !== '') payload.seed = Number(options.seed)
  if (options.lastFrame !== '') payload.return_last_frame = options.lastFrame === 'true'
  if (options.store !== '') payload.store_media = options.store === 'true'
  return payload
}

export function validateFinalizePayload(payload: FinalizeRequest) {
  if (!payload.draft_job) throw new Error('확정할 시안의 작업 ID가 필요합니다.')
  if (payload.resolution !== undefined && payload.resolution !== '1080p') {
    throw new Error('시안 확정은 1080p만 지원합니다.')
  }
  if (payload.seed !== undefined && !Number.isSafeInteger(payload.seed)) {
    throw new Error('시드는 안전하게 표현 가능한 정수로 입력해주세요.')
  }
  return payload
}

export function isPreviewRecord(record: Pick<JobRecord, 'request'> | undefined) {
  return Boolean(asGenerationRequest(record?.request)?.draft)
}

export function isFinalizeRecord(record: Pick<JobRecord, 'request'> | undefined) {
  return isFinalizeRequest(record?.request)
}

/**
 * 확정할 수 없는 시안이면 이유를 반환합니다. 요청 기록이 없는 작업(다른 기기에서 ID로 조회)은
 * 시안 여부를 알 수 없어 막지 않고, 대화상자에서 경고합니다.
 */
export function finalizeBlocker(record: JobRecord | undefined): string | null {
  if (!record) return null
  if (isFinalizeRequest(record.request)) return '이미 확정한 결과입니다. 확정 결과는 다시 확정할 수 없습니다.'
  const request = asGenerationRequest(record.request)
  if (request && !request.draft) return '일반 생성 작업은 확정할 수 없습니다. 480p 시안으로 만든 작업만 확정할 수 있습니다.'
  if (request && request.model !== MODEL_ID) return `${MODEL_ID} 모델로 만든 시안만 확정할 수 있습니다.`
  if (record.status === 'queued' || record.status === 'running') return '시안 생성이 끝난 뒤 확정할 수 있습니다.'
  if (record.status === 'failed') return '실패한 시안은 확정할 수 없습니다. 새 시안을 만들어주세요.'
  if (record.status !== 'succeeded') return '생성에 성공한 시안만 확정할 수 있습니다. 먼저 작업 상태를 조회해주세요.'
  return null
}

/** 확정 기록에는 프롬프트가 없으므로 원본 시안의 요청을 찾아 씁니다. */
export function sourceRequest(record: JobRecord | undefined, records: JobRecord[]): GenerationRequest | null {
  if (!record) return null
  if (isFinalizeRequest(record.request)) {
    const draftId = record.request.draft_job
    return asGenerationRequest(records.find((item) => item.id === draftId)?.request)
  }
  return asGenerationRequest(record.request)
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

export function inputHint(payload: GenerationRequest) {
  const framed =
    Boolean(payload.image_url) ||
    (payload.references ?? []).some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')
  if (payload.draft) return '480p 시안 · 마음에 드는 시안을 골라 1080p로 확정 · 시안과 확정 모두 과금'
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
