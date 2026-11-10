import { type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { WORKSPACES } from '@/config/constants'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'
import { isPreviewRecord } from '@/domain/seedance'
import { cn } from '@/shared/lib/cn'
import { WorkspaceIcon } from '@/shared/ui/WorkspaceIcon'

export function WorkspaceTabs() {
  const gateway = useSessionStore((s) => s.gateway)
  const hasPreviews = useProjectStore((s) => s.records.some((r) => r.project_id === s.activeProjectId && isPreviewRecord(r)))
  const tabs = WORKSPACES.filter((tab) => tab.id !== 'previews' || gateway === 'letsur' || hasPreviews)
  const location = useLocation()
  const navigate = useNavigate()
  const current = WORKSPACES.find((item) => item.path === location.pathname)?.id ?? 'create'

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys = tabs.map((item) => item.id)
    let index = keys.indexOf(current)
    if (event.key === 'ArrowRight') index = (index + 1) % keys.length
    else if (event.key === 'ArrowLeft') index = (index + keys.length - 1) % keys.length
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = keys.length - 1
    else return
    event.preventDefault()
    navigate(tabs[index].path)
  }

  return (
    <nav
      className="scrollbar-slim mx-auto flex max-w-[1440px] gap-1 overflow-x-auto overflow-y-hidden px-4 pb-2 sm:px-8"
      aria-label="작업 화면"
      onKeyDown={onKeyDown}
    >
      {tabs.map((item) => {
        const selected = item.id === current
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground sm:px-4',
              selected && 'bg-accent-soft font-semibold text-accent',
            )}
            onClick={() => navigate(item.path)}
          >
            <WorkspaceIcon name={item.id} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
