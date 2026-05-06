import type {
  GmTimelineDepartmentGroup,
  GmTimelineIssueDetail,
  GmTimelineIssueGroup,
  GmTimelineBreakdownGroup,
  GmTimelineKpiGroup,
} from '@/types/gm-workspace'

/** Maps API bottleneck to workflow stage (Organization → Member). */
export function normalizeWorkflowStage(
  b: GmTimelineIssueDetail['bottleneck'],
): 'Member' | 'Leader' | 'PM' | 'GM' {
  if (b === 'Organization') return 'Member'
  return b
}

/** Count assignees blocked at each workflow stage (Member / Leader / PM / GM). */
export function bottleneckStageDistribution(
  employees: GmTimelineIssueDetail[],
): { stage: string; count: number }[] {
  const m = new Map<string, number>()
  for (const e of employees) {
    const s = normalizeWorkflowStage(e.bottleneck)
    m.set(s, (m.get(s) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count)
}

function distinctKpiCount(items: GmTimelineIssueDetail[]): number {
  return new Set(
    items
      .map((i) => i.kpi)
      .filter((k) => k && k.trim() !== '' && k !== '—'),
  ).size
}

function blockerSummaryFromIssueId(issueId: string): string {
  switch (issueId) {
    case 'pending_acceptance':
      return 'Acceptance pending'
    case 'pending_pm_review':
      return 'PM review pending'
    case 'pending_gm_approval':
      return 'GM approval pending'
    case 'kpi_not_submitted':
      return 'Submission pending'
    case 'missing_evidence':
      return 'Evidence incomplete'
    case 'unassigned_members':
      return 'No KPI assigned'
    default:
      return 'Action pending'
  }
}

function kpiBucketKey(e: GmTimelineIssueDetail): string {
  if (e.masterKpiId) return String(e.masterKpiId)
  const k = (e.kpi ?? '').trim()
  if (!k || k === '—') return 'kpi:_none_'
  return `kpi:name:${k}`
}

function deptBucketKey(e: GmTimelineIssueDetail): string {
  return (e.departmentName ?? '').trim()
}

/** Gắn con theo `parent_assignment_id` trong cùng slice phòng (khớp BE `nestCascadeInDeptSlice`). */
export function nestCascadeInDeptSlice(slice: GmTimelineIssueDetail[]): GmTimelineIssueDetail[] {
  if (!slice.length) return []
  const byId = new Map<string, GmTimelineIssueDetail>()
  for (const d of slice) {
    d.cascadeChildren = []
    if (d.assignmentId) byId.set(String(d.assignmentId), d)
  }
  const roots: GmTimelineIssueDetail[] = []
  for (const d of slice) {
    const pid = d.parentAssignmentId ? String(d.parentAssignmentId) : ''
    if (pid && byId.has(pid)) {
      byId.get(pid)!.cascadeChildren!.push(d)
    } else {
      roots.push(d)
    }
  }
  return roots
}

/** Mirrors backend KPI-first grouping for mock / legacy payloads without `kpiGroups`. */
export function buildTimelineKpiGroupsFromEmployees(group: GmTimelineIssueGroup): GmTimelineKpiGroup[] {
  const employees = group.employees
  if (!employees.length) return []

  const byKpi = new Map<string, GmTimelineIssueDetail[]>()
  for (const e of employees) {
    const key = kpiBucketKey(e)
    if (!byKpi.has(key)) byKpi.set(key, [])
    byKpi.get(key)!.push(e)
  }

  const out: GmTimelineKpiGroup[] = []
  for (const kpiItems of byKpi.values()) {
    const byDept = new Map<string, GmTimelineIssueDetail[]>()
    for (const e of kpiItems) {
      const dk = deptBucketKey(e) || '__none__'
      if (!byDept.has(dk)) byDept.set(dk, [])
      byDept.get(dk)!.push(e)
    }

    const departments: GmTimelineDepartmentGroup[] = [...byDept.entries()]
      .map(([name, em]) => ({
        departmentName: name === '__none__' ? null : name,
        affectedEmployees: em.length,
        employees: nestCascadeInDeptSlice([...em]),
      }))
      .sort((a, b) => b.affectedEmployees - a.affectedEmployees)

    const distinctDepts = new Set(
      kpiItems.map((e) => (e.departmentName ?? '').trim()).filter(Boolean),
    )

    const kpiName =
      kpiItems.map((e) => (e.kpi ?? '').trim()).find((k) => k && k !== '—') ?? '—'
    const masterKpiId =
      kpiItems.map((e) => e.masterKpiId).find((id) => id != null && String(id).length > 0) ?? null

    out.push({
      masterKpiId,
      kpiName,
      affectedEmployees: kpiItems.length,
      affectedDepartments: distinctDepts.size,
      blockerSummary: blockerSummaryFromIssueId(group.id),
      pmName: null,
      leaderName: null,
      departments,
    })
  }

  out.sort((a, b) => b.affectedEmployees - a.affectedEmployees)
  return out
}

export function resolveTimelineKpiGroups(group: GmTimelineIssueGroup): GmTimelineKpiGroup[] {
  if (group.kpiGroups?.length) return group.kpiGroups
  return buildTimelineKpiGroupsFromEmployees(group)
}

export function kpiGroupKey(kg: GmTimelineKpiGroup): string {
  return kg.masterKpiId ? `kpi:${kg.masterKpiId}` : `kpi:name:${kg.kpiName}`
}

/** Mirrors backend {@code GmProcessTimelineService.buildBreakdownGroups} for mock / legacy payloads. */
export function buildTimelineBreakdownGroupsFromEmployees(
  employees: GmTimelineIssueDetail[],
): GmTimelineBreakdownGroup[] {
  if (!employees.length) return []

  type Bucket = {
    items: GmTimelineIssueDetail[]
    departmentName?: string | null
    pmName?: string | null
    leaderName?: string | null
  }
  const map = new Map<string, Bucket>()

  for (const e of employees) {
    const dept = e.departmentName?.trim() ?? ''
    const pm = (e.pm ?? '').trim()
    const leader = (e.leader ?? '').trim()

    let key: string
    if (dept) {
      key = `dept:${dept}`
    } else if (pm && pm !== '—') {
      key = `pm:${pm}`
    } else if (leader) {
      key = `supervisor:${leader}`
    } else {
      key = 'other:unassigned'
    }

    let b = map.get(key)
    if (!b) {
      b = { items: [] }
      map.set(key, b)
    }
    b.items.push(e)
    if (!b.departmentName && dept) b.departmentName = dept
    if (!b.pmName && pm && pm !== '—') b.pmName = pm
    if (!b.leaderName && leader) b.leaderName = leader
  }

  const out: GmTimelineBreakdownGroup[] = []
  for (const [groupKey, b] of map) {
    const items = b.items
    let groupLabel: string
    if (b.departmentName) {
      groupLabel = b.departmentName
    } else if (b.pmName) {
      groupLabel = `PM: ${b.pmName}`
    } else if (b.leaderName) {
      groupLabel = `Leader: ${b.leaderName}`
    } else {
      groupLabel = 'No department / PM'
    }
    out.push({
      groupKey,
      groupLabel,
      departmentName: b.departmentName ?? null,
      pmName: b.pmName ?? null,
      leaderName: b.leaderName ?? null,
      affectedEmployees: items.length,
      affectedKpis: distinctKpiCount(items),
      employees: [...items],
    })
  }

  out.sort((a, b) => b.affectedEmployees - a.affectedEmployees)
  return out
}

export function resolveTimelineBreakdownGroups(
  group: {
    breakdownGroups?: GmTimelineBreakdownGroup[]
    kpiGroups?: GmTimelineKpiGroup[]
    employees: GmTimelineIssueDetail[]
  },
): GmTimelineBreakdownGroup[] {
  if (group.kpiGroups?.length) return []
  if (group.breakdownGroups?.length) return group.breakdownGroups
  return buildTimelineBreakdownGroupsFromEmployees(group.employees)
}
