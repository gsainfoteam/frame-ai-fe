const base = import.meta.env.VITE_LETSUR_API_BASE?.trim().replace(/\/+$/, '')

if (!base) {
  throw new Error('VITE_LETSUR_API_BASE 환경 변수가 필요합니다. .env.example을 복사해 .env를 만드세요.')
}

export const letsurApiBase = base

/** OpenRouter는 브라우저 교차 출처 호출을 허용하므로 기본값으로 직접 호출합니다. */
export const openRouterApiBase =
  import.meta.env.VITE_OPENROUTER_API_BASE?.trim().replace(/\/+$/, '') || 'https://openrouter.ai/api/v1'
