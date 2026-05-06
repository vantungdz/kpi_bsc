import type {
  GmDepartmentApiRow,
  GmDepartmentMemberApiRow,
} from '@/types/gm-department-api'
import type { GmDepartmentMock, GmMemberDetailMock } from '@/types/gm-workspace'
import { strategicKpiKindFromTypeCode } from '@/utils/strategicKpiTypeCodes'

export function mapGmDepartmentMemberToDetail(
  mem: GmDepartmentMemberApiRow,
  deptId: string,
): GmMemberDetailMock {
  return {
    id: mem.userId,
    name: mem.fullName?.trim() || '—',
    rank: mem.rankCode?.trim() || '',
    leader: '',
    status: '',
    rootCause: '',
    dueIn: null,
    priority: '',
    scoreSelf: '',
    scoreMgr: '',
    deptId,
    relatedKpi: '',
    relatedKpiType: strategicKpiKindFromTypeCode(102),
  }
}

/** Map `GET /kpi/gm/departments` → cấu trúc `GmDepartmentMock` dùng trong GM workspace. */
export function mapGmDepartmentApiRowToWorkspaceMock(r: GmDepartmentApiRow): GmDepartmentMock {
  const members = r.members ?? []
  return {
    id: r.id,
    name: r.name,
    manager: r.managerFullName?.trim() || '—',
    managerUserId: r.managerId,
    parentId: r.parentId,
    managerRoleCode: r.managerRoleCode ?? null,
    health: 0,
    progress: 0,
    risks: { critical: 0, medium: 0 },
    responsibility: '-',
    breakdown: '—',
    impact: null,
    kpis: [],
    staffDetails: members.map((m) => mapGmDepartmentMemberToDetail(m, r.id)),
  }
}
