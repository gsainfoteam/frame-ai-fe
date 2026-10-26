import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Props = {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** 스위치 옆에 보일 현재 상태 설명 */
  children?: ReactNode
  className?: string
}

/** 켜고 끄는 설정용 스위치. Field 라벨의 htmlFor로 이름을 붙입니다. */
export function Switch({ id, checked, onChange, children, className }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-surface px-2.5 text-sm transition-colors hover:border-line-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
    >
      <span className={cn('truncate', checked ? 'text-foreground' : 'text-muted')}>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute left-0 top-0.5 size-4 rounded-full bg-white shadow-card transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}
