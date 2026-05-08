/** GET /kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá GM. */

export interface GmEvaluationHubAssignmentApiRow {
  assignmentId: string
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
  /** PM comment tổng từ user_kpi_summaries.evaluation_supervisor_comments. */
  supervisorComment: string | null
}

export interface GmEvaluationHubApiResponse {
  cycleId: string
  year: number | null
  cycleName: string | null
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
  /** Bắt buộc khi có dòng 602; 502-only có thể rỗng. */
  supervisorComment?: string
  lines: GmEvaluationHubConfirmLineBody[]
}

export interface GmEvaluationHubConfirmResult {
  updatedCount: number
  skippedCount: number
}
