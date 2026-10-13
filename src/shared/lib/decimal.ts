/**
 * 청구액·사용량용 십진수 연산. 문자열로 받은 금액을 부동소수점 오차 없이 더하고 곱합니다.
 * 지수 표기(1e-7)도 받습니다. 해석할 수 없는 값은 null입니다.
 */
type Fixed = { digits: bigint; scale: number }

function parse(value: string | number): Fixed | null {
  let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value.trim()
  const exp = /^([+-]?\d*\.?\d+)[eE]([+-]?\d+)$/.exec(text)
  let shift = 0
  if (exp) {
    text = exp[1]
    shift = Number(exp[2])
  }
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (!match[2] && !match[3])) return null
  const frac = match[3] ?? ''
  let digits = BigInt(`${match[2] || '0'}${frac}`)
  let scale = frac.length - shift
  if (scale < 0) {
    digits *= 10n ** BigInt(-scale)
    scale = 0
  }
  return { digits: match[1] === '-' ? -digits : digits, scale }
}

function align(a: Fixed, scale: number) {
  return a.digits * 10n ** BigInt(scale - a.scale)
}

function stringify({ digits, scale }: Fixed) {
  const negative = digits < 0n
  const abs = (negative ? -digits : digits).toString().padStart(scale + 1, '0')
  const int = abs.slice(0, abs.length - scale)
  const frac = scale ? abs.slice(abs.length - scale).replace(/0+$/, '') : ''
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function isDecimal(value: unknown): value is string | number {
  return (typeof value === 'string' || typeof value === 'number') && parse(value) !== null
}

export function normalizeDecimal(value: string | number): string | null {
  const parsed = parse(value)
  return parsed ? stringify(parsed) : null
}

/** 반올림 없이 합산합니다. 해석할 수 없는 값이 하나라도 있으면 null입니다. */
export function sumDecimals(values: Array<string | number>): string | null {
  const parsed = values.map(parse)
  if (parsed.some((p) => !p)) return null
  const items = parsed as Fixed[]
  const scale = Math.max(0, ...items.map((p) => p.scale))
  return stringify({ digits: items.reduce((sum, p) => sum + align(p, scale), 0n), scale })
}

export function multiplyDecimals(a: string | number, b: string | number): string | null {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return null
  return stringify({ digits: x.digits * y.digits, scale: x.scale + y.scale })
}

/** 표시용 반올림(사사오입). 계산에는 반올림 전 값을 사용합니다. */
export function formatDecimal(value: string, fractionDigits = 2): string {
  const parsed = parse(value)
  if (!parsed) return value
  if (parsed.scale <= fractionDigits) {
    const [int, frac = ''] = stringify(parsed).split('.')
    return `${Number(int).toLocaleString('ko-KR')}${fractionDigits ? `.${frac.padEnd(fractionDigits, '0')}` : ''}`
  }
  const drop = 10n ** BigInt(parsed.scale - fractionDigits)
  const negative = parsed.digits < 0n
  const abs = negative ? -parsed.digits : parsed.digits
  const rounded = (abs + drop / 2n) / drop
  const text = stringify({ digits: negative ? -rounded : rounded, scale: fractionDigits })
  const [int, frac = ''] = text.split('.')
  const intPart = int.startsWith('-') ? `-${Number(int.slice(1)).toLocaleString('ko-KR')}` : Number(int).toLocaleString('ko-KR')
  return `${intPart}${fractionDigits ? `.${frac.padEnd(fractionDigits, '0')}` : ''}`
}
