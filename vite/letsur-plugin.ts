import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

const API = 'https://gw.letsur.ai/v1'
const MAX_FRAME = 30 * 1024 * 1024

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = Buffer.from(JSON.stringify(body))
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', String(data.length))
  res.setHeader('Cache-Control', 'no-store')
  res.end(data)
}

async function downloadFrame(req: IncomingMessage, res: ServerResponse, mediaId: string) {
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer ') || auth.length > 16384) {
    sendJson(res, 401, { error: { message: 'API key required' } })
    return
  }

  try {
    const linkRes = await fetch(`${API}/media/${mediaId}/link`, {
      method: 'POST',
      headers: { Authorization: auth },
      redirect: 'manual',
    })
    if (!linkRes.ok) {
      sendJson(res, linkRes.status, {
        error: {
          message: '미디어 링크 발급 또는 다운로드 실패. 파일 준비 상태와 보관기간을 확인하세요.',
        },
      })
      return
    }

    const link = (await linkRes.json()) as { url?: string }
    const url = link.url ?? ''
    if (!url.startsWith('https://')) {
      sendJson(res, 502, { error: { message: 'Invalid media link' } })
      return
    }

    const mediaRes = await fetch(url)
    const mime = (mediaRes.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (!mime.startsWith('image/')) {
      sendJson(res, 415, { error: { message: 'Expected an image' } })
      return
    }

    const buf = Buffer.from(await mediaRes.arrayBuffer())
    if (buf.length > MAX_FRAME) {
      sendJson(res, 413, { error: { message: 'Frame exceeds 30 MiB' } })
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(buf)
  } catch {
    sendJson(res, 502, {
      error: {
        message: '렛서 연결 실패 또는 시간 초과. 생성 요청은 접수되었을 수 있으므로 자동 재전송하지 마세요.',
      },
    })
  }
}

function attach(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? ''
    if (req.method === 'GET' && (url === '/local-health' || url.startsWith('/local-health?'))) {
      sendJson(res, 200, { service: 'letsur-local', media_download: true, version: 2 })
      return
    }

    const match = url.match(/^\/api\/media\/([A-Za-z0-9_-]+)\/content(?:\?.*)?$/)
    if (req.method === 'GET' && match) {
      void downloadFrame(req, res, match[1])
      return
    }

    next()
  })
}

export function letsurLocalPlugin(): Plugin {
  return {
    name: 'letsur-local',
    configureServer(server) {
      attach(server)
    },
    configurePreviewServer(server) {
      attach(server)
    },
  }
}
