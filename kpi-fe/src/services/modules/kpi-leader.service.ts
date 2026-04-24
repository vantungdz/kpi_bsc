/**
 * kpi-leader.service.ts
 * API calls cho Leader KPI Dashboard
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import {LeaderKpiDashboard, KpiItem, LeaderKpiInformationResponse} from '@/types/kpi'

/** GET /api/kpi/leader/members */
export async function apiGetLeaderMemberList(): Promise<ApiResponse<LeaderMemberListResponse>> {
  return http.get('/kpi/leader/members').then(r => r.data)
}

/** GET /api/kpi/leader/kpi-info */
export async function apiGetLeaderKpiInfo(year: number, type: 'INDIVIDUAL' | 'PROMOTION', userId?: string): Promise<ApiResponse<LeaderKpiInformationResponse>> {
  return http.get('/kpi/leader/kpi-info', { params: { year, type, userId } }).then(r => r.data)
}

/** GET /api/kpi/leader/dashboard?year=2025 */
export async function apiGetLeaderKpiDashboard(year?: number): Promise<ApiResponse<LeaderKpiDashboard>> {
  return http.get('/kpi/leader/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT /api/kpi/leader/sheet/:memberId/:itemId — Leader scores a member's KPI item */
export async function apiLeaderScore(memberId: string, itemId: string, leaderScore: number): Promise<ApiResponse<KpiItem>> {
  return http.put(`/kpi/leader/sheet/${memberId}/${itemId}`, { leaderScore }).then(r => r.data)
}

export const leaderKpiService = {
  getMemberList: () => apiGetLeaderMemberList().then(r => r.data),
  getKpiInfo: (year: number, type: 'INDIVIDUAL' | 'PROMOTION', userId?: string) => apiGetLeaderKpiInfo(year, type, userId).then(r => r.data),
  getDashboard: (year?: number) => apiGetLeaderKpiDashboard(year).then(r => r.data),
  scoreItem: (memberId: string, itemId: string, score: number) => apiLeaderScore(memberId, itemId, score).then(r => r.data),
}
