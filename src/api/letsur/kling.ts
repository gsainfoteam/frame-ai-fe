import type { GenerationRequest } from '@/api/types'

/** Kling 모델 코드는 `kling-v{버전}-{종류}`입니다. */
export function isKlingModel(model: string) {
  return model.startsWith('kling-')
}

type KlingFileInfo = {
  Type: 'Url'
  Category: 'Image' | 'Video'
  Usage: 'FirstFrame' | 'Reference'
  ReferenceType?: 'base' | 'feature'
  Url: string
}

/** 해상도 표기가 Kling은 대문자(720P)입니다. 2K·4K는 그대로입니다. */
function klingResolution(value: string) {
  return /^\d+p$/.test(value) ? value.toUpperCase() : value
}

/**
 * 공통 요청을 렛서 Kling 본문으로 바꿉니다 (렛서 Kling 가이드).
 * - 첫 프레임은 `FileInfos`의 `Usage: FirstFrame`, 끝 프레임은 `LastFrameUrl`
 * - 참조 이미지는 `Usage: Reference`, 참조 영상은 `ReferenceType`으로 편집(`base`)과 참고(`feature`)를 구분
 * - `mode`, `references`, `seed`, `return_last_frame` 같은 Seedance 필드는 보내지 않습니다.
 */
export function toKlingBody(payload: GenerationRequest) {
  const files: KlingFileInfo[] = []
  let lastFrame: string | undefined
  if (payload.image_url) files.push({ Type: 'Url', Category: 'Image', Usage: 'FirstFrame', Url: payload.image_url })
  for (const ref of payload.references ?? []) {
    if (ref.role === 'first_frame') files.push({ Type: 'Url', Category: 'Image', Usage: 'FirstFrame', Url: ref.url })
    else if (ref.role === 'last_frame') lastFrame = ref.url
    else if (ref.type === 'video') {
      files.push({
        Type: 'Url',
        Category: 'Video',
        Usage: 'Reference',
        ReferenceType: payload.mode === 'edit' ? 'base' : 'feature',
        Url: ref.url,
      })
    } else files.push({ Type: 'Url', Category: 'Image', Usage: 'Reference', Url: ref.url })
  }

  const output: Record<string, unknown> = { AudioGeneration: payload.generate_audio ? 'Enabled' : 'Disabled' }
  if (payload.resolution) output.Resolution = klingResolution(payload.resolution)
  if (payload.duration !== undefined) output.Duration = payload.duration
  if (payload.aspect_ratio) output.AspectRatio = payload.aspect_ratio
  if (payload.watermark !== undefined) output.LogoAdd = payload.watermark ? 'Enabled' : 'Disabled'

  const body: Record<string, unknown> = { model: payload.model, Prompt: payload.prompt, OutputConfig: output }
  if (files.length) body.FileInfos = files
  if (lastFrame) body.LastFrameUrl = lastFrame
  if (payload.store_media !== undefined) body.store_media = payload.store_media
  return body
}
