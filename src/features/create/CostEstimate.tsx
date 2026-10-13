import { ASSETS_PRICING_URL } from '@/config/constants'
import { PRICING_AS_OF, estimateFinalize, estimateGeneration, formatEstimate } from '@/domain/pricing'
import { buildPayload } from '@/domain/seedance'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { currentDraft } from '@/features/create/draft'

/** 생성 설정 카드 안의 예상 비용. 설정을 바꾸면 바로 다시 계산합니다. */
export function CostEstimate() {
  // 프롬프트·참조까지 견적 조건에 영향을 주므로 스토어 전체를 구독합니다.
  useWorkspaceStore()
  useProjectStore()
  const generation = useWorkspaceStore((s) => s.generation)
  const previewCount = useWorkspaceStore((s) => s.previewCount)
  const preview = generation === 'preview'
  const count = preview ? previewCount : 1
  const payload = buildPayload(currentDraft())
  const estimate = estimateGeneration(payload)
  const finalize = preview ? estimateFinalize(payload) : null

  return (
    <section aria-labelledby="cost-estimate-title" className="mt-4 rounded-md border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="cost-estimate-title" className="text-sm font-medium">
          예상 비용
        </h3>
        <a href={ASSETS_PRICING_URL} target="_blank" rel="noopener noreferrer" className="text-xs">
          단가 {PRICING_AS_OF} 기준 · 최신 단가 ↗
        </a>
      </div>

      {estimate.ok ? (
        <>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground" aria-live="polite">
            {formatEstimate(estimate.cost * count)}
          </p>
          {count > 1 ? (
            <p className="mt-0.5 text-xs text-muted">
              시안 {count}개 × {formatEstimate(estimate.cost)} · 채택하지 않은 시안도 청구됩니다
            </p>
          ) : null}

          <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-xs">
            <div className="min-w-0">
              <dt className="text-muted">해상도 · 길이</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {estimate.resolution} · {estimate.duration}초
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">예상 토큰</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {estimate.tokens.toLocaleString('ko-KR')}
                {count > 1 ? ` × ${count}` : ''}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">적용 단가</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {estimate.pricePerMillion.toFixed(2)} unit
                <span className="block font-normal text-muted">100만 토큰당</span>
              </dd>
            </div>
          </dl>

          {finalize?.ok ? (
            <p className="mt-3 rounded-md bg-accent-soft px-2.5 py-2 text-xs text-accent">
              고른 시안을 1080p로 확정하면 1개당 {formatEstimate(finalize.cost)}을 별도로 청구합니다.
            </p>
          ) : null}
          {estimate.notes.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {estimate.notes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-1.5 text-lg font-semibold text-foreground">사전 견적 불가</p>
          <p className="mt-0.5 text-xs text-muted">{estimate.reason}</p>
        </>
      )}

      <p className="mt-3 text-xs text-muted">
        예상치이며 단가는 바뀔 수 있습니다. 실제 청구액은 생성이 끝난 뒤 작업 사용량으로 확인합니다.
      </p>
    </section>
  )
}
