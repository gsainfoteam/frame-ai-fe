import { useEffect, useRef, useState } from 'react'
import type { ResultMedia } from '@/api/types'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { CodeBlock } from '@/shared/ui/CodeBlock'
import { Disclosure } from '@/shared/ui/Disclosure'
import { EmptyState } from '@/shared/ui/EmptyState'
import { TextInput } from '@/shared/ui/Field'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { cn } from '@/shared/lib/cn'
import { playableUrl } from '@/shared/lib/url'
import { capabilitiesFor } from '@/domain/models'
import { gatewayOfMedia } from '@/api'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useJob } from '@/features/create/jobContext'
import { isFinalizeRequest } from '@/api/types'
import { isPreviewRecord } from '@/domain/seedance'
import { inquiryText } from '@/domain/support'
import { formatAmount, sumUsage } from '@/domain/usage'
import { copyText } from '@/shared/lib/clipboard'
import { formatTimestamp } from '@/shared/lib/time'
import { useProjectStore } from '@/stores/projectStore'
import { GenerateBar, GenerationSettings, SceneForm } from '@/features/create/CreateForm'

export function CreatePage() {
  const { generate } = useJob()
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void generate()
        }}
      >
        <SceneForm />
        <GenerationSettings />
        <GenerateBar />
      </form>
      <ResultPanel />
    </div>
  )
}

/** Jobs 문서의 `url_unavailable_reason` 값 */
const unavailableReasonLabel: Record<string, string> = {
  copying: '복사 중 · 자동으로 다시 조회합니다',
  download_failed: '재생용 사본을 받지 못했습니다 · 링크 갱신으로 다시 받으세요',
  failed: '파일 복사 실패 · 작업 ID로 문의하세요',
  retention_expired: '보관기한 만료 · 새 링크로 복구할 수 없습니다',
}

const mediaStateTone: Record<string, string> = {
  ready: 'succeeded',
  pending: 'queued',
  unavailable: 'unknown',
}

function MediaBlock({ item, jobId }: { item: ResultMedia; jobId: string }) {
  const { showMedia, refreshLink, addVideoRef, prepareContinuation } = useJob()
  const url = item.url ? playableUrl(item.url) : null
  const record = useProjectStore((s) => s.records.find((r) => r.id === jobId))
  const continuable = capabilitiesFor(record?.gateway ?? gatewayOfMedia(item.media_id), record?.request?.model).lastFrame
  const kindLabel = item.kind === 'video' ? '영상' : item.kind === 'image' ? '이미지' : item.kind
  const stateLabel = { pending: '준비 중', ready: '준비됨', unavailable: '사용 불가' }[item.state] || item.state
  const reusable = item.state === 'ready' && Boolean(item.media_id)

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{kindLabel}</p>
        <StatusBadge status={mediaStateTone[item.state] ?? 'idle'}>{stateLabel}</StatusBadge>
      </div>
      {item.url_expires_at ? (
        <p className="mt-1 text-xs text-muted">링크 만료 · {formatTimestamp(item.url_expires_at)}</p>
      ) : null}
      {item.expires_at ? (
        <p className="mt-1 text-xs text-muted">
          파일 보관 만료 · {formatTimestamp(item.expires_at)} · 링크를 다시 발급해도 늘어나지 않습니다
        </p>
      ) : null}
      {item.url_unavailable_reason ? (
        <p className="mt-1 text-xs text-muted">
          파일 상태: {unavailableReasonLabel[item.url_unavailable_reason] ?? item.url_unavailable_reason}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {url ? (
          <Button size="sm" onClick={() => showMedia(url, item.kind, item.media_id)}>
            {item.kind === 'video' ? '영상 재생' : '이미지 보기'}
          </Button>
        ) : null}
        {item.kind === 'video' && reusable ? (
          <>
            <Button size="sm" onClick={() => void addVideoRef(item).catch((error: Error) => toast(error.message, true))}>
              이 영상을 참조로
            </Button>
            {continuable ? (
              <Button size="sm" onClick={() => void prepareContinuation(jobId).catch((error: Error) => toast(error.message, true))}>
                마지막 프레임으로 이어 만들기
              </Button>
            ) : null}
          </>
        ) : null}
        {item.kind === 'image' && reusable ? (
          <Button
            size="sm"
            onClick={() => void prepareContinuation(jobId, item.media_id).catch((error: Error) => toast(error.message, true))}
          >
            첫 프레임으로 사용
          </Button>
        ) : null}
        {item.media_id ? (
          <Button
            size="sm"
            variant="subtle"
            onClick={() => void refreshLink(item).catch((error: Error) => toast(error.message, true))}
          >
            링크 갱신
          </Button>
        ) : null}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-button hover:text-accent"
          >
            파일 열기 ↗
          </a>
        ) : null}
      </div>
    </div>
  )
}

