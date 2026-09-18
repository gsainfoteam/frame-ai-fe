import { useState } from 'react'
import { Link } from 'react-router'
import { API_DOCS_URL, MODEL_LABEL } from '@/config/constants'
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

export function Header() {
  const { stop } = useJob()
  const apiKey = useSessionStore((s) => s.apiKey)
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

  const switchProject = (id: string) => {
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) {
      toast('업로드 또는 접수가 끝난 뒤 프로젝트를 바꿔주세요.', true)
      return false
    }
    if (!projects.some((p) => p.id === id)) return false
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
    <div className="mx-auto flex max-w-[1232px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
      <Link to="/" aria-label="Frame 영상 스튜디오 홈" className="rounded-md no-underline text-foreground">
        <BrandLogo />
      </Link>
      <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
      <div className="flex min-w-0 items-center gap-2">
        <Select
          containerClassName="w-[180px] sm:w-[220px]"
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
      <div className="flex items-center gap-2 sm:ml-auto">
        <span className="hidden text-xs text-muted md:inline">{MODEL_LABEL}</span>
        <Button size="sm" variant={apiKey ? 'default' : 'primary'} onClick={() => setKeyOpen(true)}>
          <span
            aria-hidden="true"
            className={cn('size-1.5 rounded-full', apiKey ? 'bg-accent' : 'bg-white/80')}
          />
          {apiKey ? 'API 키 연결됨' : 'API 키 입력'}
        </Button>
        <a
          href={API_DOCS_URL}
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
        <Field label="렛서 API Key" htmlFor="apiKey">
          <div className="flex gap-2">
            <TextInput
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="API 키를 입력하세요"
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
