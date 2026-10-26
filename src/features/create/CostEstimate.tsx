import { ASSETS_PRICING_URL } from '@/config/constants'
import { PRICING_AS_OF, formatEstimate } from '@/domain/pricing'
import { Disclosure } from '@/shared/ui/Disclosure'
import { useCostSummary } from '@/features/create/useCostSummary'

/** 생성 설정 안의 예상 비용 상세. 금액은 생성 바에도 보이므로 상세는 접어 둡니다. */
export function CostEstimate() {
  const { count, estimate, finalize, total } = useCostSummary()

  return (
    <Disclosure className="mt-4" label="예상 비용 상세" meta={total ?? '사전 견적 불가'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {estimate.ok ? (
          <p className="text-2xl font-semibold tabular-nums text-foreground">{total}</p>
        ) : (
          <p className="text-lg font-semibold text-foreground">사전 견적 불가</p>
        )}
        <a href={ASSETS_PRICING_URL} target="_blank" rel="noopener noreferrer" className="text-xs">
          단가 {PRICING_AS_OF} 기준 · 최신 단가 ↗
        </a>
      </div>

      {estimate.ok ? (
        <>
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
        <p className="mt-0.5 text-xs text-muted">{estimate.reason}</p>
      )}

      <p className="mt-3 text-xs text-muted">
        예상치이며 단가는 바뀔 수 있습니다. 실제 청구액은 생성이 끝난 뒤 작업 사용량으로 확인합니다.
      </p>
    </Disclosure>
  )
}
