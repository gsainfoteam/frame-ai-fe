import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string
  body: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-[340px] flex-col items-center px-4 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
        {icon ?? (
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
            <path
              d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Zm5 2.2v4.6l4-2.3-4-2.3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1.5 whitespace-pre-line text-xs text-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
