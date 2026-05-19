/**
 * GM workspace / diagnostics — **chỉ type** (dữ liệu mẫu UI đã bỏ khỏi repo).
 * để có thể xóa file mock khi toàn bộ dữ liệu lấy từ API.
 */

import type { GmEvidenceTable } from './gm-employee-evaluation'

/** Loại KPI chiến lược — đồng bộ form tạo & tag UI toàn GM workspace. */
export type GmStrategicKpiKind = "cascading" | "individual" | "promotion";

/** Khía cạnh BSC — mock nhóm diagnostics khi chưa có `categoryId`. */
export type GmBscPerspective =
  | "financial"
  | "customer"
  | "internal"
  | "learning";

export type GmDeptKpiStatus = "fail" | "warn" | "active" | "pass";

export interface GmDeptKpiMock {
  code?: string;
  abbr?: string;
  category?: "A" | "B";
  name: string;
  weight: number;
  target: string;
  actual: string;
  status: GmDeptKpiStatus;
  kpiType: GmStrategicKpiKind;
  categoryId?: string;
  diagnosticsFallbackGroup?: GmBscPerspective;
  activityStartDate?: string;
  activityEndDate?: string;
}

export interface GmDepartmentMock {
  id: string;
  name: string;
  /** UUID user — từ API `managerId`, dùng cho form PUT. */
  managerUserId?: string | null;
  parentId?: string | null;
  /** `roles.code` từ API — hiển thị badge cạnh tên quản lý. */
  managerRoleCode?: string | null;
  /** `roles.name` manager phòng (mock đồng bộ seed). */
  managerRoleName?: string | null;
  manager: string;
  health: number;
  progress: number;
  risks: { critical: number; medium: number };
  responsibility: string;
  breakdown: string;
  impact: string | null;
  kpis: GmDeptKpiMock[];
  /**
   * Nhân viên từ `GET /kpi/gm/departments` (`members`) — khi có (kể cả mảng rỗng) thì card/drawer ưu tiên thay cho mock `membersLocal`.
   */
  staffDetails?: GmMemberDetailMock[];
}

export interface GmMemberDetailMock {
  id: string;
  name: string;
  /** `roles.code` mock — đồng bộ badge member diagnostics. */
  ownerRoleCode?: string | null;
  /** `roles.name` assignee (đồng bộ seed DB). */
  ownerRoleLabel?: string | null;
  /** `roles.code` supervisor. */
  leaderRoleCode?: string | null;
  /** `roles.name` supervisor. */
  leaderRoleName?: string | null;
  rank: string;
  leader: string;
  status: string;
  rootCause: string;
  dueIn: number | null;
  priority: string;
  scoreSelf: string;
  scoreMgr: string;
  deptId: string;
  relatedKpi: string;
  relatedKpiType: GmStrategicKpiKind;
}

export type GmInvestigationMember = GmMemberDetailMock;

export type GmKpiSubmissionStatus =
  | "submitted"
  | "submitted_with_file"
  | "missing_data";

/** Link/file trong JSON evidences (`urls` | `files` | `evd`). */
export interface GmEvidenceAttachmentPair {
  url: string;
  name: string;
}

export interface GmEvidencePlanActualRow {
  plan: string;
  actual: string;
  comment: string;
  content: string;
}

export interface GmModalKpiItemMock {
  code: string;
  obj: string;
  weight: number;
  target: string;
  actual: string;
  calcRuleCode?: number | null;
  isFail: boolean;
  rootCause: string;
  score: string;
  kpiType: GmStrategicKpiKind;
  submissionStatus: GmKpiSubmissionStatus;
  /** `kpi_assignments.status_code` (ASM) cho dòng member trong drawer diagnostics. */
  assignmentStatusCode?: number | null;
  targetSummary?: string;
  actualProgressPct?: string | null;
  evidenceAttachmentUrl?: string | null;
  /** Ghi chú / content hiển thị trong drawer rollout (PM Portfolio…). */
  evidenceNoteDisplay?: string | null;
  /** Bảng Evidence từ `evidences` (đồng bộ Detailed evaluation sheet). */
  rolloutEvidence?: GmEvidenceTable | null;
  /** `planActualRecords` đã parse — hiển thị giống PM Team Review. */
  evidenceData?: GmEvidencePlanActualRow[];
  /** `content` / `note` / text legacy trong evidences — tách khỏi bảng actual. */
  evidenceContent?: string;
  evidenceAttachments?: GmEvidenceAttachmentPair[];
}

