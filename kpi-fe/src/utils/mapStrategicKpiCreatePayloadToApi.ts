/**
 * Chuyển payload emit từ `GmCreateStrategicKpiModal` → body `POST /kpi/gm/strategic-kpis`
 * (đồng bộ `CreateStrategicKpiRequest` Java, bỏ field chỉ dùng FE).
 */
export function mapStrategicKpiCreatePayloadToApi(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const typeCodeRaw = payload.typeCode
  const typeCode =
    typeof typeCodeRaw === 'number' && Number.isFinite(typeCodeRaw)
      ? typeCodeRaw
      : Number.parseInt(String(typeCodeRaw ?? ''), 10)

  const unitRaw = payload.unitCode
  const unitCode =
    typeof unitRaw === 'number' && Number.isFinite(unitRaw)
      ? unitRaw
      : Number.parseInt(String(unitRaw ?? ''), 10)

  const wRaw = payload.weightPct
  let weightPct: number
  if (typeof wRaw === 'number' && Number.isFinite(wRaw)) {
    weightPct = wRaw
  } else {
    weightPct = Number.parseFloat(String(wRaw ?? '').replace(/%/g, '').trim())
  }
  if (!Number.isFinite(weightPct)) {
    weightPct = 0
  }

  const tv = payload.targetValue
  let targetValue: number | null = null
  if (tv === null || tv === undefined || tv === '') {
    targetValue = null
  } else if (typeof tv === 'number' && Number.isFinite(tv)) {
    targetValue = tv
  } else {
    const n = Number.parseFloat(String(tv).trim())
    targetValue = Number.isFinite(n) ? n : null
  }

  const td = payload.targetDescription
  let targetDescription: unknown = null
  if (td != null && typeof td === 'object' && !Array.isArray(td)) {
    const o = td as Record<string, unknown>
    const raw = String(o.rawInput ?? '').trim()
    if (raw !== '') {
      targetDescription = {
        rawInput: o.rawInput,
        rules: Array.isArray(o.rules) ? o.rules : [],
      }
    }
  }

  const cycleId = String(payload.cycleId ?? '').trim()

  const body: Record<string, unknown> = {
    cycleId: cycleId || null,
    typeCode,
    perspective: payload.perspective,
    kpiName: String(payload.kpiName ?? '').trim(),
    targetDescription,
    targetValue,
    unitCode,
    weightPct,
    calculationMethod: String(payload.calculationMethod ?? 'mean_actual_plan').trim() || 'mean_actual_plan',
    isImportant: payload.isImportant === true,
  }

  if (typeCode === 102) {
    body.assignPMs = Array.isArray(payload.assignPMs) ? [...payload.assignPMs] : []
    const pm = payload.pmTargets
    body.pmTargets =
      pm && typeof pm === 'object' && !Array.isArray(pm) ? { ...(pm as Record<string, unknown>) } : {}
  } else {
    body.memberIds = Array.isArray(payload.memberIds) ? [...payload.memberIds] : []
  }

  return body
}
