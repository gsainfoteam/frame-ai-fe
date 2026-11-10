import { describe, expect, test } from 'bun:test'
import { GatewayApiError, extractErrorCode } from '../src/api/errors'
import { createRequester } from '../src/api/http'
import { toOpenRouterBody } from '../src/api/openrouter/client'
import type { GenerationRequest } from '../src/api/types'
import { describeError, openRouterHint } from '../src/domain/errors'
import { inquiryText, redactErrorMessage } from '../src/domain/support'

const privacyCode = 'InputImageSensitiveContentDetected.PrivacyInformation'
const providerError = {
  error: { code: privacyCode, message: "The input image 'content[2]' may contain real person.", param: 'content[2]', type: 'BadRequest' },
}
const response = { error: { code: 400, message: `HTTP 400: ${JSON.stringify(providerError)}` } }
const body: GenerationRequest = {
  model: 'bytedance/seedance-2.5', prompt: 'Private "portrait"\nsecond line', generate_audio: true,
  references: [{ type: 'image', url: 'https://private.example/photo?signature=secret', role: 'reference_image' }],
}

describe('OpenRouter portrait rejection', () => {
  test('the real nested HTTP 400 response receives a portrait-specific explanation', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify(response), { status: 400 })) as typeof fetch
    try {
      const request = createRequester({ gateway: 'openrouter', base: 'https://test.invalid', getKey: () => 'test-only', hint: openRouterHint })
      let failure: unknown
      try { await request('/videos', { method: 'POST', body: JSON.stringify(body) }) } catch (error) { failure = error }
      expect(failure).toBeInstanceOf(GatewayApiError)
      const error = failure as GatewayApiError
      expect(error.code).toBe('400')
      expect(error.message).toContain(privacyCode)
      expect(error.message).toContain('인물 자산 등록·인증을 지원하지 않습니다')
      expect(error.message).not.toContain('허용 값이 함께')
      expect(error.message).not.toContain('렛서')
      expect(error.payload).toEqual(response)
    } finally { globalThis.fetch = originalFetch }
  })

  test('ordinary 400 errors are not classified as portrait restrictions', () => {
    expect(openRouterHint(400, '400', 'unsupported resolution')).not.toContain('실제 인물')
    expect(openRouterHint(401)).toContain('API 키')
    expect(extractErrorCode({ error: { code: privacyCode } })).toBe(privacyCode)
    expect(describeError({ message: 'Provider rejected input' }, 'openrouter')).not.toContain('렛서')
  })

  test('common image references are converted to the documented wire format', async () => {
    const wire = await toOpenRouterBody(body)
    expect(wire.input_references).toEqual([{ type: 'image_url', image_url: { url: body.references![0].url } }])
    expect(wire).not.toHaveProperty('references')
  })
})

describe('copied diagnostics', () => {
  test('include the supplier reason while removing echoed prompts, URLs and keys', () => {
    const message = `${response.error.message}\n${JSON.stringify({ prompt: body.prompt, url: body.references![0].url })}\nBearer secret-token sk-or-v1-secret data:image/png;base64,c2VjcmV0`
    const diagnostics = inquiryText({ failure: {
      gateway: 'openrouter', at: '2026-11-10T01:51:25.519Z', endpoint: 'POST /api/v1/videos', status: 400, code: '400', body, message,
    } })
    expect(diagnostics).toContain(privacyCode)
    expect(diagnostics).toContain('content[2]')
    expect(diagnostics).toContain('전송 형식으로 변환 전')
    for (const sensitive of ['Private', 'second line', 'private.example', 'signature=secret', 'secret-token', 'sk-or-v1-secret', 'c2VjcmV0']) {
      expect(diagnostics).not.toContain(sensitive)
    }
  })

  test('redacts raw and multiply JSON-escaped input echoes', () => {
    let message = body.prompt
    for (let depth = 0; depth < 4; depth++) {
      expect(redactErrorMessage(message, body)).not.toContain('Private')
      message = JSON.stringify(message)
    }
    expect(redactErrorMessage('https:\\/\\/private.example/photo', null)).not.toContain('private.example')
  })
})
