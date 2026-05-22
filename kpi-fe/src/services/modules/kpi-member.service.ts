/**
 * kpi-member.service.ts
 * API Member KPI — baseURL thường là /api/v1 (xem .env.example)
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { MemberKpiDashboard, KpiSheet, MemberKpiFormMeta } from '@/types/kpi'
import type { KpiDashboardOptions } from '@/types/kpi-dashboard-options'

export type MemberSheetSubmitType = 'INDIVIDUAL' | 'PROMOTION'

export interface UpdateMemberSheetItemBody {
  /** 1–5 */
  selfScore?: number
  /** Chuỗi JSON ghi vào kpi_assignments.evidences (JSONB) */
  evidences?: string
}

export interface SubmitFeedbackBody {
  feedbackComment: string
}

export interface MemberFeedbackSubmitResponse {
  feedbackTargetRoleCode?: string | null
  assignmentStatusName?: string | null
}

/** document/db/README.md — Flow 3: member đề xuất KPI (ASM 402) */
export interface CreateIndividualKpiBody {
  cycleYear: number
  kpiName: string
  description?: string
  weight: number
  /** Perspective BSC — FK kpi_categories.id */
  categoryId: string
  /** CALC_RULE sys_status_codes: 802 AVERAGE | 803 COMMENT */
  calculationRuleCode: number
  /** CALC_TYPE: 701 ACTUAL_OVER_PLAN | 702 PLAN_OVER_ACTUAL — null khi CALC_RULE = 803 */
  calculationTypeCode?: number | null
}

/** GET …/kpi/member/dashboard-options */
export async function apiGetMemberDashboardOptions(): Promise<ApiResponse<KpiDashboardOptions>> {
  return http.get('/kpi/member/dashboard-options').then(r => r.data)
}

/** GET …/kpi/member/dashboard?year= */
export async function apiGetMemberKpiDashboard(year?: number): Promise<ApiResponse<MemberKpiDashboard>> {
  return http.get('/kpi/member/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET …/kpi/member/form-meta */
export async function apiGetMemberKpiFormMeta(year?: number): Promise<ApiResponse<MemberKpiFormMeta>> {
  return http.get('/kpi/member/form-meta', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT …/kpi/member/sheet/:assignmentId */
export async function apiUpdateMemberSheetItem(
  assignmentId: string,
  body: UpdateMemberSheetItemBody,
): Promise<ApiResponse<KpiSheet>> {
  return http.put(`/kpi/member/sheet/${assignmentId}`, body).then(r => r.data)
}

/** POST …/kpi/member/sheet/:assignmentId/feedback */
export async function apiSubmitFeedback(
  assignmentId: string,
  body: SubmitFeedbackBody,
): Promise<ApiResponse<MemberFeedbackSubmitResponse>> {
  return http.post(`/kpi/member/sheet/${assignmentId}/feedback`, body).then(r => r.data)
}

/** POST …/kpi/member/sheet/submit — Flow 2+5: bulk 404→405 + chuyển đợt */
export async function apiSubmitMemberSheet(
  year: number,
  kpiType: MemberSheetSubmitType = 'INDIVIDUAL',
  evaluationComments?: string,
): Promise<ApiResponse<void>> {
  return http.post('/kpi/member/sheet/submit', { year, kpiType, evaluationComments }).then(r => r.data)
}

/** POST …/kpi/member/sheet/save-draft */
export async function apiSaveDraft(year: number): Promise<ApiResponse<KpiSheet>> {
  return http.post('/kpi/member/sheet/save-draft', { year }).then(r => r.data)
}

/** POST …/kpi/member/individual-kpi — Flow 3 */
export async function apiCreateIndividualKpi(
  body: CreateIndividualKpiBody,
): Promise<ApiResponse<{ assignmentId: string }>> {
  return http.post('/kpi/member/individual-kpi', body).then(r => r.data)
}

export async function apiDeleteSelfCreatedKpi(
  assignmentId: string,
): Promise<ApiResponse<void>> {
  return http.delete(`/kpi/member/individual-kpi/${assignmentId}`).then(r => r.data)
}

export const memberKpiService = {
  getDashboardOptions: () => apiGetMemberDashboardOptions().then(r => r.data),
  getDashboard: (year?: number) => apiGetMemberKpiDashboard(year).then(r => r.data),
  getFormMeta: (year?: number) => apiGetMemberKpiFormMeta(year).then(r => r.data),
  updateSheetItem: (assignmentId: string, body: UpdateMemberSheetItemBody) =>
    apiUpdateMemberSheetItem(assignmentId, body).then(r => r.data),
  submitFeedback: (assignmentId: string, feedbackComment: string) =>
    apiSubmitFeedback(assignmentId, { feedbackComment }).then(r => r.data),
  submit: (year: number, kpiType: MemberSheetSubmitType = 'INDIVIDUAL', evaluationComments?: string) =>
    apiSubmitMemberSheet(year, kpiType, evaluationComments).then(r => r.data),
  saveDraft: (year: number) => apiSaveDraft(year).then(r => r.data),
  createIndividualKpi: (body: CreateIndividualKpiBody) =>
    apiCreateIndividualKpi(body).then(r => r.data),
  deleteSelfCreatedKpi: (assignmentId: string) =>
    apiDeleteSelfCreatedKpi(assignmentId).then(r => r.data),
}
