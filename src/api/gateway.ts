import { API_DOCS_URL } from '@/config/constants'

export type GatewayId = 'letsur' | 'openrouter'

export const GATEWAY_IDS: GatewayId[] = ['letsur', 'openrouter']

/** 게이트웨이마다 지원 여부가 다른 기능. 없으면 화면에서 숨기거나 비활성화합니다. */
export type GatewayCapabilities = {
  /** 480p 시안 → 1080p 확정 */
  draft: boolean
  /** 인물 참조용 관리형 업로드 (letsur-asset://) */
  managedUpload: boolean
  /** 영상·오디오 파일 업로드. 없으면 HTTPS URL만 받습니다. */
  mediaUpload: boolean
  /** 결과 보관(`store_media`) 선택 */
  storeMedia: boolean
  /** 결과로 마지막 프레임 이미지를 받아 다음 장면의 첫 프레임으로 쓰기 */
  lastFrame: boolean
  /** 영상 참조의 편집·연장 방식(`mode`) */
  videoModes: boolean
  /** 렛서 지원 문의용 정보 */
  inquiry: boolean
  /** 모델 목록에서 고르기 */
  modelPicker: boolean
}

export type GatewayInfo = {
  id: GatewayId
  label: string
  keyLabel: string
  keyPlaceholder: string
  docsUrl: string
  capabilities: GatewayCapabilities
}

export const GATEWAYS: Record<GatewayId, GatewayInfo> = {
  letsur: {
    id: 'letsur',
    label: '렛서',
    keyLabel: '렛서 API Key',
    keyPlaceholder: 'API 키를 입력하세요',
    docsUrl: API_DOCS_URL,
    capabilities: {
      draft: true,
      managedUpload: true,
      mediaUpload: true,
      storeMedia: true,
      lastFrame: true,
      videoModes: true,
      inquiry: true,
      modelPicker: true,
    },
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-…',
    docsUrl: 'https://openrouter.ai/docs/guides/overview/multimodal/video-generation',
    capabilities: {
      draft: false,
      managedUpload: false,
      mediaUpload: false,
      storeMedia: false,
      lastFrame: false,
      videoModes: false,
      inquiry: false,
      modelPicker: true,
    },
  },
}

export function isGatewayId(value: unknown): value is GatewayId {
  return typeof value === 'string' && (GATEWAY_IDS as string[]).includes(value)
}
