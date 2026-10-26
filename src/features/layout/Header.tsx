import { useState } from 'react'
import { Link } from 'react-router'
import { GATEWAYS, GATEWAY_IDS, isGatewayId } from '@/api/gateway'
import { Button } from '@/shared/ui/Button'
import { BrandLogo } from '@/shared/ui/Logo'
import { Dialog } from '@/shared/ui/Dialog'
import { Field, Select, TextInput } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { toast } from '@/stores/toastStore'
import { loadWorkspaceForProject } from '@/features/create/draft'
import { useJob } from '@/features/create/jobContext'
import { useActiveModel, useModelSync } from '@/features/create/useActiveModel'
import { isWatchActive, useJobWatchStore } from '@/features/jobs/jobWatcher'

export function Header() {
  const { stop } = useJob()
  const apiKey = useSessionStore((s) => s.apiKey)
  const keys = useSessionStore((s) => s.keys)
  const setGateway = useSessionStore((s) => s.setGateway)
  const setApiKey = useSessionStore((s) => s.setApiKey)
  const clearKey = useSessionStore((s) => s.clearKey)
  const keyOpen = useSessionStore((s) => s.keyDialogOpen)
  const setKeyOpen = useSessionStore((s) => s.setKeyDialogOpen)
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const addProject = useProjectStore((s) => s.addProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId)
  const [showKey, setShowKey] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const { gateway, spec } = useActiveModel()
  useModelSync()

  const switchGateway = (value: string) => {
    if (!isGatewayId(value) || value === gateway.id) return
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) {
      toast('업로드 또는 접수가 끝난 뒤 게이트웨이를 바꿔주세요.', true)
      return
    }
    const active = Object.values(useJobWatchStore.getState().watches).filter(isWatchActive).length
    setGateway(value)
    setShowKey(false)
    toast(
      `새 요청은 ${GATEWAYS[value].label}로 보냅니다.` +
        (active ? ` 진행 중인 작업 ${active}개는 만든 게이트웨이의 키로 계속 조회합니다.` : ''),
    )
  }

  const switchProject = (id: string) => {
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) {
      toast('업로드 또는 접수가 끝난 뒤 프로젝트를 바꿔주세요.', true)
      return false
    }
    // 방금 만든 프로젝트로도 바로 전환해야 하므로 렌더 시점 목록이 아닌 최신 상태를 봅니다.
    if (!useProjectStore.getState().projects.some((p) => p.id === id)) return false
    if ((workspace.prompt || workspace.references.length || workspace.imageUrl) && !confirm('프로젝트를 바꾸면 현재 개별 장면 설명과 참조를 비웁니다. 공통 설정과 생성 기록은 유지됩니다. 계속할까요?')) {
      return false
    }
    stop()
    setActiveProjectId(id)
    workspace.resetScene()
    loadWorkspaceForProject()
    toast('프로젝트를 전환했습니다. 새 장면 설명을 입력하세요.')
    return true
  }

  return (
    // 모바일에서는 한 줄 높이(h-14)로 고정합니다. StudioLayout이 이 높이만큼 위로 밀어 탭만 남깁니다.
    <div className="mx-auto flex h-14 max-w-[1232px] items-center gap-2 px-4 sm:h-auto sm:flex-wrap sm:gap-x-3 sm:gap-y-2 sm:px-6 sm:py-2.5">
      <Link to="/" aria-label="Frame 영상 스튜디오 홈" className="shrink-0 rounded-md no-underline text-foreground">
        <BrandLogo compact />
      </Link>
      <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <Select
          containerClassName="min-w-0 flex-1 sm:w-[220px] sm:flex-none"
          value={activeProjectId}
          aria-label="프로젝트"
          onChange={(e) => {
            if (!switchProject(e.target.value)) e.target.value = activeProjectId
          }}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={() => setNewOpen(true)} title="새 프로젝트 만들기">
          <span aria-hidden="true">＋</span>
          <span className="max-sm:sr-only">새 프로젝트</span>
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
        <span className="hidden text-xs text-muted md:inline">
          {gateway.label} · {spec.label}
        </span>
        <Button
          size="sm"
          variant={apiKey ? 'default' : 'primary'}
          aria-label={apiKey ? 'API 키 연결됨' : 'API 키 입력'}
          onClick={() => setKeyOpen(true)}
        >
          <span
            aria-hidden="true"
            className={cn('size-1.5 rounded-full', apiKey ? 'bg-accent' : 'bg-white/80')}
          />
          <span aria-hidden="true" className="sm:hidden">
            API
          </span>
          <span aria-hidden="true" className="max-sm:hidden">
            {apiKey ? 'API 키 연결됨' : 'API 키 입력'}
          </span>
        </Button>
        <a
          href={gateway.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden text-xs text-muted transition-colors hover:text-accent sm:inline"
        >
          API 문서 ↗
        </a>
      </div>

      <Dialog
        open={keyOpen}
        title="API 연결"
        description="키는 저장하지 않고 이 페이지가 열린 동안만 사용합니다."
        onClose={() => setKeyOpen(false)}
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => {
                clearKey()
                setShowKey(false)
              }}
            >
              키 지우기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (apiKey.trim()) setKeyOpen(false)
              }}
            >
              확인
            </Button>
          </>
        }
      >
        <Field
          className="mb-4"
          label="게이트웨이"
          hint="새 생성 요청을 보낼 곳입니다. 이미 만든 작업은 만든 게이트웨이로 조회하므로 두 키를 모두 입력해 둘 수 있습니다."
        >
          <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-surface p-1" role="radiogroup" aria-label="게이트웨이">
            {GATEWAY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={gateway.id === id}
                onClick={() => switchGateway(id)}
                className={cn(
                  'flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded text-sm font-medium text-muted transition-colors hover:text-foreground',
                  gateway.id === id && 'bg-panel text-accent shadow-card',
                )}
              >
                {GATEWAYS[id].label}
                {keys[id] ? <span aria-label="키 입력됨" className="size-1.5 rounded-full bg-accent" /> : null}
              </button>
            ))}
          </div>
        </Field>
        <Field label={gateway.keyLabel} htmlFor="apiKey">
          <div className="flex gap-2">
            <TextInput
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={gateway.keyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button className="shrink-0" onClick={() => setShowKey((v) => !v)}>
              {showKey ? '숨기기' : '보기'}
            </Button>
          </div>
        </Field>
      </Dialog>

      <Dialog
        open={newOpen}
        title="새 프로젝트"
        description="공통 프롬프트와 공통 이미지를 따로 관리하는 작업 단위입니다."
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <Button variant="subtle" onClick={() => setNewOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const name = newName.trim()
                if (!name) return
                const workspace = useWorkspaceStore.getState()
                if (workspace.submitting || workspace.uploads) {
                  toast('현재 요청이 끝난 뒤 프로젝트를 만들어주세요.', true)
                  return
                }
                const project = addProject(name)
                if (!switchProject(project.id)) removeProject(project.id)
                setNewName('')
                setNewOpen(false)
              }}
            >
              만들기
            </Button>
          </>
        }
      >
        <Field label="프로젝트 이름" htmlFor="newProjectName">
          <TextInput
            id="newProjectName"
            value={newName}
            maxLength={100}
            placeholder="예: 봄 캠페인 시리즈"
            onChange={(e) => setNewName(e.target.value)}
          />
        </Field>
      </Dialog>
    </div>
  )
}
