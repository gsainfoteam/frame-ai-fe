import type { GenerationRequest } from '@/api/types'
import type { ModelSpec } from '@/domain/models'

// Catalog arrays describe individual options, not valid combinations.
// Exact model IDs only; sources and audit date: docs/model-compatibility-audit.md.
const seedance20 = new Set(['bytedance/seedance-2.0', 'bytedance/seedance-2.0-fast', 'bytedance/seedance-2.0-mini'])
const veoReferences = new Set(['google/veo-3.1', 'google/veo-3.1-fast'])
const frameOnly = new Set(['google/veo-3.1-lite', 'bytedance/seedance-1-5-pro'])

export function generalImageCount(payload: GenerationRequest) {
  return (payload.references ?? []).filter((ref) => ref.type === 'image' && ref.role !== 'first_frame' && ref.role !== 'last_frame').length
}

/** undefined means no additional duration restriction, not that any duration is supported. */
export function requiredDuration(spec: ModelSpec, resolution: string | undefined, hasGeneralImages: boolean) {
  if (spec.gateway !== 'openrouter') return undefined
  if (spec.id === 'minimax/hailuo-2.3' && (resolution === '1080p' || (!resolution && spec.resolutions.length === 1 && spec.resolutions[0] === '1080p'))) return 6
  if (spec.id === 'google/veo-3.1' && hasGeneralImages) return 8
  return undefined
}

export function modelInputHint(spec: ModelSpec): string | undefined {
  if (spec.gateway !== 'openrouter') return undefined
  if (spec.id === 'minimax/hailuo-2.3') return '1080p에서는 6초만 생성할 수 있습니다.'
  if (seedance20.has(spec.id)) return '참조는 이미지 9개·영상 3개·오디오 3개까지이며, 오디오만 참조할 수 없습니다.'
  if (spec.id === 'google/veo-3.1') return '일반 참조 이미지는 최대 3개이며, 사용할 때 영상 길이는 8초입니다.'
  if (spec.id === 'google/veo-3.1-fast') return '일반 참조 이미지는 최대 3개입니다.'
  if (frameOnly.has(spec.id)) return '이미지는 첫·끝 프레임으로 지정해주세요. 일반 참조 이미지는 지원하지 않습니다.'
}

export function validateModelConstraints(payload: GenerationRequest, spec: ModelSpec) {
  if (spec.gateway !== 'openrouter') return
  const images = generalImageCount(payload)
  const duration = requiredDuration(spec, payload.resolution, images > 0)
  if (duration !== undefined && payload.duration !== undefined && payload.duration !== duration) {
    throw new Error(`${spec.label}: ${modelInputHint(spec)} 영상 길이를 ${duration}초 또는 기본으로 바꿔주세요.`)
  }
  if (seedance20.has(spec.id)) {
    const refs = payload.references ?? []
    const videos = refs.filter((ref) => ref.type === 'video').length
    const audios = refs.filter((ref) => ref.type === 'audio').length
    if (images > 9 || videos > 3 || audios > 3) throw new Error(`${spec.label}: ${modelInputHint(spec)}`)
    if (audios && !images && !videos) throw new Error(`${spec.label}에서 오디오를 참조하려면 일반 참조 이미지 또는 영상도 추가해주세요.`)
  }
  if (veoReferences.has(spec.id) && images > 3) throw new Error(`${spec.label}의 일반 참조 이미지는 최대 3개입니다.`)
  if (frameOnly.has(spec.id) && images) throw new Error(`${spec.label}: ${modelInputHint(spec)}`)
}
