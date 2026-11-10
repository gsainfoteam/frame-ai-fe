import { Children, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { useSessionStore } from '@/stores/sessionStore'
import guide from '../../../docs/user-guide.md?raw'
import { guideImageSizes } from '@/features/help/guideImages'

// 화면과 저장소의 문서를 하나의 Markdown 원본으로 관리합니다.
const sectionId = (title: string) => `guide-${title.match(/^\d+/)?.[0] ?? title.replace(/\s+/g, '-')}`
const sections = Array.from(guide.matchAll(/^## (.+)$/gm), ([, title]) => ({ title, id: sectionId(title) }))
// 스크롤로 목차 상태가 바뀌어도 이미지·제목 DOM을 다시 만들지 않도록 렌더러를 고정합니다.
const markdownComponents: Components = {
  h1: () => null,
  h2: ({ children }) => {
    const title = Children.toArray(children).join('')
    const id = sectionId(title)
    return <h2 id={id}><a href={`#${id}`} className="group text-foreground no-underline">{children}<span aria-hidden="true" className="ml-2 text-faint opacity-0 group-hover:opacity-100">#</span></a></h2>
  },
  a: ({ href, children }) => <a href={href} target={href?.startsWith('https://') ? '_blank' : undefined} rel={href?.startsWith('https://') ? 'noopener noreferrer' : undefined}>{children}</a>,
  table: ({ children }) => <div className="guide-table scrollbar-slim" role="region" aria-label="가이드 표" tabIndex={0}><table>{children}</table></div>,
  img: ({ src, alt }) => (
    <a href={src} target="_blank" rel="noopener noreferrer" title="이미지 크게 보기" className="block">
      <img src={src} alt={alt} width={guideImageSizes[src ?? '']?.[0]} height={guideImageSizes[src ?? '']?.[1]} loading="lazy" decoding="async" className="mx-auto h-auto max-w-full rounded-lg border border-line" />
    </a>
  ),
}

function GuideContents({ active }: { active: string }) {
  return (
    <nav aria-label="사용 가이드 목차" className="space-y-1">
      {sections.map(({ title, id }) => (
        <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} className={cn('block rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface hover:text-accent', active === id ? 'bg-accent-soft font-semibold text-accent' : 'text-muted')}>
          {title}
        </a>
      ))}
    </nav>
  )
}

export function HelpPage() {
  const openKeys = useSessionStore((s) => s.setKeyDialogOpen)
  const [active, setActive] = useState(sections[0].id)
  const { hash } = useLocation()

  useEffect(() => {
    // 바로 공유한 절 링크도 이미지 로딩 전에 안정적으로 이동할 수 있도록 이미지 크기를 지정합니다.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  useEffect(() => {
    const updateActive = () => {
      const offset = 170
      const current = sections.filter(({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= offset).at(-1)
      setActive(current?.id ?? sections[0].id)
    }
    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    return () => window.removeEventListener('scroll', updateActive)
  }, [])

  return (
    <div className="mx-auto max-w-[1200px]">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent">FRAME DOCUMENTATION</p>
          <h1 className="mt-2 text-3xl tracking-tight">사용 가이드</h1>
          <p className="mt-2 text-sm text-muted">OpenRouter로 첫 영상을 만들고, 다음 작업까지 이어가는 방법</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-medium">영상 만들기 →</Link>
          <Button onClick={() => openKeys(true)}>API 키 연결</Button>
        </div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)]">
          <div className="hidden lg:block">
            <p className="mb-3 px-3 text-xs font-semibold text-foreground">이 문서의 내용</p>
            <GuideContents active={active} />
            <p className="mt-6 border-t border-line px-3 pt-4 text-xs leading-relaxed text-muted">OpenRouter 기준<br />화면 확인 · 2026.11.10</p>
          </div>
          <details className="rounded-lg border border-line bg-panel p-3 lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">문서 목차 <span aria-hidden="true">⌄</span></summary>
            <div className="mt-3"><GuideContents active={active} /></div>
          </details>
        </aside>
        <article className="guide-content min-w-0 rounded-xl border border-line bg-panel p-5 sm:p-8 lg:p-10" aria-label="OpenRouter 사용 설명서">
          <Markdown
            remarkPlugins={[remarkGfm]}
            urlTransform={(url) => url.startsWith('../public/guide/') ? url.replace('../public/guide/', '/guide/') : defaultUrlTransform(url)}
            components={markdownComponents}
          >
            {guide}
          </Markdown>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm">
            <a href="#guide-1">문서 처음으로 ↑</a>
            <Link to="/" className="font-semibold">첫 영상 만들러 가기 →</Link>
          </div>
        </article>
      </div>
    </div>
  )
}
