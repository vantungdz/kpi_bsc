import type { GmMidYearIssuesData } from '@/types/gm-workspace'

/** Có dữ liệu vấn đề để hiện View Issues (sau khi đã tới mốc timeline). */
export function gmTimelinePhaseHasOpenIssues(data: GmMidYearIssuesData | null | undefined): boolean {
  if (!data) return false
  if (data.hasOpenIssues === false) return false
  const groups = data.issueGroups
  if (groups && groups.length === 0) return false
  if (groups && groups.length > 0) return true
  const types = data.issueTypes
  if (types && types.length === 0) return false
  if (types && types.length > 0) return true
  const details = data.issueDetails
  if (details?.some((b) => b.items.length > 0)) return true
  return false
}
