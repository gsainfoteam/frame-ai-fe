import type { JobRecord } from '@/api/types'
import type { SubmissionFailure } from '@/stores/workspaceStore'

/**
 * 렛서 문의용 정보 (가이드 §8): 작업 ID, 요청 시각, 모델명, 오류 코드, API 키를 뺀 요청 본문.
 * 요청 본문에는 API 키가 들어가지 않습니다(키는 Authorization 헤더로만 보냄).
 */
export function inquiryText({
  jobId,
  record,
  failure,
}: {
  jobId?: string
  record?: JobRecord
  failure?: SubmissionFailure | null
}) {
  const body = failure?.body ?? record?.request ?? null
  const lines = ['[Frame · 렛서 문의 정보 · API 키 제외]']
  const rejected = failure?.status !== undefined && failure.status >= 400 && failure.status < 500
  const missingId = rejected ? '없음 (요청 거절됨 · 접수되지 않음)' : '받지 못함 (접수 여부 확인 필요)'
  lines.push(`작업 ID: ${jobId || record?.id || missingId}`)
  lines.push(`요청 시각: ${failure?.at ?? record?.created_at ?? '알 수 없음'}`)
  lines.push(`모델: ${body?.model ?? '알 수 없음'}`)
  if (failure) {
    lines.push(`HTTP 상태: ${failure.status ?? '응답 없음 (연결 실패·시간 초과)'}`)
    if (failure.code) lines.push(`오류 코드: ${failure.code}`)
    lines.push(`오류 내용: ${failure.message}`)
  }
  if (record?.error) {
    for (const [key, value] of Object.entries(record.error)) {
      if (value) lines.push(`error.${key}: ${value}`)
    }
  }
  if (record?.status) lines.push(`작업 상태: ${record.status}`)
  lines.push('요청 본문:')
  lines.push(body ? JSON.stringify(body, null, 2) : '(이 기기에 기록 없음)')
  return lines.join('\n')
}
