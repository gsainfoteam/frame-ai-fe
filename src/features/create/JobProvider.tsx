import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { JobStatus, LetsurJob, ResultMedia, VideoGenerationRequest } from '@/api/types'
import { LetsurApiError } from '@/api/errors'
import { IMAGE_MIMES, POLL_INTERVAL_MS, REF_LIMITS, isAllowedMime } from '@/config/constants'
import { describeError } from '@/domain/errors'
import { buildPayload, captureBindings, validateDraftInputs, validatePayload } from '@/domain/seedance'
import { useVideoApi } from '@/hooks/useVideoApi'
import { validRef, safeUrl } from '@/shared/lib/url'
import { rememberImage } from '@/storage/imageRepository'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { currentDraft } from '@/features/create/draft'
import { JobContext } from '@/features/create/jobContext'

const statusLabel: Record<string, string> = {
  queued: '대기 중',
  running: '생성 중',
  succeeded: '생성 완료',
  failed: '실패',
}

function rememberJob(job: LetsurJob, id: string) {
  const status = (['queued', 'running', 'succeeded', 'failed'].includes(job.status) ? job.status : 'unknown') as JobStatus
  useProjectStore.getState().upsertRecord({
    id: job.id || id,
    status,
    updated_at: job.updated_at || new Date().toISOString(),
    ...(job.created_at ? { created_at: job.created_at } : {}),
    media: (job.result?.media ?? []).map((m) => ({
      media_id: m.media_id,
      kind: m.kind,
      state: m.state,
    })),
    ...(job.usage ? { usage: job.usage } : {}),
    ...(job.error ? { error: job.error } : {}),
  })
}

