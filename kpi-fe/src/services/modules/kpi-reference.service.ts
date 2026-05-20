import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { KpiCalculationReferenceData } from '@/types/kpi-calculation-reference'
import type { KpiUnitOption } from '@/types/kpi-unit'
import type { KpiTypeOption } from '@/types/kpi-type-option'
import type { MemberByRankOption } from '@/types/member-by-rank'
import type { RankOption } from '@/types/rank-option'
import type { DepartmentManagerOption } from '@/types/department-manager'

/** GET /kpi/reference/kpi-types-strategic — KPI_TYPE (101–103) cho form tạo strategic. */
export async function apiGetStrategicKpiTypes(): Promise<KpiTypeOption[]> {
  return http
    .get<ApiResponse<KpiTypeOption[]>>('/kpi/reference/kpi-types-strategic')
    .then((r) => r.data.data)
}

/** GET /kpi/reference/kpi-units — đơn vị KPI từ `sys_status_codes`. */
export async function apiGetKpiUnits(): Promise<KpiUnitOption[]> {
  return http.get<ApiResponse<KpiUnitOption[]>>('/kpi/reference/kpi-units').then((r) => r.data.data)
}

/** GET /kpi/reference/calculation-reference — mỗi CALC_RULE (dropdown) + CALC_TYPE được phép (radio, theo DB). */
export async function apiGetCalculationReference(): Promise<KpiCalculationReferenceData> {
  return http
    .get<ApiResponse<KpiCalculationReferenceData>>('/kpi/reference/calculation-reference')
    .then((r) => r.data.data)
}

/** GET /kpi/reference/department-managers — user active có role PM. */
export async function apiGetDepartmentManagers(): Promise<DepartmentManagerOption[]> {
  return http
    .get<ApiResponse<DepartmentManagerOption[]>>('/kpi/reference/department-managers')
    .then((r) => r.data.data)
}

/** GET /kpi/reference/ranks — `ranks` (code, name) cho KPI individual. */
export async function apiGetRanks(): Promise<RankOption[]> {
  return http.get<ApiResponse<RankOption[]>>('/kpi/reference/ranks').then((r) => r.data.data)
}

/** GET /kpi/reference/members-by-rank — user có `job_titles` → `ranks.code` = rankCode. */
export async function apiGetMembersByRank(rankCode: string): Promise<MemberByRankOption[]> {
  return http
    .get<ApiResponse<MemberByRankOption[]>>('/kpi/reference/members-by-rank', { params: { rankCode } })
    .then((r) => r.data.data)
}

/** GET /kpi/reference/promotion-assignees — user active + phòng ban chính + rank (KPI Promotion). */
export async function apiGetPromotionAssignees(): Promise<MemberByRankOption[]> {
  return http
    .get<ApiResponse<MemberByRankOption[]>>('/kpi/reference/promotion-assignees')
    .then((r) => r.data.data)
}
