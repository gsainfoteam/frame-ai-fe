import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ImageAsset, MediaReference, Project } from '@/api/types'
import { IMAGE_EXPORT_MIB, IMAGE_IMPORT_MIB } from '@/config/constants'
import { parseImageBackup, toImageBackup } from '@/domain/backup'
import { useVideoApi } from '@/hooks/useVideoApi'
import { downloadBlob, downloadJson } from '@/shared/lib/download'
import { dimensionLabel } from '@/shared/lib/image'
import { validRef } from '@/shared/lib/url'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { Disclosure } from '@/shared/ui/Disclosure'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FileButton } from '@/shared/ui/FileButton'
import { Select } from '@/shared/ui/Field'
import { imageRepository, rememberImage } from '@/storage/imageRepository'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { toast } from '@/stores/toastStore'
import { persistSharedReferences } from '@/features/create/draft'

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function legacyImages(projects: Project[], records: ReturnType<typeof useProjectStore.getState>['records']) {
  const out: ImageAsset[] = []
  const add = (projectId: string, ref: MediaReference) => {
    if (ref.type === 'image' && validRef(ref.url) && !out.some((a) => a.project_id === projectId && a.reference === ref.url)) {
      out.push({
        id: `legacy:${projectId}:${ref.url}`,
        project_id: projectId,
        name: '기존 이미지 참조 · 원본 없음',
        reference: ref.url,
        track: ref.url.startsWith('letsur-asset://') ? 'managed' : 'file',
        created_at: '',
        size: 0,
        type: 'image/png',
      })
    }
  }
  for (const project of projects) for (const ref of project.references) add(project.id, ref)
  for (const record of records) {
    for (const ref of record.request?.references || []) add(record.project_id, ref)
    if (record.request?.image_url) add(record.project_id, { type: 'image', url: record.request.image_url })
  }
  return out
}

