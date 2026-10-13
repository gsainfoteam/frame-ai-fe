import { createContext, useContext } from 'react'
import type { ResultMedia } from '@/api/types'
import type { FinalizeOptions } from '@/domain/seedance'

export type JobApi = {
  generate: () => Promise<void>
  /** 시안을 1080p로 확정합니다. 접수된 새 작업 ID를 반환합니다. */
  finalize: (draftJobId: string, options: FinalizeOptions) => Promise<string>
  lookup: () => void
  stop: () => void
  /** 영상 만들기 화면으로 이동해 결과 패널에 이 작업을 띄웁니다. */
  startPolling: (id: string) => void
  /** 화면 이동 없이 결과 패널의 현재 작업을 바꿉니다. */
  focusJob: (id: string) => void
  showMedia: (url: string, kind: string, mediaId?: string) => void
  refreshLink: (media: ResultMedia) => Promise<void>
  addVideoRef: (media: Pick<ResultMedia, 'media_id'>) => Promise<void>
  restoreRequest: (recordId: string) => void
  prepareContinuation: (jobId: string, mediaId?: string) => Promise<void>
  applyContinuation: (opts: { managed: boolean; file?: File | null }) => Promise<void>
  cancelContinuation: () => void
}

export const JobContext = createContext<JobApi | null>(null)

export function useJob() {
  const value = useContext(JobContext)
  if (!value) throw new Error('JobProvider 안에서만 사용할 수 있습니다.')
  return value
}