export interface GmMemberKpiDrawerProfile {
  name: string;
  rank?: string;
  leader?: string;
  departmentLabel?: string;
}

export interface GmPmKpiMemberRolloutRow {
  profile: GmMemberKpiDrawerProfile;
  item: GmModalKpiItemMock;
}

export interface GmPmKpiRolloutPayload {
  pmName: string;
  /** Nhãn ngắn (PM / Leader / Team) cho copy drawer. */
  rollupRoleLabel?: string;
  pmUnitLine?: string;
  kpiName: string;
  kpiTarget: string;
  rows: GmPmKpiMemberRolloutRow[];
}

/** Legacy bucket id + operational group ids from API (process-timeline). */
export type GmIssueTypeId =
  | "pending_approval"
  | "pending_acceptance"
  | "not_submitted"
  | "missing_evidence"
  | "unassigned_members"
  | "kpi_not_submitted"
  | "pending_pm_review"
  | "pending_gm_approval";

export type GmTimelineIssueSeverity = "critical" | "warning" | "info";

export interface GmTimelineIssueType {
  id: GmIssueTypeId | string;
  text: string;
  dotClass: string;
}

export interface GmTimelineIssueDetail {
  assignmentId?: string | null;
  parentAssignmentId?: string | null;
  subjectUserId?: string | null;
  /** `kpi_master.id` from process-timeline API — gom drawer theo KPI. */
  masterKpiId?: string | null;
  kpi: string;
  /** Trưởng phòng / section — `departments.manager_id`. */
  pm: string;
  /** Cấp trên trực tiếp — `user_departments.supervisor_id` (khác bước Leader trong sơ đồ 4 cấp). */
  leader: string | null;
  /** Người giữ KPI (assignee) — subject bị ảnh hưởng trong timeline issue. */
  member: string;
  /** `roles.code` của assignee (process timeline API). */
  roleCode?: string | null;
  departmentName?: string | null;
  bottleneck: "PM" | "Leader" | "Member" | "GM" | "Organization";
  reason: string;
  /** Drawer: assignment con cùng phòng (BE nest theo `parent_assignment_id`). */
  cascadeChildren?: GmTimelineIssueDetail[];
}

/** Operational cluster inside one timeline issue (drawer: group → expand → employees). */
export interface GmTimelineBreakdownGroup {
  groupKey: string;
  groupLabel: string;
  departmentName?: string | null;
  pmName?: string | null;
  leaderName?: string | null;
  affectedEmployees: number;
  affectedKpis: number;
  employees: GmTimelineIssueDetail[];
}

/** Department slice under one KPI in the GM timeline drawer. */
export interface GmTimelineDepartmentGroup {
  departmentName?: string | null;
  affectedEmployees: number;
  employees: GmTimelineIssueDetail[];
}

/** KPI-first cluster: KPI → departments → assignees. */
export interface GmTimelineKpiGroup {
  masterKpiId?: string | null;
  kpiName: string;
  affectedEmployees: number;
  affectedDepartments: number;
  blockerSummary: string;
  /** Không dùng ở cấp KPI (PM theo phòng, leader theo người). Giữ field cho tương thích API. */
  pmName?: string | null;
  leaderName?: string | null;
  departments: GmTimelineDepartmentGroup[];
}

export interface GmTimelineIssueBucket {
  id: GmIssueTypeId | string;
  title: string;
  iconClass: string;
  items: GmTimelineIssueDetail[];
}

/** One business-level operational issue (aggregated) for GM timeline. */
export interface GmTimelineIssueGroup {
  id: string;
  title: string;
  severity: GmTimelineIssueSeverity;
  blockedRole: string;
  affectedEmployees: number;
  affectedKpis: number;
  affectedDepartments: number;
  iconClass: string;
  /** @deprecated Server no longer fills; use {@link kpiGroups}. */
  breakdownGroups?: GmTimelineBreakdownGroup[];
  /** KPI → department → employees (preferred drawer hierarchy). */
  kpiGroups?: GmTimelineKpiGroup[];
  employees: GmTimelineIssueDetail[];
}

