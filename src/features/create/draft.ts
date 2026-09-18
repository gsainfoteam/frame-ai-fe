import type { MediaReference } from '@/api/types'
import { validRef } from '@/shared/lib/url'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore, type ReferenceDraft } from '@/stores/workspaceStore'
import type { PayloadDraft } from '@/domain/seedance'

function toDraftRef(ref: ReferenceDraft) {
  return {
    type: ref.type,
    url: ref.url,
    role: ref.role,
    mediaId: ref.mediaId,
    managed: ref.managed,
    filePending: Boolean(ref.file && !ref.url),
  }
}

export function currentDraft(): PayloadDraft {
  const workspace = useWorkspaceStore.getState()
  const project = useProjectStore.getState().currentProject()
  return {
    commonPrompt: project.prompt,
    useCommon: workspace.useCommon,
    scenePrompt: workspace.prompt,
    imageUrl: workspace.imageUrl,
    imagePerson: workspace.imagePerson,
    sceneReferences: workspace.references.map(toDraftRef),
    sharedReferences: workspace.sharedReferences
      .filter((ref) => validRef(ref.url))
      .map((ref) => ({
        type: 'image' as const,
        url: ref.url,
        role: (ref.role as MediaReference['role']) || 'reference_image',
      })),
    useShared: workspace.useShared,
    mode: workspace.mode,
    duration: workspace.duration,
    customDuration: workspace.customDuration,
    resolution: workspace.resolution,
    ratio: workspace.ratio,
    generateAudio: workspace.audio,
    seed: workspace.seed,
    watermark: workspace.watermark,
    lastFrame: workspace.lastFrame,
    store: workspace.store,
  }
}

export function persistSharedReferences() {
  const refs = useWorkspaceStore
    .getState()
    .sharedReferences.filter((ref) => validRef(ref.url))
    .map((ref) => ({
      type: 'image' as const,
      url: ref.url,
      role: (ref.role as MediaReference['role']) || 'reference_image',
    }))
  useProjectStore.getState().updateCurrentProject({ references: refs })
}

export function loadWorkspaceForProject() {
  const project = useProjectStore.getState().currentProject()
  useWorkspaceStore.getState().loadSharedReferences(project.references)
}
