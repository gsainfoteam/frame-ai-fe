import { createContext, useContext } from 'react'
import type { ResultMedia } from '@/api/types'

export type JobApi = {
  generate: () => Promise<void>
  lookup: () => void
  stop: () => void
  startPolling: (id: string) => void
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
