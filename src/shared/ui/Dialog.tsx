import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  preventClose?: boolean
  footer?: ReactNode
  children: ReactNode
}

export function Dialog({ open, title, description, onClose, preventClose, footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="scrollbar-slim"
      onClose={() => {
        if (!preventClose) onClose()
      }}
      onCancel={(event) => {
        if (preventClose) event.preventDefault()
      }}
    >
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base">{title}</h2>
            {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            aria-label="닫기"
            disabled={preventClose}
            onClick={onClose}
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-button hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5">
              <path d="m3.5 3.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-line bg-surface px-5 py-3.5">{footer}</div> : null}
    </dialog>
  )
}
