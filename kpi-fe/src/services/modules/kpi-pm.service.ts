/**
 * kpi-pm.service.ts
 * API calls cho PM KPI Dashboard và Quản lý giao việc
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { 
  PmKpiDashboard, 
  KpiItem,
  KpiRegistrationInitResponse, // Thêm mới cho Assign Drawer
  KpiRegistrationRequest       // Thêm mới cho Assign Drawer
} from '@/types/kpi'

/** GET /api/kpi/pm/dashboard?year=2025 */
export async function apiGetPmKpiDashboard(year?: number): Promise<ApiResponse<PmKpiDashboard>> {
  return http.get('/kpi/pm/dashboard', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET /api/pm/dashboard/init?year=... */
export async function apiGetPmDashboardInit(year?: string): Promise<ApiResponse<PmKpiDashboard>> {
  return http.get('/pm/dashboard/init', { params: year ? { year } : {} }).then(r => r.data)
}

/** PUT /api/kpi/pm/sheet/:memberId/:itemId — PM scores a member's KPI item */
export async function apiPmScore(memberId: string, itemId: string, pmScore: number): Promise<ApiResponse<KpiItem>> {
  return http.put(`/kpi/pm/sheet/${memberId}/${itemId}`, { pmScore }).then(r => r.data)
}

/** POST /api/kpi/pm/sheet/:memberId/approve — PM approves a member's KPI sheet */
export async function apiPmApproveSheet(memberId: string, year: number): Promise<ApiResponse<null>> {
  return http.post(`/kpi/pm/sheet/${memberId}/approve`, { year }).then(r => r.data)
}

// ==========================================
// CÁC API MỚI CHO CHỨC NĂNG ASSIGN/GIAO KPI
// ==========================================

/** GET /api/pm/kpis/registration/init — Lấy dữ liệu khởi tạo cho form giao việc (Codes, Chu kỳ, Members...) */
export async function apiGetRegistrationInitData(): Promise<ApiResponse<KpiRegistrationInitResponse>> {
  return http.get('/kpi/pm/registration/init').then(r => r.data)
}

/** POST /api/pm/kpis/registration — PM đăng ký tạo mới hoặc assign KPI có sẵn cho members */
export async function apiRegisterKpi(payload: KpiRegistrationRequest): Promise<ApiResponse<void>> {
  return http.post('/kpi/pm/registration', payload).then(r => r.data)
}

/** GET /kpi/strategic-kpis/{id} — Lấy chi tiết KPI để fill vào Form */
export async function apiGetKpiDetail(kpiId: string): Promise<any> {
  return http.get(`/kpi/strategic-kpis/${kpiId}`).then(r => r.data)
}

/** POST /kpi/strategic-kpis/cascade — PM giao việc / phân rã KPI cho Members */
export async function apiCascadeKpi(payload: any): Promise<any> {
  return http.post('/kpi/strategic-kpis/cascade', payload).then(r => r.data)
}

// ==========================================
// SERVICE EXPORT
// ==========================================

export const pmKpiService = {
  getDashboard: (year?: number) => apiGetPmKpiDashboard(year).then(r => r.data),
  getInitialization: (year?: string) => apiGetPmDashboardInit(year).then(r => r.data),
  scoreItem: (memberId: string, itemId: string, score: number) => apiPmScore(memberId, itemId, score).then(r => r.data),
  approveSheet: (memberId: string, year: number) => apiPmApproveSheet(memberId, year).then(r => r.data),
  
  // Tích hợp API mới
  getRegistrationInitData: () => apiGetRegistrationInitData().then(r => r.data),
  registerKpi: (payload: KpiRegistrationRequest) => apiRegisterKpi(payload).then(r => r.data),
  getKpiDetail: (kpiId: string) => apiGetKpiDetail(kpiId).then(r => r.data),
  cascadeKpi: (payload: any) => apiCascadeKpi(payload).then(r => r.data),
}

// Thêm alias để tương thích với file PmAssignKpiDrawer.vue ở bước trước (vì component đang import tên này)
export const KpiPmService = pmKpiService;