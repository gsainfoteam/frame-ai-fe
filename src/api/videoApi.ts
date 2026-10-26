import type { GatewayId } from '@/api/gateway'
import type {
  CreateJobResponse,
  JobSnapshot,
  MediaLinkResponse,
  UploadReferenceResponse,
  UploadTrack,
  VideoGenerationRequest,
} from '@/api/types'

export type VideoApi = {
  gateway: GatewayId
  createJob: (payload: VideoGenerationRequest) => Promise<CreateJobResponse>
  getJob: (id: string) => Promise<JobSnapshot>
  uploadReference: (file: File, track: UploadTrack) => Promise<UploadReferenceResponse>
  issueMediaLink: (mediaId: string) => Promise<MediaLinkResponse>
  downloadMedia: (mediaId: string) => Promise<Blob>
  /** 이 키로 쓸 수 있는 모델 코드. 게이트웨이가 키별 목록을 줄 때만 있습니다. */
  listModelIds?: () => Promise<string[]>
}
