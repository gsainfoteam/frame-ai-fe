import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { modelParts, modelTags, type ModelSpec } from '@/domain/models'
import { cn } from '@/shared/lib/cn'

/** 목록이 이보다 길면 검색 칸을 보여 줍니다. */
const SEARCH_THRESHOLD = 8

function Tags({ spec, className }: { spec: ModelSpec; className?: string }) {
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {modelTags(spec).map((tag) => (
        <span key={tag} className="rounded bg-surface-strong px-1.5 py-px text-2xs font-medium tabular-nums text-muted">
          {tag}
        </span>
      ))}
    </span>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={cn('size-3 shrink-0 text-faint transition-transform', open && 'rotate-180')}>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 text-accent">
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Props = {
  id?: string
  value: ModelSpec
  models: ModelSpec[]
  onChange: (id: string) => void
  /** 이 키로 쓸 수 없는 것으로 확인된 모델 */
  unavailable?: (id: string) => boolean
}

/**
 * 모델 이름과 지원 범위를 나눠 보여 주는 선택 상자. 공급사별로 묶고, 목록이 길면 검색할 수 있습니다.
 * 방향키로 이동하고 Enter로 고르며 Esc로 닫습니다.
 */
export function ModelPicker({ id, value, models, onChange, unavailable = () => false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(value.id)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  /** 고르거나 Esc로 닫았을 때만 선택 상자로 초점을 돌려줍니다. 바깥을 눌러 닫으면 그대로 둡니다. */
  const [refocus, setRefocus] = useState(0)
  const searchable = models.length > SEARCH_THRESHOLD

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? models.filter((spec) => `${spec.label} ${spec.id} ${spec.description ?? ''}`.toLowerCase().includes(q)) : models
  }, [models, query])

  const groups = useMemo(() => {
    const map = new Map<string, ModelSpec[]>()
    for (const spec of filtered) {
      const provider = modelParts(spec).provider
      map.set(provider, [...(map.get(provider) ?? []), spec])
    }
    return [...map.entries()]
  }, [filtered])

  const selectable = filtered.filter((spec) => !unavailable(spec.id) || spec.id === value.id)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (searchable) searchRef.current?.focus()
    else listRef.current?.focus()
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-id="${CSS.escape(active)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setActive(value.id)
    setQuery('')
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setRefocus((n) => n + 1)
  }

  useEffect(() => {
    if (refocus) triggerRef.current?.focus()
  }, [refocus])

  const choose = (spec: ModelSpec) => {
    if (unavailable(spec.id) && spec.id !== value.id) return
    onChange(spec.id)
    close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      // Enter·Space는 버튼의 클릭으로 열립니다.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        openList()
      }
      return
    }
    const index = selectable.findIndex((spec) => spec.id === active)
    const move = (next: number) => {
      event.preventDefault()
      const spec = selectable[(next + selectable.length) % selectable.length]
      if (spec) setActive(spec.id)
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index < 0 ? -1 : index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(-1)
    else if (event.key === 'Enter') {
      event.preventDefault()
      const spec = selectable.find((item) => item.id === active)
      if (spec) choose(spec)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') setOpen(false)
  }

  const current = modelParts(value)

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md border border-input-border bg-input px-3 py-2 text-left transition-colors',
          'hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
          open && 'border-primary ring-2 ring-primary/15',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-md font-semibold text-foreground">{current.name}</span>
            <span className="shrink-0 text-xs text-faint">{current.provider}</span>
          </span>
          <Tags spec={value} className="mt-1" />
        </span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-panel shadow-pop">
          {searchable ? (
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={`모델 ${models.length}개 중 검색`}
                aria-label="모델 검색"
                aria-controls={listId}
                aria-activedescendant={active ? `${listId}-${active}` : undefined}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive('')
                }}
                className="h-8 w-full rounded-md border border-input-border bg-input px-2.5 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>
          ) : null}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="모델"
            aria-activedescendant={active ? `${listId}-${active}` : undefined}
            // 위쪽 여백을 두면 고정된 공급사 제목 위 틈으로 스크롤된 항목이 비칩니다.
            className="scrollbar-slim max-h-[min(24rem,60vh)] overflow-y-auto pb-1 focus:outline-none"
          >
            {groups.length ? (
              groups.map(([provider, specs]) => (
                <div key={provider} role="group" aria-label={provider}>
                  <p className="sticky top-0 z-10 bg-panel px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-faint">
                    {provider}
                  </p>
                  {specs.map((spec) => {
                    const selected = spec.id === value.id
                    const blocked = unavailable(spec.id) && !selected
                    const { name } = modelParts(spec)
                    return (
                      <div
                        key={spec.id}
                        id={`${listId}-${spec.id}`}
                        data-id={spec.id}
                        role="option"
                        aria-selected={selected}
                        aria-disabled={blocked || undefined}
                        onPointerMove={() => !blocked && setActive(spec.id)}
                        onClick={() => choose(spec)}
                        className={cn(
                          'mx-1 flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2',
                          spec.id === active && !blocked && 'bg-surface-strong',
                          selected && 'bg-accent-soft',
                          blocked && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm font-medium', selected ? 'text-accent' : 'text-foreground')}>{name}</span>
                          {blocked ? (
                            <span className="mt-0.5 block text-xs text-muted">이 스페이스에서 사용할 수 없습니다</span>
                          ) : spec.description ? (
                            <span className="mt-0.5 block text-xs text-muted">{spec.description}</span>
                          ) : null}
                          <Tags spec={spec} className="mt-1.5" />
                        </span>
                        {selected ? <Check /> : <span className="size-4 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted">‘{query}’에 맞는 모델이 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
