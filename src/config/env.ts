/** OpenRouter만 사용하는 정적 배포에는 렛서 환경 변수가 필요하지 않습니다. */
export const letsurApiBase =
  import.meta.env.VITE_LETSUR_API_BASE?.trim().replace(/\/+$/, '') ||
  (import.meta.env.DEV ? '/api' : 'https://gw.letsur.ai/v1')

/** OpenRouter는 브라우저 교차 출처 호출을 허용하므로 기본값으로 직접 호출합니다. */
export const openRouterApiBase =
  import.meta.env.VITE_OPENROUTER_API_BASE?.trim().replace(/\/+$/, '') || 'https://openrouter.ai/api/v1'

/**
 * Replicate는 브라우저 교차 출처 호출을 제한하므로 같은 출처의 `/replicate-api` 프록시를 기본 사용합니다.
 * 로컬에서는 Vite 프록시, Cloudflare Pages 배포에서는 `functions/replicate-api/[[path]].ts`가 중계합니다.
 */
export const replicateApiBase =
  import.meta.env.VITE_REPLICATE_API_BASE?.trim().replace(/\/+$/, '') || '/replicate-api'
