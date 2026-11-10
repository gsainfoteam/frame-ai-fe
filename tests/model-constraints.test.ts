import { expect, test } from 'bun:test'
import catalog from './fixtures/openrouter-video-models-2026-11-10.json'
import type { GenerationRequest, MediaReference } from '../src/api/types'
import { toModelSpec } from '../src/domain/models'
import { buildPayload, validatePayload, type PayloadDraft } from '../src/domain/seedance'
import { requiredDuration } from '../src/domain/modelConstraints'
import { toOpenRouterBody } from '../src/api/openrouter/client'
import { estimateOpenRouter } from '../src/domain/pricing'

function spec(id: string) {
  return toModelSpec(catalog.find((model) => model.id === id)!)!
}
function payload(id: string, values: Partial<GenerationRequest> = {}): GenerationRequest {
  return { model: id, prompt: 'A paper boat on a lake', ...values }
}
function refs(type: MediaReference['type'], count: number): MediaReference[] {
  return Array.from({ length: count }, (_, i) => ({ type, url: `https://example.com/${type}/${i}` }))
}
function validate(id: string, values: Partial<GenerationRequest>) {
  return validatePayload(payload(id, values), spec(id))
}

test('catalog models build requests without unsupported audio, seed or legacy fields', async () => {
  // Frozen public GET /api/v1/videos/models response; no credentials or paid requests.
  let checked = 0
  for (const entry of catalog) {
    const model = toModelSpec(entry)
    if (!model) continue
    checked++
    const draft: PayloadDraft = {
      spec: model, scenePrompt: 'A paper boat', commonPrompt: '', useCommon: false,
      imageUrl: '', imagePerson: false, sceneReferences: [], sharedReferences: [], useShared: false,
      preview: true, mode: '', duration: String(model.durations[0]), customDuration: 5,
      resolution: model.resolutions[0], ratio: model.aspectRatios[0] ?? '', generateAudio: false,
      seed: '42', watermark: '', lastFrame: 'true', store: 'true',
    }
    const request = validatePayload(buildPayload(draft), model)
    const body = await toOpenRouterBody(request)
    if (!model.audio && model.id !== 'heygen/heygen-video-1') expect(body).not.toHaveProperty('generate_audio')
    if (model.id === 'heygen/heygen-video-1') expect(body.generate_audio).toBe(true)
    if (!model.seed) expect(body).not.toHaveProperty('seed')
    for (const field of ['draft', 'return_last_frame', 'store_media', 'references']) expect(body).not.toHaveProperty(field)
    expect(body.model).toBe(model.id)
  }
  expect(checked).toBe(29)
})

test('Hailuo 2.3 rejects 1080p/10s including omitted resolution in the current catalog', () => {
  const id = 'minimax/hailuo-2.3'
  expect(() => validate(id, { resolution: '1080p', duration: 10 })).toThrow('6초')
  expect(() => validate(id, { duration: 10 })).toThrow('6초')
  expect(() => validate(id, { resolution: '1080p', duration: 6 })).not.toThrow()
  expect(() => validate(id, { resolution: '1080p' })).not.toThrow()
  // If the catalog exposes 768p later, its 10s option remains available.
  const expanded = { ...spec(id), resolutions: ['768p', '1080p'] }
  expect(requiredDuration(expanded, '768p', false)).toBeUndefined()
  expect(() => validatePayload(payload(id, { resolution: '768p', duration: 10 }), expanded)).not.toThrow()
})

for (const id of ['bytedance/seedance-2.0', 'bytedance/seedance-2.0-fast', 'bytedance/seedance-2.0-mini']) {
  test(`${id} enforces reference boundaries and requires visual input with audio`, () => {
    for (const [type, limit] of [['image', 9], ['video', 3], ['audio', 3]] as const) {
      const visual = type === 'audio' ? refs('image', 1) : []
      expect(() => validate(id, { references: [...visual, ...refs(type, limit)] })).not.toThrow()
      expect(() => validate(id, { references: [...visual, ...refs(type, limit + 1)] })).toThrow('9개')
    }
    expect(() => validate(id, { references: refs('audio', 1) })).toThrow('이미지 또는 영상')
    expect(() => validate(id, { references: [...refs('video', 1), ...refs('audio', 1)] })).not.toThrow()
  })
}

test('Seedance 2.5 keeps its larger limits and audio-only support', () => {
  const id = 'bytedance/seedance-2.5'
  expect(() => validate(id, { references: [...refs('image', 30), ...refs('video', 10), ...refs('audio', 10)] })).not.toThrow()
  expect(() => validate(id, { references: refs('audio', 1) })).not.toThrow()
})

test('Veo general references have separate constraints from frame inputs', () => {
  for (const id of ['google/veo-3.1', 'google/veo-3.1-fast']) {
    expect(() => validate(id, { duration: 8, references: refs('image', 3) })).not.toThrow()
    expect(() => validate(id, { duration: 8, references: refs('image', 4) })).toThrow('최대 3개')
    expect(() => validate(id, { duration: 4, image_url: 'https://example.com/first.png' })).not.toThrow()
  }
  expect(() => validate('google/veo-3.1', { duration: 4, references: refs('image', 1) })).toThrow('8초')
  expect(() => validate('google/veo-3.1', { references: refs('image', 1) })).not.toThrow()
})

test('frame-only models reject general images but preserve first/last frames on the wire', async () => {
  for (const id of ['google/veo-3.1-lite', 'bytedance/seedance-1-5-pro']) {
    expect(() => validate(id, { references: refs('image', 1) })).toThrow('첫·끝 프레임')
    const request = validate(id, { references: [
      { type: 'image', role: 'first_frame', url: 'https://example.com/first.png' },
      { type: 'image', role: 'last_frame', url: 'https://example.com/last.png' },
    ] })
    const body = await toOpenRouterBody(request)
    expect(body.frame_images).toHaveLength(2)
    expect(body).not.toHaveProperty('input_references')
  }
})

test('Veo reference-mode default estimates eight seconds instead of the shortest catalog duration', () => {
  const id = 'google/veo-3.1'
  const model = { ...spec(id), pricingSkus: { duration_seconds: '0.4' } }
  const estimate = estimateOpenRouter(payload(id, { references: refs('image', 1) }), model)
  expect(estimate.ok).toBe(true)
  if (estimate.ok) {
    expect(estimate.duration).toBe(8)
    expect(estimate.cost).toBe(3.2)
  }
})