export type GmHierarchyStatus = "success" | "warning" | "danger";

/** So khớp target hiển thị với tổng đã giao (diagnostics). */
export type GmHierarchyTargetBalance = "short" | "ok" | "excess";

export interface GmHierarchyLeader {
  id: string;
  name: string;
  /** Tag vai trò nhóm (LEADER / PM / …) — từ BE `GmDiagLeaderNode.ownerRoleCode`. */
  ownerRoleCode?: string | null;
  /** `roles.name` supervisor — nhãn tag. */
  ownerRoleLabel?: string | null;
  /** Cùng trọng số KPI (BE diagnostics — không chia theo nhánh). */
  weight?: string | null;
  target: string;
  targetBalance?: GmHierarchyTargetBalance | null;
  actual: string;
  status: GmHierarchyStatus;
  blockerSummary: string;
  /** KPI của chính supervisor — dùng để tiến độ dòng leader không chỉ trung bình member. */
  leaderOwnRow?: GmHierarchyMember;
  members: GmHierarchyMember[];
}

export interface GmHierarchyMember {
  id: string;
  assignmentId?: string | null;
  name: string;
  /** Cùng trọng số KPI (BE diagnostics — không chia theo nhánh). */
  weight?: string | null;
  /** `kpi_assignments.status_code` (ASM). */
  assignmentStatusCode?: number | null;
  /** GM / PM / LEADER / MEMBER / … — từ BE `GmDiagMemberNode.ownerRoleCode`. */
  ownerRoleCode?: string | null;
  /** `roles.name` assignee — nhãn tag. */
  ownerRoleLabel?: string | null;
  /** `roles.code` supervisor. */
  leaderRoleCode?: string | null;
  /** `roles.name` supervisor. */
  leaderRoleName?: string | null;
  target: string;
  targetBalance?: GmHierarchyTargetBalance | null;
  actual: string;
  status: GmHierarchyStatus;
  /** Nhãn cột trạng thái (tiếng Việt) khi API diagnostics trả về. */
  performanceLabel?: string | null;
  blocker: string;
  rank?: string;
  rankCode?: string;
  leader?: string;
  submissionTarget?: number;
  submissionActual?: number;
  evidences?: string | null;
  /** PM nhận xét tổng trên summary (`user_kpi_summaries.evaluation_supervisor_comments`). */
  evaluationSupervisorComments?: string | null;
  feedbackNote?: string | null;
  /** BE: true khi 407 và feedback cần GM xử lý (không dựa vào có/không có nội dung note). */
  feedbackAwaitingGm?: boolean;
  evidenceAttachmentUrl?: string;
}

export interface GmHierarchyPm {
  id: string;
  assignmentId?: string | null;
  assignmentStatusCode?: number | null;
  name: string;
  /** UUID user manager phòng — so với member.id để gọn UI khi chỉ có 1 assignee là manager. */
  ownerUserId?: string | null;
  /** PM | LEADER | GM | MEMBER | TEAM — từ BE, hiển thị tag rollup khối. */
  ownerRoleCode?: string | null;
  /** `roles.name` manager phòng — nhãn tag rollup. */
  ownerRoleLabel?: string | null;
  unitLine?: string;
  /** Cùng trọng số KPI (BE diagnostics — không chia theo nhánh). */
  weight?: string | null;
  target: string;
  targetBalance?: GmHierarchyTargetBalance | null;
  actual: string;
  status: GmHierarchyStatus;
  blockerSummary: string;
  feedbackNote?: string | null;
  feedbackAwaitingGm?: boolean;
  members: GmHierarchyMember[];
  leaders?: GmHierarchyLeader[];
}

export type GmKpiLifecycleStatus = "active" | "inactive";

