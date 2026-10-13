export function dimensionLabel(width: number, height: number) {
  return `${width} × ${height}px · 가로/세로 ${(width / height).toFixed(3)}:1`
}

export function readImageDimensions(file: Blob) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    let done = false
    const finish = (value: { width: number; height: number } | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 8000)
    img.onload = () => finish({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => finish(null)
    img.src = url
  })
}

/** 영상·오디오 파일의 길이(초). 브라우저가 읽지 못하면 null입니다. */
export function readMediaDuration(file: Blob, kind: 'video' | 'audio') {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(kind)
    let done = false
    const finish = (value: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 8000)
    el.preload = 'metadata'
    el.onloadedmetadata = () => finish(Number.isFinite(el.duration) ? el.duration : null)
    el.onerror = () => finish(null)
    el.src = url
  })
}
