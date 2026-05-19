import http from '@/services/api'
import type {ApiResponse} from '@/types/api'
import {KpiCycleResponse} from "@/types/shared/kpi-cycle.type";
import type { GmKpiCycleOption } from '@/types/gm-kpi-cycle'


/** GET /v1/common/kpi-cycles/:year — Lấy thông tin các mốc thời gian của kỳ KPI theo năm */
export async function apiGetKpiCycleByYear(year: number): Promise<ApiResponse<KpiCycleResponse>> {
    return http.get(`/common/kpi-cycles/${year}`).then(r => r.data)
}

/** GET /v1/common/kpi-cycles — Danh sách chu kỳ KPI dùng cho dropdown năm */
export async function apiGetKpiCyclesForDropdown(): Promise<ApiResponse<GmKpiCycleOption[]>> {
    return http.get('/common/kpi-cycles').then(r => r.data)
}

export const kpiCycleService = {
    getKpiCycleByYear: (year: number) => apiGetKpiCycleByYear(year).then(r => r.data),
    getKpiCyclesForDropdown: () => apiGetKpiCyclesForDropdown().then(r => r.data),
}