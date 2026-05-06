import type { GmTimelineDepartmentGroup, GmTimelineIssueDetail, GmTimelineKpiGroup } from '@/types/gm-workspace'
import { kpiGroupKey } from '@/utils/gm-timeline-breakdown'

export function gmDrawerEmployeeRowKey(
  kg: GmTimelineKpiGroup,
  dg: GmTimelineDepartmentGroup,
  item: GmTimelineIssueDetail,
  idx: number | string,
): string {
  return `${kpiGroupKey(kg)}|${dg.departmentName ?? ''}|${item.subjectUserId ?? ''}|${item.member}|${idx}`
}

export function assigneeIsSectionPmSameUser(item: GmTimelineIssueDetail): boolean {
  const m = (item.member ?? '').trim()
  const p = (item.pm ?? '').trim()
  return m.length > 0 && p.length > 0 && p !== '—' && m === p
}
