import { useEffect } from 'react'
import { GATEWAYS } from '@/api/gateway'
import { LETSUR_MODELS, modelCapabilities } from '@/domain/models'
import { resolveModel, useModelStore } from '@/stores/modelStore'
import { useSessionStore } from '@/stores/sessionStore'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

/** 지금 선택한 게이트웨이와 모델. OpenRouter를 고르면 모델 목록을 불러옵니다. */
export function useActiveModel() {
  const gateway = useSessionStore((s) => s.gateway)
  const modelId = useWorkspaceStore((s) => s.model)
  const list = useModelStore((s) => s.openRouter)
  const status = useModelStore((s) => s.status)
  const error = useModelStore((s) => s.error)
  const load = useModelStore((s) => s.loadOpenRouter)
  const letsurKey = useSessionStore((s) => s.keys.letsur)
  const letsurAvailable = useModelStore((s) => s.letsurAvailable)
  const checkLetsur = useModelStore((s) => s.checkLetsur)

  useEffect(() => {
    if (gateway === 'openrouter') void load()
  }, [gateway, load])

  useEffect(() => {
    if (gateway === 'letsur' && letsurKey) void checkLetsur(letsurKey)
  }, [gateway, letsurKey, checkLetsur])

  const spec = resolveModel(gateway, modelId, list)
  const letsur = gateway === 'letsur'
  return {
    gateway: GATEWAYS[gateway],
    caps: modelCapabilities(spec),
    spec,
    models: letsur ? LETSUR_MODELS : list,
    /** 렛서에서 이 스페이스에 없는 것으로 확인된 모델 */
    unavailable: (id: string) => letsur && letsurAvailable !== null && !letsurAvailable.includes(id),
    status: letsur ? 'ready' : status,
    error,
  }
}

/**
 * 게이트웨이나 모델이 바뀌면 지원하지 않는 설정을 기본값으로 되돌립니다. 화면 어디서든 바뀔 수 있어
 * 항상 그려지는 헤더에서 한 번만 씁니다.
 */
export function useModelSync() {
  const { spec } = useActiveModel()
  useEffect(() => {
    const changed = useWorkspaceStore.getState().fitToModel(spec)
    if (changed.length) toast(`${spec.label}에서 지원하지 않는 ${changed.join('·')} 설정을 기본값으로 바꿨습니다.`)
  }, [spec])
}
