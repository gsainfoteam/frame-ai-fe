import { create } from 'zustand'
import type { JobRecord, Project, ProjectBackup } from '@/api/types'
import { PROJECT_NAME_MAX } from '@/config/constants'
import { cleanRecord, defaultProject, mergeProjectBackup } from '@/domain/backup'
import { createId } from '@/shared/lib/id'
import { loadProjectData, saveProjectData } from '@/storage/projectRepository'

type ProjectState = {
  projects: Project[]
  records: JobRecord[]
  activeProjectId: string
  storageFailed: boolean
  persist: () => void
  currentProject: () => Project
  setActiveProjectId: (id: string) => void
  addProject: (name: string) => Project
  removeProject: (id: string) => void
  renameProject: (name: string) => void
  updateCurrentProject: (patch: Partial<Pick<Project, 'prompt' | 'references'>>) => void
  upsertRecord: (record: Partial<JobRecord> & { id: string }) => JobRecord
  deleteRecord: (id: string) => void
  moveRecord: (id: string, projectId: string) => void
  replaceFromBackup: (incoming: ProjectBackup) => void
  snapshot: () => ProjectBackup
}

function persistNow(state: Pick<ProjectState, 'projects' | 'records' | 'activeProjectId'>) {
  saveProjectData({
    version: 2,
    activeProjectId: state.activeProjectId,
    projects: state.projects,
    records: state.records,
  })
}

const loaded = loadProjectData()

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: loaded.projects,
  records: loaded.records,
  activeProjectId: loaded.activeProjectId,
  storageFailed: loaded.failed,
  persist: () => {
    try {
      persistNow(get())
      set({ storageFailed: false })
    } catch {
      set({ storageFailed: true })
    }
  },
  currentProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? defaultProject()
  },
  setActiveProjectId: (activeProjectId) => {
    set({ activeProjectId })
    get().persist()
  },
  addProject: (name) => {
    const project: Project = {
      id: createId('project'),
      name: name.trim().slice(0, PROJECT_NAME_MAX),
      prompt: '',
      references: [],
      updated_at: new Date().toISOString(),
    }
    set((state) => ({ projects: [...state.projects, project] }))
    get().persist()
    return project
  },
  removeProject: (id) => {
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
    get().persist()
  },
  renameProject: (name) => {
    const trimmed = name.trim().slice(0, PROJECT_NAME_MAX)
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === state.activeProjectId ? { ...p, name: trimmed, updated_at: new Date().toISOString() } : p,
      ),
    }))
    get().persist()
  },
  updateCurrentProject: (patch) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === state.activeProjectId ? { ...p, ...patch, updated_at: new Date().toISOString() } : p,
      ),
    }))
    get().persist()
  },
  upsertRecord: (record) => {
    const state = get()
    const index = state.records.findIndex((item) => item.id === record.id)
    const old = index < 0 ? {} : state.records[index]
    const next = cleanRecord({ project_id: state.activeProjectId, ...old, ...record })
    const records = [...state.records]
    if (index < 0) records.unshift(next)
    else records[index] = next
    set({ records })
    get().persist()
    return next
  },
  deleteRecord: (id) => {
    set((state) => ({ records: state.records.filter((item) => item.id !== id) }))
    get().persist()
  },
  moveRecord: (id, projectId) => {
    set((state) => ({
      records: state.records.map((item) => (item.id === id ? { ...item, project_id: projectId } : item)),
    }))
    get().persist()
  },
  replaceFromBackup: (incoming) => {
    const merged = mergeProjectBackup(get().snapshot(), incoming)
    set({
      projects: merged.projects,
      records: merged.records,
      activeProjectId: merged.activeProjectId,
    })
    get().persist()
  },
  snapshot: () => ({
    version: 2,
    activeProjectId: get().activeProjectId,
    projects: get().projects,
    records: get().records,
  }),
}))
