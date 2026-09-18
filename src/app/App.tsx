import { BrowserRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JobProvider } from '@/features/create/JobProvider'
import { CreatePage } from '@/features/create/CreatePage'
import { ProjectPage } from '@/features/project/ProjectPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { GalleryPage } from '@/features/gallery/GalleryPage'
import { StudioLayout } from '@/features/layout/StudioLayout'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <JobProvider>
          <Routes>
            <Route element={<StudioLayout />}>
              <Route index element={<CreatePage />} />
              <Route path="project" element={<ProjectPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="library" element={<GalleryPage />} />
            </Route>
          </Routes>
        </JobProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
