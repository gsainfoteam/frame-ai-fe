import type { ResultMedia } from '@/api/types'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { CodeBlock } from '@/shared/ui/CodeBlock'
import { Disclosure } from '@/shared/ui/Disclosure'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Field, TextInput } from '@/shared/ui/Field'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { safeUrl } from '@/shared/lib/url'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useJob } from '@/features/create/jobContext'
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

const mediaStateTone: Record<string, string> = {
  ready: 'succeeded',
  pending: 'queued',
  unavailable: 'unknown',
}

function MediaBlock({ item, jobId }: { item: ResultMedia; jobId: string }) {
  const { showMedia, refreshLink, addVideoRef, prepareContinuation } = useJob()
  const url = item.url ? safeUrl(item.url) : null
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
        <p className="mt-1 text-xs text-muted">링크 만료 · {new Date(item.url_expires_at * 1000).toLocaleString('ko-KR')}</p>
      ) : null}
      {item.url_unavailable_reason ? <p className="mt-1 text-xs text-muted">파일 상태: {item.url_unavailable_reason}</p> : null}
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
            <Button size="sm" onClick={() => void prepareContinuation(jobId).catch((error: Error) => toast(error.message, true))}>
              마지막 프레임으로 이어 만들기
            </Button>
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

function ResultPanel() {
  const { lookup, stop } = useJob()
  const status = useWorkspaceStore((s) => s.status)
  const cost = useWorkspaceStore((s) => s.cost)
  const notice = useWorkspaceStore((s) => s.notice)
  const noticeError = useWorkspaceStore((s) => s.noticeError)
  const jobId = useWorkspaceStore((s) => s.jobId)
  const media = useWorkspaceStore((s) => s.media)
  const preview = useWorkspaceStore((s) => s.preview)
  const polling = useWorkspaceStore((s) => s.polling)
  const rawResponse = useWorkspaceStore((s) => s.rawResponse)
  const set = useWorkspaceStore((s) => s.set)
  const badge =
    status === '생성 완료'
      ? 'succeeded'
      : status === '실패' || status === '입력 거절'
        ? 'failed'
        : polling
          ? 'running'
          : 'idle'

  return (
    <aside className="scrollbar-slim space-y-4 lg:sticky lg:top-[calc(var(--app-header-h)+1.25rem)] lg:max-h-[calc(100svh-var(--app-header-h)-2.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
      <Card>
        <CardHeader title="생성 결과" actions={<StatusBadge status={badge}>{status}</StatusBadge>} />
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
        {notice ? (
          <p className={`mt-4 whitespace-pre-wrap text-xs ${noticeError ? 'text-danger' : 'text-muted'}`} role="status">
            {notice}
          </p>
        ) : null}
        {media.length ? (
          <div className="mt-3 space-y-2.5 border-t border-line pt-3">
            {media.map((item) => (
              <MediaBlock key={item.media_id || item.url} item={item} jobId={jobId} />
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="작업 확인"
          description="접수한 작업 ID로 진행 상태와 결과를 다시 불러옵니다."
          actions={<span className="text-xs text-muted">{cost}</span>}
        />
        <Field label="작업 ID" htmlFor="jobId" hint="갱신 중지는 영상 생성 취소가 아닙니다.">
          <TextInput
            id="jobId"
            value={jobId}
            placeholder="접수된 작업 ID를 붙여넣으세요"
            spellCheck={false}
            onChange={(e) => set({ jobId: e.target.value })}
          />
        </Field>
        <div className="mt-3 flex gap-2">
          <Button onClick={lookup} disabled={polling}>
            {polling ? '자동 갱신 중…' : '조회 / 자동 갱신'}
          </Button>
          <Button variant="subtle" onClick={stop} disabled={!polling}>
            갱신 중지
          </Button>
        </div>
        <Disclosure className="mt-3" label="서버 응답 보기">
          <CodeBlock>{rawResponse}</CodeBlock>
        </Disclosure>
      </Card>
    </aside>
  )
}
