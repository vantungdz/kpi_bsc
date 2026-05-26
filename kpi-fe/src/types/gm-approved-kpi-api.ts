/** GET /kpi/gm/approved-kpi-queue?cycleId= */

export interface GmApprovedKpiQueueItemApi {
  assignmentId: string
  cycleId: string
  statusCode: number | null
  statusName: string | null
  statusDescription: string | null
  userId: string
  userFullName: string | null
  userUsername: string | null
  /** roles.code nối ||| */
  userRoleCodes?: string | null
  /** ISO — thời điểm assignment (created_at) */
  requestedAt?: string | null
  masterCode: string | null
  masterName: string | null
  targetValue: number | string | null
  targetDescription: string | null
  weight: number | string | null
  important: boolean | null
  categoryName: string | null
  typeCode: number | null
  unitCode: number | null
  feedbackNote: string | null
  /** roles.code của người tạo KPI master */
  creatorRoleCode?: string | null
  baselineTargetValue?: number | string | null
  baselineScoringDescription?: string | null
  targetChanged?: boolean | null
  scoringChanged?: boolean | null
  assigneeHasEdits?: boolean | null
}

export interface GmApprovedKpiDecisionBody {
  cycleId: string
  assignmentId: string
  approve: boolean
  /** Bắt buộc khi `approve === false` và 403→406 (lưu update_reason). */
  rejectReason?: string | null
  /** Từ chối một KPI trong drawer: các KPI khác cùng member → 404. */
  resetDrawerSiblingsToPendingAcceptance?: boolean
}

export interface GmApprovedKpiDecisionResultApi {
  updatedCount: number
  siblingsResetToPendingAcceptanceCount?: number
}
