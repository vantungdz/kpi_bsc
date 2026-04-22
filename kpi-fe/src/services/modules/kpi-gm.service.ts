/**
 * kpi-gm.service.ts
 * API calls cho GM KPI Dashboard
 *
 * Khi VITE_USE_MOCK=true: intercepted bởi mock-adapter.ts → dùng gm-kpi.mock.ts
 * Khi VITE_USE_MOCK=false: gọi thẳng backend Java
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { GmKpiDashboard, KpiSection, KpiSectionMember } from '@/types/kpi'

/** GET /api/kpi/gm/dashboard?year=2025 */
export async function apiGetGmKpiDashboard(year?: number): Promise<ApiResponse<GmKpiDashboard>> {
  return http.get('/kpi/gm/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET /api/kpi/gm/sections/:sectionId/members?year=2025 */
export async function apiGetSectionMembers(sectionId: string, year?: number): Promise<ApiResponse<KpiSectionMember[]>> {
  return http.get(`/kpi/gm/sections/${sectionId}/members`, { params: year ? { year } : {} }).then(r => r.data)
}

export const gmKpiService = {
  getDashboard: (year?: number) => apiGetGmKpiDashboard(year).then(r => r.data),
  getSectionMembers: (sectionId: string, year?: number) => apiGetSectionMembers(sectionId, year).then(r => r.data),
}
