/** Một nhân viên trong payload phòng ban — đồng bộ `GmDepartmentMemberResponse`. */
export interface GmDepartmentMemberApiRow {
  userId: string
  fullName: string
  email: string | null
  rankCode: string | null
}

/** KPI team giao cho phòng — đồng bộ `GmDepartmentAssignedKpiResponse`. */
export interface GmDepartmentAssignedKpiApiRow {
  assignmentId: string
  cycleId: string
  cycleYear: number
  kpiInfoId: string
  kpiCode: string
  kpiName: string
  statusCode: number
  typeCode: number
  targetValue: number | string | null
  weight: number | string | null
}

/** Một dòng `GET/POST/PUT /kpi/gm/departments` — đồng bộ backend `GmDepartmentResponse`. */
export interface GmDepartmentApiRow {
  id: string
  name: string
  parentId: string | null
  managerId: string | null
  managerFullName: string | null
  /** `roles.code` (GM / PM / LEADER / MEMBER) — null nếu không có manager hoặc không có role. */
  managerRoleCode?: string | null
  createdAt: string
  updatedAt: string
  members?: GmDepartmentMemberApiRow[]
  assignedKpis?: GmDepartmentAssignedKpiApiRow[]
  /** Năm chu kỳ dùng để lọc `assignedKpis` (metadata). */
  kpiYear?: number | null
}

export interface GmCreateDepartmentBody {
  name: string
  parentId?: string | null
  managerId?: string | null
}

export type GmUpdateDepartmentBody = GmCreateDepartmentBody

/** GET /kpi/gm/departments/:id/member-candidates — đồng bộ {@code GmDepartmentMemberCandidateResponse}. */
export interface GmDepartmentMemberCandidateApiRow {
  userId: string
  fullName: string
  email: string | null
  rankCode: string | null
  jobTitleLabel: string | null
}

/** POST /kpi/gm/departments/:id/members */
export interface GmAddDepartmentMembersBody {
  userIds: string[]
}
