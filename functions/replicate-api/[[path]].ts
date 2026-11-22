const UPSTREAM = 'https://api.replicate.com/v1'
const MAX_AUTH_LEN = 4096

const ALLOWED_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^models\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/predictions$/ },
  { method: 'GET', pattern: /^predictions\/[A-Za-z0-9_-]+$/ },
  { method: 'POST', pattern: /^files$/ },
]

type PagesContext = {
  request: Request
  params: { path?: string | string[] }
}

function jsonError(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ title, detail, status }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function resolveSubpath(params: PagesContext['params']) {
  const raw = Array.isArray(params.path) ? params.path : params.path ? [params.path] : []
  const segments = raw.filter(Boolean)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..' || segment.includes('/'))) {
    return null
  }
  return segments.join('/')
}

/**
 * Cloudflare Pages Function: `/replicate-api/*` 요청을 Replicate API(`https://api.replicate.com/v1/*`)로 중계합니다.
 * 브라우저에서 전달한 `Authorization: Bearer ...` 헤더를 그대로 전달하며, 앱이 사용하는 엔드포인트만 허용합니다.
 */
export async function onRequest({ request, params }: PagesContext): Promise<Response> {
  const subpath = resolveSubpath(params)
  if (!subpath) return jsonError(404, 'Not Found', '지원하지 않는 Replicate API 경로입니다.')

  const matchingRoutes = ALLOWED_ROUTES.filter((route) => route.pattern.test(subpath))
  if (!matchingRoutes.length) return jsonError(404, 'Not Found', '지원하지 않는 Replicate API 경로입니다.')
  if (!matchingRoutes.some((route) => route.method === request.method)) {
    return jsonError(405, 'Method Not Allowed', '허용되지 않은 HTTP 메서드입니다.')
  }

  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.length > MAX_AUTH_LEN) {
    return jsonError(401, 'Unauthenticated', 'Replicate API 토큰이 필요합니다.')
  }

  const headers = new Headers()
  headers.set('Authorization', auth)
  headers.set('Accept', request.headers.get('Accept') || 'application/json')
  const contentType = request.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)

  try {
    const upstream = await fetch(`${UPSTREAM}/${subpath}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    })

    const resHeaders = new Headers()
    const upstreamType = upstream.headers.get('Content-Type')
    if (upstreamType) resHeaders.set('Content-Type', upstreamType)
    const retryAfter = upstream.headers.get('Retry-After')
    if (retryAfter) resHeaders.set('Retry-After', retryAfter)
    resHeaders.set('Cache-Control', 'no-store')
    resHeaders.set('X-Content-Type-Options', 'nosniff')

    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    })
  } catch {
    return jsonError(
      502,
      'Bad Gateway',
      'Replicate 연결에 실패했습니다. 생성 요청은 접수되었을 수 있으므로 Replicate 대시보드에서 먼저 확인하세요.',
    )
  }
}
