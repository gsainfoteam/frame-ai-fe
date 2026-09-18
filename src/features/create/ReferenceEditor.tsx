import { FILE_SIZE_MIB, MIME_BY_TYPE, ROLES, SEEDANCE_GUIDE_URL, isAllowedMime } from '@/config/constants'
import { dimensionLabel, readImageDimensions } from '@/shared/lib/image'
import { Button } from '@/shared/ui/Button'
import { FileButton } from '@/shared/ui/FileButton'
import { Checkbox, Select, TextInput } from '@/shared/ui/Field'
import { useVideoApi } from '@/hooks/useVideoApi'
import { rememberImage } from '@/storage/imageRepository'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore, type ReferenceDraft } from '@/stores/workspaceStore'
import { persistSharedReferences } from '@/features/create/draft'
import type { MediaKind, UploadTrack } from '@/api/types'

type Props = {
  value: ReferenceDraft
  shared?: boolean
  onChange: (patch: Partial<ReferenceDraft>) => void
  onRemove: () => void
}

export function ReferenceCard({ value, shared, onChange, onRemove }: Props) {
  const api = useVideoApi()
  const bumpUploads = useWorkspaceStore((s) => s.bumpUploads)
  const submitting = useWorkspaceStore((s) => s.submitting)
  const uploads = useWorkspaceStore((s) => s.uploads)
  const busy = submitting || uploads > 0

  const setType = (type: MediaKind) => {
    onChange({
      type,
      role: ROLES[type][0][0],
      url: '',
      mediaId: undefined,
      file: null,
      status: '',
    })
  }

  const upload = async () => {
    const file = value.file
    if (!file) {
      onChange({ status: '먼저 파일을 선택해주세요.' })
      return
    }
    if (!isAllowedMime(MIME_BY_TYPE[value.type], file.type)) {
      onChange({ status: '이 종류에서 지원하는 파일 형식을 선택해주세요.' })
      return
    }
    const max = FILE_SIZE_MIB[value.type]
    if (file.size > max * 1048576) {
      onChange({ status: `이 파일의 크기 제한은 ${max} MiB입니다.` })
      return
    }
    const projectId = useProjectStore.getState().activeProjectId
    bumpUploads(1)
    onChange({ status: '파일 업로드 중…' })
    try {
      const result = await api.uploadReference(file, value.managed ? 'managed' : 'file')
      if (!result.reference) throw new Error('업로드 응답에 reference가 없습니다.')
      onChange({
        url: result.reference,
        status:
          `업로드 완료 · ${file.name}` +
          (result.track === 'managed' || value.managed
            ? ' · 관리형 (생성 시 공급사 등록·심사 진행)'
            : ' · 일반 파일'),
      })
      if (value.type === 'image') {
        try {
          await rememberImage(file, result.reference, (result.track || (value.managed ? 'managed' : 'file')) as UploadTrack, projectId)
        } catch (error) {
          onChange({ status: '렛서 업로드는 성공했지만 원본의 브라우저 저장에 실패했습니다.' })
          toast((error as Error).message, true)
          return
        }
      }
      if (shared) persistSharedReferences()
    } catch (error) {
      onChange({ status: (error as Error).message })
    } finally {
      bumpUploads(-1)
    }
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          containerClassName="w-[92px] shrink-0"
          aria-label="참조 종류"
          value={value.type}
          disabled={shared || busy}
          onChange={(e) => setType(e.target.value as MediaKind)}
        >
          <option value="image">이미지</option>
          <option value="video">영상</option>
          <option value="audio">오디오</option>
        </Select>
        <Select
          containerClassName="min-w-[150px] flex-1"
          aria-label="참조 역할"
          value={value.role}
          disabled={busy}
          onChange={(e) => onChange({ role: e.target.value })}
        >
          {ROLES[value.type].map(([role, label]) => (
            <option key={role} value={role}>
              {label}
            </option>
          ))}
        </Select>
        {value.managed ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">관리형</span>
        ) : null}
        <Button variant="subtle" size="sm" disabled={busy} onClick={onRemove} aria-label="참조 삭제">
          삭제
        </Button>
      </div>

      <TextInput
        className="mt-2"
        aria-label="참조 URL"
        placeholder="HTTPS URL 또는 업로드한 참조"
        value={value.url}
        disabled={busy}
        onChange={(e) => onChange({ url: e.target.value, mediaId: undefined })}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FileButton
          aria-label="업로드할 참조 파일"
          accept={MIME_BY_TYPE[value.type].join(',')}
          disabled={busy}
          label={
            value.file ? <span className="max-w-44 truncate">{value.file.name}</span> : '파일 선택'
          }
          onChange={async (event) => {
            const file = event.target.files?.[0] ?? null
            onChange({ file, url: '', mediaId: undefined, status: '파일을 선택했습니다. 파일 업로드 버튼을 눌러주세요.' })
            if (file && value.type === 'image') {
              const dimensions = await readImageDimensions(file)
              onChange({
                file,
                url: '',
                mediaId: undefined,
                status: `${dimensions ? `${dimensionLabel(dimensions.width, dimensions.height)} · ` : '크기 확인 불가 · '}파일 업로드 버튼을 눌러주세요.`,
              })
            }
          }}
        />
        <Button disabled={busy || !value.file} onClick={() => void upload()}>
          파일 업로드
        </Button>
      </div>

      <Checkbox
        className="mt-2.5"
        label="인물 포함 / 공급사 자산 등록 필요 → 관리형 업로드"
        checked={value.managed}
        disabled={busy}
        onChange={(e) => {
          const managed = e.target.checked
          onChange({
            managed,
            mediaId: undefined,
            url: value.url ? '' : value.url,
            status: value.url
              ? '업로드 방식이 변경되었습니다. 파일을 다시 업로드하거나 해당 방식의 참조를 입력해주세요.'
              : value.status,
          })
        }}
      />
      <p className="mt-1.5 text-xs text-muted">
        일반 업로드는 배경·소품, 관리형은 인물 참조에 사용합니다.{' '}
        <a href={SEEDANCE_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          모델 가이드 ↗
        </a>
      </p>
      {value.status ? (
        <p className="mt-1.5 break-words text-xs text-accent" role="status">
          {value.status}
        </p>
      ) : null}
    </div>
  )
}
