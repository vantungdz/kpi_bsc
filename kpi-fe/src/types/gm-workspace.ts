/**
 * GM workspace / diagnostics — **chỉ type**, tách khỏi `mocks/gm-kpi.mock.ts`
 * để có thể xóa file mock khi toàn bộ dữ liệu lấy từ API.
 */

/** Loại KPI chiến lược — đồng bộ form tạo & tag UI toàn GM workspace. */
export type GmStrategicKpiKind = 'cascading' | 'individual' | 'promotion'

/** Khía cạnh BSC — mock nhóm diagnostics khi chưa có `categoryId`. */
export type GmBscPerspective = 'financial' | 'customer' | 'internal' | 'learning'

export type GmDeptKpiStatus = 'fail' | 'warn' | 'active' | 'pass'

export interface GmDeptKpiMock {
  code?: string
  abbr?: string
  category?: 'A' | 'B'
  name: string
  weight: number
  target: string
  actual: string
  status: GmDeptKpiStatus
  kpiType: GmStrategicKpiKind
  categoryId?: string
  diagnosticsFallbackGroup?: GmBscPerspective
  activityStartDate?: string
  activityEndDate?: string
}

export interface GmDepartmentMock {
  id: string
  name: string
  /** UUID user — từ API `managerId`, dùng cho form PUT. */
  managerUserId?: string | null
  parentId?: string | null
  /** `roles.code` từ API — hiển thị badge cạnh tên quản lý. */
  managerRoleCode?: string | null
  /** `roles.name` manager phòng (mock đồng bộ seed). */
  managerRoleName?: string | null
  manager: string
  health: number
  progress: number
  risks: { critical: number; medium: number }
  responsibility: string
  breakdown: string
  impact: string | null
  kpis: GmDeptKpiMock[]
  /**
   * Nhân viên từ `GET /kpi/gm/departments` (`members`) — khi có (kể cả mảng rỗng) thì card/drawer ưu tiên thay cho mock `membersLocal`.
   */
  staffDetails?: GmMemberDetailMock[]
}

export interface GmMemberDetailMock {
  id: string
  name: string
  /** `roles.code` mock — đồng bộ badge member diagnostics. */
  ownerRoleCode?: string | null
  /** `roles.name` assignee (đồng bộ seed DB). */
  ownerRoleLabel?: string | null
  /** `roles.code` supervisor. */
  leaderRoleCode?: string | null
  /** `roles.name` supervisor. */
  leaderRoleName?: string | null
  rank: string
  leader: string
  status: string
  rootCause: string
  dueIn: number | null
  priority: string
  scoreSelf: string
  scoreMgr: string
  deptId: string
  relatedKpi: string
  relatedKpiType: GmStrategicKpiKind
}

export type GmInvestigationMember = GmMemberDetailMock

export type GmKpiSubmissionStatus = 'submitted' | 'submitted_with_file' | 'missing_data'

export interface GmModalKpiItemMock {
  code: string
  obj: string
  weight: number
  target: string
  actual: string
  isFail: boolean
  rootCause: string
  score: string
  kpiType: GmStrategicKpiKind
  submissionStatus: GmKpiSubmissionStatus
  targetSummary?: string
  actualProgressPct?: string | null
  evidenceAttachmentUrl?: string | null
}

export interface GmMemberKpiDrawerProfile {
  name: string
  rank?: string
  leader?: string
  departmentLabel?: string
}

export interface GmPmKpiMemberRolloutRow {
  profile: GmMemberKpiDrawerProfile
  item: GmModalKpiItemMock
}

export interface GmPmKpiRolloutPayload {
  pmName: string
  /** Nhãn ngắn (PM / Leader / Team) cho copy drawer. */
  rollupRoleLabel?: string
  pmUnitLine?: string
  kpiName: string
  kpiTarget: string
  rows: GmPmKpiMemberRolloutRow[]
}

export type GmIssueTypeId = 'pending_approval' | 'not_submitted' | 'missing_evidence'

export interface GmTimelineIssueType {
  id: GmIssueTypeId
  text: string
  dotClass: string
}

export interface GmTimelineIssueDetail {
  kpi: string
  pm: string
  leader: string
  member: string
  bottleneck: 'PM' | 'Leader' | 'Member'
  reason: string
}

export interface GmTimelineIssueBucket {
  id: GmIssueTypeId
  title: string
  iconClass: string
  items: GmTimelineIssueDetail[]
}

export type GmHierarchyStatus = 'success' | 'warning' | 'danger'

