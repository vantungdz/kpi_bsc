/**
 * Nền dòng KPI theo `roles.code` của người tạo KPI master (đồng bộ GM diagnostics + PM portfolio).
 */
export function kpiCreatorRowBgClass(roleCode?: string | null, expanded = false): string {
  const c = String(roleCode ?? '')
    .trim()
    .toUpperCase()
  switch (c) {
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