export function GalleryPage() {
  const api = useVideoApi()
  const projects = useProjectStore((s) => s.projects)
  const records = useProjectStore((s) => s.records)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const [scope, setScope] = useState<'project' | 'all'>('project')
  const bumpUploads = useWorkspaceStore((s) => s.bumpUploads)

  const galleryQuery = useQuery({
    queryKey: ['gallery', scope, activeProjectId, projects, records],
    queryFn: async () => {
      const saved = await imageRepository.getAll()
      const merged = [
        ...saved,
        ...legacyImages(projects, records).filter(
          (legacy) => !saved.some((item) => item.project_id === legacy.project_id && item.reference === legacy.reference),
        ),
      ]
      const visible = merged.filter((asset) => scope === 'all' || asset.project_id === activeProjectId)
      const note = `${visible.length}개 · 브라우저에 보관한 원본 ${(saved.reduce((sum, asset) => sum + (asset.blob?.size || 0), 0) / 1048576).toFixed(1)} MiB`
      const previews: Record<string, string> = {}
      for (const asset of visible) {
        if (asset.blob) previews[asset.id] = URL.createObjectURL(asset.blob)
      }
      return { items: visible, note, previews }
    },
  })

  const items = galleryQuery.data?.items ?? []
  const note = galleryQuery.isError
    ? `이미지 보관함: ${galleryQuery.error instanceof Error && galleryQuery.error.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족합니다. 원본을 다운로드한 뒤 불필요한 보관 이미지를 삭제해주세요.' : (galleryQuery.error as Error).message}`
    : galleryQuery.data?.note ?? '이미지 보관함을 여는 중…'
  const previews = galleryQuery.data?.previews ?? {}
  const reload = () => galleryQuery.refetch()

  const attach = (asset: ImageAsset, target: 'scene' | 'shared') => {
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 이미지를 추가해주세요.')
    if (!validRef(asset.reference)) throw new Error('먼저 이 이미지를 업로드해주세요.')
    const list = target === 'shared' ? workspace.sharedReferences : workspace.references
    if (list.some((ref) => ref.url === asset.reference)) throw new Error('이미 추가한 이미지입니다.')
    if (target === 'shared') {
      workspace.addSharedReference({ type: 'image', role: 'reference_image', url: asset.reference })
      persistSharedReferences()
      toast('프로젝트 공통 이미지에 추가했습니다.')
    } else {
      workspace.addReference({ type: 'image', role: 'reference_image', url: asset.reference })
      toast('장면 참조에 추가했습니다. 시작 화면으로 쓰려면 참조 역할을 첫 프레임으로 바꾸세요.')
    }
  }

  return (
    <Card>
      <CardHeader
        title="이미지 보관함"
        description={note}
        actions={
          <Select
            aria-label="이미지 표시 범위"
            containerClassName="w-auto"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'project' | 'all')}
          >
            <option value="project">현재 프로젝트</option>
            <option value="all">모든 프로젝트</option>
          </Select>
        }
      />

      <Disclosure label="원본 백업 · 복원" meta="프로젝트 JSON 백업에는 원본이 포함되지 않습니다">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={async () => {
              try {
                const saved = await imageRepository.getAll()
                if (saved.reduce((sum, asset) => sum + (asset.blob?.size || 0), 0) > IMAGE_EXPORT_MIB * 1048576) {
                  throw new Error('한 번의 이미지 백업은 원본 합계 100 MiB까지 지원합니다.')
                }
                const dataUrls = await Promise.all(saved.map((asset) => blobToDataUrl(asset.blob!)))
                downloadJson(toImageBackup(saved, dataUrls), `frame-images-${new Date().toISOString().slice(0, 10)}.json`)
              } catch (error) {
                toast((error as Error).message, true)
              }
            }}
          >
            이미지 원본 백업
          </Button>
          <FileButton
            label="이미지 백업 복원"
            accept=".json,application/json"
            onChange={async (event) => {
              try {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > IMAGE_IMPORT_MIB * 1048576) throw new Error('백업 파일은 140 MiB 이하만 지원합니다.')
                const parsed = parseImageBackup(await file.text())
                if (!confirm('이미지 원본을 이 브라우저에 가져옵니다. 같은 ID의 이미지는 백업 내용으로 교체됩니다. 계속할까요?')) return
                for (const asset of parsed) {
                  if (!projects.some((p) => p.id === asset.project_id)) asset.project_id = activeProjectId
                }
                await imageRepository.putMany(parsed)
                await reload()
                toast('이미지 보관함을 복원했습니다.')
              } catch (error) {
                toast((error as Error).message, true)
              } finally {
                event.target.value = ''
              }
            }}
          />
        </div>
      </Disclosure>

      {galleryQuery.isPending ? (
        <p className="mt-4 text-sm text-muted">불러오는 중…</p>
      ) : items.length ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {items.map((asset) => (
            <GalleryCard
              key={asset.id}
              asset={asset}
              preview={previews[asset.id]}
              projectName={projects.find((p) => p.id === asset.project_id)?.name || '다른 프로젝트'}
              onAttach={attach}
              onReload={() => void reload()}
              onReupload={async (track) => {
                if (!asset.blob) return
                const workspace = useWorkspaceStore.getState()
                if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 업로드해주세요.')
                bumpUploads(1)
                try {
                  const file = new File([asset.blob], asset.name, { type: asset.type })
                  const result = await api.uploadReference(file, track)
                  if (!result.reference || !validRef(result.reference)) throw new Error('유효한 업로드 참조를 받지 못했습니다.')
                  await rememberImage(file, result.reference, track, asset.project_id, asset.name)
                  toast('새 참조로 업로드했습니다. 새 항목에서 장면 또는 공통 이미지로 추가하세요.')
                  await reload()
                } finally {
                  bumpUploads(-1)
                }
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="보관된 이미지가 없습니다" body="이미지 파일을 업로드하면 여기에서 모아 볼 수 있습니다." />
      )}
    </Card>
  )
}

function GalleryCard({
  asset,
  preview,
  projectName,
  onAttach,
  onReload,
  onReupload,
}: {
  asset: ImageAsset
  preview?: string
  projectName: string
  onAttach: (asset: ImageAsset, target: 'scene' | 'shared') => void
  onReload: () => void
  onReupload: (track: 'file' | 'managed') => Promise<void>
}) {
  const [track, setTrack] = useState<'file' | 'managed'>(asset.track)
  const [dims, setDims] = useState('')
  const tryAttach = (target: 'scene' | 'shared') => {
    try {
      onAttach(asset, target)
    } catch (error) {
      toast((error as Error).message, true)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-line bg-panel">
      <div className="grid h-36 place-items-center overflow-hidden border-b border-line bg-viewer p-2 text-xs text-muted">
        {preview ? (
          <img
            src={preview}
            alt={asset.name}
            loading="lazy"
            className="max-h-32 max-w-full rounded object-contain"
            onLoad={(e) => setDims(dimensionLabel(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))}
            onError={() => setDims('이 형식은 미리보기를 지원하지 않습니다.')}
          />
        ) : (
          '이전 참조 · 원본 미보관'
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-medium">{asset.name}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${
              asset.track === 'managed' ? 'bg-accent-soft text-accent' : 'bg-surface-strong text-muted'
            }`}
          >
            {asset.track === 'managed' ? '관리형' : '일반'}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {projectName}
          {asset.size ? ` · ${(asset.size / 1048576).toFixed(1)} MiB` : ''}
          {dims ? ` · ${dims}` : ''}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => tryAttach('scene')}>
            장면에 추가
          </Button>
          <Button size="sm" onClick={() => tryAttach('shared')}>
            공통 이미지로
          </Button>
        </div>
        {asset.blob ? (
          <>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Select
                aria-label="다시 업로드할 방식"
                containerClassName="w-auto"
                className="h-8 text-sm"
                value={track}
                onChange={(e) => setTrack(e.target.value as 'file' | 'managed')}
              >
                <option value="file">일반 업로드</option>
                <option value="managed">관리형 · 인물</option>
              </Select>
              <Button size="sm" onClick={() => void onReupload(track).catch((error: Error) => toast(error.message, true))}>
                다시 업로드
              </Button>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5">
              <Button size="sm" variant="subtle" onClick={() => downloadBlob(asset.blob!, asset.name || 'reference-image')}>
                원본 다운로드
              </Button>
              <Button
                size="sm"
                variant="subtle"
                onClick={async () => {
                  if (!confirm('브라우저에 보관한 이 원본을 삭제할까요? 프로젝트 참조와 렛서의 파일은 유지됩니다.')) return
                  await imageRepository.delete(asset.id)
                  onReload()
                }}
              >
                보관함에서 삭제
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted">기능 추가 전의 이미지는 참조 값만 남아 있어 썸네일을 복원할 수 없습니다.</p>
        )}
      </div>
    </div>
  )
}
