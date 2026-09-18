import { HISTORY_BACKUP_MIB } from '@/config/constants'
import { parseProjectBackup } from '@/domain/backup'
import { downloadJson } from '@/shared/lib/download'
import { Button } from '@/shared/ui/Button'
import { Card, CardHeader } from '@/shared/ui/Card'
import { Disclosure } from '@/shared/ui/Disclosure'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FileButton } from '@/shared/ui/FileButton'
import { Select } from '@/shared/ui/Field'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { useProjectStore } from '@/stores/projectStore'
import { toast } from '@/stores/toastStore'
import { loadWorkspaceForProject } from '@/features/create/draft'
import { useJob } from '@/features/create/jobContext'

const statusText = {
  queued: '대기',
  running: '생성 중',
  succeeded: '완료',
  failed: '실패',
  unknown: '미조회',
} as const

export function HistoryPage() {
  const { startPolling, restoreRequest, prepareContinuation, addVideoRef } = useJob()
  const projects = useProjectStore((s) => s.projects)
  const records = useProjectStore((s) => s.records)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const storageFailed = useProjectStore((s) => s.storageFailed)
  const snapshot = useProjectStore((s) => s.snapshot)
  const replaceFromBackup = useProjectStore((s) => s.replaceFromBackup)
  const deleteRecord = useProjectStore((s) => s.deleteRecord)
  const moveRecord = useProjectStore((s) => s.moveRecord)
  const current = projects.find((p) => p.id === activeProjectId)
  const items = records
    .filter((record) => record.project_id === activeProjectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <Card>
      <CardHeader
        title={`${current?.name ?? '프로젝트'} · 생성 기록`}
        description={
          storageFailed
            ? '브라우저에 저장하지 못했습니다. 페이지를 닫기 전에 JSON 백업을 저장하세요.'
            : `이 프로젝트 ${items.length}개 · 전체 ${records.length}개가 이 브라우저에 저장됨`
        }
        actions={
          <Button onClick={() => downloadJson(snapshot(), `frame-history-${new Date().toISOString().slice(0, 10)}.json`)}>
            전체 프로젝트 백업
          </Button>
        }
      />

      <Disclosure label="백업 · 복원 안내" meta="API 키와 영상 파일은 저장하지 않습니다">
        <div className="flex flex-wrap items-center gap-2">
          <FileButton
            label="기록 JSON 가져오기"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              try {
                if (!file) return
                if (file.size > HISTORY_BACKUP_MIB * 1024 * 1024) throw new Error('백업 파일은 20 MiB 이하여야 합니다.')
                const incoming = parseProjectBackup(await file.text())
                if (!confirm('프로젝트와 기록을 합칩니다. 같은 ID의 프로젝트 공통 설정은 백업 내용으로 바뀝니다. 계속할까요?')) return
                replaceFromBackup(incoming)
                loadWorkspaceForProject()
                toast('프로젝트와 기록을 가져왔습니다. API 키는 직접 입력해주세요.')
              } catch (error) {
                toast(`기록 가져오기 실패: ${(error as Error).message}`, true)
              } finally {
                event.target.value = ''
              }
            }}
          />
          <p className="text-xs text-muted">같은 ID의 프로젝트는 백업 내용으로 교체됩니다.</p>
        </div>
      </Disclosure>

      {items.length ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((record) => {
            const date = new Date(record.created_at)
            const videos = record.media.filter((m) => m.kind === 'video' && m.state === 'ready')
            return (
              <li key={record.id} className="rounded-md border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 min-w-0 whitespace-pre-wrap break-words text-sm font-medium">
                    {record.request?.prompt || '이전 작업 (설정 정보 없음)'}
                  </p>
                  <StatusBadge status={record.status}>{statusText[record.status]}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {(Number.isNaN(date.getTime()) ? record.created_at : date.toLocaleString('ko-KR')) +
                    (record.usage ? ` · ${record.usage.amount} ${record.usage.currency}` : '')}
                </p>
                <p className="mt-0.5 break-all font-mono text-2xs text-faint">{record.id}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" onClick={() => startPolling(record.id)}>
                    결과 / 상태 조회
                  </Button>
                  {record.request ? (
                    <Button size="sm" onClick={() => restoreRequest(record.id)}>
                      설정 불러오기
                    </Button>
                  ) : null}
                  {record.status === 'succeeded' ? (
                    <Button size="sm" onClick={() => void prepareContinuation(record.id).catch((e: Error) => toast(e.message, true))}>
                      마지막 프레임으로 이어 만들기
                    </Button>
                  ) : null}
                  {videos.map((media, index) => (
                    <Button
                      key={media.media_id}
                      size="sm"
                      onClick={() => void addVideoRef(media).catch((e: Error) => toast(e.message, true))}
                    >
                      영상{index ? index + 1 : ''}을 참조로
                    </Button>
                  ))}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Select
                      aria-label="기록을 다른 프로젝트로 이동"
                      containerClassName="w-auto"
                      className="h-8 text-sm"
                      value={record.project_id}
                      onChange={(e) => moveRecord(record.id, e.target.value)}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        if (!confirm('이 기기의 기록만 삭제합니다. 렛서의 영상은 삭제하지 않습니다.')) return
                        deleteRecord(record.id)
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState title="기록이 없습니다" body="생성하거나 작업 ID로 조회한 기록이 여기에 쌓입니다." />
      )}
    </Card>
  )
}
