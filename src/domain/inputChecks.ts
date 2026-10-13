import type { MediaKind } from '@/api/types'

/**
 * 가이드 §3 생성 입력 조건. 업로드에 성공해도 생성 단계에서 검사가 실패할 수 있어 미리 경고합니다.
 * 브라우저가 읽은 값이 실제와 다를 수 있으므로 막지는 않습니다.
 */
export const INPUT_LIMITS = {
  imageSide: { min: 300, max: 6000 },
  /** 가로/세로 비율. 양 끝값은 허용하지 않습니다(0.4 초과·2.5 미만). */
  imageRatio: { min: 0.4, max: 2.5 },
  seconds: { min: 2, max: 30 },
  /** 여러 참조 영상의 총 길이는 이 값 미만 */
  totalVideoSeconds: 30,
} as const

export function imageWarnings(width: number, height: number) {
  const { imageSide, imageRatio } = INPUT_LIMITS
  const warnings: string[] = []
  if (Math.min(width, height) < imageSide.min || Math.max(width, height) > imageSide.max) {
    warnings.push(`가로·세로는 ${imageSide.min}~${imageSide.max}px이어야 합니다.`)
  }
  const ratio = width / height
  if (ratio <= imageRatio.min || ratio >= imageRatio.max) {
    warnings.push(`가로/세로 비율은 ${imageRatio.min} 초과 ${imageRatio.max} 미만이어야 합니다. 자르거나 여백을 추가해주세요.`)
  }
  return warnings
}

export function durationWarning(kind: Exclude<MediaKind, 'image'>, seconds: number) {
  const { min, max } = INPUT_LIMITS.seconds
  if (seconds < min || seconds > max) return `${kind === 'video' ? '영상' : '오디오'} 길이는 ${min}~${max}초여야 합니다.`
  return null
}

export function totalVideoWarning(seconds: number[]) {
  const total = seconds.reduce((sum, value) => sum + value, 0)
  if (seconds.length > 1 && total >= INPUT_LIMITS.totalVideoSeconds) {
    return `참조 영상의 총 길이(${total.toFixed(1)}초)는 ${INPUT_LIMITS.totalVideoSeconds}초 미만이어야 합니다.`
  }
  return null
}

export function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}초`
}
