import type { JobRecord, VideoGenerationRequest } from '@/api/types'
import type { SubmissionFailure } from '@/stores/workspaceStore'

/**
 * 문의에 넣어도 되는 형태로 요청 본문을 줄입니다. 렛서 문서는 API 키, 서명 링크, 고객 입력 원문을
 * 문의 내용에 넣지 말라고 안내하므로 프롬프트와 외부·서명 URL은 생략하고 구조만 남깁니다.
 * 업로드 참조(letsur-file://, letsur-asset://)는 서명 링크가 아니므로 진단을 위해 남깁니다.
 */
export function redactRequest(body: VideoGenerationRequest) {
  const redactUrl = (url: string) => (/^letsur-(file|asset):\/\//.test(url) ? url : url ? '[URL 생략]' : '')
  const out: Record<string, unknown> = { ...body }
  if (typeof out.prompt === 'string') out.prompt = `[프롬프트 ${out.prompt.length}자 생략]`
  if (typeof out.image_url === 'string') out.image_url = redactUrl(out.image_url)
  if (Array.isArray(out.references)) {
    out.references = (out.references as Array<{ url: string }>).map((ref) => ({ ...ref, url: redactUrl(ref.url) }))
  }
  return out
}

/**
 * 렛서 문의용 정보 (FAQ·오류 처리 문서): 스페이스 이름, 계정 이메일, 발생 시각, 엔드포인트, HTTP 상태,
 * `type` 또는 `error.code`, `error_ref`, 작업 ID. API 키와 인증 헤더는 넣지 않습니다.
 */
export function inquiryText({ record, failure }: { record?: JobRecord; failure?: SubmissionFailure | null }) {
  const body = failure?.body ?? record?.request ?? null
  const rejected = failure?.status !== undefined && failure.status >= 400 && failure.status < 500
  const missingId = rejected ? '없음 (요청 거절됨 · 접수되지 않음)' : '받지 못함 (접수 여부 확인 필요)'
  const lines = [
    '[Frame · 렛서 문의 정보 · API 키·서명 링크·프롬프트 원문 제외]',
    '스페이스 이름: (직접 입력)',
    '계정 이메일: (직접 입력)',
    `작업 ID: ${record?.id || missingId}`,
    `요청 시각: ${failure?.at ?? record?.created_at ?? '알 수 없음'}`,
    `모델: ${body?.model ?? '알 수 없음'}`,
  ]
  if (failure) {
    lines.push(`엔드포인트: ${failure.endpoint}`)
    lines.push(`HTTP 상태: ${failure.status ?? '응답 없음 (연결 실패·시간 초과)'}`)
    if (failure.code) lines.push(`오류 코드: ${failure.code}`)
    if (failure.ref) lines.push(`error_ref: ${failure.ref}`)
  } else if (record) {
    lines.push(`엔드포인트: GET /v1/jobs/${record.id}`)
    lines.push(`작업 상태: ${record.status}`)
    for (const key of ['type', 'code', 'vendor_code', 'title'] as const) {
      const value = record.error?.[key]
      if (value) lines.push(`error.${key}: ${value}`)
    }
  }
  lines.push('요청 본문 (일부 생략):')
  lines.push(body ? JSON.stringify(redactRequest(body), null, 2) : '(이 기기에 기록 없음)')
  return lines.join('\n')
}
