/**
 * kpi-pm.service.ts
 * API calls cho PM KPI Dashboard
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { PmKpiDashboard, KpiItem } from '@/types/kpi'

/** GET /api/kpi/pm/dashboard?year=2025 */
export async function apiGetPmKpiDashboard(year?: number): Promise<ApiResponse<PmKpiDashboard>> {
  return http.get('/kpi/pm/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT /api/kpi/pm/sheet/:memberId/:itemId — PM scores a member's KPI item */
export async function apiPmScore(memberId: string, itemId: string, pmScore: number): Promise<ApiResponse<KpiItem>> {
  return http.put(`/kpi/pm/sheet/${memberId}/${itemId}`, { pmScore }).then(r => r.data)
}

/** POST /api/kpi/pm/sheet/:memberId/approve — PM approves a member's KPI sheet */
export async function apiPmApproveSheet(memberId: string, year: number): Promise<ApiResponse<null>> {
  return http.post(`/kpi/pm/sheet/${memberId}/approve`, { year }).then(r => r.data)
}

export const pmKpiService = {
  getDashboard: (year?: number) => apiGetPmKpiDashboard(year).then(r => r.data),
  scoreItem: (memberId: string, itemId: string, score: number) => apiPmScore(memberId, itemId, score).then(r => r.data),
  approveSheet: (memberId: string, year: number) => apiPmApproveSheet(memberId, year).then(r => r.data),
}
