import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PREVIEW_MAX_CANDIDATES } from '@/config/constants'
import { totalVideoWarning } from '@/domain/inputChecks'
import { cn } from '@/shared/lib/cn'
import { buildPayload, inputHint, validateDraftInputs, validatePayload } from '@/domain/seedance'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { CodeBlock } from '@/shared/ui/CodeBlock'
import { Disclosure } from '@/shared/ui/Disclosure'
import { Checkbox, Field, Select, TextArea, TextInput } from '@/shared/ui/Field'
import { ChipGroup, type ChipOption } from '@/shared/ui/ChipGroup'
import { Switch } from '@/shared/ui/Switch'
import { useSessionStore } from '@/stores/sessionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useProjectStore } from '@/stores/projectStore'
import { currentDraft } from '@/features/create/draft'
import { ReferenceCard } from '@/features/create/ReferenceEditor'
import { CostEstimate } from '@/features/create/CostEstimate'
import { useCostSummary } from '@/features/create/useCostSummary'
import { downloadJson } from '@/shared/lib/download'

export function SceneForm() {
  const prompt = useWorkspaceStore((s) => s.prompt)
  const useCommon = useWorkspaceStore((s) => s.useCommon)
  const useShared = useWorkspaceStore((s) => s.useShared)
  const imageUrl = useWorkspaceStore((s) => s.imageUrl)
  const imagePerson = useWorkspaceStore((s) => s.imagePerson)
  const firstFramePreview = useWorkspaceStore((s) => s.firstFramePreview)
  const references = useWorkspaceStore((s) => s.references)
  const refOpen = useWorkspaceStore((s) => s.refOpen)
  const mode = useWorkspaceStore((s) => s.mode)
  const set = useWorkspaceStore((s) => s.set)
  const addReference = useWorkspaceStore((s) => s.addReference)
  const updateReference = useWorkspaceStore((s) => s.updateReference)
  const removeReference = useWorkspaceStore((s) => s.removeReference)
  const hasVideoRef = references.some((ref) => ref.type === 'video')

  return (
    <Card>
      <CardHeader title="장면 설명" description="이 장면에만 적용되는 프롬프트와 참조입니다." />
      <Field
        label="어떤 장면을 만들까요?"
        htmlFor="prompt"
        hint="피사체, 움직임, 카메라, 분위기와 소리를 구체적으로 적어주세요."
      >
        <TextArea
          id="prompt"
          required
          className="min-h-40"
          placeholder="예: 이른 아침의 고요한 숲. 나뭇잎 사이로 햇빛이 내려오고 옅은 안개가 흐른다."
          value={prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </Field>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2.5">
        <span className="text-xs font-medium text-muted">프로젝트 공통 설정 적용</span>
        <Checkbox label="공통 프롬프트" checked={useCommon} onChange={(e) => set({ useCommon: e.target.checked })} />
        <Checkbox label="공통 이미지" checked={useShared} onChange={(e) => set({ useShared: e.target.checked })} />
        <Link to="/project" className="ml-auto text-xs text-muted transition-colors hover:text-accent">
          공통 설정 편집 ↗
        </Link>
      </div>

      <Disclosure
        className="mt-3"
        label="이미지 · 영상 · 오디오 참조"
        meta={references.length ? `${references.length}개 추가됨` : '없음'}
        open={refOpen}
        onToggle={(open) => set({ refOpen: open })}
      >
        <div className="space-y-4">
          <div>
            <Field label="첫 프레임 이미지 URL (선택)" htmlFor="firstFrameUrl">
              <TextInput
                id="firstFrameUrl"
                value={imageUrl}
                placeholder="https://… 또는 letsur-file://…"
                onChange={(e) => set({ imageUrl: e.target.value, firstFramePreview: null })}
              />
            </Field>
            {firstFramePreview ? (
              <figure className="mt-2 flex items-center gap-2.5">
                <img
                  src={firstFramePreview}
                  alt="다음 영상의 첫 프레임"
                  className="max-h-20 rounded-md border border-line"
                />
                <figcaption className="text-xs text-muted">다음 영상의 시작 이미지</figcaption>
              </figure>
            ) : null}
            <Checkbox
              className="mt-2"
              label="이 첫 프레임에 인물이 포함되어 있음"
              checked={imagePerson}
              onChange={(e) => set({ imagePerson: e.target.checked })}
            />
          </div>

          <div>
            {references.length ? (
              <div className="space-y-2.5">
                {references.map((ref) => (
                  <ReferenceCard
                    key={ref.id}
                    value={ref}
                    onChange={(patch) => updateReference(ref.id, patch)}
                    onRemove={() => removeReference(ref.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                참조를 추가하면 인물·배경·스타일을 장면 사이에서 일관되게 유지할 수 있습니다.
              </p>
            )}
            <Button className="mt-2.5" onClick={() => addReference()}>
              ＋ 참조 추가
            </Button>
          </div>

          {hasVideoRef || mode ? (
            <Field label="영상 참조 사용 방식" hint="영상 참조가 있을 때만 적용됩니다.">
              <Select value={mode} onChange={(e) => set({ mode: e.target.value })}>
                <option value="">기본값 사용</option>
                <option value="reference">영상 참고 · reference</option>
                <option value="edit">영상 편집 · edit</option>
                <option value="extend">영상 연장 · extend</option>
              </Select>
            </Field>
          ) : null}
        </div>
      </Disclosure>
    </Card>
  )
}

const DURATION_OPTIONS: ChipOption<string>[] = [
  { value: '', label: '기본', title: '모델 기본값 · 일반 생성 5초, 편집·연장은 자동' },
  { value: '5', label: '5초' },
  { value: '10', label: '10초' },
  { value: '15', label: '15초' },
  { value: '20', label: '20초' },
  { value: '30', label: '30초' },
  { value: '-1', label: '자동', title: '모델이 길이를 정합니다. 사전 견적을 낼 수 없습니다.' },
  { value: 'custom', label: '직접 입력' },
]

const RESOLUTION_OPTIONS: ChipOption<string>[] = [
  { value: '480p', label: '480p', title: '빠른 확인' },
  { value: '720p', label: '720p', title: 'HD' },
  { value: '1080p', label: '1080p', title: 'Full HD' },
]

/** 비율 모양을 14px 상자 안에 그립니다. */
function RatioIcon({ ratio }: { ratio: string }) {
  if (ratio === 'adaptive') {
    return (
      <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
        <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.6" />
      </svg>
    )
  }
  const [w, h] = ratio.split(':').map(Number)
  const scale = 12 / Math.max(w, h)
  const width = w * scale
  const height = h * scale
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
      <rect x={(14 - width) / 2} y={(14 - height) / 2} width={width} height={height} rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

const RATIO_OPTIONS: ChipOption<string>[] = [
  { value: '', label: '기본', title: '입력에 따른 기본값 · 텍스트만 쓰면 16:9' },
  ...['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map((ratio) => ({
    value: ratio,
    label: (
      <>
        <RatioIcon ratio={ratio} />
        {ratio}
      </>
    ),
  })),
  {
    value: 'adaptive',
    label: (
      <>
        <RatioIcon ratio="adaptive" />
        자동 맞춤
      </>
    ),
    title: '입력 이미지·영상의 비율을 따릅니다 (adaptive).',
  },
]

export function GenerationSettings() {
  const duration = useWorkspaceStore((s) => s.duration)
  const customDuration = useWorkspaceStore((s) => s.customDuration)
  const resolution = useWorkspaceStore((s) => s.resolution)
  const ratio = useWorkspaceStore((s) => s.ratio)
  const audio = useWorkspaceStore((s) => s.audio)
  const seed = useWorkspaceStore((s) => s.seed)
  const watermark = useWorkspaceStore((s) => s.watermark)
  const lastFrame = useWorkspaceStore((s) => s.lastFrame)
  const store = useWorkspaceStore((s) => s.store)
  const generation = useWorkspaceStore((s) => s.generation)
  const previewCount = useWorkspaceStore((s) => s.previewCount)
  const hasVideoInput = useWorkspaceStore((s) => s.references.some((ref) => ref.type === 'video') || Boolean(s.mode))
  const set = useWorkspaceStore((s) => s.set)
  const mode = useWorkspaceStore((s) => s.mode)
  const framed = useWorkspaceStore(
    (s) =>
      Boolean(s.imageUrl.trim()) ||
      s.references.some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame') ||
      (s.useShared && s.sharedReferences.some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')),
  )
  const continuityReady = lastFrame === 'true' && store === 'true'
  const preview = generation === 'preview'
  const editMode = mode === 'edit'
  // 입력 비율을 따르는 조합에서는 고정 비율을 고를 수 없습니다 (Seedance 입력 방식 표).
  const ratioLocked = framed || mode === 'edit' || mode === 'extend'

  return (
    <Card>
      <CardHeader
        title="생성 설정"
        description="연속 장면 준비를 켜면 마지막 프레임 반환과 결과 보관을 함께 설정합니다."
        actions={
          <Button
            disabled={continuityReady}
            onClick={() => {
              set({ lastFrame: 'true', store: 'true' })
              useWorkspaceStore.getState().setNotice('마지막 프레임 반환과 결과 보관을 켰습니다. 다음 생성부터 적용됩니다.')
            }}
          >
            {continuityReady ? '연속 장면 준비됨' : '연속 장면 준비'}
          </Button>
        }
      />
      <Field
        className="mb-4"
        label="생성 방식"
        hint={
          preview
            ? '480p로 구도·움직임을 비교한 뒤 고른 시안만 1080p로 확정합니다. 시안과 확정 모두 과금되고, 확정할 때는 내용을 바꿀 수 없습니다.'
            : hasVideoInput
              ? '영상 참조·편집·연장에는 시안을 사용할 수 없습니다.'
              : '내용이 정해져 있거나 480p·720p로 충분하면 바로 생성이 더 저렴합니다.'
        }
      >
        <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-surface p-1" role="radiogroup" aria-label="생성 방식">
          {(
            [
              ['direct', '바로 생성'],
              ['preview', '480p 시안 먼저'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={generation === value}
              disabled={value === 'preview' && hasVideoInput}
              onClick={() => set({ generation: value })}
              className={cn(
                'h-8 cursor-pointer rounded text-sm font-medium text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                generation === value && 'bg-panel text-accent shadow-card',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <div className="space-y-4">
        <Field
          label={<span id="duration-label">영상 길이</span>}
          hint={editMode ? '영상 편집은 입력 영상 길이를 유지하므로 기본 또는 자동만 사용할 수 있습니다.' : undefined}
        >
          <ChipGroup
            ariaLabelledBy="duration-label"
            value={duration}
            onChange={(value) => set({ duration: value })}
            options={DURATION_OPTIONS.map((option) => ({
              ...option,
              disabled: editMode && option.value !== '' && option.value !== '-1',
              title: editMode && option.value !== '' && option.value !== '-1' ? '영상 편집에서는 사용할 수 없습니다.' : option.title,
            }))}
          />
          {duration === 'custom' ? (
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                className="w-24"
                type="number"
                min={4}
                max={30}
                step={1}
                value={customDuration}
                aria-label="직접 입력한 영상 길이"
                onChange={(e) => set({ customDuration: Number(e.target.value) })}
              />
              <span className="text-sm text-muted">초 · 4–30초 정수</span>
            </div>
          ) : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          {preview ? (
            <Field
              label={<span id="count-label">시안 개수</span>}
              hint="후보마다 별도로 과금됩니다. 시드를 지정하면 후보마다 1씩 늘려 보냅니다."
            >
              <ChipGroup
                ariaLabelledBy="count-label"
                value={String(previewCount)}
                onChange={(value) => set({ previewCount: Number(value) })}
                options={Array.from({ length: PREVIEW_MAX_CANDIDATES }, (_, index) => ({
                  value: String(index + 1),
                  label: `${index + 1}개`,
                }))}
              />
            </Field>
          ) : (
            <Field label={<span id="resolution-label">해상도</span>}>
              <ChipGroup
                ariaLabelledBy="resolution-label"
                value={resolution}
                onChange={(value) => set({ resolution: value })}
                options={RESOLUTION_OPTIONS}
              />
            </Field>
          )}
          <Field label="오디오 생성" htmlFor="audio-switch">
            <Switch id="audio-switch" checked={audio} onChange={(checked) => set({ audio: checked })}>
              {audio ? '켜짐' : '꺼짐 · 무음'}
            </Switch>
          </Field>
        </div>

        <Field
          label={<span id="ratio-label">화면 비율</span>}
          hint={
            ratioLocked
              ? '첫·마지막 프레임 지정이나 영상 편집·연장은 입력의 비율을 따르므로 기본 또는 자동 맞춤만 사용할 수 있습니다.'
              : undefined
          }
        >
          <ChipGroup
            ariaLabelledBy="ratio-label"
            value={ratio}
            onChange={(value) => set({ ratio: value })}
            options={RATIO_OPTIONS.map((option) => ({
              ...option,
              disabled: ratioLocked && option.value !== '' && option.value !== 'adaptive',
              title:
                ratioLocked && option.value !== '' && option.value !== 'adaptive'
                  ? '프레임 지정·영상 편집·연장에서는 사용할 수 없습니다.'
                  : option.title,
            }))}
          />
        </Field>
      </div>

      <CostEstimate />

      <Disclosure className="mt-4" label="고급 설정" meta="시드 · 워터마크 · 결과 보관">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="시드 (선택)" hint="같은 시드가 같은 결과를 보장하지는 않습니다.">
            <TextInput type="number" step={1} placeholder="지정하지 않음" value={seed} onChange={(e) => set({ seed: e.target.value })} />
          </Field>
          <Field label="워터마크">
            <Select value={watermark} onChange={(e) => set({ watermark: e.target.value })}>
              <option value="">모델 기본값</option>
              <option value="true">사용</option>
              <option value="false">사용 안 함</option>
            </Select>
          </Field>
          <Field label="마지막 프레임 반환">
            <Select value={lastFrame} onChange={(e) => set({ lastFrame: e.target.value })}>
              <option value="">모델 기본값</option>
              <option value="true">반환</option>
              <option value="false">반환 안 함</option>
            </Select>
          </Field>
          <Field label="결과 보관">
            <Select value={store} onChange={(e) => set({ store: e.target.value })}>
              <option value="">스페이스 설정 따르기</option>
              <option value="false">임시 보관 · 약 1시간</option>
              <option value="true">결과 보관</option>
            </Select>
          </Field>
        </div>
      </Disclosure>

      <RequestPreview />
    </Card>
  )
}

/** 프롬프트·참조까지 반영해야 하므로 스토어 전체를 구독합니다. */
function RequestPreview() {
  useWorkspaceStore()
  useProjectStore()
  const payload = buildPayload(currentDraft())

  return (
    <Disclosure className="mt-2.5" label="전송할 요청 JSON 확인">
      <CodeBlock>{JSON.stringify(payload, null, 2)}</CodeBlock>
      <Button className="mt-2.5" onClick={() => downloadJson(payload, 'video-request.json')}>
        설정 JSON 저장
      </Button>
    </Disclosure>
  )
}

/**
 * 폼의 직접 자식으로 두어 왼쪽 열 하단에 고정됩니다. 오류·API 키 안내·입력 조건·예상 금액을
 * 버튼 옆 한곳에 모아 스크롤 위치와 상관없이 보이게 합니다.
 */
export function GenerateBar() {
  useWorkspaceStore()
  useProjectStore()
  const submitting = useWorkspaceStore((s) => s.submitting)
  const uploads = useWorkspaceStore((s) => s.uploads)
  const blockedFor = useCountdown(useWorkspaceStore((s) => s.submitBlock))
  const apiKey = useSessionStore((s) => s.apiKey)
  const openKeyDialog = useSessionStore((s) => s.setKeyDialogOpen)
  const { preview, count, estimate, total } = useCostSummary()
  const draft = currentDraft()
  const payload = buildPayload(draft)
  let error = ''
  try {
    validatePayload({ ...payload, prompt: payload.prompt || '입력 검사' })
    validateDraftInputs(draft)
  } catch (err) {
    error = (err as Error).message
  }
  const hint = inputHint(payload)
  const videoSeconds = useWorkspaceStore.getState().references.flatMap((ref) =>
    ref.type === 'video' && ref.durationSec !== undefined ? [ref.durationSec] : [],
  )
  const lengthWarning = totalVideoWarning(videoSeconds)
  const label = preview ? (count > 1 ? `480p 시안 ${count}개 만들기 ↗` : '480p 시안 만들기 ↗') : '영상 생성 ↗'
  const busy = submitting || uploads > 0 || blockedFor > 0

  return (
    <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-background via-background to-transparent px-1 pb-3 pt-5">
      <div className="rounded-lg border border-line-strong bg-panel px-3 py-2.5 shadow-card sm:px-4 sm:py-3">
        {error || lengthWarning ? (
          <p
            className="scrollbar-slim mb-2.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-danger-line bg-danger-soft px-2.5 py-1.5 text-xs text-danger"
            role="alert"
          >
            {error || `주의: ${lengthWarning}`}
          </p>
        ) : null}
        <div className="flex items-center gap-x-4 gap-y-2.5 max-[359px]:flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {estimate.ok ? `예상 ${total}` : '사전 견적 불가'}
              {estimate.ok ? (
                <span className="text-xs font-normal text-muted max-sm:block sm:ml-1.5">
                  {count > 1 ? `시안 ${count}개 · ` : ''}
                  {estimate.resolution} · {estimate.duration}초
                </span>
              ) : null}
            </p>
            {/* 입력 조건 안내는 모바일에서 숨겨 바를 한 줄로 유지합니다. API 키 안내는 항상 보입니다. */}
            <p className={cn('mt-0.5 truncate text-xs text-muted', apiKey && 'max-sm:hidden')} title={apiKey ? hint : undefined}>
              {apiKey ? hint : '영상을 생성하려면 렛서 API 키가 필요합니다.'}
            </p>
          </div>
          {apiKey ? (
            <Button variant="primary" size="lg" type="submit" className="shrink-0 max-[359px]:w-full sm:min-w-44" disabled={busy}>
              {submitting
                ? '접수 중…'
                : uploads > 0
                  ? '업로드 중…'
                  : blockedFor > 0
                    ? `대기열 가득 참 · ${blockedFor}초 뒤`
                    : label}
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="shrink-0 max-[359px]:w-full sm:min-w-44" onClick={() => openKeyDialog(true)}>
              API 키 입력
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 남은 초. 0이면 대기 없음 */
function useCountdown(block: { at: number; until: number } | null) {
  const [clock, setClock] = useState({ block, now: block?.at ?? 0 })
  if (clock.block !== block) setClock({ block, now: block?.at ?? 0 })
  useEffect(() => {
    if (!block) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      setClock({ block, now })
      if (now >= block.until) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [block])
  return block ? Math.max(0, Math.ceil((block.until - clock.now) / 1000)) : 0
}
