import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type ChipOption<T extends string> = {
  value: T
  label: ReactNode
  /** 마우스를 올렸을 때 보일 설명. 비활성 사유도 여기에 적습니다. */
  title?: string
  disabled?: boolean
}

type Props<T extends string> = {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  ariaLabelledBy?: string
  className?: string
}

/** 선택지가 적은 설정을 한눈에 보이게 하는 라디오 그룹. 방향키로 이동하며 선택합니다. */
export function ChipGroup<T extends string>({ options, value, onChange, ariaLabel, ariaLabelledBy, className }: Props<T>) {
  const enabled = options.filter((option) => !option.disabled)
  const focusValue = enabled.some((option) => option.value === value) ? value : enabled[0]?.value

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step || !enabled.length) return
    event.preventDefault()
    const index = enabled.findIndex((option) => option.value === focusValue)
    const next = enabled[(index + step + enabled.length) % enabled.length]
    onChange(next.value)
    const button = event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)
    button?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn('flex flex-wrap gap-1.5', className)}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={option.value}
            tabIndex={option.value === focusValue ? 0 : -1}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              'disabled:cursor-not-allowed disabled:opacity-40',
              selected
                ? 'border-primary bg-accent-soft font-medium text-accent'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
