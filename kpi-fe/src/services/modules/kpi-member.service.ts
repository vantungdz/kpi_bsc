/**
 * kpi-member.service.ts
 * API Member KPI — baseURL thường là /api/v1 (xem .env.example)
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { MemberKpiDashboard, KpiSheet, MemberKpiFormMeta } from '@/types/kpi'

export interface UpdateMemberSheetItemBody {
  /** 1–5 */
  selfScore?: number
  /** Chuỗi JSON ghi vào kpi_assignments.evidences (JSONB) */
  evidences?: string
}

/** document/db/README.md — Flow 3: member đề xuất KPI (ASM 402) */
export interface CreateIndividualKpiBody {
  cycleYear: number
  kpiName: string
  description?: string
  weight: number
  /** Perspective BSC — FK kpi_categories.id */
  categoryId: string
  /** CALC_RULE sys_status_codes: 801–804 */
  calculationRuleCode: number
}

/** GET …/kpi/member/dashboard?year= */
export async function apiGetMemberKpiDashboard(year?: number): Promise<ApiResponse<MemberKpiDashboard>> {
  return http.get('/kpi/member/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET …/kpi/member/form-meta */
export async function apiGetMemberKpiFormMeta(): Promise<ApiResponse<MemberKpiFormMeta>> {
  return http.get('/kpi/member/form-meta').then(r => r.data)
}

/** PUT …/kpi/member/sheet/:assignmentId */
export async function apiUpdateMemberSheetItem(
  assignmentId: string,
  body: UpdateMemberSheetItemBody,
): Promise<ApiResponse<KpiSheet>> {
  return http.put(`/kpi/member/sheet/${assignmentId}`, body).then(r => r.data)
}

/** POST …/kpi/member/sheet/submit — Flow 2+5: bulk 404→405 + chuyển đợt */
export async function apiSubmitMemberSheet(year: number): Promise<ApiResponse<void>> {
  return http.post('/kpi/member/sheet/submit', { year }).then(r => r.data)
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

export const memberKpiService = {
  getDashboard: (year?: number) => apiGetMemberKpiDashboard(year).then(r => r.data),
  getFormMeta: () => apiGetMemberKpiFormMeta().then(r => r.data),
  updateSheetItem: (assignmentId: string, body: UpdateMemberSheetItemBody) =>
    apiUpdateMemberSheetItem(assignmentId, body).then(r => r.data),
  submit: (year: number) => apiSubmitMemberSheet(year).then(r => r.data),
  saveDraft: (year: number) => apiSaveDraft(year).then(r => r.data),
  createIndividualKpi: (body: CreateIndividualKpiBody) =>
    apiCreateIndividualKpi(body).then(r => r.data),
}
