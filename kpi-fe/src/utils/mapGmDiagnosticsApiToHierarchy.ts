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
  GmHierarchyTargetBalance,
  GmKpiLifecycleStatus,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'
import { normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import { normalizeStrategicKpiKind } from '@/utils/gm-strategic-kpi-kind'

function asStatus(s: string | undefined | null): GmHierarchyStatus {
  if (s === 'success' || s === 'warning' || s === 'danger') return s
  return 'warning'
}

function mapTargetBalance(v: string | null | undefined): GmHierarchyTargetBalance | undefined {
  if (v === 'short' || v === 'ok' || v === 'excess') return v
  return undefined
}

function parseOptionalSubmissionNum(v: number | string | null | undefined): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).trim())
  return Number.isFinite(n) ? n : undefined
}

function mapMember(m: GmDiagMemberApi): GmHierarchyMember {
  return {
    id: m.id,
    assignmentId: m.assignmentId ?? undefined,
    name: m.name,
    weight: m.weight ?? undefined,
    assignmentStatusCode:
      typeof m.statusCode === 'number' && Number.isFinite(m.statusCode) ? m.statusCode : undefined,
    ownerRoleCode: m.ownerRoleCode ?? undefined,
    ownerRoleLabel: m.ownerRoleLabel ?? undefined,
    leaderRoleCode: m.leaderRoleCode ?? undefined,
    leaderRoleName: m.leaderRoleName ?? undefined,
    target: m.target,
    targetBalance: mapTargetBalance(m.targetBalance),
    actual: m.actual,
    status: asStatus(m.status),
    performanceLabel: m.performanceLabel ?? undefined,
    submissionTarget: parseOptionalSubmissionNum(m.submissionTarget),
    submissionActual: parseOptionalSubmissionNum(m.submissionActual),
    evidences: m.evidences ?? undefined,
    feedbackNote: m.feedbackNote ?? undefined,
    feedbackAwaitingGm:
      typeof m.feedbackAwaitingGm === 'boolean' ? m.feedbackAwaitingGm : undefined,
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
    weight: l.weight ?? undefined,
    target: l.target,
    targetBalance: mapTargetBalance(l.targetBalance),
    actual: l.actual,
    status: asStatus(l.status),
    blockerSummary: l.blockerSummary ?? '',
    leaderOwnRow: l.leaderOwnRow ? mapMember(l.leaderOwnRow) : undefined,
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
    weight: p.weight ?? undefined,
    target: p.target,
    targetBalance: mapTargetBalance(p.targetBalance),
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
      targetBalance: mapTargetBalance(k.targetBalance),
      actual: k.actual,
      status: asStatus(k.status),
      blockerSummary: k.blockerSummary,
      kpiType,
      unitCode: k.unitCode ?? undefined,
      calculationRuleCode:
        typeof k.calculationRuleCode === 'number' && Number.isFinite(k.calculationRuleCode)
          ? k.calculationRuleCode
          : undefined,
      calculationTypeCode:
        typeof k.calculationTypeCode === 'number' && Number.isFinite(k.calculationTypeCode)
          ? k.calculationTypeCode
          : undefined,
      diagnosticsFallbackGroup: fallbackGroup,
      categoryId: cid,
      categoryName: cname,
      lifecycleStatus: lifecycle,
      isImportant: k.isImportant === true,
      isGlobal: k.isGlobal ?? undefined,
      pmOwners: (k.pmOwners ?? []).map(mapPm),
      investigateDeptId: k.investigateDeptId ?? undefined,
      investigateKpiName: k.investigateKpiName ?? undefined,
    }
  })
}