function JobSummary({ jobId }: { jobId: string }) {
  const records = useProjectStore((s) => s.records)
  const set = useWorkspaceStore((s) => s.set)
  const record = records.find((item) => item.id === jobId)
  if (!record) return null
  const finalizeOf = isFinalizeRequest(record.request) ? record.request.draft_job : null
  const source = finalizeOf ? records.find((item) => item.id === finalizeOf) : undefined
  const total = finalizeOf ? sumUsage([source?.usage, record.usage]) : null
  const storeOff = record.request?.store_media === false
  const previewJob = isPreviewRecord(record)
  if (!previewJob && !finalizeOf && !storeOff) return null

  return (
    <div className="mt-3 space-y-2 text-xs text-muted">
      {previewJob ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">480p 시안</span>
          {record.status === 'succeeded' ? (
            <Button size="sm" variant="primary" onClick={() => set({ finalizeTarget: record.id })}>
              1080p로 확정 ↗
            </Button>
          ) : (
            <span>생성이 끝나면 1080p로 확정할 수 있습니다.</span>
          )}
        </div>
      ) : null}
      {finalizeOf ? (
        <p>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">1080p 확정</span>{' '}
          원본 시안 <span className="break-all font-mono">{finalizeOf}</span>
          {total ? ` · 시안 포함 총액 ${formatAmount(total.amount, total.currency)}` : ' · 시안 포함 총액은 두 작업 비용이 모두 확정된 뒤 표시됩니다'}
        </p>
      ) : null}
      {storeOff ? (
        <p>임시 보관 결과입니다(약 1시간, 첫 파일 복사 접수 시점부터 계산). 파일이 준비되면 바로 내려받으세요.</p>
      ) : null}
    </div>
  )
}

function InquiryButton({ jobId, size = 'md' }: { jobId: string; size?: 'sm' | 'md' }) {
  const records = useProjectStore((s) => s.records)
  const lastSubmission = useWorkspaceStore((s) => s.lastSubmission)
  // 방금 실패한 제출이 있으면 그 요청을, 아니면 화면의 작업을 문의 대상으로 씁니다.
  const record = lastSubmission ? undefined : records.find((item) => item.id === jobId)
  if (!record && !lastSubmission) return null
  return (
    <Button
      variant="subtle"
      size={size}
      title={lastSubmission ? '방금 실패한 요청의 문의 정보' : '현재 작업의 문의 정보'}
      onClick={() =>
        void copyText(inquiryText({ record, failure: lastSubmission })).then((ok) =>
          toast(
            !ok
              ? '복사하지 못했습니다.'
              : (record?.gateway ?? lastSubmission?.gateway) === 'openrouter'
                ? '진단 정보를 복사했습니다. OpenRouter 활동 기록(Activity)과 함께 확인하거나 지원 문의에 첨부하세요.'
                : '문의용 정보를 복사했습니다. 스페이스 이름과 계정 이메일을 채워 렛서 플랫폼의 문의 기능에 남겨주세요.',
            !ok,
          ),
        )
      }
    >
      문의용 정보 복사
    </Button>
  )
}

/** 미리보기 바로 아래의 진행·오류 안내. 오류면 문의 정보 복사를 함께 둡니다. */
function StatusStrip({ jobId }: { jobId: string }) {
  const notice = useWorkspaceStore((s) => s.notice)
  const noticeError = useWorkspaceStore((s) => s.noticeError)
  const polling = useWorkspaceStore((s) => s.polling)
  if (!notice) return null
  return (
    <div
      className={cn(
        'mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        noticeError
          ? 'border-danger-line bg-danger-soft text-danger'
          : polling
            ? 'border-transparent bg-accent-soft text-accent'
            : 'border-line bg-surface text-muted',
      )}
    >
      {polling && !noticeError ? <span className="mt-1.5 size-1.5 shrink-0 animate-pulse rounded-full bg-accent" /> : null}
      <p role="status" className="scrollbar-slim max-h-40 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words">
        {notice}
      </p>
      {noticeError ? (
        <div className="-my-1 shrink-0">
          <InquiryButton jobId={jobId} size="sm" />
        </div>
      ) : null}
    </div>
  )
}

/** 현재 작업의 ID·비용·자동 조회 상태를 한 줄로 보여줍니다. */
function JobMeta({ jobId }: { jobId: string }) {
  const { stop } = useJob()
  const cost = useWorkspaceStore((s) => s.cost)
  const polling = useWorkspaceStore((s) => s.polling)
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="min-w-0 truncate">
        작업 <span className="select-all font-mono text-faint">{jobId}</span>
      </span>
      <span className="tabular-nums">{cost}</span>
      {polling ? (
        <button
          type="button"
          className="ml-auto cursor-pointer font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
          title="자동 조회만 멈춥니다. 영상 생성은 취소되지 않습니다."
          onClick={stop}
        >
          자동 조회 중지
        </button>
      ) : null}
    </div>
  )
}

