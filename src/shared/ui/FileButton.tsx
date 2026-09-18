import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode
  className?: string
}

/** 브라우저 기본 파일 입력 대신 버튼 모양의 라벨을 씁니다. */
export function FileButton({ label = '파일 선택', className, disabled, ...props }: Props) {
  return (
    <label
      className={cn(
        'inline-flex h-9 cursor-pointer select-none items-center justify-center gap-1.5 rounded-md border border-line-strong bg-panel px-3 text-sm font-medium text-foreground shadow-card transition-colors hover:bg-button',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
        disabled && 'pointer-events-none opacity-45',
        className,
      )}
    >
      <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 text-muted">
        <path
          d="M7 10V3m0 0L4.5 5.5M7 3l2.5 2.5M2.5 10.5v.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
      <input type="file" className="sr-only" disabled={disabled} {...props} />
    </label>
  )
}
