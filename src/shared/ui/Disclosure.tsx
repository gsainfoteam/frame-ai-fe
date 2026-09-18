import type { ReactNode, SyntheticEvent } from 'react'
import { cn } from '@/shared/lib/cn'

type Props = {
  label: ReactNode
  meta?: ReactNode
  /** 값을 주면 제어 컴포넌트로 동작합니다. */
  open?: boolean
  onToggle?: (open: boolean) => void
  variant?: 'panel' | 'plain'
  className?: string
  children: ReactNode
}

export function Disclosure({
  label,
  meta,
  open,
  onToggle,
  variant = 'panel',
  className,
  children,
}: Props) {
  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    onToggle?.(event.currentTarget.open)
  }

  return (
    <details
      className={cn(
        'group',
        variant === 'panel' && 'overflow-hidden rounded-md border border-line bg-surface',
        className,
      )}
      open={open}
      onToggle={handleToggle}
    >
      <summary
        className={cn(
          'flex cursor-pointer items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent',
          variant === 'panel' && 'px-3 py-2.5',
        )}
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="size-3 shrink-0 text-faint transition-transform duration-150 group-open:rotate-90"
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {meta ? <span className="shrink-0 text-xs font-normal text-faint">{meta}</span> : null}
      </summary>
      <div className={cn(variant === 'panel' ? 'border-t border-line bg-panel p-3' : 'pt-3')}>{children}</div>
    </details>
  )
}
