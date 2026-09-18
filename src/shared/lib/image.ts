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
