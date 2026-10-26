import type { GenerationRequest, Resolution } from '@/api/types'
import { LETSUR_MODEL, type ModelSpec } from '@/domain/models'

/**
 * 가이드 §7의 단가표(기준일 2026-09-28, unit / 100만 영상 토큰). 단가는 운영 상황에 따라 바뀔 수 있으므로
 * 화면에는 항상 "예상"으로만 표시하고, 실제 청구액은 완료된 작업의 usage로 확인합니다.
 */
export const PRICING_AS_OF = '2026-09-28'

const PRICE_PER_MILLION: Record<'none' | 'video', Record<Resolution, number>> = {
  none: { '480p': 10.7, '720p': 10.7, '1080p': 11.7 },
  video: { '480p': 6.4, '720p': 6.4, '1080p': 7.0 },
}

/**
 * 토큰 수 ≈ 가로 × 세로 × (24 × 길이 + 1) ÷ 1024.
 * 가이드에 16:9 5초(121 프레임 단위) 토큰 수만 나와 있어 그 값으로 해상도별 계수를 맞췄습니다.
 * 480p의 실제 픽셀 크기는 렛서 확인이 필요합니다(854×480으로는 48,439로 약간 다름).
 */
const TOKENS_PER_FRAME_UNIT: Record<Resolution, number> = {
  '480p': 48_437 / 121,
  '720p': 108_900 / 121,
  '1080p': 245_025 / 121,
}

export const DEFAULT_DURATION = 5

export type Estimate =
  | {
      ok: true
      cost: number
      /** 렛서는 과금 단위 `unit`, OpenRouter는 `USD` */
      currency: string
      /** 토큰 단가 모델일 때만 있습니다. */
      tokens?: number
      /** 적용 단가. 예: { value: '10.70 unit', per: '100만 토큰' } */
      rate: { value: string; per: string }
      resolution: string
      duration: number
      notes: string[]
    }
  | { ok: false; reason: string }

export function estimateTokens(resolution: Resolution, duration: number) {
  return Math.round(TOKENS_PER_FRAME_UNIT[resolution] * (24 * duration + 1))
}

function estimate(resolution: Resolution, duration: number, notes: string[]): Estimate {
  const tokens = estimateTokens(resolution, duration)
  const pricePerMillion = PRICE_PER_MILLION.none[resolution]
  return {
    ok: true,
    tokens,
    cost: (tokens / 1_000_000) * pricePerMillion,
    currency: 'unit',
    rate: { value: `${pricePerMillion.toFixed(2)} unit`, per: '100만 토큰' },
    resolution,
    duration,
    notes,
  }
}

function framed(payload: GenerationRequest) {
  return Boolean(payload.image_url) || (payload.references ?? []).some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')
}

export function estimateGeneration(payload: GenerationRequest, spec: ModelSpec = LETSUR_MODEL): Estimate {
  if (spec.gateway === 'openrouter') return estimateOpenRouter(payload, spec)
  if (spec.kind !== 'seedance') {
    return {
      ok: false,
      reason: `${spec.label}은(는) 해상도별 초 단위로 과금됩니다. 현재 단가는 렛서 에셋 화면에서 확인하고, 실제 청구액은 완료 후 사용량으로 확인하세요.`,
    }
  }
  if ((payload.references ?? []).some((ref) => ref.type === 'video') || payload.mode) {
    return { ok: false, reason: '영상 입력은 입력 길이도 과금되어 사전 견적을 낼 수 없습니다. 완료 후 실제 사용량을 확인하세요.' }
  }
  if (payload.duration === -1) {
    return { ok: false, reason: '길이를 모델이 정하므로 사전 견적을 낼 수 없습니다. 완료 후 실제 사용량을 확인하세요.' }
  }
  if (payload.duration !== undefined && (!Number.isInteger(payload.duration) || payload.duration < 4 || payload.duration > 30)) {
    return { ok: false, reason: '영상 길이를 4–30초로 지정하면 예상 비용을 표시합니다.' }
  }
  const resolution = (payload.draft ? '480p' : (payload.resolution ?? '480p')) as Resolution
  if (!(resolution in TOKENS_PER_FRAME_UNIT)) return { ok: false, reason: '이 해상도의 단가 정보가 없습니다.' }
  const notes: string[] = []
  if (framed(payload) || payload.aspect_ratio === 'adaptive') {
    notes.push('출력 비율이 입력 이미지를 따르면 토큰 수가 달라질 수 있습니다.')
  } else if (payload.aspect_ratio && payload.aspect_ratio !== '16:9') {
    notes.push('16:9 외 비율은 16:9와 같은 픽셀 수로 가정한 근사치입니다.')
  }
  return estimate(resolution, payload.duration ?? DEFAULT_DURATION, notes)
}

/** 확정은 원본 시안의 길이·비율을 이어받아 1080p 일반 생성과 같은 단가가 적용됩니다. */
export function estimateFinalize(source: GenerationRequest | null): Estimate {
  if (!source) {
    return estimate('1080p', DEFAULT_DURATION, ['원본 시안 기록이 이 기기에 없어 5초 16:9로 가정했습니다.'])
  }
  const result = estimateGeneration({ ...source, draft: false, resolution: '1080p' })
  return result
}

export function formatEstimate(cost: number, currency = 'unit') {
  if (currency === 'USD') return `약 $${cost < 1 ? cost.toFixed(3) : cost.toFixed(2)}`
  return `약 ${cost.toFixed(2)} ${currency}`
}

/** 해상도 이름의 짧은 변 픽셀 수 */
const SHORT_SIDE: Record<string, number> = { '360p': 360, '480p': 480, '720p': 720, '768p': 768, '1080p': 1080, '1K': 1080, '2K': 1440, '4K': 2160 }

