/**
 * kpi-member.service.ts
 * API calls cho Member KPI Dashboard & KPI Sheet
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { MemberKpiDashboard, KpiSheet, KpiItem } from '@/types/kpi'

/** GET /api/kpi/member/dashboard?year=2025 */
export async function apiGetMemberKpiDashboard(year?: number): Promise<ApiResponse<MemberKpiDashboard>> {
  return http.get('/kpi/member/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT /api/kpi/member/sheet/:itemId — update self-score */
export async function apiUpdateSelfScore(itemId: string, selfScore: number): Promise<ApiResponse<KpiItem>> {
  return http.put(`/kpi/member/sheet/${itemId}`, { selfScore }).then(r => r.data)
}

/** POST /api/kpi/member/sheet/submit — submit evaluation */
export async function apiSubmitEvaluation(year: number): Promise<ApiResponse<KpiSheet>> {
  return http.post('/kpi/member/sheet/submit', { year }).then(r => r.data)
}

/** POST /api/kpi/member/sheet/save-draft — save draft */
export async function apiSaveDraft(year: number): Promise<ApiResponse<KpiSheet>> {
  return http.post('/kpi/member/sheet/save-draft', { year }).then(r => r.data)
}

export const memberKpiService = {
  getDashboard: (year?: number) => apiGetMemberKpiDashboard(year).then(r => r.data),
  updateSelfScore: (itemId: string, selfScore: number) => apiUpdateSelfScore(itemId, selfScore).then(r => r.data),
  submit: (year: number) => apiSubmitEvaluation(year).then(r => r.data),
  saveDraft: (year: number) => apiSaveDraft(year).then(r => r.data),
}
