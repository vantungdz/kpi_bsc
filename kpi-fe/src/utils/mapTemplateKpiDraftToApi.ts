import type { GmCreateKpiTemplateItemBody, GmUpdateKpiTemplateItemBody } from '@/types/gm-kpi-template'
import {
  strategicKpiKindFromCreatePayload,
  typeCodeFromStrategicKpiKind,
} from '@/utils/strategicKpiTypeCodes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function resolveTypeCode(payload: Record<string, unknown>): number {
  const tc = payload.typeCode
  if (typeof tc === 'number' && Number.isFinite(tc)) return tc
  if (typeof tc === 'string' && /^\d+$/.test(tc.trim())) return Number.parseInt(tc.trim(), 10)
  return typeCodeFromStrategicKpiKind(strategicKpiKindFromCreatePayload(payload))
}

function resolveUnitCode(payload: Record<string, unknown>): number {
  const u = payload.unitCode
  if (typeof u === 'number' && Number.isFinite(u)) return u
  return Number.parseInt(String(u ?? '').trim(), 10)
}

function resolveWeightNumber(payload: Record<string, unknown>): number {
  const wRaw = payload.weightPct
  if (typeof wRaw === 'number' && Number.isFinite(wRaw)) return wRaw
  const n = Number.parseFloat(String(wRaw ?? '').replace(/%/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function resolveTargetValue(payload: Record<string, unknown>): number | null {
  const kind = strategicKpiKindFromCreatePayload(payload)
  if (kind !== 'cascading') return null
  const tv = payload.targetValue
  if (tv === null || tv === undefined || tv === '') return null
  if (typeof tv === 'number' && Number.isFinite(tv)) return tv
  const n = Number.parseFloat(String(tv).trim())
  return Number.isFinite(n) ? n : null
}

/** Body POST `/kpi/gm/kpi-templates/:id/items` từ payload drawer (đồng bộ BE). */
export function mapDraftPayloadToCreateTemplateItemBody(
  payload: Record<string, unknown>,
): GmCreateKpiTemplateItemBody {
  const perspective = String(payload.perspective ?? '').trim()
  if (!UUID_RE.test(perspective)) {
    throw new Error('Chọn nhóm KPI (UUID kpi_categories) trước khi lưu.')
  }
  const unitCode = resolveUnitCode(payload)
  if (!Number.isFinite(unitCode)) {
    throw new Error('Đơn vị KPI (unitCode) không hợp lệ.')
  }
  const defaultWeight = resolveWeightNumber(payload)
  if (defaultWeight <= 0) {
    throw new Error('Trọng số phải > 0.')
  }
  return {
    kpiName: String(payload.kpiName ?? '').trim(),
    perspective,
    typeCode: resolveTypeCode(payload),
    unitCode,
    calculationMethod:
      String(payload.calculationMethod ?? 'mean_actual_plan').trim() || 'mean_actual_plan',
    defaultTargetValue: resolveTargetValue(payload),
    defaultWeight,
  }
}

/** Body PUT item — gửi đủ trường để BE merge (partial theo từng field null trên server; BE hiện merge đầy đủ từ payload có mặt). */
export function mapDraftPayloadToUpdateTemplateItemBody(
  payload: Record<string, unknown>,
): GmUpdateKpiTemplateItemBody {
  const perspective = String(payload.perspective ?? '').trim()
  if (!UUID_RE.test(perspective)) {
    throw new Error('Nhóm KPI (perspective) không hợp lệ.')
  }
  const unitCode = resolveUnitCode(payload)
  if (!Number.isFinite(unitCode)) {
    throw new Error('Đơn vị KPI (unitCode) không hợp lệ.')
  }
  const defaultWeight = resolveWeightNumber(payload)
  if (defaultWeight <= 0) {
    throw new Error('Trọng số phải > 0.')
  }
  return {
    kpiName: String(payload.kpiName ?? '').trim(),
    perspective,
    typeCode: resolveTypeCode(payload),
    unitCode,
    calculationMethod:
      String(payload.calculationMethod ?? 'mean_actual_plan').trim() || 'mean_actual_plan',
    defaultTargetValue: resolveTargetValue(payload),
    defaultWeight,
  }
}
