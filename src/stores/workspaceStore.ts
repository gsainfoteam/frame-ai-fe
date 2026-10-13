import { create } from 'zustand'
import type { MediaKind, ResultMedia, VideoGenerationRequest } from '@/api/types'
import { ROLES } from '@/config/constants'
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
  at: string
  body: VideoGenerationRequest
  status?: number
  code?: string
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
}))
