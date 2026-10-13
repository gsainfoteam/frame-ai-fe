import type { LetsurJob } from '@/api/types'
import { POLL_INITIAL_MS, POLL_MAX_MS, POLL_STEP_MS } from '@/config/constants'

/** 10초 → 15초 → … → 30초 */
export function nextPollDelay(attempt: number) {
  return Math.min(POLL_MAX_MS, POLL_INITIAL_MS + Math.max(0, attempt) * POLL_STEP_MS)
}

export type Settlement = { settled: false; note: string } | { settled: true; note: string }

/**
 * 더 조회할 필요가 있는지 판단합니다 (가이드 §5).
 * - 생성 완료라도 결과가 `pending`이거나 `copying`이면 계속 조회합니다.
 * - `storage: none`이거나 결과를 받을 수 없는 상태는 반복 조회로 해결되지 않으므로 멈춥니다.
 */
export function settleJob(job: LetsurJob): Settlement {
  if (job.status === 'failed') return { settled: true, note: '' }
  if (job.status !== 'succeeded') return { settled: false, note: '' }

  const media = job.result?.media ?? []
  const copying = media.some((item) => item.state === 'pending' || item.url_unavailable_reason === 'copying')
  if (job.result?.storage === 'none') {
    return {
      settled: true,
      note: copying || !media.some((item) => item.url)
        ? '이 작업은 결과를 보관하지 않습니다. 다시 조회해도 내려받을 수 없습니다.'
        : '이 작업은 결과를 보관하지 않습니다. 링크가 만료되기 전에 바로 내려받으세요.',
    }
  }
  if (copying) return { settled: false, note: '영상 생성 완료 · 결과 파일을 준비하고 있습니다.' }
  if (!media.length) return { settled: true, note: '생성은 완료되었지만 반환된 미디어가 없습니다.' }
  const unavailable = media.filter((item) => item.state === 'unavailable')
  if (unavailable.length === media.length) {
    return {
      settled: true,
      note: '결과 파일을 받을 수 없는 상태입니다. 보관기한이 지났을 수 있습니다. 상태가 계속되면 작업 ID로 문의하세요.',
    }
  }
  return { settled: true, note: '결과를 확인하세요. 링크가 만료되면 다시 발급할 수 있습니다.' }
}
