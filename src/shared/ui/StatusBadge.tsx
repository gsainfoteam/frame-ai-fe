import { cn } from '@/shared/lib/cn'

const tones: Record<string, string> = {
  queued: 'border-line-strong bg-surface-strong text-muted',
  running: 'border-transparent bg-accent-soft text-accent',
  succeeded: 'border-transparent bg-accent-soft text-accent',
  failed: 'border-danger-line bg-danger-soft text-danger',
  unknown: 'border-line bg-surface text-faint',
  idle: 'border-line bg-surface text-muted',
}

const dots: Record<string, string> = {
  queued: 'bg-faint',
  running: 'bg-accent animate-pulse',
  succeeded: 'bg-accent',
  failed: 'bg-danger',
  unknown: 'bg-line-strong',
  idle: 'bg-line-strong',
}

export function StatusBadge({ status, children }: { status: string; children: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[status] ?? tones.idle,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dots[status] ?? dots.idle)} />
      {children}
    </span>
  )
}
