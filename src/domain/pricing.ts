import type { GenerationRequest, Resolution } from '@/api/types'

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
  | { ok: true; tokens: number; cost: number; resolution: Resolution; duration: number; notes: string[] }
  | { ok: false; reason: string }

export function estimateTokens(resolution: Resolution, duration: number) {
  return Math.round(TOKENS_PER_FRAME_UNIT[resolution] * (24 * duration + 1))
}

function estimate(resolution: Resolution, duration: number, notes: string[]): Estimate {
  const tokens = estimateTokens(resolution, duration)
  return { ok: true, tokens, cost: (tokens / 1_000_000) * PRICE_PER_MILLION.none[resolution], resolution, duration, notes }
}

function framed(payload: GenerationRequest) {
  return Boolean(payload.image_url) || (payload.references ?? []).some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')
}

export function estimateGeneration(payload: GenerationRequest): Estimate {
  if ((payload.references ?? []).some((ref) => ref.type === 'video') || payload.mode) {
    return { ok: false, reason: '영상 입력은 입력 길이도 과금되어 사전 견적을 낼 수 없습니다. 완료 후 실제 사용량을 확인하세요.' }
  }
  if (payload.duration === -1) {
    return { ok: false, reason: '길이를 모델이 정하므로 사전 견적을 낼 수 없습니다. 완료 후 실제 사용량을 확인하세요.' }
  }
  const resolution = payload.draft ? '480p' : (payload.resolution ?? '480p')
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

export function formatEstimate(cost: number) {
  return `약 ${cost.toFixed(2)} unit`
}

/**
 * 시안 N개 + 1개 확정(N×D + F)과 1080p 직접 N개(N×F) 비교 (가이드 §7.3).
 * 반올림 전 값을 더합니다.
 */
export function compareCandidates(count: number, preview: number, final: number) {
  return { viaPreview: count * preview + final, direct: count * final }
}
