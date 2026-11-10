import { beforeEach, describe, expect, test } from 'bun:test'
import { loadSession, saveSession, SESSION_KEY } from '../src/storage/sessionRepository'
import { loadWorkspaceDraft, saveWorkspaceDraft, serializeWorkspaceDraft, type SavedDraft } from '../src/storage/workspaceRepository'

const values = new Map<string, string>()
let blocked = false
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => { if (blocked) throw new Error('blocked'); return values.get(key) ?? null },
  setItem: (key: string, value: string) => { if (blocked) throw new Error('quota'); values.set(key, value) },
  removeItem: (key: string) => values.delete(key),
} })

beforeEach(() => { values.clear(); blocked = false })

const draft: SavedDraft = {
  draftGateway: 'openrouter', prompt: 'A forest in morning light', imageUrl: '', imagePerson: false,
  useCommon: true, useShared: true, refOpen: false, references: [], model: 'test/video', generation: 'direct',
  previewCount: 1, duration: '10', customDuration: 8, resolution: '1080p', ratio: '9:16', audio: true,
  seed: '123', watermark: '', lastFrame: '', store: '', mode: '', jobId: 'job-accepted',
}

describe('saved connections', () => {
  test('new browsers default to OpenRouter; existing provider preference is retained', () => {
    expect(loadSession().gateway).toBe('openrouter')
    localStorage.setItem('frame.gateway', 'letsur')
    expect(loadSession().gateway).toBe('letsur')
  })
  test('both keys survive a reload and clearing one leaves the other intact', () => {
    saveSession({ gateway: 'openrouter', keys: { openrouter: 'test-or-key', letsur: 'test-letsur-key' } })
    const restored = loadSession()
    expect(restored.keys.openrouter).toBe('test-or-key')
    restored.keys.openrouter = ''
    saveSession(restored)
    expect(loadSession().keys).toEqual({ openrouter: '', letsur: 'test-letsur-key' })
  })
  test('corrupt or inaccessible storage is reported without preventing startup', () => {
    localStorage.setItem(SESSION_KEY, '{bad json')
    expect(loadSession().storageFailed).toBe(true)
    blocked = true
    expect(loadSession().gateway).toBe('openrouter')
    expect(loadSession().storageFailed).toBe(true)
  })
})

describe('project drafts', () => {
  test('keeps prompts, models, settings and job IDs separately for each project', () => {
    saveWorkspaceDraft('a', serializeWorkspaceDraft(draft))
    saveWorkspaceDraft('b', serializeWorkspaceDraft({ ...draft, prompt: 'A different scene', resolution: '720p' }))
    expect(loadWorkspaceDraft('a').draft).toEqual(draft)
    expect(loadWorkspaceDraft('b').draft?.prompt).toBe('A different scene')
  })
  test('drops transient state, credentials, files and signed result-reference URLs', () => {
    const state = {
      ...draft, apiKey: 'do-not-persist', submitting: true, uploads: 1,
      preview: { url: 'https://signed.example/result' },
      references: [{ id: 'ref1', type: 'video' as const, role: 'reference_video', managed: false,
        url: 'https://signed.example/video', mediaId: 'job#0', status: '', file: { name: 'not-serializable' } }],
    }
    const serialized = serializeWorkspaceDraft(state)
    expect(serialized).not.toContain('do-not-persist')
    expect(serialized).not.toContain('signed.example')
    expect(serialized).not.toContain('submitting')
    expect(serialized).not.toContain('not-serializable')
    saveWorkspaceDraft('a', serialized)
    expect(loadWorkspaceDraft('a').draft?.references[0].mediaId).toBe('job#0')
  })
  test('preserves local image references; unuploaded files ask to be selected again', () => {
    const references = [
      { id: 'r1', type: 'image' as const, role: 'reference_image', url: 'frame-local://img1', managed: false, status: '' },
      { id: 'r2', type: 'image' as const, role: 'reference_image', url: '', managed: false, status: '' },
    ]
    saveWorkspaceDraft('a', serializeWorkspaceDraft({ ...draft, references }))
    const restored = loadWorkspaceDraft('a').draft!
    expect(restored.references[0].url).toBe('frame-local://img1')
    expect(restored.references[1].status).toContain('다시 선택')
  })
  test('handles unsupported or damaged data without mixing it into runtime state', () => {
    localStorage.setItem('frame.draft.v1:a', JSON.stringify({ version: 1, draft: { ...draft, references: null } }))
    expect(loadWorkspaceDraft('a')).toEqual({ failed: true })
    expect(loadWorkspaceDraft('b')).toEqual({ failed: false })
    blocked = true
    expect(loadWorkspaceDraft('b')).toEqual({ failed: true })
  })
})

// 실제 스토어를 통과하는 전환·저장 경로도 검사합니다.
describe('store integration', () => {
  test('switching projects saves and restores the draft and its provider; backups exclude credentials', async () => {
    const { useSessionStore: session } = await import('../src/stores/sessionStore')
    const { useProjectStore: projects } = await import('../src/stores/projectStore')
    const { useWorkspaceStore: workspace } = await import('../src/stores/workspaceStore')
    const first = projects.getState().activeProjectId
    session.getState().setApiKey('test-only-key')
    workspace.getState().set({ prompt: 'First project', duration: '10', resolution: '1080p' })
    const second = projects.getState().addProject('Second project')
    projects.getState().setActiveProjectId(second.id)
    expect(workspace.getState().prompt).toBe('')
    session.getState().setGateway('letsur')
    workspace.getState().set({ prompt: 'Second project scene' })
    projects.getState().setActiveProjectId(first)
    expect(workspace.getState().prompt).toBe('First project')
    expect(workspace.getState().resolution).toBe('1080p')
    expect(session.getState().gateway).toBe('openrouter')
    expect(JSON.stringify(projects.getState().snapshot())).not.toContain('test-only-key')
    expect(values.get(`frame.draft.v1:${first}`)).not.toContain('test-only-key')
    session.getState().clearKey()
    expect(loadSession().keys.openrouter).toBe('')
    blocked = true
    workspace.getState().set({ prompt: 'Cannot save' })
    session.getState().setApiKey('unsaved-key')
    expect(workspace.getState().storageFailed).toBe(true)
    expect(session.getState().storageFailed).toBe(true)
  })
})
