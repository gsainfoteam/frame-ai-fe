import { GATEWAYS, type GatewayCapabilities, type GatewayId } from '@/api/gateway'
import { MODEL_ID, MODEL_LABEL } from '@/config/constants'

/**
 * 렛서 모델의 요청 형식. 같은 게이트웨이라도 모델마다 필드 이름과 입력 조합이 다릅니다.
 * - seedance: 렛서가 정한 필드(prompt, references, …)
 * - kling-t2v / kling-i2v / kling-omni: Kling 전용 필드(Prompt, OutputConfig, FileInfos, …)
 */
export type ModelKind = 'seedance' | 'kling-t2v' | 'kling-i2v' | 'kling-omni'

/** 폼 옵션과 검증에 쓰는 모델별 지원 범위 */
export type ModelSpec = {
  id: string
  label: string
  gateway: GatewayId
  /** 렛서 모델의 요청 형식. OpenRouter 모델은 모두 같은 형식이라 비어 있습니다. */
  kind?: ModelKind
  /** 짧은 설명. 모델 선택 목록에 붙습니다. */
  description?: string
  /** 게이트웨이 기본 기능 중 이 모델이 다르게 지원하는 항목 */
  caps?: Partial<GatewayCapabilities>
  /** 길이 자동 선택(`-1`) 지원 */
  autoDuration?: boolean
  resolutions: string[]
  /** `adaptive`는 입력 비율 따르기 */
  aspectRatios: string[]
  /** 고를 수 있는 길이(초). 오름차순 */
  durations: number[]
  /** `first_frame`, `last_frame` */
  frameImages: string[]
  /** `generate_audio`로 오디오를 켜고 끌 수 있는지 */
  audio: boolean
  seed: boolean
  /** OpenRouter `provider.options`로 넘길 수 있는 모델 전용 파라미터 */
  passthrough: string[]
  /** OpenRouter 가격 SKU. 값은 USD 문자열입니다. */
  pricingSkus?: Record<string, string>
  /** 해상도·비율별 실제 픽셀 크기 ("WxH") */
  sizes?: string[]
}

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, index) => min + index)

/** 렛서 기본 모델. 제약은 렛서 Seedance 2.5 가이드 기준입니다. */
export const LETSUR_MODEL: ModelSpec = {
  id: MODEL_ID,
  label: MODEL_LABEL,
  gateway: 'letsur',
  kind: 'seedance',
  description: '텍스트·프레임·참조·편집·연장',
  autoDuration: true,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '21:9', '4:3', '3:4', 'adaptive'],
  durations: range(4, 30),
  frameImages: ['first_frame', 'last_frame'],
  audio: true,
  seed: true,
  passthrough: [],
}

/** Kling은 시안·관리형 업로드·마지막 프레임 반환·시드가 없습니다. 영상 참조는 옴니 모델만 받습니다. */
const KLING_CAPS: Partial<GatewayCapabilities> = { draft: false, managedUpload: false, lastFrame: false, videoModes: false }

function kling(version: 3 | 4, kind: 'kling-t2v' | 'kling-i2v' | 'kling-omni'): ModelSpec {
  const v4 = version === 4
  const name = { 'kling-t2v': 'text-to-video', 'kling-i2v': 'image-to-video', 'kling-omni': 'omni-video' }[kind]
  const ratios =
    kind === 'kling-i2v'
      ? []
      : ['16:9', '9:16', '1:1', ...(v4 ? ['21:9'] : []), ...(v4 && kind === 'kling-omni' ? ['adaptive'] : [])]
  return {
    id: `kling-v${version}-${name}`,
    label: `Kling V${version} ${{ 'kling-t2v': '텍스트→영상', 'kling-i2v': '이미지→영상', 'kling-omni': '옴니' }[kind]}`,
    gateway: 'letsur',
    kind,
    description: {
      'kling-t2v': '텍스트만',
      'kling-i2v': '시작 프레임 이미지 + 끝 프레임(선택)',
      'kling-omni': '참조 이미지·영상, 영상 편집',
    }[kind],
    caps: { ...KLING_CAPS, videoModes: kind === 'kling-omni' },
    resolutions: v4 ? ['720p', '1080p', '2K', '4K'] : ['720p', '1080p'],
    aspectRatios: ratios,
    durations: range(3, v4 ? 30 : 15),
    frameImages: kind === 'kling-t2v' ? [] : ['first_frame', 'last_frame'],
    audio: true,
    seed: false,
    passthrough: [],
  }
}

/** 렛서 영상 모델. 스페이스에서 쓸 수 있는지는 `GET /v1/models`로 확인합니다. */
export const LETSUR_MODELS: ModelSpec[] = [
  LETSUR_MODEL,
  ...([3, 4] as const).flatMap((version) => (['kling-t2v', 'kling-i2v', 'kling-omni'] as const).map((kind) => kling(version, kind))),
]

