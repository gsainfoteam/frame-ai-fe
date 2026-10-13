import type { RawUsage, UsageInfo, UsageItem } from '@/api/types'
import { formatDecimal, isDecimal, normalizeDecimal, sumDecimals } from '@/shared/lib/decimal'

/** 조회 응답의 `usage`를 저장 형태로 바꿉니다. 금액이 없으면 아직 확정되지 않은 것으로 봅니다(무료가 아님). */
export function normalizeUsage(raw: RawUsage | undefined | null): UsageInfo | undefined {
  if (!raw || !isDecimal(raw.amount) || typeof raw.currency !== 'string') return undefined
  const items: UsageItem[] = []
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    if (!item || typeof item !== 'object') continue
    const out: UsageItem = {}
    if (typeof item.unit === 'string') out.unit = item.unit
    if (isDecimal(item.quantity)) out.quantity = normalizeDecimal(item.quantity) ?? undefined
    if (isDecimal(item.unit_price)) out.unit_price = normalizeDecimal(item.unit_price) ?? undefined
    if (Object.keys(out).length) items.push(out)
  }
  return {
    amount: normalizeDecimal(raw.amount)!,
    currency: raw.currency,
    ...(items.length ? { items } : {}),
  }
}

/** `unit`은 가격표의 과금 단위입니다. 원화·USD로 바꾸지 않습니다. */
export function formatAmount(amount: string, currency: string, digits = 4) {
  return `${formatDecimal(amount, digits)} ${currency}`
}

export function formatUsage(usage: UsageInfo | undefined) {
  if (!usage) return '비용 미확정'
  const tokens = usage.items?.find((item) => item.unit === 'token' && item.quantity)
  return `${formatAmount(usage.amount, usage.currency)}${tokens ? ` · ${formatDecimal(tokens.quantity!, 0)} 토큰` : ''}`
}

/** 같은 단위의 청구액만 합산합니다. 하나라도 미확정이거나 단위가 다르면 null입니다. */
export function sumUsage(list: Array<UsageInfo | undefined>): UsageInfo | null {
  if (!list.length || list.some((usage) => !usage)) return null
  const currency = list[0]!.currency
  if (list.some((usage) => usage!.currency !== currency)) return null
  const amount = sumDecimals(list.map((usage) => usage!.amount))
  return amount === null ? null : { amount, currency }
}
