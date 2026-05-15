/** GET /kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá GM. */

export interface GmEvaluationHubAssignmentApiRow {
  assignmentId: string | null
  statusCode: number | null
  assignmentStatusName: string | null
  /** `sys_status_codes.description` (ASM); ưu tiên cho cột Tiến độ. */
  assignmentStatusDescription: string | null
  midSelfScore: number | string | null
  endSelfScore: number | string | null
  endPmScore: number | string | null
  endGmScore: number | string | null
  evidences: string | null
  targetDescription: string | null
  weight: number | string | null
  masterCode: string | null
  masterName: string | null
  categoryName: string | null
  kpiTypeName: string | null
  userId: string
  userFullName: string | null
  userUsername: string | null
  rankCode: string | null
  assigneeSupervisorId: string | null
  assigneeSupervisorFullName: string | null
  sectionId: string
  sectionName: string | null
  sectionManagerId: string | null
  sectionManagerFullName: string | null
  memberRoleCode: string | null
  memberRoleName: string | null
  /** Member — user_kpi_summaries.evaluation_comments (BSC / portfolio). */
  evaluationComments: string | null
  /** Member — user_kpi_summaries.evaluation_comments_promotion. */
  evaluationCommentsPromotion: string | null
  /** PM tổng — evaluation_supervisor_comments. */
  supervisorCommentPortfolio: string | null
  /** PM tổng — evaluation_supervisor_comments_promotion. */
  supervisorCommentPromotion: string | null
}

export interface GmEvaluationHubApiResponse {
  cycleId: string
  year: number | null
  cycleName: string | null
  activePhase?: string | null
  assignments: GmEvaluationHubAssignmentApiRow[]
}

export interface GmEvaluationHubConfirmLineBody {
  assignmentId: string
  /** Chỉ gửi khi assignment ASM 602 (chấm điểm cuối kỳ). */
  endGmScore?: number
  /** Comment theo từng KPI của GM — ghi vào `kpi_assignments.evidences.gmComment`. */
  gmComment?: string
}

export interface GmEvaluationHubConfirmBody {
  cycleId: string
  evaluationUserId: string
  /** Bắt buộc khi có dòng 602; lưu portfolio hoặc promotion theo `promotion`. */
  supervisorComment?: string
  /** true = tab Promotion — lưu evaluation_supervisor_comments_promotion. */
  promotion?: boolean
  lines: GmEvaluationHubConfirmLineBody[]
}

export interface GmEvaluationHubConfirmResult {
  updatedCount: number
  skippedCount: number
}

export interface GmEvaluationHubUnlockBody {
  cycleId: string
  evaluationUserId: string
  promotion?: boolean
}
