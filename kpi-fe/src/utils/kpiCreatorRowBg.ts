export type KpiCreatorRoleCode = 'GM' | 'PM' | 'LEADER' | 'MEMBER'

/** Chấm màu + nhãn — đồng bộ với `kpiCreatorRowBgClass`. */
export const KPI_CREATOR_LEGEND_ITEMS: ReadonlyArray<{
  role: KpiCreatorRoleCode
  label: string
  dotClass: string
}> = [
  { role: 'GM', label: 'KPI created by GM', dotClass: 'bg-amber-100 ring-1 ring-amber-200' },
  { role: 'PM', label: 'KPI created by PM', dotClass: 'bg-blue-100 ring-1 ring-blue-200' },
  { role: 'LEADER', label: 'KPI created by Leader', dotClass: 'bg-emerald-100 ring-1 ring-emerald-200' },
  { role: 'MEMBER', label: 'KPI created by Member', dotClass: 'bg-fuchsia-100 ring-1 ring-fuchsia-200' },
] as const

function normalizeCreatorRole(roleCode?: string | null): string {
  return String(roleCode ?? '').trim().toUpperCase()
}

const KNOWN_CREATOR_ROLES = new Set<KpiCreatorRoleCode>(['GM', 'PM', 'LEADER', 'MEMBER'])

export type KpiCreatorSourceFields = {
  createdByCurrentUser?: boolean | null
  createdByRoleCode?: string | null
  creatorRoleCode?: string | null
}

/** Role người tạo KPI master (ưu tiên self khi `createdByCurrentUser`). */
export function resolveKpiCreatorRoleCode(
  source: KpiCreatorSourceFields,
  selfRole?: KpiCreatorRoleCode,
): KpiCreatorRoleCode | null {
  if (source.createdByCurrentUser === true && selfRole) return selfRole
  const code = normalizeCreatorRole(source.creatorRoleCode ?? source.createdByRoleCode)
  if (KNOWN_CREATOR_ROLES.has(code as KpiCreatorRoleCode)) return code as KpiCreatorRoleCode
  return null
}

/** Nền dòng từ assignment; trả về `''` nếu không xác định role (để giữ alert/hover mặc định). */
export function kpiCreatorRowBgFromSource(
  source: KpiCreatorSourceFields,
  options?: { selfRole?: KpiCreatorRoleCode; expanded?: boolean },
): string {
  const role = resolveKpiCreatorRoleCode(source, options?.selfRole)
  if (!role) return ''
  return kpiCreatorRowBgClass(role, options?.expanded ?? false)
}

/** Màu chấm tròn trong legend (cùng tông với nền dòng). */
export function kpiCreatorDotClass(roleCode?: string | null): string {
  const item = KPI_CREATOR_LEGEND_ITEMS.find((x) => x.role === normalizeCreatorRole(roleCode))
  return item?.dotClass ?? 'bg-slate-100 ring-1 ring-slate-200'
}

/**
 * Nền dòng KPI theo `roles.code` của người tạo KPI master (đồng bộ GM diagnostics + PM portfolio).
 */
export function kpiCreatorRowBgClass(roleCode?: string | null, expanded = false): string {
  switch (normalizeCreatorRole(roleCode)) {
    case 'GM':
      return expanded ? 'bg-amber-50' : 'bg-amber-50 hover:bg-amber-100'
    case 'PM':
      return expanded ? 'bg-blue-50' : 'bg-blue-50 hover:bg-blue-100'
    case 'LEADER':
      return expanded ? 'bg-emerald-50' : 'bg-emerald-50 hover:bg-emerald-100'
    case 'MEMBER':
      return expanded ? 'bg-fuchsia-50' : 'bg-fuchsia-50 hover:bg-fuchsia-100'
    default:
      return expanded ? 'bg-slate-100' : 'bg-white hover:bg-slate-100'
  }
}
