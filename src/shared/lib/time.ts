/** API 시각 값(Unix 초·밀리초 또는 ISO 문자열)을 표시용 문자열로 바꿉니다. */
export function formatTimestamp(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  const ms =
    typeof value === 'number'
      ? value < 1e12
        ? value * 1000
        : value
      : /^\d+$/.test(value)
        ? Number(value) * (value.length <= 10 ? 1000 : 1)
        : Date.parse(value)
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR')
}
