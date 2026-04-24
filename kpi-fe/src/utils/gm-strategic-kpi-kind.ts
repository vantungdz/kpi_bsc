import type { GmStrategicKpiKind } from '@/types/gm-workspace'

/** Chuẩn hoá loại KPI từ payload (hỗ trợ legacy `independent` / `direct`). */
export function normalizeStrategicKpiKind(raw: unknown): GmStrategicKpiKind {
  if (raw === 'cascading' || raw === 'individual' || raw === 'promotion') return raw
  if (raw === 'independent') return 'individual'
  if (raw === 'direct') return 'promotion'
  return 'cascading'
}
