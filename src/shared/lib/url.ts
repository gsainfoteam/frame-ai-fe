export function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * 화면에서 재생·표시할 수 있는 주소. HTTPS 외에 이 페이지가 만든 blob: 주소(인증이 필요한 결과 파일을
 * 내려받은 사본)도 허용합니다. 게이트웨이로 보내는 값에는 `safeUrl`을 씁니다.
 */
export function playableUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return url.href
    return url.protocol === 'blob:' && url.origin === window.location.origin ? url.href : null
  } catch {
    return null
  }
}

/** 이 브라우저의 이미지 보관함에 둔 원본. OpenRouter로 보낼 때 data URL로 바꿉니다. */
export const LOCAL_IMAGE_SCHEME = 'frame-local://'

export function isLocalImageRef(value: string) {
  return /^frame-local:\/\/[A-Za-z0-9_-]+$/.test(value)
}

export function validRef(value: string) {
  return /^https:\/\/\S+$/.test(value) || /^letsur-(file|asset):\/\/[^\s/]+$/.test(value) || isLocalImageRef(value)
}
