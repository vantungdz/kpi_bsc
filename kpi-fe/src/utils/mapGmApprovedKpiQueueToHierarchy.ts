import type { GmApprovedKpiQueueItemApi } from '@/types/gm-approved-kpi-api'
import type { GmBscPerspective, GmHierarchyKpi, GmHierarchyStatus, GmStrategicKpiKind } from '@/types/gm-workspace'
import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'

/** Đọc chuỗi quy tắc từ `target_description` (JSON có rawInput hoặc text thuần). */
function scoringRulesFromTargetDescription(td: string | null | undefined): string | undefined {
  const raw = String(td ?? '').trim()
  if (!raw) return undefined
  const fromJson = extractRawInputFromApiTargetDescription(raw).trim()
  if (fromJson) return fromJson
  try {
    JSON.parse(raw)
    return undefined
  } catch {
    return raw
  }
}

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

function coerceAssignmentStatusCode(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

function rowStatusVisual(code: number | null | undefined): GmHierarchyStatus {
  const c = Number(code)
  if (c === 403) return 'danger'
  if (c === 402) return 'warning'
  return 'warning'
}

function splitUserRoleCodes(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return []
  const parts = String(raw)
    .split('|||')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
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
    const statusCodeNum = coerceAssignmentStatusCode(row.statusCode)
    const asmDesc =
      String(row.statusDescription ?? '').trim() ||
      String(row.statusName ?? '').trim() ||
      String(row.statusCode ?? '—')
    const feedbackNote = String(row.feedbackNote ?? '').trim()
    const asmName = String(row.statusName ?? '').trim() || null
    const scoringRulesText = scoringRulesFromTargetDescription(row.targetDescription)
    return {
      id: String(row.assignmentId),
      assignmentId: String(row.assignmentId),
      assignmentStatusCode: statusCodeNum,
      assigneeUserId: String(row.userId ?? '').trim() || undefined,
      assigneeRoleCodes: splitUserRoleCodes(row.userRoleCodes),
      requestedAt: row.requestedAt != null ? String(row.requestedAt) : undefined,
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
      status: rowStatusVisual(statusCodeNum ?? undefined),
      blockerSummary: feedbackNote,
      scoringRulesText: scoringRulesText ?? undefined,
      kpiType: typeCodeToKpiType(row.typeCode),
      unitCode: row.unitCode != null ? Number(row.unitCode) : undefined,
      diagnosticsFallbackGroup: categoryNameToPerspective(row.categoryName),
      categoryName: row.categoryName ?? undefined,
      lifecycleStatus: 'inactive',
      isImportant: Boolean(row.important),
      isGlobal: false,
      pmOwners: [],
      creatorRoleCode:
        row.creatorRoleCode != null && String(row.creatorRoleCode).trim() !== ''
          ? String(row.creatorRoleCode).trim().toUpperCase()
          : undefined,
    }
  })
}