export interface GmHierarchyKpi {
  id: string;
  name: string;
  weight: string;
  target: string;
  targetBalance?: GmHierarchyTargetBalance | null;
  actual: string;
  status: GmHierarchyStatus;
  blockerSummary: string;
  kpiType: GmStrategicKpiKind;
  diagnosticsFallbackGroup?: GmBscPerspective;
  categoryId?: string;
  categoryName?: string;
  lifecycleStatus?: GmKpiLifecycleStatus;
  isImportant?: boolean;
  creatorRoleCode?: string;
  /** `kpi_master.is_global`: true = KPI GM (công ty), false = member đề xuất; undefined = API cũ / không rõ. */
  isGlobal?: boolean | null;
  unitCode?: number;
  calculationRuleCode?: number;
  calculationTypeCode?: number;
  pmOwners: GmHierarchyPm[];
  investigateDeptId?: string;
  investigateKpiName?: string;
  activityStartDate?: string;
  activityEndDate?: string;
  /** Tab Approved KPI (API): `kpi_assignments.id` — gửi kèm POST decision. */
  assignmentId?: string | null;
  /** ASM 401 / 402 / 403 — nút ✓/✗ chỉ bật khi 403. */
  assignmentStatusCode?: number | null;
  assigneeDisplayName?: string | null;
  /** Assignee — tab Approved KPI (API queue). */
  assigneeUserId?: string | null;
  /** roles.code (uppercase), đã tách từ BE. */
  assigneeRoleCodes?: string[];
  /** Thời điểm assignment (API) — gộp “gửi gần nhất” theo member. */
  requestedAt?: string | null;
  /** `sys_status_codes.description` (ưu tiên hiển thị). */
  assignmentStatusLabel?: string | null;
  /** `sys_status_codes.name` — tooltip / tương lai. */
  assignmentStatusName?: string | null;
  /** Quy tắc chấm điểm (DSL / rawInput) — khi API trả `target_description`. */
  scoringRulesText?: string | null;
}

export interface GmMidYearIssuesData {
  hasOpenIssues?: boolean;
  /** Số nhóm vấn đề vận hành (API); optional trên mock cũ. */
  operationalIssueCount?: number;
  /** Nhân sự distinct across groups (API). */
  totalDistinctEmployeesAffected?: number;
  pendingKpisLine: string;
  popoverTitle: string;
  bullets?: { text: string; dotClass: string }[];
  issueTypes?: GmTimelineIssueType[];
  /** @deprecated Dùng {@link issueGroups}; giữ để tương thích mock cũ. */
  issueDetails?: GmTimelineIssueBucket[];
  /** Nhóm vấn đề vận hành (API + mock mới). */
  issueGroups?: GmTimelineIssueGroup[];
}

export interface GmPortfolioDonutData {
  centerTotal: number;
  centerSubtitle: string;
  circles: {
    stroke: string;
    strokeDasharray: string;
    strokeDashoffset: string;
  }[];
  legend: {
    label: string;
    value: number;
    dotClass: string;
    badgeClass: string;
  }[];
  healthTrendLabel?: string;
  healthMonthlyTrend?: { label: string; value: number | null }[];
}

export interface GmWorkspaceCycleOption {
  id: string;
  label: string;
}

export interface GmWorkspaceCycleSnapshot {
  departments: GmDepartmentMock[];
  portfolioDonut: GmPortfolioDonutData;
  midYearIssues: GmMidYearIssuesData;
  settingIssues?: GmMidYearIssuesData | null;
  yearEndIssues?: GmMidYearIssuesData | null;
  hierarchyKpis: GmHierarchyKpi[];
  membersDetails: GmMemberDetailMock[];
  inactivePendingKpis: GmHierarchyKpi[];
  personalKpiRows: GmPersonalKpiRowMock[];
}

export interface GmPersonalKpiRowMock {
  id: string;
  diagnosticsFallbackGroup: GmBscPerspective;
  objective: string;
  /** Loại KPI — tag giống tab Strategic KPIs Tracking & Diagnostics. */
  kpiType: GmStrategicKpiKind;
  target: string;
  weight: number;
  actual: string;
  finalScore: string;
  /** `kpi_assignments.status_code` (FK logic tới `sys_status_codes.code`). */
  assignmentStatusCode: number | null;
  /** `sys_status_codes.name` — tooltip / bổ sung khi cột dùng `description`. */
  assignmentStatusName: string;
  /** Ưu tiên `sys_status_codes.description`, sau đó `name` (đồng bộ API leader kpi-info). */
  assignmentStatusDisplay: string;
  /** `kpi_master.unit_code` — hiển thị kèm Target. */
  unitCode?: number | null;
}