export function JobProvider({ children }: { children: ReactNode }) {
  const api = useVideoApi()
  const navigate = useNavigate()
  const epochRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const activeRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const stop = useCallback(() => {
    clearTimer()
    activeRef.current = false
    epochRef.current += 1
    useWorkspaceStore.getState().set({ polling: false })
  }, [])

  const showMedia = useCallback((url: string, kind: string, mediaId = '') => {
    useWorkspaceStore.getState().set({ preview: { url, kind, mediaId } })
  }, [])

  const attachReadyMedia = useCallback(
    (items: ResultMedia[], currentPreview?: string) => {
      const readyVideo = items.find((item) => item.kind === 'video' && item.state === 'ready' && item.url)
      const safe = readyVideo?.url ? safeUrl(readyVideo.url) : null
      if (safe && readyVideo && currentPreview !== readyVideo.media_id) {
        showMedia(safe, readyVideo.kind, readyVideo.media_id)
      }
    },
    [showMedia],
  )

  const startPolling = useCallback(
    (id: string) => {
      navigate('/')
      const workspace = useWorkspaceStore.getState()
      if (workspace.jobId !== id) {
        workspace.set({ media: [], preview: null })
      }
      stop()
      workspace.set({ jobId: id, polling: true })
      activeRef.current = true
      const token = epochRef.current

      const poll = async () => {
        if (token !== epochRef.current || !activeRef.current) return
        try {
          const json = await api.getJob(id)
          if (token !== epochRef.current) return
          const job = json.data?.job
          if (!job) throw new Error('응답에서 작업 정보를 찾지 못했습니다.')
          rememberJob(job, id)
          const media = job.result?.media ?? []
          useWorkspaceStore.getState().set({
            rawResponse: JSON.stringify(json, null, 2),
            status: statusLabel[job.status] || job.status,
            cost: job.usage ? `${job.usage.amount} ${job.usage.currency}` : '비용 미확정',
            media,
          })
          if (job.status === 'failed') {
            const text = describeError(job.error)
            useWorkspaceStore.getState().setNotice(text, true)
            toast(text, true)
            stop()
            return
          }
          if (job.status === 'succeeded') {
            attachReadyMedia(media, useWorkspaceStore.getState().preview?.mediaId)
            const pending = media.some((item) => item.state === 'pending')
            const message = pending
              ? '영상 생성 완료 · 결과 파일을 준비하고 있습니다.'
              : media.length
                ? '결과를 확인하세요. 링크가 만료되면 다시 발급할 수 있습니다.'
                : '생성은 완료되었지만 반환된 미디어가 없습니다.'
            useWorkspaceStore.getState().setNotice(message)
            if (!pending) {
              stop()
              return
            }
          } else {
            useWorkspaceStore.getState().setNotice(`작업 ${id} · 5초마다 진행 상태를 확인합니다.`)
          }
          timerRef.current = window.setTimeout(() => void poll(), POLL_INTERVAL_MS)
        } catch (error) {
          if (token !== epochRef.current) return
          const err = error as LetsurApiError
          useWorkspaceStore.getState().setNotice(err.message, true)
          toast(err.message, true)
          if (err.status === 429 || err.status === 503) {
            timerRef.current = window.setTimeout(() => void poll(), Math.min(err.retry || POLL_INTERVAL_MS, 2147483647))
            useWorkspaceStore.getState().setNotice(`${err.message}\n안내된 대기 후 같은 작업을 다시 조회합니다.`, true)
          } else {
            stop()
          }
        }
      }

      void poll()
    },
    [api, attachReadyMedia, navigate, stop],
  )

  const lookup = useCallback(() => {
    const id = useWorkspaceStore.getState().jobId.trim()
    if (!id) {
      useWorkspaceStore.getState().setNotice('조회할 작업 ID를 입력해주세요.', true)
      toast('조회할 작업 ID를 입력해주세요.', true)
      return
    }
    startPolling(id)
  }, [startPolling])

  const refreshReferenceLinks = useCallback(
    async (payload: VideoGenerationRequest) => {
      const workspace = useWorkspaceStore.getState()
      const next = { ...payload, references: payload.references ? [...payload.references] : undefined }
      const bindings = captureBindings(currentDraft())
      for (const binding of bindings) {
        const link = await api.issueMediaLink(binding.media_id)
        if (!safeUrl(link.url ?? '')) throw new Error('이전 영상의 링크 발급에 실패했습니다.')
        if (next.references?.[binding.index]) next.references[binding.index] = { ...next.references[binding.index], url: link.url! }
        const scene = workspace.references[binding.index]
        if (scene) workspace.updateReference(scene.id, { url: link.url })
      }
      return next
    },
    [api],
  )

  const generate = useCallback(async () => {
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) return
    workspace.set({ notice: '', noticeError: false })
    let payload: VideoGenerationRequest
    try {
      payload = validatePayload(buildPayload(currentDraft()))
      validateDraftInputs(currentDraft())
      if (!useSessionStore.getState().apiKey.trim()) throw new Error('API 키를 입력해주세요.')
    } catch (error) {
      const message = (error as Error).message
      workspace.set({ notice: message, noticeError: true })
      toast(message, true)
      return
    }

    stop()
    const myEpoch = epochRef.current
    const submittedProjectId = useProjectStore.getState().activeProjectId
    const bindings = captureBindings(currentDraft())
    workspace.set({ submitting: true, status: '접수 중' })
    workspace.setNotice('영상 생성 요청을 보내고 있습니다…')
    let sent = false
    try {
      payload = validatePayload(await refreshReferenceLinks(payload))
      sent = true
      const json = await api.createJob(payload)
      workspace.set({ rawResponse: JSON.stringify(json, null, 2) })
      if (typeof json.id !== 'string' || !json.id) {
        throw new Error('접수 응답에 작업 ID가 없습니다. 실제 접수 여부를 확인해주세요.')
      }
      useProjectStore.getState().upsertRecord({
        id: json.id,
        project_id: submittedProjectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'queued',
        request: payload,
        bindings,
        media: [],
      })
      workspace.set({
        jobId: json.id,
        media: [],
        preview: null,
        cost: '비용 미확정',
        notice: '장면을 만들고 있습니다. 잠시 기다려주세요.',
      })
      if (epochRef.current === myEpoch) startPolling(json.id)
    } catch (error) {
      const err = error as LetsurApiError
      if (err.payload) workspace.set({ rawResponse: JSON.stringify(err.payload, null, 2) })
      workspace.set({
        status: sent ? (err.status === 400 ? '입력 거절' : '접수 확인 필요') : '참조 준비 실패',
      })
      const extra = sent
        ? err.status === 400
          ? '\n입력을 수정한 뒤 다시 요청해주세요.'
          : '\n중복 생성을 피하기 위해 자동 재전송하지 않습니다.'
        : '\n새 영상 생성 요청은 전송하지 않았습니다. 보관 만료 시 다운로드해 둔 파일을 다시 업로드해주세요.'
      workspace.setNotice(err.message + extra, true)
      toast(err.message, true)
    } finally {
      useWorkspaceStore.getState().set({ submitting: false })
    }
  }, [api, refreshReferenceLinks, startPolling, stop])

  const refreshLink = useCallback(
    async (media: ResultMedia) => {
      const result = await api.issueMediaLink(media.media_id)
      if (!safeUrl(result.url ?? '')) throw new Error('유효한 HTTPS 미디어 링크가 없습니다.')
      useWorkspaceStore.getState().set({
        media: useWorkspaceStore.getState().media.map((item) =>
          item.media_id === media.media_id
            ? { ...item, url: result.url, url_expires_at: result.url_expires_at, state: 'ready' }
            : item,
        ),
      })
      toast('파일 링크가 준비되었습니다.')
      if (result.url) showMedia(result.url, media.kind, media.media_id)
    },
    [api, showMedia],
  )

  const addVideoRef = useCallback(
    async (media: Pick<ResultMedia, 'media_id'>) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 추가해주세요.')
      const payload = buildPayload(currentDraft())
      if (payload.image_url || (payload.references ?? []).some((ref) => ref.role === 'first_frame' || ref.role === 'last_frame')) {
        throw new Error('현재 첫·마지막 프레임을 사용 중입니다. 프레임 참조를 제거한 후 영상 참조를 추가해주세요.')
      }
      if ((payload.references ?? []).filter((ref) => ref.type === 'video').length >= REF_LIMITS.video) {
        throw new Error('영상 참조는 최대 10개입니다.')
      }
      const targetProjectId = useProjectStore.getState().activeProjectId
      const link = await api.issueMediaLink(media.media_id)
      if (!safeUrl(link.url ?? '')) throw new Error('유효한 영상 링크를 받지 못했습니다.')
      if (targetProjectId !== useProjectStore.getState().activeProjectId) {
        throw new Error('프로젝트가 변경되어 참조를 추가하지 않았습니다. 현재 프로젝트에서 다시 선택해주세요.')
      }
      navigate('/')
      workspace.addReference({
        type: 'video',
        role: 'reference_video',
        url: link.url,
        mediaId: media.media_id,
        status: '이전 생성 영상 · 전송 직전에 링크를 다시 갱신합니다.',
      })
      if (!workspace.mode) workspace.set({ mode: 'reference' })
      toast('이전 영상을 참조로 추가했습니다. 장면 설명을 작성하고 생성하세요.')
    },
    [api, navigate],
  )

  const restoreRequest = useCallback(
    (recordId: string) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 설정을 불러와주세요.')
      const record = useProjectStore.getState().records.find((item) => item.id === recordId)
      if (!record?.request) return
      if (!confirm('현재 작성 중인 설정을 이 기록의 설정으로 바꿀까요?')) return
      navigate('/')
      const p = record.request
      workspace.set({
        firstFramePreview: null,
        useCommon: false,
        useShared: false,
        prompt: p.prompt || '',
        imageUrl: p.image_url || '',
        imagePerson: false,
        resolution: p.resolution || '480p',
        ratio: p.aspect_ratio || '',
        mode: p.mode || '',
        seed: p.seed === undefined ? '' : String(p.seed),
        audio: p.generate_audio ?? true,
        watermark: p.watermark === undefined ? '' : String(p.watermark),
        lastFrame: p.return_last_frame === undefined ? '' : String(p.return_last_frame),
        store: p.store_media === undefined ? '' : String(p.store_media),
        references: [],
        refOpen: Boolean(p.image_url || p.references?.length),
      })
      const duration = p.duration
      workspace.set({
        duration: duration === undefined ? '' : [-1, 5, 10, 15, 20, 30].includes(duration) ? String(duration) : 'custom',
        customDuration: duration ?? 8,
      })
      for (const [index, ref] of (p.references || []).entries()) {
        const binding = record.bindings.find((b) => b.index === index)
        workspace.addReference({
          type: ref.type,
          role: ref.role,
          url: binding ? '' : ref.url,
          mediaId: binding?.media_id,
          status: binding ? '이전 생성 영상 · 전송 직전에 최신 링크를 발급합니다.' : '',
        })
      }
      toast(
        '당시의 전체 요청을 불러왔습니다. 중복 적용을 막기 위해 이번 장면의 공통 설정 적용을 껐습니다. 이전 생성 영상은 전송 직전에 링크를 갱신합니다.',
      )
    },
    [navigate],
  )

  const prepareContinuation = useCallback(
    async (jobId: string, mediaId?: string) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 이어 만들기를 선택해주세요.')
      const projectId = useProjectStore.getState().activeProjectId
      workspace.setNotice('마지막 프레임을 확인하고 있습니다…')
      const response = await api.getJob(jobId)
      if (projectId !== useProjectStore.getState().activeProjectId) return
      const job = response.data?.job
      if (!job) throw new Error('작업 정보를 찾지 못했습니다.')
      rememberJob(job, jobId)
      if (job.status !== 'succeeded') throw new Error('생성 완료 후 마지막 프레임을 사용할 수 있습니다.')
      const images = (job.result?.media || []).filter((m) => m.kind === 'image')
      if (!images.length) {
        throw new Error(
          '이 작업에는 반환된 마지막 프레임 이미지가 없습니다. 기존 영상에 소급해서 요청할 수 없습니다. 다음 생성부터 ‘연속 장면 준비’를 켜세요.',
        )
      }
      if (!mediaId && images.length > 1) {
        throw new Error('결과 이미지가 여러 개입니다. 결과를 조회하고 원하는 이미지의 ‘첫 프레임으로 사용’을 선택해주세요.')
      }
      const media = mediaId ? images.find((m) => m.media_id === mediaId) : images[0]
      if (!media || media.state !== 'ready') {
        throw new Error('마지막 프레임이 준비되지 않았거나 사용할 수 없습니다. 작업을 다시 조회해주세요.')
      }
      const link = await api.issueMediaLink(media.media_id)
      if (!safeUrl(link.url ?? '')) throw new Error('마지막 프레임 링크가 유효하지 않습니다.')
      workspace.set({
        continuation: { jobId, mediaId: media.media_id, projectId, previewUrl: link.url! },
      })
    },
    [api],
  )

  const applyContinuation = useCallback(
    async ({ managed, file }: { managed: boolean; file?: File | null }) => {
      const source = useWorkspaceStore.getState().continuation
      if (!source) return
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 적용해주세요.')
        workspace.bumpUploads(1)
      try {
        const blob = file || (await api.downloadMedia(source.mediaId))
        if (!isAllowedMime(IMAGE_MIMES, blob.type) || !blob.size || blob.size > 30 * 1024 * 1024) {
          throw new Error('30 MiB 이하의 지원되는 이미지 파일을 선택해주세요.')
        }
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[
          blob.type
        ] || 'image'
        const uploadFile = new File([blob], `last-frame-${source.jobId}.${extension}`, { type: blob.type })
        const result = await api.uploadReference(uploadFile, managed ? 'managed' : 'file')
        if (!result.reference || !validRef(result.reference)) throw new Error('업로드 참조를 받지 못했습니다.')
        if (source.projectId !== useProjectStore.getState().activeProjectId) {
          throw new Error('프로젝트가 변경되어 첫 프레임을 적용하지 않았습니다.')
        }
        workspace.clearReferences()
        workspace.set({
          imageUrl: result.reference,
          imagePerson: managed,
          useShared: false,
          mode: '',
          ratio: 'adaptive',
          lastFrame: 'true',
          store: 'true',
          refOpen: true,
          firstFramePreview: source.previewUrl,
          continuation: null,
        })
        navigate('/')
        try {
          await rememberImage(uploadFile, result.reference!, managed ? 'managed' : 'file', source.projectId)
        } catch (storageError) {
          toast(`원본의 브라우저 보관에는 실패했습니다. ${(storageError as Error).message}`, true)
        }
        toast(
          '마지막 프레임을 다음 영상의 첫 프레임으로 적용했습니다. 기존 장면 참조를 비우고 공통 이미지 적용을 껐습니다. 아직 영상 생성 요청은 보내지 않았습니다.',
        )
      } finally {
        useWorkspaceStore.getState().bumpUploads(-1)
      }
    },
    [api, navigate],
  )

  const cancelContinuation = useCallback(() => {
    useWorkspaceStore.getState().set({ continuation: null })
  }, [])

  const value = useMemo(
    () => ({
      generate,
      lookup,
      stop,
      startPolling,
      showMedia,
      refreshLink,
      addVideoRef,
      restoreRequest,
      prepareContinuation,
      applyContinuation,
      cancelContinuation,
    }),
    [
      addVideoRef,
      applyContinuation,
      cancelContinuation,
      generate,
      lookup,
      prepareContinuation,
      refreshLink,
      restoreRequest,
      showMedia,
      startPolling,
      stop,
    ],
  )

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>
}
