import type { GmStrategicKpiKind } from '@/types/gm-workspace'

/** 102 TEAM → UI «Cascading»; 101 INDIVIDUAL; 103 PROMOTION — đồng bộ BE diagnostics. */
export function strategicKpiKindFromTypeCode(code: number | null | undefined): GmStrategicKpiKind {
  if (code === 102) return 'cascading'
  if (code === 103) return 'promotion'
  if (code === 101) return 'individual'
  return 'cascading'
}

export function typeCodeFromStrategicKpiKind(kind: GmStrategicKpiKind): number {
  if (kind === 'cascading') return 102
  if (kind === 'promotion') return 103
  return 101
}

/**
 * Loại KPI từ payload tạo/sửa — ưu tiên `typeCode` (101/102/103); fallback chuỗi legacy `kpiType` nếu còn.
 */
export function strategicKpiKindFromCreatePayload(payload: Record<string, unknown>): GmStrategicKpiKind {
  const tc = payload.typeCode
  if (typeof tc === 'number' && Number.isFinite(tc)) {
    return strategicKpiKindFromTypeCode(tc)
  }
  if (typeof tc === 'string' && /^\d+$/.test(tc.trim())) {
    return strategicKpiKindFromTypeCode(Number.parseInt(tc.trim(), 10))
  }
  const raw = payload.kpiType
  if (raw === 'cascading' || raw === 'individual' || raw === 'promotion') return raw
  if (raw === 'independent') return 'individual'
  if (raw === 'direct') return 'promotion'
  return 'cascading'
}

/** Icon Font Awesome theo mã loại (giữ layout cũ). */
export function strategicKpiTypeIconClass(code: number): string {
  if (code === 102) return 'fas fa-code-branch text-xs text-blue-600'
  if (code === 103) return 'fas fa-user-plus text-xs text-purple-600'
  return 'fas fa-crosshairs text-xs text-slate-600'
}
