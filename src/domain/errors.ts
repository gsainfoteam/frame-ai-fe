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