/** 자주 쓰지 않는 도구라 결과 아래에 접어 둡니다. 입력 중에는 현재 작업을 바꾸지 않습니다. */
function JobLookup({ jobId }: { jobId: string }) {
  const { startPolling } = useJob()
  const polling = useWorkspaceStore((s) => s.polling)
  const rawResponse = useWorkspaceStore((s) => s.rawResponse)
  const [value, setValue] = useState('')

  return (
    <div className="mt-4 border-t border-line pt-3">
      <Disclosure variant="plain" label="작업 ID로 조회" meta="문의 정보 · 서버 응답">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const id = value.trim()
            if (!id) {
              toast('조회할 작업 ID를 입력해주세요.', true)
              return
            }
            startPolling(id)
            setValue('')
          }}
        >
          <TextInput
            aria-label="조회할 작업 ID"
            value={value}
            placeholder="접수된 작업 ID를 붙여넣으세요"
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" className="shrink-0">
            조회
          </Button>
        </form>
        <p className="mt-1.5 text-xs text-muted">
          조회한 작업은 10~30초 간격으로 자동 갱신됩니다. 자동 조회를 멈춰도 영상 생성은 취소되지 않습니다.
        </p>
        {jobId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {polling ? null : (
              <Button size="sm" onClick={() => startPolling(jobId)}>
                현재 작업 다시 조회
              </Button>
            )}
            <InquiryButton jobId={jobId} size="sm" />
          </div>
        ) : null}
        <Disclosure className="mt-3" label="서버 응답 보기">
          <CodeBlock>{rawResponse}</CodeBlock>
        </Disclosure>
      </Disclosure>
    </div>
  )
}

function ResultPanel() {
  const status = useWorkspaceStore((s) => s.status)
  const jobId = useWorkspaceStore((s) => s.jobId)
  const media = useWorkspaceStore((s) => s.media)
  const preview = useWorkspaceStore((s) => s.preview)
  const polling = useWorkspaceStore((s) => s.polling)
  const panelRef = useRef<HTMLElement>(null)
  const shownJob = useRef(jobId)
  // 한 열 레이아웃(모바일·태블릿)에서는 결과가 폼 아래에 있으므로, 새 작업이 잡히면 결과로 스크롤합니다.
  useEffect(() => {
    if (!jobId || jobId === shownJob.current) return
    shownJob.current = jobId
    if (window.matchMedia('(min-width: 1024px)').matches) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [jobId])
  const badge =
    status === '생성 완료'
      ? 'succeeded'
      : status === '실패' || status === '입력 거절'
        ? 'failed'
        : polling
          ? 'running'
          : 'idle'

  return (
    <aside ref={panelRef} className="scrollbar-slim scroll-mt-14 lg:sticky lg:top-[calc(var(--app-header-h)+1.25rem)] lg:max-h-[calc(100svh-var(--app-header-h)-2.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
      <Card>
        <CardHeader title="생성 결과" className="mb-3" actions={<StatusBadge status={badge}>{status}</StatusBadge>} />
        <div className="flex aspect-video min-h-44 items-center justify-center overflow-hidden rounded-md border border-line bg-viewer">
          {preview ? (
            preview.kind === 'video' || preview.kind === 'audio' ? (
              <video
                key={preview.url}
                src={preview.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-full max-w-full"
                onError={() =>
                  useWorkspaceStore
                    .getState()
                    .setNotice('미디어를 재생할 수 없습니다. 링크를 다시 발급하거나 파일 열기를 사용하세요.', true)
                }
              />
            ) : (
              <img src={preview.url} alt="생성된 마지막 프레임" className="max-h-full max-w-full object-contain" />
            )
          ) : (
            <EmptyState title="생성 결과 미리보기" body={'장면을 설명하고 생성하면\n여기에서 결과를 확인할 수 있어요.'} />
          )}
        </div>
        <StatusStrip jobId={jobId.trim()} />
        {jobId ? <JobMeta jobId={jobId} /> : null}
        {jobId ? <JobSummary jobId={jobId} /> : null}
        {media.length ? (
          <div className="mt-4 space-y-2.5 border-t border-line pt-4">
            {media.map((item) => (
              <MediaBlock key={item.media_id || item.url} item={item} jobId={jobId} />
            ))}
          </div>
        ) : null}
        <JobLookup jobId={jobId.trim()} />
      </Card>
    </aside>
  )
}
