import { create } from 'zustand'
import type { GatewayId } from '@/api/gateway'
import { getVideoApi } from '@/api'
import { fetchOpenRouterModels } from '@/api/openrouter/client'
import { LETSUR_MODEL, LETSUR_MODELS, OPENROUTER_DEFAULT_MODEL, toModelSpec, type ModelSpec } from '@/domain/models'

/**
 * 목록을 받기 전에도 폼을 쓸 수 있도록 둔 기본 모델. 값은 2026-10 OpenRouter `/videos/models` 응답 기준이며
 * 목록을 받으면 그 값으로 바뀝니다.
 */
const OPENROUTER_FALLBACK: ModelSpec = {
  id: OPENROUTER_DEFAULT_MODEL,
  label: 'ByteDance: Seedance 2.5',
  gateway: 'openrouter',
  resolutions: ['480p', '720p'],
  aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
  durations: Array.from({ length: 27 }, (_, index) => index + 4),
  frameImages: ['first_frame', 'last_frame'],
  audio: true,
  seed: true,
  passthrough: ['watermark', 'req_key', 'output_format'],
}

type ModelState = {
  openRouter: ModelSpec[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  /** 렛서 키로 확인한 이 스페이스의 모델 코드. 확인 전이거나 실패하면 null입니다. */
  letsurAvailable: string[] | null
  /** 확인에 쓴 키. 키가 바뀌면 다시 확인합니다. */
  letsurCheckedKey: string
  loadOpenRouter: () => Promise<void>
  checkLetsur: (key: string) => Promise<void>
}

export const useModelStore = create<ModelState>((set, get) => ({
  openRouter: [],
  status: 'idle',
  error: '',
  letsurAvailable: null,
  letsurCheckedKey: '',
  checkLetsur: async (key) => {
    if (!key.trim() || get().letsurCheckedKey === key) return
    set({ letsurCheckedKey: key, letsurAvailable: null })
    try {
      const ids = (await getVideoApi('letsur').listModelIds?.()) ?? null
      if (get().letsurCheckedKey === key) set({ letsurAvailable: ids })
    } catch {
      // 목록을 못 받아도 생성은 막지 않습니다. 모델 사용 권한은 접수 응답에서 확인됩니다.
    }
  },
  loadOpenRouter: async () => {
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading', error: '' })
    try {
      const specs = (await fetchOpenRouterModels()).flatMap((model) => toModelSpec(model) ?? [])
      set({ openRouter: specs.sort((a, b) => a.label.localeCompare(b.label)), status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: (error as Error).message })
    }
  },
}))

/** 게이트웨이와 선택한 모델 ID로 지원 범위를 찾습니다. 빈 값이나 목록에 없는 ID는 기본 모델입니다. */
export function resolveModel(gateway: GatewayId, modelId: string, list = useModelStore.getState().openRouter): ModelSpec {
  if (gateway === 'letsur') return LETSUR_MODELS.find((spec) => spec.id === modelId) ?? LETSUR_MODEL
  return (
    list.find((spec) => spec.id === modelId) ??
    list.find((spec) => spec.id === OPENROUTER_DEFAULT_MODEL) ??
    list[0] ??
    OPENROUTER_FALLBACK
  )
}
