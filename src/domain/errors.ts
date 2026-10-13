/** 오류 코드별 안내. 렛서 문서의 오류 처리·Jobs·References·Media Links 표 기준입니다. */
const CODE_HINTS: Record<string, string> = {
  invalid_credentials: 'API 키 값과 Authorization: Bearer 형식을 확인하세요.',
  missing_credentials: 'API 키 값과 Authorization: Bearer 형식을 확인하세요.',
  api_key_expired: 'API 키가 만료되었습니다. 사용할 수 있는 키로 바꿔주세요.',
  insufficient_units: '보유 유닛이 부족하거나 호출이 차단된 상태입니다. 유닛 화면을 확인하세요. 시간이 지나도 자동으로 풀리지 않으니 반복하지 마세요.',
  ip_not_allowed: '이 API 키의 IP 허용 목록에 현재 출발지 IP가 없습니다. 키의 보안 설정을 확인하세요.',
  policy_limit_exceeded: '키 또는 구성원 월 한도 정책에 걸렸습니다. 한도와 사용량을 확인하세요. 반복해서 보내지 마세요.',
  usage_limit_exceeded: '이 API 키의 월 사용 한도에 도달했습니다. 한도를 확인하세요. 반복해서 보내지 마세요.',
  rate_limit_exceeded: '요청이 너무 잦습니다. 간격을 두고 다시 시도하세요.',
  queue_full: '대기열이 가득 찼습니다. 요청은 접수되지 않았으니 안내된 시간 뒤에 다시 시도하세요.',
  invalid_parameter: '요청 필드를 확인하세요. 시안은 480p, 확정은 1080p만 사용하고, 확정 요청에는 프롬프트·길이·비율 등을 넣지 않습니다.',
  validation_error: '요청 필드를 확인하세요. 시안은 480p, 확정은 1080p만 사용하고, 확정 요청에는 프롬프트·길이·비율 등을 넣지 않습니다.',
  model_not_found: '모델 코드와 이 스페이스의 이용 권한을 에셋 화면에서 확인하세요.',
  service_error: '게이트웨이 오류입니다. 생성 요청이었다면 접수됐을 수 있으니 다시 보내기 전에 접수 여부를 확인하세요.',
  proxy_error: '게이트웨이 오류입니다. 생성 요청이었다면 접수됐을 수 있으니 다시 보내기 전에 접수 여부를 확인하세요.',
  service_timeout: '게이트웨이 응답 시간이 초과되었습니다. 생성 요청이었다면 접수됐을 수 있으니 다시 보내기 전에 접수 여부를 확인하세요.',
  job_not_found: '작업 ID가 접수 응답의 값인지, 작업을 만든 스페이스의 키인지 확인하세요.',
  result_unavailable: '결과 조회가 일시적으로 불가합니다. 생성 실패가 아니니 같은 작업 ID로 다시 조회하세요.',
  REFERENCE_UPLOAD_REJECTED: '파일 형식(MIME)과 종류별 크기 제한을 확인하세요.',
  REFERENCE_TOO_LARGE: '파일이 업로드 상한(200 MiB)을 넘었습니다.',
  REFERENCE_UPLOAD_UNAVAILABLE: '지금은 업로드를 사용할 수 없습니다. 잠시 뒤 다시 시도하세요.',
  MEDIA_NOT_FOUND: '미디어 ID와 API 키의 스페이스를 확인하세요.',
  MEDIA_NOT_READY: '결과 파일을 준비하고 있습니다. 잠시 뒤 다시 확인하세요.',
  MEDIA_UNAVAILABLE: '지금은 링크를 발급할 수 없습니다. 잠시 뒤 다시 시도하세요.',
  MEDIA_RETENTION_EXPIRED: '파일 보관기한이 지나 새 링크를 발급할 수 없습니다. 이미 받아 둔 사본을 확인하세요.',
  MEDIA_LINK_EXPIRED: '링크 서명이 만료되었습니다. 파일 보관기간 안이면 링크를 다시 발급하세요.',
  MEDIA_NOT_STORED: '파일 사본을 사용할 수 없습니다. 작업 ID와 오류 정보로 문의하세요.',
}

