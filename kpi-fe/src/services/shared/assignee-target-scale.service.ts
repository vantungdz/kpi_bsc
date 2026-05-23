/**
 * API dùng chung: assignee (PM / Leader / Member) sửa target & thang điểm trên assignment.
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { KpiScoringRulesPayload } from '@/types/gm-strategic-kpi-edit'

export interface AssigneeTargetScaleUpdateBody {
  targetValue: number
  targetDescription: KpiScoringRulesPayload | null
}

export interface AssigneeTargetScaleUpdateResult {
  assignmentId: string
  assignmentTargetValue: number
  targetDescription: string
}

/** PUT /v1/common/assignments/:assignmentId/assignee-target-scale */
export async function apiUpdateAssigneeTargetScale(
  assignmentId: string,
  body: AssigneeTargetScaleUpdateBody,
): Promise<AssigneeTargetScaleUpdateResult> {
  const res = await http.put<ApiResponse<AssigneeTargetScaleUpdateResult>>(
    `/common/assignments/${assignmentId}/assignee-target-scale`,
    body,
  )
  const data = res.data?.data
  if (!data?.assignmentId) {
    throw new Error(res.data?.message?.trim() || 'Không lưu được thay đổi.')
  }
  return data
}

export const assigneeTargetScaleService = {
  update: apiUpdateAssigneeTargetScale,
}
