import { create } from 'zustand'
import type { GetJobResponse, JobStatus, LetsurJob } from '@/api/types'
import { LetsurApiError, isRetryableRateLimit, isTransportError } from '@/api/errors'
import { createLetsurClient } from '@/api/letsur/client'
import { POLL_MAX_WAIT_MS, POLL_TRANSPORT_FAILURES } from '@/config/constants'
import { nextPollDelay, settleJob } from '@/domain/polling'
import { normalizeUsage } from '@/domain/usage'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * 여러 작업의 상태를 동시에 조회합니다. 화면 전환과 무관하게 계속 동작하며,
 * 작업마다 10~30초 간격·최대 대기 시간 규칙(가이드 §5)을 따릅니다.
 */
export type WatchPhase = 'polling' | 'retrying' | 'settled' | 'timeout' | 'stopped' | 'error'

export type JobWatch = {
  id: string
  phase: WatchPhase
  job?: LetsurJob
  raw?: string
  /** 진행·완료 안내 또는 마지막 오류 */
  message: string
  messageIsError: boolean
  startedAt: number
  nextAt?: number
}

export type WatchEvent = 'update' | 'settled' | 'error' | 'timeout' | 'stopped'
type Listener = (watch: JobWatch, event: WatchEvent) => void

export const useJobWatchStore = create<{ watches: Record<string, JobWatch> }>(() => ({ watches: {} }))

const api = createLetsurClient(() => useSessionStore.getState().apiKey)
const timers = new Map<string, number>()
const epochs = new Map<string, number>()
const listeners = new Set<Listener>()

export function isWatchActive(watch: JobWatch | undefined) {
  return watch?.phase === 'polling' || watch?.phase === 'retrying'
}

export function onJobWatch(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function patch(id: string, next: Partial<JobWatch>) {
  const base: JobWatch = useJobWatchStore.getState().watches[id] ?? {
    id,
    phase: 'polling',
    message: '',
    messageIsError: false,
    startedAt: Date.now(),
  }
  const watch: JobWatch = { ...base, ...next }
  useJobWatchStore.setState((state) => ({ watches: { ...state.watches, [id]: watch } }))
  return watch
}

function emit(watch: JobWatch, event: WatchEvent) {
  for (const listener of listeners) listener(watch, event)
}

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer !== undefined) window.clearTimeout(timer)
  timers.delete(id)
}

/** 조회 결과를 이 브라우저의 생성 기록에 반영합니다. */
export function rememberJob(job: LetsurJob, id: string) {
  const status = (['queued', 'running', 'succeeded', 'failed'].includes(job.status) ? job.status : 'unknown') as JobStatus
  const usage = normalizeUsage(job.usage)
  useProjectStore.getState().upsertRecord({
    id: job.id || id,
    status,
    updated_at: job.updated_at || new Date().toISOString(),
    ...(job.created_at ? { created_at: job.created_at } : {}),
    media: (job.result?.media ?? []).map((m) => ({
      media_id: m.media_id,
      kind: m.kind,
      state: m.state,
    })),
    ...(usage ? { usage } : {}),
    ...(job.error ? { error: job.error } : {}),
  })
}

function readJob(json: GetJobResponse) {
  const job = json.data?.job
  if (!job) throw new LetsurApiError('응답에서 작업 정보를 찾지 못했습니다.', { code: 'missing_job' })
  return job
}

/** 작업을 한 번 조회해 기록에 반영합니다. 자동 조회와 별개입니다. */
export async function fetchJobOnce(id: string) {
  const json = await api.getJob(id)
  const job = readJob(json)
  rememberJob(job, id)
  const settlement = settleJob(job)
  const current = useJobWatchStore.getState().watches[id]
  patch(id, {
    job,
    raw: JSON.stringify(json, null, 2),
    ...(isWatchActive(current) ? {} : { phase: settlement.settled ? 'settled' : 'stopped' }),
  })
  return job
}

