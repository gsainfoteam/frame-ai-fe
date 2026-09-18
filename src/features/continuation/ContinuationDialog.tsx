import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Disclosure } from '@/shared/ui/Disclosure'
import { Checkbox } from '@/shared/ui/Field'
import { FileButton } from '@/shared/ui/FileButton'
import { IMAGE_MIMES } from '@/config/constants'
import { useWorkspaceStore, type ContinuationSession } from '@/stores/workspaceStore'
import { toast } from '@/stores/toastStore'
import { useJob } from '@/features/create/jobContext'

export function ContinuationDialog() {
  const continuation = useWorkspaceStore((s) => s.continuation)
  const uploads = useWorkspaceStore((s) => s.uploads)
  const { cancelContinuation } = useJob()

  if (!continuation) return null

  return (
    <ContinuationBody
      key={`${continuation.jobId}:${continuation.mediaId}`}
      continuation={continuation}
      uploads={uploads}
      onCancel={cancelContinuation}
    />
  )
}

function ContinuationBody({
  continuation,
  uploads,
  onCancel,
}: {
  continuation: ContinuationSession
  uploads: number
  onCancel: () => void
}) {
  const { applyContinuation } = useJob()
  const [managed, setManaged] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const busy = uploads > 0

  return (
    <Dialog
      open
      title="마지막 프레임으로 다음 장면 시작"
      description="현재 장면의 참조를 이 이미지로 교체합니다. 적용만으로 새 영상이 생성되지는 않습니다."
      onClose={() => {
        if (!busy) onCancel()
      }}
      preventClose={busy}
      footer={
        <>
          <Button variant="subtle" disabled={busy} onClick={onCancel}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              setError('')
              void applyContinuation({ managed, file }).catch((err: Error) => {
                setFallbackOpen(true)
                setError(`${err.message} 새 영상은 생성하지 않았습니다.`)
                toast(err.message, true)
              })
            }}
          >
            {busy ? '적용 중…' : '이 이미지로 시작'}
          </Button>
        </>
      }
    >
      <img
        src={continuation.previewUrl}
        alt="다음 영상의 첫 프레임으로 사용할 이미지"
        className="mx-auto block max-h-64 max-w-full rounded-md border border-line"
      />
      <p className="mt-2.5 break-all font-mono text-2xs text-faint">이전 작업 · {continuation.jobId}</p>
      <Checkbox
        className="mt-3"
        label="인물 포함 · 관리형 업로드 사용"
        checked={managed}
        onChange={(e) => setManaged(e.target.checked)}
      />
      <p className="mt-1.5 text-xs text-muted">적용하면 이 장면의 공통 이미지 적용은 자동으로 꺼집니다.</p>

      <Disclosure
        className="mt-3"
        label="다운로드한 이미지로 계속"
        open={fallbackOpen}
        onToggle={setFallbackOpen}
      >
        <p className="text-xs text-muted">자동 다운로드가 실패하면 아래 링크로 이미지를 열어 저장한 뒤 그 파일을 선택하세요.</p>
        <a
          href={continuation.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-xs"
        >
          마지막 프레임 원본 열기 ↗
        </a>
        <div className="mt-2.5">
          <FileButton
            label={file ? <span className="max-w-44 truncate">{file.name}</span> : '저장한 이미지 선택'}
            accept={IMAGE_MIMES.join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </Disclosure>

      {error ? (
        <p className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}
