import type { WORKSPACES } from '@/config/constants'

type WorkspaceId = (typeof WORKSPACES)[number]['id']

const paths: Record<WorkspaceId, string> = {
  create: 'M4 5h16v14H4z M4 9h16 M8 5v4 M13 5v4 M18 5v4 M10 12l5 2-5 2z',
  previews: 'M3 5h7v14H3z M14 5h7v14h-7z',
  project: 'M5 4v16 M12 4v16 M19 4v16 M3 8h4 M10 15h4 M17 10h4',
  history: 'M4 10a8 8 0 1 1 1 7 M4 4v6h6 M12 7v5l3 2',
  images: 'M4 4h16v16H4z M4 16l5-5 4 4 3-3 4 4 M15 8h.01',
  help: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1z M12 6v14',
}

export function WorkspaceIcon({ name }: { name: WorkspaceId }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