/** 모델이 알려 준 실제 크기 목록에서 해상도·비율에 맞는 픽셀 수를 찾고, 없으면 비율로 계산합니다. */
function pixelSize(spec: ModelSpec, resolution: string, ratio: string) {
  const [rw, rh] = ratio.split(':').map(Number)
  const target = rw && rh ? rw / rh : 16 / 9
  const short = SHORT_SIDE[resolution]
  const sizes = (spec.sizes ?? []).flatMap((size) => {
    const [w, h] = size.split('x').map(Number)
    return w && h ? [{ w, h }] : []
  })
  const match = sizes
    .filter(({ w, h }) => !short || Math.min(w, h) === short || Math.abs(Math.min(w, h) - short) / short < 0.1)
    .sort((a, b) => Math.abs(a.w / a.h - target) - Math.abs(b.w / b.h - target))[0]
  if (match && Math.abs(match.w / match.h - target) < 0.05) return match.w * match.h
  if (!short) return null
  const long = Math.round(short * Math.max(target, 1 / target))
  return short * long
}

/**
 * OpenRouter `pricing_skus`로 계산한 예상 금액(USD). SKU 이름은 모델마다 달라 알려진 형태만 계산합니다.
 * - 토큰 과금(Seedance): `video_tokens[_해상도][_without_audio]` × 토큰 수
 * - 초 과금: `duration_seconds[_with_audio|_without_audio][_해상도]`, `text_to_video_duration_seconds_해상도` 등 × 길이
 * - `cents_*` SKU는 센트 단위입니다.
 */
export function estimateOpenRouter(payload: GenerationRequest, spec: ModelSpec): Estimate {
  const skus = spec.pricingSkus ?? {}
  if (!Object.keys(skus).length) return { ok: false, reason: '이 모델은 단가 정보를 제공하지 않습니다. 완료 후 실제 사용량을 확인하세요.' }
  if ((payload.references ?? []).some((ref) => ref.type === 'video')) {
    return { ok: false, reason: '영상 입력은 입력 길이도 과금되어 사전 견적을 낼 수 없습니다. 완료 후 실제 사용량을 확인하세요.' }
  }
  const notes: string[] = []
  let duration = payload.duration
  if (duration === undefined) {
    duration = spec.durations.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : spec.durations[0]
    notes.push(`길이를 모델 기본값으로 두면 ${duration}초로 가정합니다.`)
  }
  let resolution = payload.resolution
  if (!resolution) {
    resolution = spec.resolutions.includes('720p') ? '720p' : spec.resolutions[0]
    notes.push(`해상도를 모델 기본값으로 두면 ${resolution}로 가정합니다.`)
  }
  const res = resolution.toLowerCase()
  const audio = payload.generate_audio
  const framed = Boolean(payload.image_url) || (payload.references ?? []).some((ref) => ref.type === 'image')
  const price = (key: string) => {
    const value = skus[key]
    if (value === undefined) return undefined
    const n = Number(value)
    if (!Number.isFinite(n)) return undefined
    return key.startsWith('cents_') ? n / 100 : n
  }
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = price(key)
      if (value !== undefined) return { key, value }
    }
    return null
  }

  const tokenRate = pick([
    `video_tokens_${res}`,
    ...(audio ? ['video_tokens'] : ['video_tokens_without_audio', 'video_tokens']),
  ])
  if (tokenRate) {
    const pixels = pixelSize(spec, resolution, payload.aspect_ratio || '16:9')
    if (!pixels) return { ok: false, reason: '이 해상도의 픽셀 크기를 알 수 없어 사전 견적을 낼 수 없습니다.' }
    if (!payload.aspect_ratio) notes.push('비율을 기본값으로 두면 16:9로 가정합니다.')
    if (framed) notes.push('출력 비율이 입력 이미지를 따르면 토큰 수가 달라질 수 있습니다.')
    const tokens = Math.round((pixels * (24 * duration + 1)) / 1024)
    return {
      ok: true,
      tokens,
      cost: tokens * tokenRate.value,
      currency: 'USD',
      rate: { value: `${(tokenRate.value * 1_000_000).toFixed(2)} USD`, per: '100만 토큰' },
      resolution,
      duration,
      notes,
    }
  }

  const mode = framed ? 'image_to_video' : 'text_to_video'
  const audioTag = audio && spec.audio ? 'with_audio' : 'without_audio'
  const secondRate = pick([
    `duration_seconds_${audioTag}_${res}`,
    `${mode}_duration_seconds_${res}`,
    `duration_seconds_${res}`,
    `cents_per_video_output_second_${res}`,
    `cents_per_second_output_${res}`,
    `duration_seconds_${audioTag}`,
    ...(audio && spec.audio ? ['duration_seconds_with_audio'] : []),
    'duration_seconds',
    'cents_per_second_output',
  ])
  if (secondRate) {
    return {
      ok: true,
      cost: duration * secondRate.value,
      currency: 'USD',
      rate: { value: `${secondRate.value.toFixed(3)} USD`, per: '초' },
      resolution,
      duration,
      notes,
    }
  }
  return { ok: false, reason: '이 모델의 단가 형식을 해석하지 못했습니다. 완료 후 실제 사용량을 확인하세요.' }
}

/**
 * 시안 N개 + 1개 확정(N×D + F)과 1080p 직접 N개(N×F) 비교 (가이드 §7.3).
 * 반올림 전 값을 더합니다.
 */
export function compareCandidates(count: number, preview: number, final: number) {
  return { viaPreview: count * preview + final, direct: count * final }
}
