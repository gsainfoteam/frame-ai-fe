import { estimateFinalize, estimateGeneration, formatEstimate } from '@/domain/pricing'
import { buildPayload } from '@/domain/seedance'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { currentDraft } from '@/features/create/draft'

/** 생성 바와 예상 비용 상세가 같은 견적을 쓰도록 한곳에서 계산합니다. */
export function useCostSummary() {
  // 프롬프트·참조까지 견적 조건에 영향을 주므로 스토어 전체를 구독합니다.
  useWorkspaceStore()
  useProjectStore()
  const generation = useWorkspaceStore((s) => s.generation)
  const previewCount = useWorkspaceStore((s) => s.previewCount)
  const preview = generation === 'preview'
  const count = preview ? previewCount : 1
  const draft = currentDraft()
  const payload = buildPayload(draft)
  const estimate = estimateGeneration(payload, draft.spec)
  const finalize = preview ? estimateFinalize(payload) : null
  const total = estimate.ok ? formatEstimate(estimate.cost * count, estimate.currency) : null
  return { preview, count, estimate, finalize, total, spec: draft.spec }
}
