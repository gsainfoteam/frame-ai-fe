import { z } from 'zod/mini'

const referenceSchema = z.object({
  id: z.string(), type: z.enum(['image', 'video', 'audio']), role: z.string(), url: z.string(),
  managed: z.boolean(), mediaId: z.optional(z.string()), status: z.string(), durationSec: z.optional(z.number()),
})

/** 작성 입력만 저장합니다. File·API 키·재생 URL·통신 중 상태는 저장하지 않습니다. */
const draftSchema = z.object({
  draftGateway: z.enum(['openrouter', 'letsur']),
  prompt: z.string(), imageUrl: z.string(), imagePerson: z.boolean(),
  useCommon: z.boolean(), useShared: z.boolean(), refOpen: z.boolean(),
  references: z.array(referenceSchema),
  model: z.string(), generation: z.enum(['direct', 'preview']), previewCount: z.int().check(z.minimum(1), z.maximum(4)),
  duration: z.string(), customDuration: z.number(), resolution: z.string(), ratio: z.string(),
  audio: z.boolean(), seed: z.string(), watermark: z.string(), lastFrame: z.string(), store: z.string(), mode: z.string(),
  jobId: z.string(),
})

export type SavedDraft = z.infer<typeof draftSchema>
const key = (projectId: string) => `frame.draft.v1:${projectId}`

export function loadWorkspaceDraft(projectId: string): { draft?: SavedDraft; failed: boolean } {
  try {
    const raw = localStorage.getItem(key(projectId))
    if (!raw) return { failed: false }
    const data = JSON.parse(raw)
    if (data?.version !== 1) throw new Error('Invalid draft version')
    return { draft: draftSchema.parse(data.draft), failed: false }
  } catch {
    return { failed: true }
  }
}

export function serializeWorkspaceDraft(state: SavedDraft) {
  const draft = draftSchema.parse(state)
  draft.references = draft.references.map((ref) => ({
    ...ref,
    // 생성 영상 참조의 서명 URL은 다음 요청 직전에 mediaId로 다시 발급합니다.
    url: ref.mediaId ? '' : ref.url,
    status: ref.mediaId ? '이전 생성 영상 · 전송 전에 링크를 갱신합니다.' : ref.url ? '' : '파일을 다시 선택하거나 URL을 입력해주세요.',
  }))
  return JSON.stringify({ version: 1, draft })
}

export function saveWorkspaceDraft(projectId: string, serialized: string) {
  localStorage.setItem(key(projectId), serialized)
}
