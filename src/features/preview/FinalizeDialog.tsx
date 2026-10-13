import { useState } from 'react'
import { isFinalizeRequest } from '@/api/types'
import { ASSETS_PRICING_URL } from '@/config/constants'
import { PRICING_AS_OF, estimateFinalize, formatEstimate } from '@/domain/pricing'
import { emptyFinalizeOptions, finalizeBlocker, sourceRequest, type FinalizeOptions } from '@/domain/seedance'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Field, Select, TextInput } from '@/shared/ui/Field'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useJob } from '@/features/create/jobContext'

export function FinalizeDialog() {
  const target = useWorkspaceStore((s) => s.finalizeTarget)
  if (!target) return null
  return <FinalizeBody key={target} draftJobId={target} />
}

function FinalizeBody({ draftJobId }: { draftJobId: string }) {
  const { finalize, focusJob } = useJob()
  const records = useProjectStore((s) => s.records)
  const submitting = useWorkspaceStore((s) => s.submitting)
  const set = useWorkspaceStore((s) => s.set)
  const [options, setOptions] = useState<FinalizeOptions>(emptyFinalizeOptions)
  const [error, setError] = useState('')

  const record = records.find((item) => item.id === draftJobId)
  const source = sourceRequest(record, records)
  const blocker = finalizeBlocker(record)
  const previous = records.filter((item) => isFinalizeRequest(item.request) && item.request.draft_job === draftJobId)
  const estimate = estimateFinalize(source)
  const close = () => {
    if (!submitting) set({ finalizeTarget: null })
  }
  const update = (patch: Partial<FinalizeOptions>) => setOptions((current) => ({ ...current, ...patch }))

  return (
    <Dialog
      open
      title="시안을 1080p로 확정"
      description="프롬프트·길이·비율·입력 이미지는 시안에서 그대로 이어받습니다. 내용을 바꾸려면 새 시안을 만드세요."
      onClose={close}
      preventClose={submitting}
      footer={
        <>
          <Button variant="subtle" disabled={submitting} onClick={close}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={submitting || Boolean(blocker)}
            onClick={() => {
              setError('')
              if (previous.length && !confirm(`이 시안은 이미 ${previous.length}번 확정했습니다. 다시 확정하면 다시 과금됩니다. 계속할까요?`)) {
                return
              }
              void finalize(draftJobId, options)
                .then((id) => {
                  set({ finalizeTarget: null })
                  focusJob(id)
                  toast('1080p 확정 요청을 접수했습니다. 새 작업으로 진행 상태를 확인합니다.')
                })
                .catch((err: Error) => {
                  setError(err.message)
                  toast(err.message.split('\n')[0], true)
                })
            }}
          >
            {submitting ? '접수 중…' : '1080p 확정 요청 ↗'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="line-clamp-3 whitespace-pre-wrap break-words">{source?.prompt || '(이 기기에 시안 요청 기록 없음)'}</p>
          <p className="mt-1.5 text-xs text-muted">
            {source
              ? `${source.duration === undefined ? '기본 길이(5초)' : source.duration === -1 ? '길이 자동' : `${source.duration}초`} · ${source.aspect_ratio || '비율 기본값'} · 오디오 ${source.generate_audio === false ? '끔' : '켬'}`
              : '시안 설정을 확인할 수 없습니다.'}
          </p>
          <p className="mt-1 break-all font-mono text-2xs text-faint">시안 · {draftJobId}</p>
        </div>

        {blocker ? (
          <p className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-danger" role="alert">
            {blocker}
          </p>
        ) : !record ? (
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">
            이 기기에 요청 기록이 없어 시안인지 확인할 수 없습니다. 같은 스페이스·모델에서 성공한 시안이 아니면 요청이 거절됩니다.
          </p>
        ) : null}
        {previous.length ? (
          <p className="text-xs text-danger">이미 확정한 시안입니다 ({previous.length}회). 다시 확정하면 다시 과금됩니다.</p>
        ) : null}

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="오디오">
            <Select value={options.generateAudio} onChange={(e) => update({ generateAudio: e.target.value })}>
              <option value="">시안 설정 따르기</option>
              <option value="true">켜기</option>
              <option value="false">끄기 · 무음</option>
            </Select>
          </Field>
          <Field label="워터마크">
            <Select value={options.watermark} onChange={(e) => update({ watermark: e.target.value })}>
              <option value="">모델 기본값</option>
              <option value="true">사용</option>
              <option value="false">사용 안 함</option>
            </Select>
          </Field>
          <Field label="시드 (선택)">
            <TextInput type="number" step={1} placeholder="지정하지 않음" value={options.seed} onChange={(e) => update({ seed: e.target.value })} />
          </Field>
          <Field label="마지막 프레임 반환">
            <Select value={options.lastFrame} onChange={(e) => update({ lastFrame: e.target.value })}>
              <option value="">모델 기본값</option>
              <option value="true">반환</option>
              <option value="false">반환 안 함</option>
            </Select>
          </Field>
          <Field label="결과 보관" className="sm:col-span-2">
            <Select value={options.store} onChange={(e) => update({ store: e.target.value })}>
              <option value="">스페이스 설정 따르기</option>
              <option value="false">임시 보관 · 약 1시간, 준비되면 바로 내려받기</option>
              <option value="true">결과 보관</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-md border border-line bg-surface px-3 py-2.5 text-xs text-muted">
          <p className="text-sm font-medium text-foreground">
            {estimate.ok ? `예상 비용 ${formatEstimate(estimate.cost)}` : '사전 견적 불가'}
          </p>
          <p className="mt-1">
            {estimate.ok
              ? `1080p 일반 생성과 같은 단가 · ${estimate.duration}초 기준 · 시안 비용과 별도로 청구됩니다.`
              : estimate.reason}
          </p>
          {estimate.ok ? estimate.notes.map((note) => <p key={note}>{note}</p>) : null}
          <p className="mt-1">
            단가 {PRICING_AS_OF} 기준 · 변동될 수 있음 ·{' '}
            <a href={ASSETS_PRICING_URL} target="_blank" rel="noopener noreferrer">
              최신 단가 ↗
            </a>
          </p>
          <p className="mt-1">480p 시안으로 판단하기 어려운 작은 글자·세부 질감은 1080p 결과에서 다시 확인하세요.</p>
        </div>

        {error ? (
          <p className="whitespace-pre-wrap rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
