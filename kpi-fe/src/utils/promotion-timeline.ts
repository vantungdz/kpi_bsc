import type { GmHierarchyKpi, GmHierarchyMember, GmHierarchyPm } from '@/types/gm-workspace'
import type { GmPromotionCycleOption } from '@/types/gm-promotion-cycle'
import type { PmDashboardInitResponse } from '@/types/kpi'

/** Label for promotion cycle header / create-KPI dropdowns. */
export function formatPromotionCycleOptionLabel(row: GmPromotionCycleOption): string {
  const name = String(row.name ?? '').trim()
  if (name) return name
  const start = row.startDate ? String(row.startDate).slice(0, 10) : ''
  const end = row.endDate ? String(row.endDate).slice(0, 10) : ''
  return start && end ? `${start} – ${end}` : row.id
}

export type PromotionTimelineActiveSegment =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'

/** Display titles for promotion timeline issue group ids (API). */
export const PROMO_TIMELINE_ISSUE_TITLES: Record<string, string> = {
  promo_overdue_not_submitted: 'Overdue submissions',
  promo_not_submitted: 'Not submitted',
  promo_pending_pm_evaluation: 'Pending PM evaluation',
  promo_pending_gm_evaluation: 'Pending GM approval',
  promo_rejected: 'Rejected',
}

export function promoTimelineIssueDisplayTitle(groupId: string, fallbackTitle: string): string {
  return PROMO_TIMELINE_ISSUE_TITLES[groupId] ?? fallbackTitle
}

export function promoTimelineClusterStatusEn(issueId: string): string {
  switch (issueId) {
    case 'promo_not_submitted':
      return 'Not submitted'
    case 'promo_overdue_not_submitted':
      return 'Overdue — not submitted'
    case 'promo_pending_pm_evaluation':
      return 'Pending PM evaluation'
    case 'promo_pending_gm_evaluation':
      return 'Pending GM approval'
    case 'promo_rejected':
      return 'Rejected'
    default:
      return 'In progress'
  }
}

function memberPromotionCycleId(member: GmHierarchyMember | null | undefined): string | null {
  const id = member?.promotionCycleId
  if (typeof id === 'string' && id.trim()) return id.trim()
  return null
}

function scanPmBranch(pm: GmHierarchyPm): string | null {
  for (const m of pm.members ?? []) {
    const id = memberPromotionCycleId(m)
    if (id) return id
  }
  for (const leader of pm.leaders ?? []) {
    const own = memberPromotionCycleId(leader.leaderOwnRow)
    if (own) return own
    for (const m of leader.members ?? []) {
      const id = memberPromotionCycleId(m)
      if (id) return id
    }
  }
  return null
}

function scanPmBranchForCycle(pm: GmHierarchyPm, target: string): boolean {
  for (const m of pm.members ?? []) {
    if (memberPromotionCycleId(m) === target) return true
  }
  for (const leader of pm.leaders ?? []) {
    if (memberPromotionCycleId(leader.leaderOwnRow) === target) return true
    for (const m of leader.members ?? []) {
      if (memberPromotionCycleId(m) === target) return true
    }
  }
  return false
}

/** Whether a diagnostics KPI row (or any assignee under it) uses the given promotion cycle. */
export function hierarchyKpiUsesPromotionCycle(
  kpi: GmHierarchyKpi,
  cycleId: string,
): boolean {
  const target = String(cycleId ?? '').trim()
  if (!target) return true
  if (kpi.promotionCycleId?.trim() === target) return true
  for (const pm of kpi.pmOwners ?? []) {
    if (scanPmBranchForCycle(pm, target)) return true
  }
  return false
}

/**
 * First non-empty {@code promotionCycleId} from promotion diagnostics hierarchy.
 */
export function collectPromotionCycleIdFromHierarchy(rows: GmHierarchyKpi[]): string | null {
  for (const kpi of rows ?? []) {
    const onKpi = kpi.promotionCycleId?.trim()
    if (onKpi) return onKpi
    for (const pm of kpi.pmOwners ?? []) {
      const fromPm = scanPmBranch(pm)
      if (fromPm) return fromPm
    }
  }
  return null
}

/** Extract promotion cycle id from PM portfolio init rows (type 103). */
export function collectPromotionCycleIdFromKpiRows(
  rows: PmDashboardInitResponse['kpis'],
): string | null {
  if (!rows?.length) return null
  for (const row of rows) {
    const tc = row.kpiType ?? row.typeCode
    if (tc != null && tc !== 103) continue
    const id = row.promotionCycleId
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  for (const row of rows) {
    const id = row.promotionCycleId
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export function promotionTimelineSegmentLabel(segment: PromotionTimelineActiveSegment | string | null | undefined): string {
  switch (segment) {
    case 'NOT_STARTED':
      return 'Not started'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'OVERDUE':
      return 'Overdue'
    case 'COMPLETED':
      return '100% Complete'
    default:
      return 'Not started'
  }
}
