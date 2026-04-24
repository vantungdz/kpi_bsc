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
  masterCode: string | null
  masterName: string | null
  targetDescription: string | null
  weight: number | string | null
  important: boolean | null
  categoryName: string | null
  typeCode: number | null
}

export interface GmApprovedKpiDecisionBody {
  cycleId: string
  assignmentId: string
  approve: boolean
}

export interface GmApprovedKpiDecisionResultApi {
  updatedCount: number
}
