import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ASSETS_PRICING_URL, PREVIEW_MAX_CANDIDATES } from '@/config/constants'
import { PRICING_AS_OF, estimateGeneration, formatEstimate } from '@/domain/pricing'
import { totalVideoWarning } from '@/domain/inputChecks'
import { cn } from '@/shared/lib/cn'
import { buildPayload, inputHint, validateDraftInputs, validatePayload } from '@/domain/seedance'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { CodeBlock } from '@/shared/ui/CodeBlock'
import { Disclosure } from '@/shared/ui/Disclosure'
import { Checkbox, Field, Select, TextArea, TextInput } from '@/shared/ui/Field'
import { useSessionStore } from '@/stores/sessionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useProjectStore } from '@/stores/projectStore'
import { currentDraft } from '@/features/create/draft'
import { ReferenceCard } from '@/features/create/ReferenceEditor'
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
          className="min-h-32"
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
  const continuityReady = lastFrame === 'true' && store === 'true'
  const preview = generation === 'preview'

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
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field label="영상 길이">
          <Select value={duration} onChange={(e) => set({ duration: e.target.value })}>
            <option value="">모델 기본값</option>
            <option value="-1">자동 선택</option>
            <option value="5">5초</option>
            <option value="10">10초</option>
            <option value="15">15초</option>
            <option value="20">20초</option>
            <option value="30">30초</option>
            <option value="custom">직접 입력 (4–30초)</option>
          </Select>
          {duration === 'custom' ? (
            <TextInput
              className="mt-2"
              type="number"
              min={4}
              max={30}
              step={1}
              value={customDuration}
              aria-label="직접 입력한 영상 길이"
              onChange={(e) => set({ customDuration: Number(e.target.value) })}
            />
          ) : null}
        </Field>
        {preview ? (
          <Field label="시안 개수" hint="후보마다 별도로 과금됩니다. 시드를 지정하면 후보마다 1씩 늘려 보냅니다.">
            <Select value={String(previewCount)} onChange={(e) => set({ previewCount: Number(e.target.value) })}>
              {Array.from({ length: PREVIEW_MAX_CANDIDATES }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}개 · 480p
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="해상도">
            <Select value={resolution} onChange={(e) => set({ resolution: e.target.value })}>
              <option value="480p">480p · 빠른 확인</option>
              <option value="720p">720p · HD</option>
              <option value="1080p">1080p · Full HD</option>
            </Select>
          </Field>
        )}
        <Field label="화면 비율">
          <Select value={ratio} onChange={(e) => set({ ratio: e.target.value })}>
            <option value="">입력에 따른 기본값</option>
            <option>16:9</option>
            <option>9:16</option>
            <option>1:1</option>
            <option>21:9</option>
            <option>4:3</option>
            <option>3:4</option>
            <option value="adaptive">자동 맞춤 · adaptive</option>
          </Select>
        </Field>
        <Field label="오디오 생성">
          <Select value={String(audio)} onChange={(e) => set({ audio: e.target.value === 'true' })}>
            <option value="true">켜기</option>
            <option value="false">끄기 · 무음</option>
          </Select>
        </Field>
      </div>

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
              <option value="false">임시 보관</option>
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

export function GenerateBar() {
  useWorkspaceStore()
  useProjectStore()
  const submitting = useWorkspaceStore((s) => s.submitting)
  const uploads = useWorkspaceStore((s) => s.uploads)
  const generation = useWorkspaceStore((s) => s.generation)
  const previewCount = useWorkspaceStore((s) => s.previewCount)
  const blockedFor = useCountdown(useWorkspaceStore((s) => s.submitBlock))
  const apiKey = useSessionStore((s) => s.apiKey)
  const openKeyDialog = useSessionStore((s) => s.setKeyDialogOpen)
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
  const count = generation === 'preview' ? previewCount : 1
  const estimate = estimateGeneration(payload)
  const label =
    generation === 'preview' ? (count > 1 ? `480p 시안 ${count}개 만들기 ↗` : '480p 시안 만들기 ↗') : '영상 생성 ↗'

  return (
    <div className="space-y-2.5">
      {error ? (
        <p
          className="whitespace-pre-wrap rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {apiKey ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-muted">
          <span>영상을 생성하려면 렛서 API 키가 필요합니다.</span>
          <Button size="sm" className="ml-auto" onClick={() => openKeyDialog(true)}>
            API 키 입력
          </Button>
        </div>
      )}
      {lengthWarning ? <p className="text-xs text-danger">주의: {lengthWarning}</p> : null}
      <p className="text-xs text-muted">{hint}</p>
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-3 pt-3 sm:-mx-6 sm:px-6">
        <Button variant="primary" size="lg" type="submit" block disabled={submitting || uploads > 0 || blockedFor > 0}>
          {submitting ? '접수 중…' : uploads > 0 ? '업로드 중…' : blockedFor > 0 ? `대기열 가득 참 · ${blockedFor}초 뒤 다시 요청` : label}
        </Button>
        <p className="mt-1.5 text-center text-xs text-faint">
          {estimate.ok
            ? `예상 ${formatEstimate(estimate.cost * count)}${count > 1 ? ` (${count} × ${formatEstimate(estimate.cost)})` : ''} · ${estimate.resolution} ${estimate.duration}초`
            : estimate.reason}
          {estimate.ok && estimate.notes.length ? ` · ${estimate.notes.join(' ')}` : ''}
          {' · '}단가 {PRICING_AS_OF} 기준·변동 가능 · 실제 청구액은 완료 후 확인{' '}
          <a href={ASSETS_PRICING_URL} target="_blank" rel="noopener noreferrer">
            최신 단가 ↗
          </a>
        </p>
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
