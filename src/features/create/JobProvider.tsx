import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { GenerationRequest, MediaBinding, ResultMedia, VideoGenerationRequest } from '@/api/types'
import { asGenerationRequest, isFinalizeRequest } from '@/api/types'
import { GatewayApiError, isMediaNotReady, isRetryableRateLimit } from '@/api/errors'
import { currentVideoApi, videoApiForMedia } from '@/api'
import { GATEWAYS } from '@/api/gateway'
import { IMAGE_MIMES, PREVIEW_MAX_CANDIDATES, REF_LIMITS, isAllowedMime } from '@/config/constants'
import { describeError } from '@/domain/errors'
import { capabilitiesFor, modelCapabilities, type ModelSpec } from '@/domain/models'
import { estimateGeneration, formatEstimate } from '@/domain/pricing'
import {
  buildFinalizePayload,
  buildPayload,
  captureBindings,
  finalizeBlocker,
  isPreviewRecord,
  validateDraftInputs,
  validateFinalizePayload,
  validatePayload,
  type FinalizeOptions,
} from '@/domain/seedance'
import { formatUsage } from '@/domain/usage'
import { playableUrl, safeUrl, validRef } from '@/shared/lib/url'
import { rememberImage } from '@/storage/imageRepository'
import { useProjectStore } from '@/stores/projectStore'
import { useSessionStore } from '@/stores/sessionStore'
import { toast } from '@/stores/toastStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { currentDraft, currentModel } from '@/features/create/draft'
import { JobContext } from '@/features/create/jobContext'
import {
  fetchJobOnce,
  gatewayOfJob,
  isWatchActive,
  onJobWatch,
  rememberJob,
  stopWatching,
  useJobWatchStore,
  videoApiForJob,
  watchJob,
  type JobWatch,
} from '@/features/jobs/jobWatcher'

const statusLabel: Record<string, string> = {
  queued: '대기 중',
  running: '생성 중',
  succeeded: '생성 완료',
  failed: '실패',
}

/** Retry-After 없이 재시도 가능한 429를 받았을 때 기다릴 시간 */
const RATE_LIMIT_FALLBACK_MS = 10_000

function findRecord(id: string) {
  return useProjectStore.getState().records.find((item) => item.id === id)
}

/** 접수됐는지 확인할 수 없는 실패인지, 거절이 확정된 실패인지 구분합니다 (가이드 §8 재시도 판단). */
function classifySubmitError(err: GatewayApiError) {
  if (err.status === 400) return { status: '입력 거절', extra: '\n요청은 접수되지 않았습니다. 입력을 수정한 뒤 다시 요청해주세요.' }
  if (isRetryableRateLimit(err)) {
    return {
      status: err.code === 'rate_limit_exceeded' ? '요청 간격 제한' : '대기열 가득 참',
      extra: `\n요청은 접수되지 않았습니다. ${Math.round((err.retry ?? RATE_LIMIT_FALLBACK_MS) / 1000)}초 뒤 다시 요청할 수 있습니다.`,
    }
  }
  if (err.status !== undefined && err.status >= 400 && err.status < 500) {
    return { status: '요청 거절', extra: '\n요청은 접수되지 않았습니다. 안내에 따라 확인한 뒤 다시 요청해주세요.' }
  }
  return {
    status: '접수 확인 필요',
    extra:
      err.gateway === 'openrouter' || (!err.gateway && useSessionStore.getState().gateway === 'openrouter')
        ? '\n접수 여부를 알 수 없습니다. 다시 보내면 중복 생성·과금될 수 있어 자동 재전송하지 않습니다. OpenRouter 활동 기록(Activity)에서 접수 여부를 확인하세요.'
        : '\n접수 여부를 알 수 없습니다. 다시 보내면 중복 생성·과금될 수 있어 자동 재전송하지 않습니다. 요청 시각과 모델명으로 렛서 담당자에게 접수 여부를 확인하세요(‘문의용 정보 복사’).',
  }
}

