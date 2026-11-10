import { expect, test } from 'bun:test'
import { toOpenRouterBody } from '../src/api/openrouter/client'
import { modelAudioMode, toModelSpec } from '../src/domain/models'
import { buildPayload, type PayloadDraft } from '../src/domain/seedance'
import { estimateOpenRouter } from '../src/domain/pricing'

function draft(model: string, toggle: boolean, requested: boolean): PayloadDraft {
  const spec = toModelSpec({ id: model, generate_audio: toggle, supported_durations: [5], supported_resolutions: ['720p'] })!
  return {
    spec, commonPrompt: '', useCommon: false, scenePrompt: 'A paper boat', imageUrl: '', imagePerson: false,
    sceneReferences: [], sharedReferences: [], useShared: false, preview: false, mode: '', duration: '5',
    customDuration: 5, resolution: '720p', ratio: '', generateAudio: requested, seed: '', watermark: '', lastFrame: '', store: '',
  }
}

test('HeyGen always sends audio even when a saved draft or record requests silence', async () => {
  const input = draft('heygen/heygen-video-1', false, false)
  const payload = buildPayload(input)
  expect(modelAudioMode(input.spec)).toBe('required')
  expect(payload.generate_audio).toBe(true)
  expect((await toOpenRouterBody(payload)).generate_audio).toBe(true)
  expect((await toOpenRouterBody({ ...payload, generate_audio: false })).generate_audio).toBe(true)
  expect(input.generateAudio).toBe(false) // 다른 모델에서 선택한 오디오 설정은 덮어쓰지 않습니다.
})

test('models exposing the audio toggle preserve both on and off requests', async () => {
  for (const requested of [true, false]) {
    const input = draft('bytedance/seedance-2.5', true, requested)
    expect(modelAudioMode(input.spec)).toBe('optional')
    expect((await toOpenRouterBody(buildPayload(input))).generate_audio).toBe(requested)
  }
})

test('unknown fixed audio behavior uses provider defaults instead of forcing silence', async () => {
  const input = draft('example/fixed-model', false, false)
  expect(modelAudioMode(input.spec)).toBe('default')
  const payload = buildPayload(input)
  expect(payload).not.toHaveProperty('generate_audio')
  expect(await toOpenRouterBody(payload)).not.toHaveProperty('generate_audio')
})

test('required audio uses the with-audio rate even without a toggle', () => {
  const input = draft('heygen/heygen-video-1', false, false)
  input.spec.pricingSkus = { duration_seconds_with_audio: '0.2', duration_seconds_without_audio: '0.1' }
  const estimate = estimateOpenRouter(buildPayload(input), input.spec)
  expect(estimate.ok).toBe(true)
  if (estimate.ok) expect(estimate.cost).toBe(1)
})

test('unknown audio does not guess an audio-dependent price', () => {
  const input = draft('example/fixed-model', false, true)
  input.spec.pricingSkus = { duration_seconds_with_audio: '0.2', duration_seconds_without_audio: '0.1' }
  expect(estimateOpenRouter(buildPayload(input), input.spec).ok).toBe(false)
})
