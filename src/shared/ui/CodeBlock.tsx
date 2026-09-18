import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        'scrollbar-slim max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface-strong p-3 font-mono text-xs text-foreground',
        className,
      )}
    >
      {children}
    </pre>
  )
}
