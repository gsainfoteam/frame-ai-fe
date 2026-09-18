import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const controlClass =
  'w-full min-w-0 rounded-md border border-input-border bg-input text-md text-foreground transition-colors' +
  ' focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15' +
  ' disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted'

const heightClass = 'h-9 px-2.5'

export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, heightClass, className)} {...props} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-28 resize-y px-2.5 py-2 leading-relaxed', className)} {...props} />
}

export function Select({
  className,
  containerClassName,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { containerClassName?: string }) {
  return (
    <div className={cn('relative min-w-0', containerClassName)}>
      <select className={cn(controlClass, heightClass, 'cursor-pointer appearance-none pr-8', className)} {...props} />
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-faint"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-start gap-2 text-sm',
        props.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-px size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
        {...props}
      />
      <span className="min-w-0">{label}</span>
    </label>
  )
}