export interface GmHierarchyLeader {
  id: string
  name: string
  /** Tag vai trò nhóm (LEADER / PM / …) — từ BE `GmDiagLeaderNode.ownerRoleCode`. */
  ownerRoleCode?: string | null
  /** `roles.name` supervisor — nhãn tag. */
  ownerRoleLabel?: string | null
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  members: GmHierarchyMember[]
}

export interface GmHierarchyMember {
  id: string
  name: string
  /** GM / PM / LEADER / MEMBER / … — từ BE `GmDiagMemberNode.ownerRoleCode`. */
  ownerRoleCode?: string | null
  /** `roles.name` assignee — nhãn tag. */
  ownerRoleLabel?: string | null
  /** `roles.code` supervisor. */
  leaderRoleCode?: string | null
  /** `roles.name` supervisor. */
  leaderRoleName?: string | null
  target: string
  actual: string
  status: GmHierarchyStatus
  /** Nhãn cột trạng thái (tiếng Việt) khi API diagnostics trả về. */
  performanceLabel?: string | null
  blocker: string
  rank?: string
  leader?: string
  submissionTarget?: number
  submissionActual?: number
  evidenceAttachmentUrl?: string
}

export interface GmHierarchyPm {
  id: string
  name: string
  /** UUID user manager phòng — so với member.id để gọn UI khi chỉ có 1 assignee là manager. */
  ownerUserId?: string | null
  /** PM | LEADER | GM | MEMBER | TEAM — từ BE, hiển thị tag rollup khối. */
  ownerRoleCode?: string | null
  /** `roles.name` manager phòng — nhãn tag rollup. */
  ownerRoleLabel?: string | null
  unitLine?: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  members: GmHierarchyMember[]
  leaders?: GmHierarchyLeader[]
}

export type GmKpiLifecycleStatus = 'active' | 'inactive'

export interface GmHierarchyKpi {
  id: string
  name: string
  weight: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  kpiType: GmStrategicKpiKind
  diagnosticsFallbackGroup?: GmBscPerspective
  categoryId?: string
  categoryName?: string
  lifecycleStatus?: GmKpiLifecycleStatus
  isImportant?: boolean
  unitCode?: number
  pmOwners: GmHierarchyPm[]
  investigateDeptId?: string
  investigateKpiName?: string
  activityStartDate?: string
  activityEndDate?: string
  /** Tab Approved KPI (API): `kpi_assignments.id` — gửi kèm POST decision. */
  assignmentId?: string | null
  /** ASM 401 / 402 / 403 — nút ✓/✗ chỉ bật khi 403. */
  assignmentStatusCode?: number | null
  assigneeDisplayName?: string | null
  /** `sys_status_codes.description` (ưu tiên hiển thị). */
  assignmentStatusLabel?: string | null
  /** `sys_status_codes.name` — tooltip / tương lai. */
  assignmentStatusName?: string | null
}

export interface GmMidYearIssuesData {
  hasOpenIssues?: boolean
  pendingKpisLine: string
  popoverTitle: string
  bullets: { text: string; dotClass: string }[]
  issueTypes?: GmTimelineIssueType[]
  issueDetails?: GmTimelineIssueBucket[]
}

export interface GmPortfolioDonutData {
  centerTotal: number
  centerSubtitle: string
  circles: { stroke: string; strokeDasharray: string; strokeDashoffset: string }[]
  legend: { label: string; value: number; dotClass: string; badgeClass: string }[]
  healthTrendLabel?: string
  healthMonthlyTrend?: { label: string; value: number | null }[]
}

export interface GmWorkspaceCycleOption {
  id: string
  label: string
}

export interface GmWorkspaceCycleSnapshot {
  departments: GmDepartmentMock[]
  portfolioDonut: GmPortfolioDonutData
  midYearIssues: GmMidYearIssuesData
  settingIssues?: GmMidYearIssuesData | null
  yearEndIssues?: GmMidYearIssuesData | null
  hierarchyKpis: GmHierarchyKpi[]
  membersDetails: GmMemberDetailMock[]
  inactivePendingKpis: GmHierarchyKpi[]
  personalKpiRows: GmPersonalKpiRowMock[]
}

export type GmPersonalKpiRowStatus = 'good' | 'warn' | 'pending'

export interface GmPersonalKpiRowMock {
  id: string
  diagnosticsFallbackGroup: GmBscPerspective
  objective: string
  /** Loại KPI — tag giống tab Strategic KPIs Tracking & Diagnostics. */
  kpiType: GmStrategicKpiKind
  target: string
  weight: number
  actual: string
  finalScore: string
  status: GmPersonalKpiRowStatus
}
