import { BrowserRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JobProvider } from '@/features/create/JobProvider'
import { CreatePage } from '@/features/create/CreatePage'
import { lazy } from 'react'
import { StudioLayout } from '@/features/layout/StudioLayout'

const PreviewsPage = lazy(() => import('@/features/preview/PreviewsPage').then((module) => ({ default: module.PreviewsPage })))
const ProjectPage = lazy(() => import('@/features/project/ProjectPage').then((module) => ({ default: module.ProjectPage })))
const HistoryPage = lazy(() => import('@/features/history/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const GalleryPage = lazy(() => import('@/features/gallery/GalleryPage').then((module) => ({ default: module.GalleryPage })))
const queryClient = new QueryClient()
const HelpPage = lazy(() => import('@/features/help/HelpPage').then((module) => ({ default: module.HelpPage })))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <JobProvider>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route index element={<CreatePage />} />
              <Route path="previews" element={<PreviewsPage />} />
              <Route path="project" element={<ProjectPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="library" element={<GalleryPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
          </Routes>
        </JobProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
