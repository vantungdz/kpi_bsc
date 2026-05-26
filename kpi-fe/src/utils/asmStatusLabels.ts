import type { SysStatusCode } from '@/types/kpi'

/** Map `sys_status_codes.code` → `description` (category ASM_STATUS). */
export function buildAsmStatusDescriptionMap(
  rows: SysStatusCode[] | null | undefined,
): Record<number, string> {
  const descMap: Record<number, string> = {}
  for (const row of rows ?? []) {
    const c = Number(row?.code)
    if (!Number.isFinite(c)) continue
    const d = String(row?.description ?? '').trim()
    if (d) descMap[c] = d
  }
  return descMap
}

/** Ưu tiên mô tả từ dòng KPI/API, sau đó bảng ASM từ init. */
export function resolveAsmStatusLabel(
  statusCode: unknown,
  descriptionByCode: Record<number, string>,
  item?: {
    statusDesc?: string | null
    statusDescription?: string | null
    statusName?: string | null
  },
): string {
  const direct = item
    ? String(item.statusDesc ?? item.statusDescription ?? item.statusName ?? '').trim()
    : ''
  if (direct) return direct
  const code = Number(statusCode)
  if (!Number.isFinite(code) || code <= 0) return ''
  const fromDb = String(descriptionByCode[code] ?? '').trim()
  return fromDb || String(code)
}
