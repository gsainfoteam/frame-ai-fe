import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Header } from '@/features/layout/Header'
import { WorkspaceTabs } from '@/features/layout/WorkspaceTabs'
import { ContinuationDialog } from '@/features/continuation/ContinuationDialog'
import { FinalizeDialog } from '@/features/preview/FinalizeDialog'
import { ToastViewport } from '@/shared/ui/Toast'
import { Link } from 'react-router'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useProjectStore } from '@/stores/projectStore'

export function StudioLayout() {
  const draftFailed = useWorkspaceStore((s) => s.storageFailed)
  const keyFailed = useSessionStore((s) => s.storageFailed)
  const projectFailed = useProjectStore((s) => s.storageFailed)

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* 모바일에서는 헤더 줄(h-14)만큼 위로 밀어 고정해, 스크롤하면 탭만 남깁니다. */}
      <div className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur max-sm:-top-14">
        <Header />
        <WorkspaceTabs />
      </div>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
        {draftFailed || keyFailed || projectFailed ? (
          <p role="alert" className="mb-4 rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            브라우저의 저장 정보를 읽거나 저장하지 못했습니다. 새로고침하기 전에 입력 내용을 복사하고, 생성 기록에서 백업을 내려받으세요.
          </p>
        ) : null}
        <Suspense fallback={<p role="status" className="py-8 text-sm text-muted">화면을 불러오는 중…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-4 sm:px-8">
        <p className="border-t border-line pt-3 text-center text-xs text-faint">
          Frame · API 키와 작업 내용은 이 브라우저에 저장됩니다 · <Link to="/help">사용 가이드</Link>
        </p>
      </footer>
      <ContinuationDialog />
      <FinalizeDialog />
      <ToastViewport />
    </div>
  )
}
