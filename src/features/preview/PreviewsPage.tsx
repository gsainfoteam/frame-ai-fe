import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { asGenerationRequest, isFinalizeRequest, type JobRecord } from '@/api/types'
import { ASSETS_PRICING_URL } from '@/config/constants'
import { PRICING_AS_OF, compareCandidates, estimateFinalize, estimateGeneration, formatEstimate } from '@/domain/pricing'
import { finalizeBlocker, isPreviewRecord } from '@/domain/seedance'
import { formatAmount, formatUsage, sumUsage } from '@/domain/usage'
import { safeUrl } from '@/shared/lib/url'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Field'
import { EmptyState } from '@/shared/ui/EmptyState'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useJob } from '@/features/create/jobContext'
import { fetchJobOnce, isWatchActive, useJobWatchStore, watchJob } from '@/features/jobs/jobWatcher'

const statusText = {
  queued: '대기',
  running: '생성 중',
  succeeded: '완료',
  failed: '실패',
  unknown: '미조회',
} as const

export function PreviewsPage() {
  const projects = useProjectStore((s) => s.projects)
  const records = useProjectStore((s) => s.records)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const [openOnly, setOpenOnly] = useState(false)
  const project = projects.find((p) => p.id === activeProjectId)
  const finalizedIds = new Set(
    records.flatMap((record) => (isFinalizeRequest(record.request) ? [record.request.draft_job] : [])),
  )
  const previews = records
    .filter((record) => record.project_id === activeProjectId && isPreviewRecord(record))
    .filter((record) => !openOnly || (!finalizedIds.has(record.id) && record.status !== 'failed'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`${project?.name ?? '프로젝트'} · 시안 비교`}
          description="480p 시안의 구도와 움직임을 나란히 비교하고, 마음에 드는 시안만 1080p로 확정합니다. 시안과 확정은 각각 과금됩니다."
          actions={
            <Checkbox label="확정 전 시안만" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          }
        />
        <CostComparison previews={previews} />
      </Card>

      {previews.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {previews.map((record) => (
            <PreviewCard key={record.id} record={record} />
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="시안이 없습니다"
            body={'영상 만들기에서 생성 방식을 ‘480p 시안 먼저’로 선택하면\n여기에서 후보를 비교할 수 있어요.'}
          />
          <div className="mt-3 text-center">
            <Link to="/" className="text-sm">
              영상 만들기로 이동 ↗
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

/** 가이드 §7.3: 시안 N개 + 1개 확정 vs 1080p 직접 N개 */
function CostComparison({ previews }: { previews: JobRecord[] }) {
  const candidates = previews.filter((record) => record.status !== 'failed')
  const charged = sumUsage(previews.filter((record) => record.usage).map((record) => record.usage))
  const pending = previews.filter((record) => !record.usage && record.status !== 'failed').length
  const first = asGenerationRequest(candidates[0]?.request)
  const preview = first ? estimateGeneration(first) : null
  const final = first ? estimateFinalize(first) : null
  const comparable = candidates.length > 0 && preview?.ok && final?.ok

  return (
    <div className="grid gap-3 text-xs text-muted sm:grid-cols-2">
      <div className="rounded-md border border-line bg-surface px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">
          시안 실제 청구 {charged ? formatAmount(charged.amount, charged.currency) : '없음'}
        </p>
        <p className="mt-1">
          {previews.length}개 중 {previews.length - pending}개의 청구액 합산
          {pending ? ` · ${pending}개는 아직 비용 미확정(무료가 아님)` : ''} · 채택하지 않은 시안도 포함
        </p>
      </div>
      <div className="rounded-md border border-line bg-surface px-3 py-2.5">
        {comparable && preview.ok && final.ok ? (
          (() => {
            const { viaPreview, direct } = compareCandidates(candidates.length, preview.cost, final.cost)
            return (
              <>
                <p className="text-sm font-medium text-foreground">
                  시안 {candidates.length}개 + 1개 확정 {formatEstimate(viaPreview)} · 1080p 직접 {candidates.length}개{' '}
                  {formatEstimate(direct)}
                </p>
                <p className="mt-1">
                  가장 최근 시안 설정({preview.duration}초) 기준 예상 · 한 번에 원하는 결과를 얻는다면 1080p 직접 생성이 더 저렴합니다.
                </p>
              </>
            )
          })()
        ) : (
          <p>{preview && !preview.ok ? preview.reason : '시안을 만들면 1080p 직접 생성과 예상 비용을 비교합니다.'}</p>
        )}
        <p className="mt-1">
          단가 {PRICING_AS_OF} 기준 · 변동될 수 있음 ·{' '}
          <a href={ASSETS_PRICING_URL} target="_blank" rel="noopener noreferrer">
            최신 단가 ↗
          </a>
        </p>
      </div>
    </div>
  )
}

function PreviewCard({ record }: { record: JobRecord }) {
  const { startPolling, restoreRequest } = useJob()
  const records = useProjectStore((s) => s.records)
  const apiKey = useSessionStore((s) => s.apiKey)
  const watch = useJobWatchStore((s) => s.watches[record.id])
  const set = useWorkspaceStore((s) => s.set)
  const request = asGenerationRequest(record.request)
  const blocker = finalizeBlocker(record)
  const finals = records.filter((item) => isFinalizeRequest(item.request) && item.request.draft_job === record.id)
  const video = (watch?.job?.result?.media ?? []).find((item) => item.kind === 'video' && item.state === 'ready' && item.url)
  const videoUrl = video?.url ? safeUrl(video.url) : null
  const unsettled = record.status === 'queued' || record.status === 'running' || record.status === 'unknown'

  // 처리 중인 시안은 자동 조회합니다. 완료된 시안은 재생 링크를 받으려고 한 번만 조회합니다.
  useEffect(() => {
    if (unsettled && apiKey && !isWatchActive(useJobWatchStore.getState().watches[record.id])) watchJob(record.id)
  }, [apiKey, record.id, unsettled])

  const linkQuery = useQuery({
    queryKey: ['preview-link', record.id, apiKey],
    queryFn: () => fetchJobOnce(record.id),
    enabled: Boolean(apiKey) && record.status === 'succeeded' && !videoUrl,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return (
    <li className="flex flex-col rounded-lg border border-line bg-panel p-3 shadow-card">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-line bg-viewer">
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
            onError={() => void linkQuery.refetch()}
          />
        ) : (
          <p className="px-4 text-center text-xs text-muted">
            {!apiKey
              ? 'API 키를 입력하면 미리보기를 불러옵니다.'
              : record.status === 'failed'
                ? '생성 실패'
                : unsettled
                  ? watch?.message || '시안을 만들고 있습니다…'
                  : linkQuery.isFetching
                    ? '미리보기를 불러오는 중…'
                    : linkQuery.error
                      ? (linkQuery.error as Error).message.split('\n')[0]
                      : watch?.message || '재생할 수 있는 영상이 없습니다.'}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="line-clamp-2 min-w-0 whitespace-pre-wrap break-words text-sm font-medium">
          {request?.prompt || '(설정 정보 없음)'}
        </p>
        <StatusBadge status={record.status}>{statusText[record.status]}</StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted">
        {request
          ? `${request.duration === undefined ? '5초' : request.duration === -1 ? '길이 자동' : `${request.duration}초`} · ${request.aspect_ratio || '비율 기본값'}${request.seed !== undefined ? ` · 시드 ${request.seed}` : ''}`
          : ''}
        {` · ${formatUsage(record.usage)}`}
      </p>
      <p className="mt-0.5 break-all font-mono text-2xs text-faint">{record.id}</p>

      {finals.length ? (
        <ul className="mt-2 space-y-1">
          {finals.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">
              <span>1080p 확정 · {statusText[item.status]}</span>
              <button type="button" className="cursor-pointer font-medium underline-offset-2 hover:underline" onClick={() => startPolling(item.id)}>
                결과 보기
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        <Button
          size="sm"
          variant={finals.length ? 'default' : 'primary'}
          disabled={Boolean(blocker)}
          title={blocker ?? undefined}
          onClick={() => set({ finalizeTarget: record.id })}
        >
          {finals.length ? '다시 확정' : '1080p로 확정'}
        </Button>
        <Button size="sm" onClick={() => startPolling(record.id)}>
          결과 패널에서 보기
        </Button>
        {request ? (
          <Button size="sm" variant="subtle" onClick={() => restoreRequest(record.id)}>
            설정 불러오기
          </Button>
        ) : null}
      </div>
    </li>
  )
}
