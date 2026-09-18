export class LetsurApiError extends Error {
  status?: number
  code?: string
  retry?: number
  payload?: unknown

  constructor(message: string, init?: { status?: number; code?: string; retry?: number; payload?: unknown }) {
    super(message)
    this.name = 'LetsurApiError'
    this.status = init?.status
    this.code = init?.code
    this.retry = init?.retry
    this.payload = init?.payload
  }
}

export function parseRetryAfter(header: string | null) {
  if (!header) return 5000
  const asNumber = Number(header)
  const ms = Number.isNaN(asNumber) ? Date.parse(header) - Date.now() : asNumber * 1000
  const retry = Math.max(5000, ms)
  return Number.isFinite(retry) ? retry : 5000
}
