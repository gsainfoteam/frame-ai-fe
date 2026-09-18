import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'default' | 'primary' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
}

const variants: Record<Variant, string> = {
  default: 'border border-line-strong bg-panel text-foreground shadow-card hover:bg-button',
  primary: 'border border-transparent bg-primary text-white font-semibold shadow-card hover:bg-primary-hover',
  subtle: 'border border-transparent bg-transparent text-muted hover:bg-button hover:text-foreground',
  danger: 'border border-danger-line bg-danger-soft text-danger hover:border-danger',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1 rounded-md px-2.5 text-xs',
  md: 'h-9 gap-1.5 rounded-md px-3 text-sm',
  lg: 'h-11 gap-2 rounded-lg px-4 text-base',
}

export function Button({ variant = 'default', size = 'md', block, className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