/** HTTP 상태와 오류 코드별 확인·조치 안내 (가이드 §8, 렛서 오류 처리 문서) */
export function httpHint(status: number, code?: string, raw = '') {
  if (code && CODE_HINTS[code]) return CODE_HINTS[code]
  if (/queue_full/.test(raw)) return CODE_HINTS.queue_full
  switch (status) {
    case 400:
      return CODE_HINTS.invalid_parameter
    case 401:
      return CODE_HINTS.invalid_credentials
    case 402:
      return CODE_HINTS.insufficient_units
    case 403:
      return '이 키로 허용되지 않은 요청입니다. 키의 IP 허용 목록과 스페이스 설정을 확인하세요.'
    case 404:
      return '모델명·이용 권한·파일 또는 작업 ID와 스페이스를 확인하세요.'
    case 410:
      return '링크 또는 파일 보관기한이 만료되었습니다. 링크만 만료됐다면 다시 발급하고, 파일이 만료됐다면 더 이상 받을 수 없습니다.'
    case 413:
      return CODE_HINTS.REFERENCE_TOO_LARGE
    case 429:
      return '한도에 걸렸습니다. 사용량·월 한도를 확인하세요. 자동으로 재시도하지 않습니다.'
    case 502:
    case 504:
      return CODE_HINTS.service_error
    case 503:
      return '서비스가 일시적으로 응답하지 않습니다. 잠시 뒤 다시 조회하세요.'
    default:
      return ''
  }
}

export function describeError(error: unknown) {
  const e = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>
  const lines: string[] = []
  const labels: Array<[string, string]> = [
    ['title', '오류'],
    ['message', '메시지'],
    ['detail', '상세'],
    ['type', '오류 유형'],
    ['code', '오류 코드'],
    ['vendor_code', '공급사 코드'],
    ['error_ref', '문의 참조'],
  ]
  for (const [key, label] of labels) {
    const value = e[key]
    if (value !== undefined && value !== null && value !== '') {
      lines.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    }
  }

  const raw = JSON.stringify(e)
  if (/AspectRatioTooLarge|AspectRatioTooSmall/.test(raw)) {
    lines.push(
      '참조 이미지의 가로세로 비율이 공급사 자산 등록 조건을 벗어났습니다. 생성 영상의 화면 비율이 아니라 원본 이미지의 비율을 확인하세요. 이미지를 자르거나 여백을 추가해 비율을 바꾼 뒤 다시 업로드하고, 기존 참조도 새 참조로 교체해주세요. 같은 비율로 해상도만 줄이면 해결되지 않습니다. 정확한 허용 범위는 해당 공급사 등록 경로에서 확인해야 합니다.',
    )
    return lines.join('\n')
  }
  if (e.vendor_code === 'InputImageSensitiveContentDetected.PrivacyInformation') {
    lines.push(
      '원인: 공급사가 입력 이미지의 개인정보 관련 콘텐츠를 감지하여 거절했습니다. 응답만으로 어느 부분이 문제인지는 알 수 없습니다. 같은 요청을 그대로 재전송하지 마세요. 인물 참조라면 문서에 맞게 관리형 업로드를 사용해야 하지만, 관리형도 콘텐츠 심사를 면제하지 않습니다. 사용할 권한이 있는 다른 적합한 자료를 선택하거나 작업 ID로 지원에 문의하세요.',
    )
  } else if (/vendor|reject/i.test(raw)) {
    lines.push(
      '공급사 거절만으로 렛서 장애인지 확정할 수 없습니다. 인물 참조의 관리형 업로드 여부, 입력 조합, 파일 조건과 콘텐츠 심사를 확인하세요. 상세 사유가 없거나 올바른 입력에서도 반복되면 작업 ID와 위 오류 내용을 렛서 지원에 전달하세요.',
    )
  }
  return lines.join('\n') || '요청 처리에 실패했습니다. 서버 응답을 확인해주세요.'
}
