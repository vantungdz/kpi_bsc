import type {
  GmDeptKpiMock,
  GmDepartmentMock,
  GmHierarchyKpi,
  GmHierarchyPm,
  GmHierarchyStatus,
  GmDeptKpiStatus,
} from '@/types/gm-workspace'
import { kpiPayloadFormUnitKey } from '@/utils/kpiUnitCodes'
import { strategicKpiKindFromCreatePayload } from '@/utils/strategicKpiTypeCodes'
import { normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import { formatStrategicCreateTargetDisplay } from '@/utils/gm-strategic-create-target-format'

function mapDeptKpiStatusToHierarchy(status: GmDeptKpiStatus): GmHierarchyStatus {
  if (status === 'fail') return 'danger'
  if (status === 'warn') return 'warning'
  if (status === 'active') return 'warning'
  return 'success'
}

/** Một dòng diagnostics từ payload emit của GmCreateStrategicKpiModal (preview / mock UI). */
export function buildHierarchyKpiFromStrategicCreatePayload(
  payload: Record<string, unknown>,
): GmHierarchyKpi {
  const kpiType = strategicKpiKindFromCreatePayload(payload)

  const nameRaw = String(payload.kpiName ?? '').trim()
  const name = nameRaw || 'Strategic KPI'

  const w = String(payload.weightPct ?? '').trim()
  const weight = w.length ? `${w.replace(/%/g, '')}%` : '—'

  const unit = kpiPayloadFormUnitKey(payload as Record<string, unknown>)
  const target = formatStrategicCreateTargetDisplay(String(payload.targetValue ?? ''), unit)

  const pmTargets = (payload.pmTargets as Record<string, string> | undefined) ?? {}
  const assignPMs = Array.isArray(payload.assignPMs) ? (payload.assignPMs as string[]) : []

  const editingRowId = String(payload.editingKpiId ?? '').trim()
  const preserveCreatedId = editingRowId.startsWith('kpi-created-') ? editingRowId : ''
  const pmOwnerKey =
    preserveCreatedId.length > 0
      ? preserveCreatedId.replace(/^kpi-created-/, '') || 'id'
      : typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now())
  const rowId = preserveCreatedId.length > 0 ? preserveCreatedId : `kpi-created-${pmOwnerKey}`

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  const pmOwners: GmHierarchyPm[] =
    kpiType === 'cascading'
      ? assignPMs.map((pmKey, i) => {
          const isUuid = uuidLike.test(pmKey)
          const display = isUuid ? `PM (${pmKey.slice(0, 8)}…)` : pmKey
          return {
            id: isUuid ? pmKey : `new-pm-${pmOwnerKey}-${i}`,
            name: display,
            ownerRoleCode: 'PM',
            unitLine: 'PM · (mock — vừa gán)',
            target: formatStrategicCreateTargetDisplay(
              String(pmTargets[pmKey] ?? payload.targetValue ?? ''),
              unit,
            ),
            actual: '—',
            status: 'warning' as GmHierarchyStatus,
            blockerSummary: 'Chờ cập nhật tiến độ',
            members: [],
          }
        })
      : []

  const pers = String(payload.perspective ?? '').trim()
  const categoryIdFromPayload =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pers) ? pers : undefined

  const row: GmHierarchyKpi = {
    id: rowId,
    name,
    weight,
    target,
    actual: '—',
    status: 'warning',
    blockerSummary: 'KPI mới tạo (mock) — chưa có dữ liệu thực tế',
    kpiType,
    isImportant: payload.isImportant === true,
    pmOwners,
  }
  if (categoryIdFromPayload) {
    row.categoryId = categoryIdFromPayload
  } else {
    row.diagnosticsFallbackGroup = normalizeGmBscPerspective(pers)
  }
  return row
}

/**
 * Ghép KPI từng phòng ban vào danh sách hierarchy diagnostics (mock layout).
 */
export function appendDeptKpisAsHierarchyRows(
  existing: GmHierarchyKpi[],
  departments: GmDepartmentMock[],
): GmHierarchyKpi[] {
  const covered = new Set<string>()
  for (const r of existing) {
    if (r.investigateDeptId && r.investigateKpiName) {
      covered.add(`${r.investigateDeptId}::${String(r.investigateKpiName).trim()}`)
    }
  }
  for (const r of existing) {
    if (!String(r.id).startsWith('layout-global-kpi-')) continue
    const kn = r.investigateKpiName?.trim()
    if (!kn) continue
    for (const d of departments) {
      covered.add(`${d.id}::${kn}`)
    }
  }
  const out = [...existing]
  let seq = 0
  for (const dept of departments) {
    for (const k of dept.kpis) {
      const key = `${dept.id}::${k.name.trim()}`
      if (covered.has(key)) continue
      covered.add(key)
      const kid = k.categoryId?.trim()
      out.push({
        id: `dept-${dept.id}-kpi-${seq++}`,
        name: `${k.name} · ${dept.name}`,
        weight: `${k.weight}%`,
        target: k.target,
        actual: k.actual,
        status: mapDeptKpiStatusToHierarchy(k.status),
        blockerSummary: 'Theo dữ liệu phòng ban (mock)',
        kpiType: k.kpiType,
        ...(kid
          ? { categoryId: kid }
          : {
              diagnosticsFallbackGroup:
                k.diagnosticsFallbackGroup ?? normalizeGmBscPerspective(undefined),
            }),
        pmOwners: [],
        investigateDeptId: dept.id,
        investigateKpiName: k.name,
      })
    }
  }
  return out
}

/** KPI phòng ban (danh sách master) từ cùng payload — gắn vào dept đầu khi demo. */
export function buildDeptKpiFromStrategicCreatePayload(payload: Record<string, unknown>): GmDeptKpiMock {
  const kpiType = strategicKpiKindFromCreatePayload(payload)
  const name = String(payload.kpiName ?? '').trim() || 'Strategic KPI'
  const w = Number.parseInt(String(payload.weightPct ?? '').replace(/%/g, ''), 10)
  const weight = Number.isFinite(w) && w > 0 ? w : 5
  const uKey = kpiPayloadFormUnitKey(payload)
  const pers = String(payload.perspective ?? '').trim()
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const categoryId = uuidLike.test(pers) ? pers : undefined
  return {
    name,
    weight,
    target: formatStrategicCreateTargetDisplay(String(payload.targetValue ?? ''), uKey),
    actual: '—',
    status: 'active',
    kpiType,
    ...(categoryId
      ? { categoryId }
      : { diagnosticsFallbackGroup: normalizeGmBscPerspective(pers || undefined) }),
  }
}

/** Chuyển dòng inactive (tab duyệt) → mục master phòng ban đầu (đồng bộ builder hierarchy). */
export function hierarchyInactiveKpiToDeptKpiMock(row: GmHierarchyKpi): GmDeptKpiMock {
  const wStr = String(row.weight ?? '')
    .replace(/%/g, '')
    .trim()
  const w = Number.parseInt(wStr, 10)
  const weight = Number.isFinite(w) && w > 0 ? w : 5
  const cid = row.categoryId?.trim()
  return {
    name: String(row.name ?? '').trim() || 'Strategic KPI',
    weight,
    target: String(row.target ?? '—'),
    actual: String(row.actual ?? '—').trim() || '—',
    status: 'active',
    kpiType: row.kpiType,
    ...(cid
      ? { categoryId: cid }
      : {
          diagnosticsFallbackGroup:
            row.diagnosticsFallbackGroup ?? normalizeGmBscPerspective(undefined),
        }),
  }
}
