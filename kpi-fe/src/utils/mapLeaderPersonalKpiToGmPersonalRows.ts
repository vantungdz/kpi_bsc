import type { LeaderKpiAssignment, LeaderKpiInformationResponse } from '@/types/kpi'
import type { GmBscPerspective, GmPersonalKpiRowMock, GmStrategicKpiKind } from '@/types/gm-workspace'

/** Loại KPI từ DB (`type_code` + `type_name` từ API leader kpi-info). */
function gmStrategicKpiKindFromDbKpiType(
  typeCode: number | null | undefined,
  typeName: string | null | undefined,
): GmStrategicKpiKind {
  const code = typeof typeCode === 'number' && Number.isFinite(typeCode) ? Math.round(typeCode) : null
  if (code === 103) return 'promotion'
  if (code === 102) return 'cascading'
  if (code === 101) return 'individual'
  const u = String(typeName ?? '').trim().toUpperCase()
  if (u === 'PROMOTION' || u === '103') return 'promotion'
  if (u === 'TEAM' || u === 'CASCADING' || u === '102') return 'cascading'
  if (u === 'INDIVIDUAL' || u === '101') return 'individual'
  return 'individual'
}

/** Fallback khi API cũ không trả typeCode (chỉ theo tham số ?type= của request). */
function gmStrategicKpiKindFromRequestedType(t: string | null | undefined): GmStrategicKpiKind {
  const u = String(t ?? '').trim().toUpperCase()
  if (u === 'PROMOTION') return 'promotion'
  if (u === 'INDIVIDUAL') return 'individual'
  return 'individual'
}

function resolveGmPersonalRowKpiType(
  a: LeaderKpiAssignment,
  requestedType: 'INDIVIDUAL' | 'PROMOTION',
): GmStrategicKpiKind {
  const hasTypeCode = typeof a.typeCode === 'number' && Number.isFinite(a.typeCode)
  const hasTypeName = a.typeName != null && String(a.typeName).trim() !== ''
  if (hasTypeCode || hasTypeName) {
    return gmStrategicKpiKindFromDbKpiType(
      hasTypeCode ? (a.typeCode as number) : null,
      hasTypeName ? String(a.typeName) : null,
    )
  }
  return gmStrategicKpiKindFromRequestedType(requestedType)
}

/** Cột Target trên tab KPI cá nhân GM: chỉ số; không lấy targetDescription (JSON quy tắc chấm điểm). */
function formatPersonalTargetDisplay(a: LeaderKpiAssignment): string {
  const raw = a.targetValue
  if (raw == null || raw === '') return '-'
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).trim())
  if (!Number.isFinite(n)) return '-'
  return String(n)
}

/** Gợi ý nhóm BSC từ tên danh mục (API `kpi_categories.name`). */
function inferBscFromCategoryName(name: string): GmBscPerspective {
  const n = name.toLowerCase()
  if (/financial|tài chính|💰/.test(n)) return 'financial'
  if (/customer|khách hàng|👥/.test(n)) return 'customer'
  if (/learning|đào tạo|growth|phát triển|🎓/.test(n)) return 'learning'
  if (/internal|vận hành|quy trình|nội bộ|⚙️/.test(n)) return 'internal'
  return 'internal'
}

/** Nhãn hiển thị từ join `sys_status_codes` trên API leader (description ưu tiên). */
function assignmentStatusFields(a: LeaderKpiAssignment): {
  assignmentStatusCode: number | null
  assignmentStatusName: string
  assignmentStatusDisplay: string
} {
  const codeRaw = a.statusCode
  const assignmentStatusCode =
    typeof codeRaw === 'number' && Number.isFinite(codeRaw) ? Math.round(codeRaw) : null
  const name = String(a.statusName ?? '').trim()
  const desc = String(a.statusDesc ?? '').trim()
  const assignmentStatusDisplay = desc || name || '—'
  return { assignmentStatusCode, assignmentStatusName: name, assignmentStatusDisplay }
}

function formatFinalScore(a: LeaderKpiAssignment): string {
  if (a.endSelfScore != null) return String(a.endSelfScore)
  if (a.midSelfScore != null) return String(a.midSelfScore)
  return '—'
}

/** Cột Actual tab KPI cá nhân GM — tóm tắt từ JSON `kpi_assignments.evidences` (đồng bộ drawer minh chứng). */
function formatPersonalKpiActualFromEvidences(evidences: string | null | undefined): string {
  const raw = String(evidences ?? '').trim()
  if (!raw || raw === '{}' || raw === 'null') return '—'
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result = String(parsed.result ?? '').trim()
    // Mode 803 (comment): drawer lưu field `actual` (kết quả thực tế nhập tay)
    const actualField = String(parsed.actual ?? '').trim()
    const planActualRecords = Array.isArray(parsed.planActualRecords)
      ? (parsed.planActualRecords as unknown[])
          .map((row) => {
            if (!row || typeof row !== 'object') return ''
            return String((row as Record<string, unknown>).actual ?? '').trim()
          })
          .filter(Boolean)
      : []
    const note = String(parsed.note ?? parsed.text ?? '').trim()
    // Mode comment (non-803): drawer lưu field `content` (diễn giải tự do)
    const content = String(parsed.content ?? '').trim()
    const pick =
      result ||
      actualField ||
      (planActualRecords.length ? planActualRecords.join(' | ') : '') ||
      content ||
      note
    if (!pick) return '—'
    return pick.length > 120 ? `${pick.slice(0, 117)}…` : pick
  } catch {
    return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw
  }
}

/**
 * Gộp payload `GET /kpi/leader/kpi-info` (INDIVIDUAL + PROMOTION) → dòng cho `GmGmPersonalKpiPanel`
 * (tab **KPI cá nhân** trên dashboard GM — GM cũng gọi endpoint này cho KPI của chính mình).
 */
export function mergeLeaderKpiInfoResponsesToGmPersonalRows(
  inputs: {
    requestedType: 'INDIVIDUAL' | 'PROMOTION'
    response: LeaderKpiInformationResponse | null | undefined
  }[],
): GmPersonalKpiRowMock[] {
  const seen = new Set<string>()
  const out: GmPersonalKpiRowMock[] = []

  for (const input of inputs) {
    const resp = input.response
    if (!resp?.categories?.length) continue
    for (const cat of resp.categories) {
      const bsc = inferBscFromCategoryName(String(cat.name ?? ''))
      for (const a of cat.assignments ?? []) {
        const id = String(a.assignmentId ?? '').trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        const kpiType = resolveGmPersonalRowKpiType(a, input.requestedType)
        const st = assignmentStatusFields(a)
        out.push({
          id,
          diagnosticsFallbackGroup: bsc,
          objective: String(a.kpiName ?? a.kpiCode ?? 'KPI').trim() || 'KPI',
          kpiType,
          target: formatPersonalTargetDisplay(a),
          unitCode:
            typeof a.unitCode === 'number' && Number.isFinite(a.unitCode) ? a.unitCode : null,
          weight: Number.isFinite(Number(a.weight)) ? Math.round(Number(a.weight)) : 0,
          actual: formatPersonalKpiActualFromEvidences(a.evidences),
          finalScore: formatFinalScore(a),
          ...st,
        })
      }
    }
  }
  return out
}
