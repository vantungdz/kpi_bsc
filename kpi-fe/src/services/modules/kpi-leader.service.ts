/**
 * kpi-leader.service.ts
 * API calls cho Leader KPI Dashboard
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { LeaderKpiDashboard, KpiItem } from '@/types/kpi'

/** GET /api/kpi/leader/dashboard?year=2025 */
export async function apiGetLeaderKpiDashboard(year?: number): Promise<ApiResponse<LeaderKpiDashboard>> {
  return http.get('/kpi/leader/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT /api/kpi/leader/sheet/:memberId/:itemId — Leader scores a member's KPI item */
export async function apiLeaderScore(memberId: string, itemId: string, leaderScore: number): Promise<ApiResponse<KpiItem>> {
  return http.put(`/kpi/leader/sheet/${memberId}/${itemId}`, { leaderScore }).then(r => r.data)
}

export const leaderKpiService = {
  getDashboard: (year?: number) => apiGetLeaderKpiDashboard(year).then(r => r.data),
  scoreItem: (memberId: string, itemId: string, score: number) => apiLeaderScore(memberId, itemId, score).then(r => r.data),
}
