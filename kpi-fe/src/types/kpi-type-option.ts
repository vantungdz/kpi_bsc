/** Một dòng `GET /kpi/reference/kpi-types-strategic` — `sys_status_codes` category KPI_TYPE. */
export interface KpiTypeOption {
  code: number
  name: string
  description: string
}

/** Nhãn loại KPI — ưu tiên `description` trong `sys_status_codes`. */
export function kpiTypeDisplayLabel(row: {
  description?: string | null
  name?: string | null
}): string {
  const desc = String(row.description ?? '').trim()
  if (desc) return desc
  const name = String(row.name ?? '').trim()
  return name || '—'
}