/** 기록된 작업의 기능. 렛서는 요청의 모델 코드로 Kling 여부를 구분합니다. */
export function capabilitiesFor(gateway: GatewayId, modelId?: string): GatewayCapabilities {
  const spec = gateway === 'letsur' ? LETSUR_MODELS.find((item) => item.id === modelId) : undefined
  return spec ? modelCapabilities(spec) : GATEWAYS[gateway].capabilities
}

/** 게이트웨이 기본 기능에 모델별 차이를 반영한 값 */
export function modelCapabilities(spec: ModelSpec): GatewayCapabilities {
  return { ...GATEWAYS[spec.gateway].capabilities, ...spec.caps }
}

/** OpenRouter에서 처음 고를 모델. 목록에 없으면 첫 번째 모델을 씁니다. */
export const OPENROUTER_DEFAULT_MODEL = 'bytedance/seedance-2.5'

/** `GET /videos/models`의 항목 */
export type OpenRouterVideoModel = {
  id: string
  name?: string
  supported_resolutions?: string[] | null
  supported_aspect_ratios?: string[] | null
  supported_sizes?: string[] | null
  supported_durations?: number[] | null
  supported_frame_images?: string[] | null
  generate_audio?: boolean | null
  seed?: boolean | null
  pricing_skus?: Record<string, string> | null
  allowed_passthrough_parameters?: string[] | null
}

/**
 * 프롬프트로 새 영상을 만드는 모델만 남깁니다. 길이·해상도 정보가 없는 모델은 편집·업스케일·아바타처럼
 * 입력 영상이나 별도 입력이 필요한 모델이라 이 화면에서 쓸 수 없습니다.
 */
export function toModelSpec(model: OpenRouterVideoModel): ModelSpec | null {
  const durations = (model.supported_durations ?? []).filter((value) => Number.isInteger(value) && value > 0)
  const resolutions = model.supported_resolutions ?? []
  if (!model.id || !durations.length || !resolutions.length) return null
  return {
    id: model.id,
    label: model.name || model.id,
    gateway: 'openrouter',
    resolutions,
    aspectRatios: model.supported_aspect_ratios ?? [],
    durations: [...new Set(durations)].sort((a, b) => a - b),
    frameImages: model.supported_frame_images ?? [],
    audio: model.generate_audio === true,
    seed: model.seed === true,
    passthrough: model.allowed_passthrough_parameters ?? [],
    pricingSkus: model.pricing_skus ?? undefined,
    sizes: model.supported_sizes ?? undefined,
  }
}

export function durationLabel(spec: ModelSpec) {
  const list = spec.durations
  if (!list.length) return ''
  const contiguous = list.every((value, index) => index === 0 || value === list[index - 1] + 1)
  return contiguous && list.length > 2 ? `${list[0]}–${list[list.length - 1]}초` : `${list.join('·')}초`
}

/**
 * 영상·오디오 참조를 반영하는 모델. 렛서 Seedance는 둘 다, 렛서 Kling은 옴니 모델이 영상만 받습니다.
 * OpenRouter 공식 문서는 Seedance 2 이상만 영상·오디오 참조를 반영한다고 안내합니다.
 */
export function acceptsMediaReferences(spec: ModelSpec, type: 'video' | 'audio') {
  if (spec.kind === 'seedance') return true
  if (spec.kind === 'kling-omni') return type === 'video'
  if (spec.kind) return false
  return /^bytedance\/seedance-2/.test(spec.id)
}

/** "ByteDance: Seedance 2.5"처럼 공급사가 앞에 붙은 이름을 나눕니다. 렛서 모델은 종류로 공급사를 정합니다. */
export function modelParts(spec: ModelSpec) {
  const at = spec.label.indexOf(': ')
  if (at > 0) return { provider: spec.label.slice(0, at), name: spec.label.slice(at + 2) }
  if (spec.kind === 'seedance') return { provider: 'ByteDance', name: spec.label }
  if (spec.kind?.startsWith('kling')) return { provider: 'Kling', name: spec.label.replace(/^Kling\s+/, '') }
  return { provider: '기타', name: spec.label }
}

function resolutionRange(list: string[]) {
  return list.length > 2 ? `${list[0]}–${list[list.length - 1]}` : list.join('·')
}

/** 모델이 지원하는 것을 짧은 태그로 보여 줍니다. */
export function modelTags(spec: ModelSpec) {
  const frames = spec.frameImages.includes('last_frame') ? '첫·끝 프레임' : spec.frameImages.includes('first_frame') ? '첫 프레임' : null
  return [
    durationLabel(spec),
    resolutionRange(spec.resolutions),
    spec.audio ? '오디오' : null,
    frames,
    acceptsMediaReferences(spec, 'video') ? '영상 참조' : null,
  ].filter((tag): tag is string => Boolean(tag))
}
