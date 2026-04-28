import type {
  GmDiagKpiApi,
  GmDiagLeaderApi,
  GmDiagMemberApi,
  GmDiagPmApi,
} from '@/types/gm-diagnostics-api'
import type {
  GmBscPerspective,
  GmHierarchyKpi,
  GmHierarchyLeader,
  GmHierarchyMember,
  GmHierarchyPm,
  GmHierarchyStatus,
  GmKpiLifecycleStatus,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'
import { normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import { normalizeStrategicKpiKind } from '@/utils/gm-strategic-kpi-kind'

function asStatus(s: string | undefined | null): GmHierarchyStatus {
  if (s === 'success' || s === 'warning' || s === 'danger') return s
  return 'warning'
}

function mapMember(m: GmDiagMemberApi): GmHierarchyMember {
  return {
    id: m.id,
    name: m.name,
    assignmentStatusCode:
      typeof m.statusCode === 'number' && Number.isFinite(m.statusCode) ? m.statusCode : undefined,
    ownerRoleCode: m.ownerRoleCode ?? undefined,
    ownerRoleLabel: m.ownerRoleLabel ?? undefined,
    leaderRoleCode: m.leaderRoleCode ?? undefined,
    leaderRoleName: m.leaderRoleName ?? undefined,
    target: m.target,
    actual: m.actual,
    status: asStatus(m.status),
    performanceLabel: m.performanceLabel ?? undefined,
    blocker: m.blocker ?? '—',
    rank: m.rank ?? undefined,
    leader: m.leader ?? undefined,
  }
}

function mapLeader(l: GmDiagLeaderApi): GmHierarchyLeader {
  return {
    id: l.id,
    name: l.name,
    ownerRoleCode: l.ownerRoleCode ?? undefined,
    ownerRoleLabel: l.ownerRoleLabel ?? undefined,
    target: l.target,
    actual: l.actual,
    status: asStatus(l.status),
    blockerSummary: l.blockerSummary ?? '',
    members: (l.members ?? []).map(mapMember),
  }
}

function mapPm(p: GmDiagPmApi): GmHierarchyPm {
  const leadersRaw = p.leaders
  const leaders =
    Array.isArray(leadersRaw) && leadersRaw.length > 0
      ? leadersRaw.map(mapLeader)
      : undefined
  return {
    id: p.id,
    name: p.name,
    ownerUserId: p.ownerUserId ?? undefined,
    ownerRoleCode: p.ownerRoleCode ?? undefined,
    ownerRoleLabel: p.ownerRoleLabel ?? undefined,
    unitLine: p.unitLine,
    target: p.target,
    actual: p.actual,
    status: asStatus(p.status),
    blockerSummary: p.blockerSummary,
    members: (p.members ?? []).map(mapMember),
    leaders,
  }
}

export function mapGmDiagnosticsApiKpisToHierarchyRows(kpis: GmDiagKpiApi[] | null | undefined): GmHierarchyKpi[] {
  if (!kpis?.length) return []
  return kpis.map((k) => {
    const cid = k.categoryId != null && String(k.categoryId).trim() !== '' ? String(k.categoryId).trim() : undefined
    const cname = k.categoryName != null && String(k.categoryName).trim() !== '' ? String(k.categoryName).trim() : undefined
    const fallbackGroup =
      cid != null ? undefined : (normalizeGmBscPerspective(undefined) as GmBscPerspective)
    const kpiType = normalizeStrategicKpiKind(k.kpiType) as GmStrategicKpiKind
    const lifecycle = (k.lifecycleStatus === 'inactive' ? 'inactive' : 'active') as GmKpiLifecycleStatus
    return {
      id: k.id,
      name: k.name,
      weight: k.weight,
      target: k.target,
      actual: k.actual,
      status: asStatus(k.status),
      blockerSummary: k.blockerSummary,
      kpiType,
      unitCode: k.unitCode ?? undefined,
      diagnosticsFallbackGroup: fallbackGroup,
      categoryId: cid,
      categoryName: cname,
      lifecycleStatus: lifecycle,
      isImportant: k.isImportant === true,
      pmOwners: (k.pmOwners ?? []).map(mapPm),
      investigateDeptId: k.investigateDeptId ?? undefined,
      investigateKpiName: k.investigateKpiName ?? undefined,
    }
  })
}
