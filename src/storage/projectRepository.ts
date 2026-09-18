import type { ProjectBackup } from '@/api/types'
import { HISTORY_KEY, HISTORY_KEY_V1 } from '@/config/constants'
import { defaultProject, parseProjectBackup } from '@/domain/backup'

export type LoadedProjects = ProjectBackup & { failed: boolean }

export function loadProjectData(): LoadedProjects {
  try {
    const stored = localStorage.getItem(HISTORY_KEY) || localStorage.getItem(HISTORY_KEY_V1)
    if (!stored) {
      return {
        version: 2,
        projects: [defaultProject()],
        records: [],
        activeProjectId: 'default',
        failed: false,
      }
    }
    return { ...parseProjectBackup(stored), failed: false }
  } catch {
    return {
      version: 2,
      projects: [defaultProject()],
      records: [],
      activeProjectId: 'default',
      failed: true,
    }
  }
}

export function saveProjectData(data: ProjectBackup) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(data))
}
