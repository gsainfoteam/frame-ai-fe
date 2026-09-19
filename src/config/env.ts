const base = import.meta.env.VITE_LETSUR_API_BASE?.trim().replace(/\/+$/, '')

if (!base) {
  throw new Error('VITE_LETSUR_API_BASE 환경 변수가 필요합니다. .env.example을 복사해 .env를 만드세요.')
}

export const letsurApiBase = base
