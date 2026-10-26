import { create } from 'zustand'
import type { MediaKind, ResultMedia, VideoGenerationRequest } from '@/api/types'
import type { GatewayId } from '@/api/gateway'
import { ROLES } from '@/config/constants'
import { modelCapabilities, type ModelSpec } from '@/domain/models'
import { createId } from '@/shared/lib/id'

export type ReferenceDraft = {
  id: string
  type: MediaKind
  role: string
  url: string
  managed: boolean
  mediaId?: string
  status: string
  file?: File | null
  /** 브라우저에서 읽은 영상·오디오 길이(초). 입력 조건 경고용 */
  durationSec?: number
}

export type PreviewMedia = {
  url: string
  kind: string
  mediaId: string
}

/** 접수 여부를 알 수 없거나 거절된 제출. 담당자 문의용 정보로 사용합니다 (API 키 제외). */
export type SubmissionFailure = {
  /** 요청을 보낸 게이트웨이. 이전 기록에는 없을 수 있습니다(렛서). */
  gateway?: GatewayId
  at: string
  endpoint: string
  body: VideoGenerationRequest
  status?: number
  code?: string
  /** 공통 오류 형식의 error_ref */
  ref?: string
  message: string
}

export type GenerationKind = 'direct' | 'preview'

export type ContinuationSession = {
  jobId: string
  mediaId: string
  projectId: string
  previewUrl: string
}

type WorkspaceState = {
  useCommon: boolean
  useShared: boolean
  prompt: string
  imageUrl: string
  imagePerson: boolean
  firstFramePreview: string | null
  references: ReferenceDraft[]
  sharedReferences: ReferenceDraft[]
  refOpen: boolean
  mode: string
  /** OpenRouter에서 고른 모델 ID. 빈 값이면 게이트웨이 기본 모델입니다. */
  model: string
  generation: GenerationKind
  previewCount: number
  duration: string
  customDuration: number
  resolution: string
  ratio: string
  audio: boolean
  seed: string
  watermark: string
  lastFrame: string
  store: string
  jobId: string
  submitting: boolean
  uploads: number
  status: string
  cost: string
  notice: string
  noticeError: boolean
  rawResponse: string
  media: ResultMedia[]
  preview: PreviewMedia | null
  polling: boolean
  continuation: ContinuationSession | null
  /** 1080p 확정 대화상자를 열 시안의 작업 ID */
  finalizeTarget: string | null
  /** `queue_full` 응답을 받은 시각과 Retry-After가 끝나는 시각(ms) */
  submitBlock: { at: number; until: number } | null
  lastSubmission: SubmissionFailure | null
  set: (patch: Partial<WorkspaceState>) => void
  resetScene: () => void
  addReference: (initial?: Partial<ReferenceDraft>) => string
  addSharedReference: (initial?: Partial<ReferenceDraft>) => string
  updateReference: (id: string, patch: Partial<ReferenceDraft>) => void
  updateSharedReference: (id: string, patch: Partial<ReferenceDraft>) => void
  removeReference: (id: string) => void
  removeSharedReference: (id: string) => void
  clearReferences: () => void
  loadSharedReferences: (refs: Array<Partial<ReferenceDraft>>) => void
  bumpUploads: (delta: number) => void
  setNotice: (text: string, error?: boolean) => void
  /** 게이트웨이·모델이 지원하지 않는 설정을 기본값으로 되돌립니다. 바꾼 항목 이름을 돌려줍니다. */
  fitToModel: (spec: ModelSpec) => string[]
}

const sceneDefaults = {
  prompt: '',
  imageUrl: '',
  imagePerson: false,
  firstFramePreview: null as string | null,
  references: [] as ReferenceDraft[],
  sharedReferences: [] as ReferenceDraft[],
  refOpen: false,
  mode: '',
  useCommon: true,
  useShared: true,
}

export const emptyWorkspaceResult = {
  jobId: '',
  status: '준비',
  cost: '비용 미확정',
  notice: '생성 요청이 접수되면 10~30초 간격으로 진행 상태를 확인합니다.',
  noticeError: false,
  rawResponse: '아직 응답이 없습니다.',
  media: [] as ResultMedia[],
  preview: null as PreviewMedia | null,
}

