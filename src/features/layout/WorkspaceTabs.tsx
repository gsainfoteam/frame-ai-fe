import { type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { WORKSPACES } from '@/config/constants'
import { cn } from '@/shared/lib/cn'

export function WorkspaceTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = WORKSPACES.find((item) => item.path === location.pathname)?.id ?? 'create'

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys = WORKSPACES.map((item) => item.id)
    let index = keys.indexOf(current)
    if (event.key === 'ArrowRight') index = (index + 1) % keys.length
    else if (event.key === 'ArrowLeft') index = (index + keys.length - 1) % keys.length
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = keys.length - 1
    else return
    event.preventDefault()
    navigate(WORKSPACES[index].path)
  }

  return (
    <nav
      className="mx-auto flex max-w-[1232px] gap-1 overflow-x-auto overflow-y-hidden px-4 sm:px-6"
      aria-label="작업 화면"
      onKeyDown={onKeyDown}
    >
      {WORKSPACES.map((item) => {
        const selected = item.id === current
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'w-28 shrink-0 cursor-pointer whitespace-nowrap border-b-2 border-transparent py-2.5 text-center text-sm font-medium text-muted transition-colors hover:text-foreground',
              selected && 'border-primary font-semibold text-accent',
            )}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
