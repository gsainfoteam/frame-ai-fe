import type {
  ApiErrorInfo,
  ImageAsset,
  JobRecord,
  JobStatus,
  MediaBinding,
  MediaReference,
  Project,
  ProjectBackup,
  StoredMedia,
  VideoGenerationRequest,
} from '@/api/types'
import { IMAGE_MIMES, PROJECT_NAME_MAX, isAllowedMime } from '@/config/constants'
import { validRef } from '@/shared/lib/url'

export function cleanRequest(value: unknown): VideoGenerationRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const p = value as Record<string, unknown>
  const out: Partial<VideoGenerationRequest> = {}
  for (const key of ['model', 'prompt', 'image_url', 'mode', 'resolution', 'aspect_ratio'] as const) {
    if (typeof p[key] === 'string') (out as Record<string, unknown>)[key] = p[key]
  }
  for (const key of ['duration', 'seed'] as const) {
    if (Number.isSafeInteger(p[key])) (out as Record<string, unknown>)[key] = p[key]
  }
  for (const key of ['generate_audio', 'watermark', 'return_last_frame', 'store_media'] as const) {
    if (typeof p[key] === 'boolean') (out as Record<string, unknown>)[key] = p[key]
  }
  if (Array.isArray(p.references)) {
    out.references = p.references
      .map((item) => {
        const ref = item as MediaReference
        return {
          type: ref.type,
          url: ref.url,
          ...(ref.role ? { role: ref.role } : {}),
        }
      })
      .filter((ref) => ['image', 'video', 'audio'].includes(ref.type) && typeof ref.url === 'string')
  }
  return out as VideoGenerationRequest
}

export function cleanRecord(record: unknown): JobRecord {
  const r = record as JobRecord
  if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 200) {
    throw new Error('작업 ID가 올바르지 않은 기록입니다.')
  }
  const statuses: JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'unknown']
  const out: JobRecord = {
    id: r.id,
    project_id: typeof r.project_id === 'string' ? r.project_id : 'default',
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
    status: statuses.includes(r.status) ? r.status : 'unknown',
    request: cleanRequest(r.request),
    media: [],
    bindings: [],
  }
  if (Array.isArray(r.media)) {
    out.media = r.media
      .filter(
        (m): m is StoredMedia =>
          typeof m.media_id === 'string' && ['video', 'image', 'audio'].includes(m.kind),
      )
      .map((m) => ({
        media_id: m.media_id,
        kind: m.kind,
        state: (['pending', 'ready', 'unavailable'] as const).includes(m.state) ? m.state : 'pending',
      }))
  }
  if (Array.isArray(r.bindings)) {
    out.bindings = r.bindings
      .filter((b): b is MediaBinding => Number.isInteger(b.index) && b.index >= 0 && typeof b.media_id === 'string')
      .map((b) => ({ index: b.index, media_id: b.media_id }))
  }
  for (const binding of out.bindings) {
    if (out.request?.references?.[binding.index]) out.request.references[binding.index].url = ''
  }
  if (r.usage && typeof r.usage.amount === 'string' && typeof r.usage.currency === 'string') {
    out.usage = { amount: r.usage.amount, currency: r.usage.currency }
  }
  if (r.error && typeof r.error === 'object') {
    const error: ApiErrorInfo = {}
    for (const key of ['type', 'title', 'detail', 'vendor_code', 'message', 'code'] as const) {
      if (typeof r.error[key] === 'string') error[key] = r.error[key]
    }
    out.error = error
  }
  return out
}

export function cleanProject(value: unknown): Project {
  const p = value as Project
  if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim()) {
    throw new Error('프로젝트 정보가 올바르지 않습니다.')
  }
  const refs = cleanRequest({ references: Array.isArray(p.references) ? p.references : [] })?.references ?? []
  if (
    refs.length > 30 ||
    refs.some(
      (ref) =>
        ref.type !== 'image' ||
        !['first_frame', 'last_frame', 'reference_image'].includes(ref.role ?? '') ||
        !validRef(ref.url),
    )
  ) {
    throw new Error('프로젝트 참조 이미지를 확인해주세요.')
  }
  return {
    id: p.id,
    name: p.name.trim().slice(0, PROJECT_NAME_MAX),
    prompt: typeof p.prompt === 'string' ? p.prompt : '',
    references: refs,
    updated_at: typeof p.updated_at === 'string' ? p.updated_at : new Date().toISOString(),
  }
}

