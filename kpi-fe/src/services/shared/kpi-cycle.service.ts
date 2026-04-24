import http from '@/services/api'
import type {ApiResponse} from '@/types/api'
import {KpiCycleResponse} from "@/types/shared/kpi-cycle.type";


/** GET /v1/common/kpi-cycles/:year — Lấy thông tin các mốc thời gian của kỳ KPI theo năm */
export async function apiGetKpiCycleByYear(year: number): Promise<ApiResponse<KpiCycleResponse>> {
    return http.get(`/common/kpi-cycles/${year}`).then(r => r.data)
}

export const kpiCycleService = {
    getKpiCycleByYear: (year: number) => apiGetKpiCycleByYear(year).then(r => r.data),
}