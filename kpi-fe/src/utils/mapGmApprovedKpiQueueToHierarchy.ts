import type { GmApprovedKpiQueueItemApi } from '@/types/gm-approved-kpi-api'
import type { GmBscPerspective, GmHierarchyKpi, GmHierarchyStatus, GmStrategicKpiKind } from '@/types/gm-workspace'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

function categoryNameToPerspective(name: string | null | undefined): GmBscPerspective {
  const n = String(name ?? '')
    .trim()
    .toLowerCase()
  if (n.includes('tài chính') || n.includes('financial')) return 'financial'
  if (n.includes('khách') || n.includes('customer')) return 'customer'
  if (n.includes('học') || n.includes('learning') || n.includes('growth')) return 'learning'
  return 'internal'
}

function typeCodeToKpiType(code: number | null | undefined): GmStrategicKpiKind {
  const c = Number(code)
  if (c === 102) return 'cascading'
  if (c === 103) return 'promotion'
  return 'individual'
}

function formatWeight(w: unknown): string {
  const n = typeof w === 'number' ? w : Number.parseFloat(String(w ?? ''))
  if (!Number.isFinite(n)) return '—'
  if (n > 0 && n <= 1) return `${Math.round(n * 100)}%`
  if (n <= 100) return `${Math.round(n)}%`
  return `${n}%`
}

function formatTargetValue(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return '—'
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

function rowStatusVisual(code: number | null | undefined): GmHierarchyStatus {
  const c = Number(code)
  if (c === 403) return 'danger'
  if (c === 402) return 'warning'
  return 'warning'
}

/** Map API queue → hàng hiển thị tab Approved KPI (cùng shape `GmHierarchyKpi`). */
export function mapGmApprovedKpiQueueItemsToHierarchyRows(items: GmApprovedKpiQueueItemApi[]): GmHierarchyKpi[] {
  return items.map((row) => {
    const code = row.masterCode?.trim()
    const name = row.masterName?.trim()
    const title = [code, name].filter(Boolean).join(' · ') || 'KPI'
    const assignee =
      String(row.userFullName ?? '').trim() ||
      String(row.userUsername ?? '').trim() ||
      '—'
    const asmDesc =
      String(row.statusDescription ?? '').trim() ||
      String(row.statusName ?? '').trim() ||
      String(row.statusCode ?? '—')
    const feedbackNote = String(row.feedbackNote ?? '').trim()
    const asmName = String(row.statusName ?? '').trim() || null
    return {
      id: String(row.assignmentId),
      assignmentId: String(row.assignmentId),
      assignmentStatusCode: typeof row.statusCode === 'number' ? row.statusCode : null,
      assigneeDisplayName: assignee,
      assignmentStatusLabel: asmDesc,
      assignmentStatusName: asmName,
      name: title,
      weight: formatWeight(row.weight),
      target: formatKpiTargetWithUnit(
        formatTargetValue(row.targetValue),
        row.unitCode != null ? Number(row.unitCode) : undefined,
      ),
      actual: '—',
      status: rowStatusVisual(row.statusCode),
      blockerSummary: feedbackNote ? `${assignee} · ${asmDesc} · ${feedbackNote}` : `${assignee} · ${asmDesc}`,
      kpiType: typeCodeToKpiType(row.typeCode),
      unitCode: row.unitCode != null ? Number(row.unitCode) : undefined,
      diagnosticsFallbackGroup: categoryNameToPerspective(row.categoryName),
      categoryName: row.categoryName ?? undefined,
      lifecycleStatus: 'inactive',
      isImportant: Boolean(row.important),
      isGlobal: false,
      pmOwners: [],
    }
  })
}
