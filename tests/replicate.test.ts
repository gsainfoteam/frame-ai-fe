import { describe, expect, test } from 'bun:test'
import { onRequest as replicateProxy } from '../functions/replicate-api/[[path]]'
import { GatewayApiError, isRetryableRateLimit } from '../src/api/errors'
import { gatewayOfMedia } from '../src/api'
import { createReplicateClient, replicateMediaId, toReplicateBody } from '../src/api/replicate/client'
import type { GenerationRequest } from '../src/api/types'
import { describeError, replicateHint } from '../src/domain/errors'
import { REPLICATE_SEEDANCE_2_5 } from '../src/domain/models'
import { estimateGeneration } from '../src/domain/pricing'
import { buildPayload, validatePayload, type PayloadDraft } from '../src/domain/seedance'
import { inquiryText, redactErrorMessage } from '../src/domain/support'
import { loadWorkspaceDraft, saveWorkspaceDraft, serializeWorkspaceDraft, type SavedDraft } from '../src/storage/workspaceRepository'

function baseDraft(overrides: Partial<PayloadDraft> = {}): PayloadDraft {
  return {
    spec: REPLICATE_SEEDANCE_2_5,
    commonPrompt: '',
    useCommon: false,
    scenePrompt: 'A golden retriever running across a meadow',
    imageUrl: '',
    imagePerson: false,
    sceneReferences: [],
    sharedReferences: [],
    useShared: false,
    preview: false,
    mode: '',
    duration: '5',
    customDuration: 8,
    resolution: '720p',
    ratio: '16:9',
    generateAudio: true,
    seed: '',
    watermark: '',
    lastFrame: '',
    store: '',
    ...overrides,
  }
}

describe('Replicate Seedance 2.5 schema mapping & validation', () => {
  test('maps text-to-video options to Replicate input schema', () => {
    const request = validatePayload(
      buildPayload(baseDraft({ seed: '42', watermark: 'false', duration: '-1', ratio: 'adaptive', resolution: '480p' })),
      REPLICATE_SEEDANCE_2_5,
    )
    expect(toReplicateBody(request)).toEqual({
      input: {
        prompt: 'A golden retriever running across a meadow',
        duration: -1,
        resolution: '480p',
        aspect_ratio: 'adaptive',
        generate_audio: true,
        watermark: false,
        seed: 42,
      },
    })
  })

  test('maps first/last frames and automatically enforces adaptive aspect_ratio when omitted', () => {
    const request = validatePayload(
      buildPayload(
        baseDraft({
          ratio: '',
          sceneReferences: [
            { type: 'image', role: 'first_frame', url: 'https://example.com/first.png' },
            { type: 'image', role: 'last_frame', url: 'https://example.com/last.png' },
          ],
        }),
      ),
      REPLICATE_SEEDANCE_2_5,
    )
    expect(toReplicateBody(request)).toEqual({
      input: {
        prompt: 'A golden retriever running across a meadow',
        image: 'https://example.com/first.png',
        last_frame_image: 'https://example.com/last.png',
        duration: 5,
        resolution: '720p',
        aspect_ratio: 'adaptive',
        generate_audio: true,
      },
    })
  })

  test('rejects fixed aspect ratios with first/last frames', () => {
    const request = buildPayload(
      baseDraft({
        ratio: '16:9',
        imageUrl: 'https://example.com/first.png',
      }),
    )
    expect(() => validatePayload(request, REPLICATE_SEEDANCE_2_5)).toThrow('자동 맞춤')
  })

  test('maps reference_images, reference_videos, reference_audios and enforces audio constraint', () => {
    const audioOnly: GenerationRequest = {
      model: 'bytedance/seedance-2.5',
      prompt: 'Lip sync clip',
      references: [{ type: 'audio', role: 'reference_audio', url: 'https://example.com/voice.mp3' }],
    }
    expect(() => validatePayload(audioOnly, REPLICATE_SEEDANCE_2_5)).toThrow('이미지 또는 영상')

    const multimodal: GenerationRequest = {
      model: 'bytedance/seedance-2.5',
      prompt: 'Use [Image1], [Video1], and [Audio1]',
      references: [
        { type: 'image', role: 'reference_image', url: 'https://example.com/img1.png' },
        { type: 'video', role: 'reference_video', url: 'https://example.com/vid1.mp4' },
        { type: 'audio', role: 'reference_audio', url: 'https://example.com/aud1.wav' },
      ],
      duration: 10,
      resolution: '720p',
    }
    validatePayload(multimodal, REPLICATE_SEEDANCE_2_5)
    expect(toReplicateBody(multimodal)).toEqual({
      input: {
        prompt: 'Use [Image1], [Video1], and [Audio1]',
        reference_images: ['https://example.com/img1.png'],
        reference_videos: ['https://example.com/vid1.mp4'],
        reference_audios: ['https://example.com/aud1.wav'],
        duration: 10,
        resolution: '720p',
      },
    })
  })

  test('rejects letsur and frame-local reference schemes on Replicate', () => {
    expect(() =>
      validatePayload(
        { model: 'bytedance/seedance-2.5', prompt: 'test', references: [{ type: 'image', url: 'letsur-file://abc' }] },
        REPLICATE_SEEDANCE_2_5,
      ),
    ).toThrow('Replicate')
    expect(() =>
      validatePayload(
        { model: 'bytedance/seedance-2.5', prompt: 'test', references: [{ type: 'image', url: 'frame-local://img1' }] },
        REPLICATE_SEEDANCE_2_5,
      ),
    ).toThrow('Replicate')
  })
})

