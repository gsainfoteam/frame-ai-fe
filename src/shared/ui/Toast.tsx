import { useToastStore } from '@/stores/toastStore'
import { cn } from '@/shared/lib/cn'

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100%-2rem))] flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 text-sm shadow-pop animate-[toast-in_.18s_ease-out]',
            item.error ? 'border-danger-line bg-danger-soft text-danger' : 'border-line bg-panel text-foreground',
          )}
          role="status"
        >
          <span
            className={cn(
              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-white',
              item.error ? 'bg-danger' : 'bg-accent',
            )}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" className="size-2.5">
              {item.error ? (
                <path d="M6 3v3.5M6 8.6v.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="m3 6.3 2 2L9 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </span>
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item.text}</p>
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={() => dismiss(item.id)}
            className="-mr-1 -mt-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-button hover:text-foreground"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
              <path d="m3 3 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