async function poll(id: string, epoch: number, attempt: number, transportFailures: number) {
  if (epochs.get(id) !== epoch) return
  const startedAt = useJobWatchStore.getState().watches[id]?.startedAt ?? Date.now()
  if (Date.now() - startedAt > POLL_MAX_WAIT_MS) {
    emit(
      patch(id, {
        phase: 'timeout',
        nextAt: undefined,
        messageIsError: false,
        message: `최대 대기 시간(${POLL_MAX_WAIT_MS / 60_000}분)이 지나 자동 조회를 멈췄습니다. 생성 실패가 아니며, 같은 작업 ID로 다시 조회할 수 있습니다. 같은 요청을 다시 보내지 마세요.`,
      }),
      'timeout',
    )
    return
  }

  const schedule = (delay: number, nextAttempt: number, failures: number) => {
    const nextAt = Date.now() + delay
    timers.set(id, window.setTimeout(() => void poll(id, epoch, nextAttempt, failures), Math.min(delay, 2_147_483_647)))
    return nextAt
  }

  try {
    const json = await api.getJob(id)
    if (epochs.get(id) !== epoch) return
    const job = readJob(json)
    rememberJob(job, id)
    const settlement = settleJob(job)
    const raw = JSON.stringify(json, null, 2)
    if (settlement.settled) {
      const watch = patch(id, { job, raw, phase: 'settled', nextAt: undefined, message: settlement.note, messageIsError: false })
      emit(watch, 'update')
      emit(watch, 'settled')
      return
    }
    const delay = nextPollDelay(attempt)
    const nextAt = schedule(delay, attempt + 1, 0)
    emit(patch(id, { job, raw, phase: 'polling', nextAt, message: settlement.note, messageIsError: false }), 'update')
  } catch (error) {
    if (epochs.get(id) !== epoch) return
    const err = error instanceof LetsurApiError ? error : new LetsurApiError((error as Error).message || '조회 실패')
    // 503(result_unavailable 등)과 재시도 가능한 429는 안내된 시간 뒤 같은 작업을 다시 조회합니다.
    if (isRetryableRateLimit(err) || err.status === 503) {
      const delay = err.retry ?? nextPollDelay(attempt)
      const nextAt = schedule(delay, attempt, 0)
      emit(
        patch(id, {
          phase: 'retrying',
          nextAt,
          messageIsError: true,
          message: `${err.message}\n안내된 대기(${Math.round(delay / 1000)}초) 후 같은 작업을 다시 조회합니다.`,
        }),
        'error',
      )
      return
    }
    // 연결 실패와 502·504는 간격을 늘려 제한적으로 재시도합니다 (렛서 오류 처리 문서).
    const transient = isTransportError(err) || err.status === 502 || err.status === 504
    if (transient && transportFailures + 1 < POLL_TRANSPORT_FAILURES) {
      const delay = nextPollDelay(attempt)
      const nextAt = schedule(delay, attempt + 1, transportFailures + 1)
      emit(
        patch(id, {
          phase: 'retrying',
          nextAt,
          messageIsError: true,
          message: `상태 조회에 실패했습니다. 생성 실패가 아니며 ${Math.round(delay / 1000)}초 뒤 다시 조회합니다.\n${err.message}`,
        }),
        'error',
      )
      return
    }
    emit(
      patch(id, {
        phase: 'error',
        nextAt: undefined,
        messageIsError: true,
        message: transient
          ? `상태 조회가 계속 실패해 자동 조회를 멈췄습니다. 생성 실패로 간주하지 말고 같은 작업 ID로 다시 조회하세요.\n${err.message}`
          : err.message,
      }),
      'error',
    )
  }
}

/** 이미 조회 중이면 그대로 둡니다. 멈춘 작업은 대기 시간을 새로 시작합니다. */
export function watchJob(id: string) {
  const current = useJobWatchStore.getState().watches[id]
  if (isWatchActive(current)) return
  clearTimer(id)
  const epoch = (epochs.get(id) ?? 0) + 1
  epochs.set(id, epoch)
  patch(id, { phase: 'polling', startedAt: Date.now(), nextAt: undefined, message: '', messageIsError: false })
  void poll(id, epoch, 0, 0)
}

/** 자동 조회만 멈춥니다. 영상 생성을 취소하지 않습니다. */
export function stopWatching(id: string) {
  const current = useJobWatchStore.getState().watches[id]
  clearTimer(id)
  epochs.set(id, (epochs.get(id) ?? 0) + 1)
  if (isWatchActive(current)) emit(patch(id, { phase: 'stopped', nextAt: undefined }), 'stopped')
}