export function parseProjectBackup(text: string): ProjectBackup {
  const data = JSON.parse(text) as {
    version?: number
    records?: unknown[]
    projects?: unknown[]
    activeProjectId?: string
  }
  if (![1, 2].includes(data.version ?? 0) || !Array.isArray(data.records) || data.records.length > 10000) {
    throw new Error('지원되는 기록 백업 파일이 아닙니다.')
  }
  const records = data.records.map(cleanRecord)
  const projects =
    data.version === 2
      ? Array.isArray(data.projects)
        ? data.projects.map(cleanProject)
        : (() => {
            throw new Error('프로젝트 목록이 없습니다.')
          })()
      : [
          {
            id: 'default',
            name: '기본 프로젝트',
            prompt: '',
            references: [] as MediaReference[],
            updated_at: new Date().toISOString(),
          },
        ]
  if (!projects.length || new Set(projects.map((p) => p.id)).size !== projects.length) {
    throw new Error('중복되거나 빈 프로젝트 목록입니다.')
  }
  if (records.some((r) => !projects.some((p) => p.id === r.project_id))) {
    throw new Error('기록의 프로젝트가 백업에 없습니다.')
  }
  return {
    version: data.version === 2 ? 2 : 1,
    projects,
    records,
    activeProjectId: projects.some((p) => p.id === data.activeProjectId)
      ? (data.activeProjectId as string)
      : projects[0].id,
  }
}

export function mergeProjectBackup(current: ProjectBackup, incoming: ProjectBackup): ProjectBackup {
  const projects = new Map(current.projects.map((p) => [p.id, p]))
  for (const project of incoming.projects) projects.set(project.id, project)
  const records = new Map(current.records.map((r) => [r.id, r]))
  for (const record of incoming.records) {
    const old = records.get(record.id)
    if (!old || record.updated_at > old.updated_at) records.set(record.id, record)
  }
  return {
    version: 2,
    projects: [...projects.values()],
    records: [...records.values()],
    activeProjectId: incoming.activeProjectId,
  }
}

function dataUrlToBlob(data: string, type: string) {
  const match = data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]*)$/)
  if (!match || match[1] !== type) throw new Error('이미지 데이터 형식이 올바르지 않습니다.')
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
  return { bytes, blob: new Blob([bytes], { type }) }
}

export function parseImageBackup(text: string): ImageAsset[] {
  const data = JSON.parse(text) as { format?: string; version?: number; images?: unknown[] }
  if (data.format !== 'frame-image-library' || data.version !== 1 || !Array.isArray(data.images) || data.images.length > 1000) {
    throw new Error('이미지 보관함 백업 파일이 아닙니다.')
  }
  let total = 0
  return data.images.map((item) => {
    const a = item as ImageAsset & { data?: string }
    if (
      typeof a.id !== 'string' ||
      typeof a.name !== 'string' ||
      typeof a.project_id !== 'string' ||
      !validRef(a.reference) ||
      !isAllowedMime(IMAGE_MIMES, a.type) ||
      typeof a.data !== 'string'
    ) {
      throw new Error('이미지 정보가 올바르지 않습니다.')
    }
    const { bytes, blob } = dataUrlToBlob(a.data, a.type)
    total += bytes.length
    if (bytes.length > 30 * 1024 * 1024 || total > 100 * 1024 * 1024) {
      throw new Error('이미지 백업 용량 한도를 초과했습니다.')
    }
    return {
      id: a.id,
      name: a.name,
      project_id: a.project_id,
      reference: a.reference,
      track: a.reference.startsWith('letsur-asset://') ? 'managed' : 'file',
      created_at: typeof a.created_at === 'string' ? a.created_at : new Date().toISOString(),
      type: a.type,
      size: bytes.length,
      blob,
    }
  })
}

export function toImageBackup(assets: ImageAsset[], dataUrls: string[]) {
  return {
    format: 'frame-image-library' as const,
    version: 1 as const,
    images: assets.map((asset, index) => ({
      id: asset.id,
      project_id: asset.project_id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      created_at: asset.created_at,
      reference: asset.reference,
      track: asset.track,
      data: dataUrls[index],
    })),
  }
}

export function defaultProject(): Project {
  return {
    id: 'default',
    name: '기본 프로젝트',
    prompt: '',
    references: [],
    updated_at: new Date().toISOString(),
  }
}
