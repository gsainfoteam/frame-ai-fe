import type { ModelSpec } from '@/domain/models'

type PortraitPolicy = {
  label: string
}

// 공식 문서 확인: 2026-11-10. 공급사 이름 전체에 정책을 추정 적용하지 않습니다.
// https://docs.byteplus.com/en/docs/modelark/seedance-portrait-asset-guide
// https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/responsible-ai-and-usage-guidelines
const seedanceModels = new Set([
  'bytedance/seedance-2.5',
  'bytedance/seedance-2.0',
  'bytedance/seedance-2.0-fast',
  'bytedance/seedance-2.0-mini',
])
const veoModels = new Set(['google/veo-3.1', 'google/veo-3.1-fast', 'google/veo-3.1-lite'])

/** OpenRouter의 확인된 인물 입력 제한. 안내가 없다고 제한 없는 모델이라는 뜻은 아닙니다. */
export function portraitPolicy(spec: Pick<ModelSpec, 'id' | 'gateway'>): PortraitPolicy | null {
  if (spec.gateway !== 'openrouter') return null
  if (seedanceModels.has(spec.id)) {
    return {
      label: '실사 얼굴 참조 제한',
    }
  }
  if (veoModels.has(spec.id)) {
    return {
      label: '인물 참조 조건 확인',
    }
  }
  return null
}