export function newReference(initial?: Partial<ReferenceDraft>): ReferenceDraft {
  const type = initial?.type ?? 'image'
  const roles = ROLES[type]
  return {
    id: initial?.id ?? createId('ref'),
    type,
    role: initial?.role ?? roles[0][0],
    url: initial?.url ?? '',
    managed: initial?.managed ?? (initial?.url ?? '').startsWith('letsur-asset://'),
    mediaId: initial?.mediaId,
    status: initial?.status ?? '',
    file: initial?.file ?? null,
    durationSec: initial?.durationSec,
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...sceneDefaults,
  model: '',
  generation: 'direct' as GenerationKind,
  previewCount: 1,
  duration: '',
  customDuration: 8,
  resolution: '480p',
  ratio: '',
  audio: true,
  seed: '',
  watermark: '',
  lastFrame: '',
  store: '',
  submitting: false,
  uploads: 0,
  polling: false,
  continuation: null,
  finalizeTarget: null,
  submitBlock: null,
  lastSubmission: null,
  ...emptyWorkspaceResult,
  set: (patch) => set(patch),
  resetScene: () =>
    set({
      ...sceneDefaults,
      ...emptyWorkspaceResult,
    }),
  addReference: (initial) => {
    const ref = newReference(initial)
    set({ references: [...get().references, ref], refOpen: true })
    return ref.id
  },
  addSharedReference: (initial) => {
    const ref = newReference({ type: 'image', ...initial })
    set({ sharedReferences: [...get().sharedReferences, ref] })
    return ref.id
  },
  updateReference: (id, patch) => {
    set({
      references: get().references.map((ref) => (ref.id === id ? { ...ref, ...patch } : ref)),
    })
  },
  updateSharedReference: (id, patch) => {
    set({
      sharedReferences: get().sharedReferences.map((ref) => (ref.id === id ? { ...ref, ...patch } : ref)),
    })
  },
  removeReference: (id) => set({ references: get().references.filter((ref) => ref.id !== id) }),
  removeSharedReference: (id) => set({ sharedReferences: get().sharedReferences.filter((ref) => ref.id !== id) }),
  clearReferences: () => set({ references: [] }),
  loadSharedReferences: (refs) => set({ sharedReferences: refs.map((item) => newReference({ type: 'image', ...item })) }),
  bumpUploads: (delta) => set({ uploads: Math.max(0, get().uploads + delta) }),
  setNotice: (notice, noticeError = false) => set({ notice, noticeError }),
  fitToModel: (spec) => {
    const state = get()
    const caps = modelCapabilities(spec)
    const patch: Partial<WorkspaceState> = {}
    const changed: string[] = []
    if (state.generation === 'preview' && !caps.draft) {
      patch.generation = 'direct'
      changed.push('생성 방식')
    }
    if (!spec.resolutions.includes(state.resolution)) {
      patch.resolution = spec.resolutions.includes('720p') ? '720p' : spec.resolutions[0]
      changed.push('해상도')
    }
    if (state.ratio && !spec.aspectRatios.includes(state.ratio)) {
      patch.ratio = ''
      changed.push('화면 비율')
    }
    const seconds = state.duration === 'custom' ? state.customDuration : Number(state.duration)
    if (state.duration && !(spec.autoDuration && state.duration === '-1') && !spec.durations.includes(seconds)) {
      patch.duration = ''
      changed.push('영상 길이')
    }
    if (state.mode && (!caps.videoModes || (spec.kind === 'kling-omni' && state.mode === 'extend'))) patch.mode = ''
    if (!spec.seed && state.seed) {
      patch.seed = ''
      changed.push('시드')
    }
    if (!caps.lastFrame && state.lastFrame) patch.lastFrame = ''
    if (!caps.storeMedia && state.store) patch.store = ''
    if (Object.keys(patch).length) set(patch)
    return changed
  },
}))
