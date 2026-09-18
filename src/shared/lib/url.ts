export function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function validRef(value: string) {
  return /^https:\/\/\S+$/.test(value) || /^letsur-(file|asset):\/\/[^\s/]+$/.test(value)
}
