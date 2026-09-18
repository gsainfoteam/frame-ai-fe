import type {
  CreateJobResponse,
  GetJobResponse,
  MediaLinkResponse,
  UploadReferenceResponse,
  UploadTrack,
  VideoGenerationRequest,
} from '@/api/types'

export type VideoApi = {
  createJob: (payload: VideoGenerationRequest) => Promise<CreateJobResponse>
  getJob: (id: string) => Promise<GetJobResponse>
  uploadReference: (file: File, track: UploadTrack) => Promise<UploadReferenceResponse>
  issueMediaLink: (mediaId: string) => Promise<MediaLinkResponse>
  downloadMedia: (mediaId: string) => Promise<Blob>
}
