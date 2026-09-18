import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Header } from '@/features/layout/Header'
import { WorkspaceTabs } from '@/features/layout/WorkspaceTabs'
import { ContinuationDialog } from '@/features/continuation/ContinuationDialog'
import { ToastViewport } from '@/shared/ui/Toast'
import { loadWorkspaceForProject } from '@/features/create/draft'

export function StudioLayout() {
  useEffect(() => {
    loadWorkspaceForProject()
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
        <Header />
        <WorkspaceTabs />
      </div>
      <main className="mx-auto w-full max-w-[1232px] flex-1 px-4 py-5 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-[1232px] px-4 pb-6 pt-2 sm:px-6">
        <p className="border-t border-line pt-3 text-center text-xs text-faint">
          Frame · 프로젝트와 기록은 이 브라우저에만 저장됩니다 · API 기준 2026.09.17
        </p>
      </footer>
      <ContinuationDialog />
      <ToastViewport />
    </div>
  )
}