describe('Replicate pricing & client', () => {
  test('estimates cost per second for non_video_in and video_in tiers', () => {
    const base = estimateGeneration({ model: 'bytedance/seedance-2.5', prompt: 'hi', duration: 5, resolution: '720p' }, REPLICATE_SEEDANCE_2_5)
    expect(base.ok).toBe(true)
    if (base.ok) {
      expect(base.currency).toBe('USD')
      expect(base.cost).toBeCloseTo(5 * 0.2312, 6)
    }

    const withVideo = estimateGeneration(
      {
        model: 'bytedance/seedance-2.5',
        prompt: 'hi',
        duration: 4,
        resolution: '480p',
        references: [{ type: 'video', url: 'https://example.com/ref.mp4' }],
      },
      REPLICATE_SEEDANCE_2_5,
    )
    expect(withVideo.ok).toBe(true)
    if (withVideo.ok) expect(withVideo.cost).toBeCloseTo(4 * 0.4304, 6)

    const autoDuration = estimateGeneration({ model: 'bytedance/seedance-2.5', prompt: 'hi', duration: -1 }, REPLICATE_SEEDANCE_2_5)
    expect(autoDuration.ok).toBe(false)
  })

  test('createJob, getJob, uploadReference, and issueMediaLink speak Replicate HTTP API', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null; body: unknown }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('Authorization'), body: init?.body })
      if (url.endsWith('/models/bytedance/seedance-2.5/predictions')) {
        return new Response(JSON.stringify({ id: 'pred_123', status: 'starting' }), { status: 201 })
      }
      if (url.endsWith('/predictions/pred_123')) {
        return new Response(
          JSON.stringify({
            id: 'pred_123',
            model: 'bytedance/seedance-2.5',
            status: 'succeeded',
            created_at: '2026-11-22T00:00:00Z',
            completed_at: '2026-11-22T00:02:00Z',
            output: 'https://replicate.delivery/example/out.mp4',
            data_removed: false,
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/predictions/pred_expired')) {
        return new Response(
          JSON.stringify({ id: 'pred_expired', status: 'succeeded', output: null, data_removed: true }),
          { status: 200 },
        )
      }
      if (url.endsWith('/predictions/pred_failed')) {
        return new Response(
          JSON.stringify({ id: 'pred_failed', status: 'failed', error: 'Invalid duration for edit mode' }),
          { status: 200 },
        )
      }
      if (url.endsWith('/files')) {
        return new Response(
          JSON.stringify({ id: 'file_1', urls: { get: 'https://api.replicate.com/v1/files/file_1' } }),
          { status: 201 },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    try {
      const client = createReplicateClient(() => 'r8_test_secret_token')
      const created = await client.createJob({ model: 'bytedance/seedance-2.5', prompt: 'Ocean waves', duration: 5, resolution: '720p' })
      expect(created.id).toBe('pred_123')
      expect(calls[0].auth).toBe('Bearer r8_test_secret_token')
      expect(JSON.parse(String(calls[0].body))).toEqual({
        input: { prompt: 'Ocean waves', duration: 5, resolution: '720p' },
      })

      const snap = await client.getJob('pred_123')
      expect(snap.job.status).toBe('succeeded')
      expect(snap.job.result?.media).toEqual([
        {
          media_id: replicateMediaId('pred_123', 0),
          kind: 'video',
          state: 'ready',
          url: 'https://replicate.delivery/example/out.mp4',
        },
      ])
      expect(gatewayOfMedia(replicateMediaId('pred_123', 0))).toBe('replicate')
      expect(gatewayOfMedia('job#0')).toBe('openrouter')
      expect(gatewayOfMedia('med_123')).toBe('letsur')

      const refreshed = await client.issueMediaLink(replicateMediaId('pred_123', 0))
      expect(refreshed.url).toBe('https://replicate.delivery/example/out.mp4')

      const expired = await client.getJob('pred_expired')
      expect(expired.job.result?.media?.[0].url_unavailable_reason).toBe('retention_expired')
      await expect(client.issueMediaLink(replicateMediaId('pred_expired', 0))).rejects.toMatchObject({ status: 410 })

      const failed = await client.getJob('pred_failed')
      expect(failed.job.status).toBe('failed')
      expect(failed.job.error?.message).toBe('Invalid duration for edit mode')

      const file = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' })
      const uploaded = await client.uploadReference(file, 'file')
      expect(uploaded).toEqual({ reference: 'https://api.replicate.com/v1/files/file_1', track: 'file' })
      await expect(client.uploadReference(file, 'managed')).rejects.toThrow('관리형')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('handles Replicate error hints, rate limit retries, token redaction, and draft persistence', () => {
    expect(replicateHint(401)).toContain('Replicate API 토큰')
    expect(replicateHint(422)).toContain('adaptive')
    expect(describeError({ detail: 'Vendor rejected' }, 'replicate')).not.toContain('렛서')
    expect(isRetryableRateLimit(new GatewayApiError('rate limited', { gateway: 'replicate', status: 429 }))).toBe(true)

    const redacted = redactErrorMessage('Authorization failed for r8_secretToken12345', null)
    expect(redacted).not.toContain('r8_secretToken12345')
    expect(redacted).toContain('[키 생략]')

    const diagnostics = inquiryText({
      failure: {
        gateway: 'replicate',
        at: '2026-11-22T00:00:00Z',
        endpoint: 'POST /v1/models/bytedance/seedance-2.5/predictions',
        status: 422,
        body: { model: 'bytedance/seedance-2.5', prompt: 'secret prompt' },
        message: 'Invalid token r8_supersecret',
      },
    })
    expect(diagnostics).toContain('Replicate 진단 정보')
    expect(diagnostics).not.toContain('secret prompt')
    expect(diagnostics).not.toContain('r8_supersecret')

    const values = new Map<string, string>()
    const prevStorage = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
        removeItem: (k: string) => values.delete(k),
      },
    })
    try {
      const draft: SavedDraft = {
        draftGateway: 'replicate',
        prompt: 'Seedance 2.5 on Replicate',
        imageUrl: '',
        imagePerson: false,
        useCommon: true,
        useShared: true,
        refOpen: false,
        references: [],
        model: 'bytedance/seedance-2.5',
        generation: 'direct',
        previewCount: 1,
        duration: '-1',
        customDuration: 8,
        resolution: '720p',
        ratio: 'adaptive',
        audio: true,
        seed: '',
        watermark: 'false',
        lastFrame: '',
        store: '',
        mode: '',
        jobId: 'pred_123',
      }
      saveWorkspaceDraft('rep-proj', serializeWorkspaceDraft(draft))
      expect(loadWorkspaceDraft('rep-proj').draft?.draftGateway).toBe('replicate')
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prevStorage })
    }
  })

  test('Cloudflare Pages proxy forwards allowed Replicate endpoints and blocks disallowed paths or missing auth', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null; contentType: string | null }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        auth: headers.get('Authorization'),
        contentType: headers.get('Content-Type'),
      })
      return new Response(JSON.stringify({ id: 'pred_proxy' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '15' },
      })
    }) as typeof fetch

    try {
      const unauth = await replicateProxy({
        request: new Request('https://app.example/replicate-api/predictions/pred_1', { method: 'GET' }),
        params: { path: ['predictions', 'pred_1'] },
      })
      expect(unauth.status).toBe(401)

      const disallowedPath = await replicateProxy({
        request: new Request('https://app.example/replicate-api/account', {
          method: 'GET',
          headers: { Authorization: 'Bearer r8_token' },
        }),
        params: { path: ['account'] },
      })
      expect(disallowedPath.status).toBe(404)

      const traversal = await replicateProxy({
        request: new Request('https://app.example/replicate-api/predictions/..', {
          method: 'GET',
          headers: { Authorization: 'Bearer r8_token' },
        }),
        params: { path: ['predictions', '..'] },
      })
      expect(traversal.status).toBe(404)

      const wrongMethod = await replicateProxy({
        request: new Request('https://app.example/replicate-api/predictions/pred_1', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer r8_token' },
        }),
        params: { path: ['predictions', 'pred_1'] },
      })
      expect(wrongMethod.status).toBe(405)

      const created = await replicateProxy({
        request: new Request('https://app.example/replicate-api/models/bytedance/seedance-2.5/predictions', {
          method: 'POST',
          headers: { Authorization: 'Bearer r8_token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { prompt: 'hi' } }),
        }),
        params: { path: ['models', 'bytedance', 'seedance-2.5', 'predictions'] },
      })
      expect(created.status).toBe(201)
      expect(created.headers.get('Retry-After')).toBe('15')
      expect(created.headers.get('Cache-Control')).toBe('no-store')
      expect(await created.json()).toEqual({ id: 'pred_proxy' })
      expect(calls[0]).toEqual({
        url: 'https://api.replicate.com/v1/models/bytedance/seedance-2.5/predictions',
        method: 'POST',
        auth: 'Bearer r8_token',
        contentType: 'application/json',
      })

      const uploaded = await replicateProxy({
        request: new Request('https://app.example/replicate-api/files', {
          method: 'POST',
          headers: { Authorization: 'Bearer r8_token', 'Content-Type': 'multipart/form-data; boundary=abc' },
          body: '--abc--',
        }),
        params: { path: ['files'] },
      })
      expect(uploaded.status).toBe(201)
      expect(calls[1].url).toBe('https://api.replicate.com/v1/files')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