/** 이전 결과 영상을 참조로 다시 보내려면 게이트웨이가 공개 HTTPS 링크를 줘야 합니다. */
async function shareableVideoUrl(mediaId: string) {
  const link = await videoApiForMedia(mediaId).issueMediaLink(mediaId)
  const url = safeUrl(link.url ?? '')
  if (url) return url
  throw new Error(
    link.url?.startsWith('blob:')
      ? 'OpenRouter가 이 결과의 공개 링크를 주지 않아 영상 참조로 보낼 수 없습니다. 영상을 내려받아 HTTPS로 올린 뒤 URL을 입력해주세요.'
      : '이전 영상의 링크 발급에 실패했습니다.',
  )
}

export function JobProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  const showMedia = useCallback((url: string, kind: string, mediaId = '') => {
    useWorkspaceStore.getState().set({ preview: { url, kind, mediaId } })
  }, [])

  /** 현재 화면에 띄운 작업의 조회 결과를 결과 패널에 반영합니다. */
  const renderWatch = useCallback(
    (watch: JobWatch) => {
      const workspace = useWorkspaceStore.getState()
      const job = watch.job
      const patch: Partial<ReturnType<typeof useWorkspaceStore.getState>> = { polling: isWatchActive(watch) }
      if (watch.raw) patch.rawResponse = watch.raw
      if (job) {
        const record = findRecord(watch.id)
        patch.status = statusLabel[job.status] || job.status
        patch.cost = formatUsage(record?.usage)
        patch.media = job.result?.media ?? []
        if (job.status === 'succeeded') {
          const readyVideo = patch.media.find((item) => item.kind === 'video' && item.state === 'ready' && item.url)
          const safe = readyVideo?.url ? playableUrl(readyVideo.url) : null
          if (safe && readyVideo && workspace.preview?.mediaId !== readyVideo.media_id) {
            patch.preview = { url: safe, kind: readyVideo.kind, mediaId: readyVideo.media_id }
          }
        }
      }
      workspace.set(patch)

      if (job?.status === 'failed') {
        workspace.setNotice(describeError(job.error), true)
      } else if (watch.message) {
        workspace.setNotice(watch.message, watch.messageIsError)
      } else if (watch.phase === 'polling' && watch.nextAt) {
        const seconds = Math.max(1, Math.round((watch.nextAt - Date.now()) / 1000))
        workspace.setNotice(`작업 ${watch.id} · ${seconds}초 뒤 진행 상태를 다시 확인합니다.`)
      } else if (watch.phase === 'stopped') {
        workspace.setNotice('자동 조회를 멈췄습니다. 영상 생성이 취소된 것은 아닙니다.')
      }
    },
    [],
  )

  useEffect(
    () =>
      onJobWatch((watch, event) => {
        const current = useWorkspaceStore.getState().jobId === watch.id
        if (current) renderWatch(watch)
        if (event === 'settled' && watch.job?.status === 'failed') {
          toast(current ? describeError(watch.job.error) : `작업 ${watch.id} 생성 실패`, true)
        } else if (event === 'settled' && !current && watch.job?.status === 'succeeded') {
          toast(isPreviewRecord(findRecord(watch.id)) ? '시안 생성 완료 · 시안 비교에서 확인하세요.' : `작업 ${watch.id} 생성 완료`)
        } else if ((event === 'error' || event === 'timeout') && current) {
          toast(watch.message.split('\n')[0], event === 'error')
        }
      }),
    [renderWatch],
  )

  /** 결과 패널에 이 작업을 띄우고 자동 조회를 시작합니다. 다른 작업의 조회는 계속됩니다. */
  const focusJob = useCallback(
    (id: string) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.jobId !== id) {
        workspace.set({
          lastSubmission: null,
          jobId: id,
          media: [],
          preview: null,
          status: '조회 중',
          cost: formatUsage(findRecord(id)?.usage),
          rawResponse: '아직 응답이 없습니다.',
        })
      }
      const existing = useJobWatchStore.getState().watches[id]
      if (existing) renderWatch(existing)
      else workspace.setNotice(`작업 ${id} 상태를 확인하고 있습니다…`)
      watchJob(id)
      renderWatch(useJobWatchStore.getState().watches[id]!)
    },
    [renderWatch],
  )

  const startPolling = useCallback(
    (id: string) => {
      navigate('/')
      focusJob(id)
    },
    [focusJob, navigate],
  )

  const stop = useCallback(() => {
    const id = useWorkspaceStore.getState().jobId.trim()
    if (id) stopWatching(id)
    useWorkspaceStore.getState().set({ polling: false })
  }, [])

  const lookup = useCallback(() => {
    const id = useWorkspaceStore.getState().jobId.trim()
    if (!id) {
      useWorkspaceStore.getState().setNotice('조회할 작업 ID를 입력해주세요.', true)
      toast('조회할 작업 ID를 입력해주세요.', true)
      return
    }
    useWorkspaceStore.getState().set({ jobId: id })
    startPolling(id)
  }, [startPolling])

  const refreshReferenceLinks = useCallback(
    async (payload: GenerationRequest) => {
      const workspace = useWorkspaceStore.getState()
      const next = { ...payload, references: payload.references ? [...payload.references] : undefined }
      const bindings = captureBindings(currentDraft())
      for (const binding of bindings) {
        const url = await shareableVideoUrl(binding.media_id)
        if (next.references?.[binding.index]) next.references[binding.index] = { ...next.references[binding.index], url }
        const scene = workspace.references[binding.index]
        if (scene) workspace.updateReference(scene.id, { url })
      }
      return next
    },
    [],
  )

  /** 요청 한 건을 보내고 기록합니다. 실패하면 문의용 정보를 남기고 오류를 그대로 던집니다. */
  const submit = useCallback(
    async (payload: VideoGenerationRequest, projectId: string, bindings: MediaBinding[]) => {
      const at = new Date().toISOString()
      const api = currentVideoApi()
      try {
        const json = await api.createJob(payload)
        if (typeof json.id !== 'string' || !json.id) {
          throw new GatewayApiError('접수 응답에 작업 ID가 없습니다. 실제 접수 여부를 확인해주세요.', { payload: json })
        }
        useProjectStore.getState().upsertRecord({
          id: json.id,
          gateway: api.gateway,
          project_id: projectId,
          created_at: at,
          updated_at: at,
          status: 'queued',
          request: payload,
          bindings,
          media: [],
        })
        return { id: json.id, raw: JSON.stringify(json, null, 2) }
      } catch (error) {
        const err = error instanceof GatewayApiError ? error : new GatewayApiError((error as Error).message)
        useWorkspaceStore.getState().set({
          lastSubmission: {
            gateway: api.gateway,
            at,
            endpoint: api.gateway === 'openrouter' ? 'POST /api/v1/videos' : 'POST /v1/video/generations',
            body: payload,
            status: err.status,
            code: err.code,
            ref: err.ref,
            message: err.message,
          },
          ...(isRetryableRateLimit(err)
            ? { submitBlock: { at: Date.now(), until: Date.now() + (err.retry ?? RATE_LIMIT_FALLBACK_MS) } }
            : {}),
        })
        throw err
      }
    },
    [],
  )

  const generate = useCallback(async () => {
    const workspace = useWorkspaceStore.getState()
    if (workspace.submitting || workspace.uploads) return
    workspace.set({ notice: '', noticeError: false })
    let payload: GenerationRequest
    let spec: ModelSpec
    try {
      const draft = currentDraft()
      spec = draft.spec
      payload = validatePayload(buildPayload(draft), spec)
      validateDraftInputs(draft)
      if (!useSessionStore.getState().apiKey.trim()) throw new Error('API 키를 입력해주세요.')
      const wait = (workspace.submitBlock?.until ?? 0) - Date.now()
      if (wait > 0) throw new Error(`대기열이 가득 차 있습니다. ${Math.ceil(wait / 1000)}초 뒤 다시 요청해주세요.`)
    } catch (error) {
      const message = (error as Error).message
      workspace.set({ notice: message, noticeError: true })
      toast(message, true)
      return
    }

    const count = payload.draft ? Math.min(PREVIEW_MAX_CANDIDATES, Math.max(1, workspace.previewCount)) : 1
    if (count > 1) {
      const estimate = estimateGeneration(payload)
      const costText = estimate.ok ? `예상 비용 ${formatEstimate(estimate.cost * count)} (${count} × ${formatEstimate(estimate.cost)})` : estimate.reason
      if (!confirm(`480p 시안 ${count}개를 각각 요청합니다. 채택하지 않은 시안도 과금됩니다.\n${costText}\n계속할까요?`)) return
    }

    const submittedProjectId = useProjectStore.getState().activeProjectId
    const bindings = captureBindings(currentDraft())
    workspace.set({ submitting: true, status: '접수 중', lastSubmission: null })
    workspace.setNotice(count > 1 ? `시안 ${count}개 요청을 보내고 있습니다…` : '영상 생성 요청을 보내고 있습니다…')
    let sent = false
    const accepted: string[] = []
    try {
      payload = validatePayload(await refreshReferenceLinks(payload), spec)
      sent = true
      for (let index = 0; index < count; index += 1) {
        // 후보마다 같은 시드를 보내면 비교 의미가 없어 1씩 늘립니다.
        const body = payload.seed !== undefined && index ? { ...payload, seed: payload.seed + index } : payload
        const result = await submit(body, submittedProjectId, bindings)
        accepted.push(result.id)
        watchJob(result.id)
        if (index === 0) {
          useWorkspaceStore.getState().set({ rawResponse: result.raw })
          focusJob(result.id)
        }
      }
      useWorkspaceStore.getState().setNotice(
        count > 1
          ? `시안 ${count}개를 접수했습니다. 시안 비교에서 함께 확인하고 마음에 드는 시안을 1080p로 확정하세요.`
          : payload.draft
            ? '480p 시안을 만들고 있습니다. 완료되면 확인 후 1080p로 확정할 수 있습니다.'
            : '장면을 만들고 있습니다. 잠시 기다려주세요.',
      )
    } catch (error) {
      const err = error instanceof GatewayApiError ? error : new GatewayApiError((error as Error).message)
      if (err.payload) useWorkspaceStore.getState().set({ rawResponse: JSON.stringify(err.payload, null, 2) })
      const partial = accepted.length ? `시안 ${accepted.length}개는 접수되었고 나머지는 보내지 않았습니다.\n` : ''
      if (!sent) {
        useWorkspaceStore.getState().set({ status: '참조 준비 실패' })
        useWorkspaceStore
          .getState()
          .setNotice(
            `${err.message}\n새 영상 생성 요청은 전송하지 않았습니다. 보관 만료 시 다운로드해 둔 파일을 다시 업로드해주세요.`,
            true,
          )
      } else {
        const { status, extra } = classifySubmitError(err)
        // 공개 API 문서에는 아직 draft 필드가 없어, 스페이스에 시안 기능이 열리지 않았다면 400이 날 수 있습니다.
        const previewNote =
          payload.draft && err.status === 400 && err.gateway === 'letsur'
            ? '\n시안(draft) 기능이 이 스페이스에 아직 열리지 않았을 수 있습니다. 바로 생성으로 바꾸거나 렛서에 이용 가능 여부를 확인하세요.'
            : ''
        if (!accepted.length) useWorkspaceStore.getState().set({ status })
        useWorkspaceStore.getState().setNotice(partial + err.message + extra + previewNote, true)
      }
      toast(err.message.split('\n')[0], true)
    } finally {
      useWorkspaceStore.getState().set({ submitting: false })
    }
  }, [focusJob, refreshReferenceLinks, submit])

  const finalize = useCallback(
    async (draftJobId: string, options: FinalizeOptions) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 확정해주세요.')
      if (!useSessionStore.getState().apiKey.trim()) throw new Error('API 키를 입력해주세요.')
      const wait = (workspace.submitBlock?.until ?? 0) - Date.now()
      if (wait > 0) throw new Error(`대기열이 가득 차 있습니다. ${Math.ceil(wait / 1000)}초 뒤 다시 요청해주세요.`)
      const payload = validateFinalizePayload(buildFinalizePayload(draftJobId, options))
      const blocker = finalizeBlocker(findRecord(draftJobId))
      if (blocker) throw new Error(blocker)

      workspace.set({ submitting: true, lastSubmission: null })
      try {
        // 원본이 정말 완료된 시안인지 보내기 직전에 확인합니다. 처리 중인 원본은 완료를 기다려야 합니다.
        const job = await fetchJobOnce(draftJobId)
        if (job.status !== 'succeeded') {
          throw new Error(
            job.status === 'failed' ? '실패한 시안은 확정할 수 없습니다.' : '시안 생성이 아직 끝나지 않았습니다. 완료된 뒤 확정해주세요.',
          )
        }
        const projectId = findRecord(draftJobId)?.project_id ?? useProjectStore.getState().activeProjectId
        try {
          const result = await submit(payload, projectId, [])
          watchJob(result.id)
          return result.id
        } catch (error) {
          const err = error as GatewayApiError
          throw new GatewayApiError(err.message + classifySubmitError(err).extra, {
            status: err.status,
            code: err.code,
            ref: err.ref,
            payload: err.payload,
          })
        }
      } finally {
        useWorkspaceStore.getState().set({ submitting: false })
      }
    },
    [submit],
  )

  const refreshLink = useCallback(
    async (media: ResultMedia) => {
      let result
      try {
        result = await videoApiForMedia(media.media_id).issueMediaLink(media.media_id)
      } catch (error) {
        const err = error as GatewayApiError
        if (err.status === 410) {
          throw new Error('파일 보관기한이 지나 더 이상 받을 수 없습니다. 링크를 다시 발급해도 보관기한은 늘어나지 않습니다.', { cause: error })
        }
        if (isMediaNotReady(err)) {
          throw new Error('결과 파일을 아직 복사하고 있습니다. 잠시 뒤 작업을 다시 조회해주세요.', { cause: error })
        }
        throw err
      }
      const url = playableUrl(result.url ?? '')
      if (!url) throw new Error('유효한 HTTPS 미디어 링크가 없습니다.')
      useWorkspaceStore.getState().set({
        media: useWorkspaceStore.getState().media.map((item) =>
          item.media_id === media.media_id
            ? {
                ...item,
                url,
                url_expires_at: result.url_expires_at,
                ...(result.expires_at !== undefined ? { expires_at: result.expires_at } : {}),
                state: 'ready',
              }
            : item,
        ),
      })
      toast('파일 링크가 준비되었습니다.')
      showMedia(url, media.kind, media.media_id)
    },
    [showMedia],
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
      const url = await shareableVideoUrl(media.media_id)
      if (targetProjectId !== useProjectStore.getState().activeProjectId) {
        throw new Error('프로젝트가 변경되어 참조를 추가하지 않았습니다. 현재 프로젝트에서 다시 선택해주세요.')
      }
      navigate('/')
      workspace.addReference({
        type: 'video',
        role: 'reference_video',
        url,
        mediaId: media.media_id,
        status: '이전 생성 영상 · 전송 직전에 링크를 다시 갱신합니다.',
      })
      if (!workspace.mode && modelCapabilities(currentModel()).videoModes) workspace.set({ mode: 'reference' })
      const switched = workspace.generation === 'preview'
      if (switched) workspace.set({ generation: 'direct' })
      toast(
        `이전 영상을 참조로 추가했습니다.${switched ? ' 영상 입력은 시안을 지원하지 않아 바로 생성으로 바꿨습니다.' : ''} 장면 설명을 작성하고 생성하세요.`,
      )
    },
    [navigate],
  )

  const restoreRequest = useCallback(
    (recordId: string) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) {
        toast('현재 요청이 끝난 뒤 설정을 불러와주세요.', true)
        return
      }
      const records = useProjectStore.getState().records
      const record = records.find((item) => item.id === recordId)
      // 확정 기록에는 내용 필드가 없으므로 원본 시안의 요청을 불러옵니다.
      const request = record?.request
      const fromPreview = isFinalizeRequest(request)
      const source = isFinalizeRequest(request) ? records.find((item) => item.id === request.draft_job) : record
      const p = asGenerationRequest(source?.request)
      if (!p) {
        toast(fromPreview ? '원본 시안 기록이 이 기기에 없어 설정을 불러올 수 없습니다.' : '이 기록에는 요청 설정이 없습니다.', true)
        return
      }
      if (!confirm('현재 작성 중인 설정을 이 기록의 설정으로 바꿀까요?')) return
      // 기록을 만든 게이트웨이와 모델로 되돌려야 같은 요청 형식으로 다시 보낼 수 있습니다.
      const sourceGateway = source?.gateway ?? 'letsur'
      const switched = useSessionStore.getState().gateway !== sourceGateway
      if (switched) useSessionStore.getState().setGateway(sourceGateway)
      navigate('/')
      workspace.set({
        firstFramePreview: null,
        useCommon: false,
        useShared: false,
        model: p.model,
        prompt: p.prompt || '',
        imageUrl: p.image_url || '',
        imagePerson: false,
        generation: p.draft ? 'preview' : 'direct',
        previewCount: 1,
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
        const binding = source?.bindings.find((b) => b.index === index)
        workspace.addReference({
          type: ref.type,
          role: ref.role,
          url: binding ? '' : ref.url,
          mediaId: binding?.media_id,
          status: binding ? '이전 생성 영상 · 전송 직전에 최신 링크를 발급합니다.' : '',
        })
      }
      toast(
        `${fromPreview ? '확정 결과의 원본 시안 설정을 불러왔습니다.' : '당시의 전체 요청을 불러왔습니다.'}${switched ? ` 새 요청도 ${GATEWAYS[sourceGateway].label}로 보내도록 게이트웨이를 바꿨습니다.` : ''} 중복 적용을 막기 위해 이번 장면의 공통 설정 적용을 껐습니다.`,
      )
    },
    [navigate],
  )

  const prepareContinuation = useCallback(
    async (jobId: string, mediaId?: string) => {
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 이어 만들기를 선택해주세요.')
      if (!capabilitiesFor(gatewayOfJob(jobId), findRecord(jobId)?.request?.model).lastFrame) {
        throw new Error('이 모델의 결과에는 마지막 프레임 이미지가 없어 이어 만들기를 사용할 수 없습니다.')
      }
      const projectId = useProjectStore.getState().activeProjectId
      workspace.setNotice('마지막 프레임을 확인하고 있습니다…')
      const { job } = await videoApiForJob(jobId).getJob(jobId)
      if (projectId !== useProjectStore.getState().activeProjectId) return
      rememberJob(job, jobId)
      if (job.status !== 'succeeded') throw new Error('생성 완료 후 마지막 프레임을 사용할 수 있습니다.')
      // 배열의 첫 항목이 이미지라고 가정하지 않고 kind로 찾습니다 (가이드 §6.1).
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
      const link = await videoApiForMedia(media.media_id).issueMediaLink(media.media_id)
      if (!safeUrl(link.url ?? '')) throw new Error('마지막 프레임 링크가 유효하지 않습니다.')
      workspace.set({
        continuation: { jobId, mediaId: media.media_id, projectId, previewUrl: link.url! },
      })
    },
    [],
  )

  const applyContinuation = useCallback(
    async ({ managed, file }: { managed: boolean; file?: File | null }) => {
      const source = useWorkspaceStore.getState().continuation
      if (!source) return
      const workspace = useWorkspaceStore.getState()
      if (workspace.submitting || workspace.uploads) throw new Error('현재 요청이 끝난 뒤 적용해주세요.')
      workspace.bumpUploads(1)
      try {
        const blob = file || (await videoApiForMedia(source.mediaId).downloadMedia(source.mediaId))
        if (!isAllowedMime(IMAGE_MIMES, blob.type) || !blob.size || blob.size > 30 * 1024 * 1024) {
          throw new Error('30 MiB 이하의 지원되는 이미지 파일을 선택해주세요.')
        }
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[
          blob.type
        ] || 'image'
        const uploadFile = new File([blob], `last-frame-${source.jobId}.${extension}`, { type: blob.type })
        // 다음 영상은 지금 선택한 게이트웨이로 보내므로 그쪽에 올립니다.
        const api = currentVideoApi()
        const caps = modelCapabilities(currentModel())
        managed = managed && caps.managedUpload
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
          ratio: currentModel().aspectRatios.includes('adaptive') ? 'adaptive' : '',
          lastFrame: caps.lastFrame ? 'true' : '',
          store: caps.storeMedia ? 'true' : '',
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
    [navigate],
  )

  const cancelContinuation = useCallback(() => {
    useWorkspaceStore.getState().set({ continuation: null })
  }, [])

  const value = useMemo(
    () => ({
      generate,
      finalize,
      lookup,
      stop,
      startPolling,
      focusJob,
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
      finalize,
      focusJob,
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
