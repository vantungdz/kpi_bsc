/**
 * GM employee evaluation hub — shared shapes for mock data and
 * `mapGmEvaluationHubApiToPmBranches` (real API mapping).
 */

export type GmEmployeeSheetStatus = 'pending_pm' | 'self_scoring' | 'approved'

export interface GmEvidenceTable {
  title: string
  icon: string
  accent: 'indigo' | 'emerald'
  headers: string[]
  rows: string[][]
  footer?: string[]
  /** Đường dẫn tài liệu đính kèm — GM mở trong tab mới. */
  attachmentUrl?: string
  /** Nhãn cho `attachmentUrl` (mặc định UI: «Xem bằng chứng đính kèm»). */
  attachmentLabel?: string
}

export interface GmKpiItem {
  id: string
  index: number
  title: string
  target: string
  weight: number
  evidenceButtonLabel: string
  evidenceButtonIcon: string
  evidenceTone: 'blue' | 'emerald'
  selfScore: number
  /** Điểm GM đã lưu (end_gm_score); khi có giá trị thì cột Supervisor Score hiển thị điểm GM. */
  pmScore?: number | null
  /** GM đã lưu ?? điểm PM (end_pm_score) — prefill dropdown và fallback cột Supervisor Score khi chưa có điểm GM. */
  pmSeedScore?: number | null
  evidence: GmEvidenceTable
  /** Ghi chú theo từng KPI từ `kpi_assignments.evidences.gmComment` (GM có thể chỉnh sửa/ghi đè). */
  gmComment?: string
  /** ASM assignment từ hub API: 502 = review GM (không chấm), 602 = chấm điểm GM + comment. */
  hubAssignmentStatusCode?: number | null
}

export interface GmKpiGroup {
  groupTitle: string
  items: GmKpiItem[]
}

export interface GmEvalMember {
  id: string
  code: string
  name: string
  role: string
  initials: string
  initialsClass: string
  rank: string
  status: GmEmployeeSheetStatus
  /** `sys_status_codes.name` (ASM) — cột Tiến độ; khi không có API có thể gán nhãn qua `gmEmployeeSheetStatusDescription`. */
  assignmentStatusDisplay?: string | null
  /** Cột Thao tác (chấm/duyệt GM): bật khi có assignment ASM 502 hoặc 602. */
  gmApprovalActionEnabled?: boolean
  /** `users.id` (assignee) — API hub; mock: fixed UUID map trong mock file. */
  evaluationUserId?: string
  selfScoreDisplay: string | null
  canScore: boolean
  projectIds: string[]
  /** @deprecated Dùng employeeCommentPortfolio / employeeCommentPromotion */
  employeeComment?: string
  /** Member — evaluation_comments (BSC / portfolio). */
  employeeCommentPortfolio?: string
  /** Member — evaluation_comments_promotion. */
  employeeCommentPromotion?: string
  /** @deprecated Dùng supervisorCommentPortfolio / supervisorCommentPromotion */
  supervisorComment?: string
  /** PM nhận xét tổng portfolio (seed ô Supervisor tab BSC). */
  supervisorCommentPortfolio?: string
  /** PM nhận xét tổng promotion. */
  supervisorCommentPromotion?: string
  groups: GmKpiGroup[]
}

export interface GmEvalPmBroker {
  id: string
  name: string
  unit: string
}

/** Nhánh Leader → các member (mock hub đánh giá GM). */
export interface GmEvalLeaderBranch {
  leaderKey: string
  /** Bảng KPI của leader — GM mở drawer chấm giống PM/member. */
  sheet: GmEvalMember
  members: GmEvalMember[]
}

/** Một PM + cấu trúc PM → Leader → Member. */
export interface GmEvalPmBranch {
  pm: GmEvalMember
  leaders: GmEvalLeaderBranch[]
  directMembers: GmEvalMember[]
  /** Id section — khớp mock section departments trong mock hub. */
  sectionId?: string
  sectionName?: string
}
