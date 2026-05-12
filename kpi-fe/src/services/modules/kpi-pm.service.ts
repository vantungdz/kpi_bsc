/**
 * kpi-pm.service.ts
 * API calls cho PM KPI Dashboard và Quản lý giao việc
 */
import http from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { GmProcessTimelineApiResponse } from '@/services/modules/kpi-gm.service'
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

/** GET /v1/pm/dashboard/process-timeline?year= — timeline vấn đề chỉ trong section của PM đăng nhập. */
export async function apiGetPmProcessTimeline(year: number): Promise<GmProcessTimelineApiResponse> {
  return http
    .get<ApiResponse<GmProcessTimelineApiResponse>>('/pm/dashboard/process-timeline', {
      params: { year },
    })
    .then((r) => r.data.data)
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

/**
 * GET /kpi/strategic-kpis/{id} — Chi tiết KPI (form GM/PM).
 * @param parentAssignmentId — ID assignment của PM trên portfolio; BE chỉ trả member cascade dưới dòng đó.
 */
export async function apiGetKpiDetail(
  kpiId: string,
  parentAssignmentId?: string,
): Promise<any> {
  return http
    .get(`/kpi/strategic-kpis/${kpiId}`, {
      params: parentAssignmentId ? { parentAssignmentId } : undefined,
    })
    .then((r) => r.data)
}

/** POST /kpi/strategic-kpis/cascade — PM giao việc / phân rã KPI cho Members */
export async function apiCascadeKpi(payload: any): Promise<any> {
  return http.post('/kpi/strategic-kpis/cascade', payload).then(r => r.data)
}

/** POST /kpi/strategic-kpis/status/bulk-update — PM update status KPI */
export async function apiBulkUpdateKpiStatus(payload: any): Promise<any> {
  return http.put('/kpi/strategic-kpis/status/bulk-update', payload).then(r => r.data)
}

/** GET /v1/pm/dashboard/pm-portfolio-evaluation-gate?year= — toàn team đã nộp KPI Member (individual/team ≥501) cho PM chưa. */
export type PmPortfolioEvaluationGate = {
  allPortfolioSubmittedToPm: boolean
  pendingMembers: { userId: string; fullName: string }[]
}

export async function apiGetPmPortfolioEvaluationGate(
  year: number,
): Promise<ApiResponse<PmPortfolioEvaluationGate>> {
  return http
    .get<ApiResponse<PmPortfolioEvaluationGate>>('/pm/dashboard/pm-portfolio-evaluation-gate', {
      params: { year },
    })
    .then((r) => r.data)
}

/** GET /api/pm/dashboard/team-members?year=... — Get team hierarchy (Used in PmTeamMembersTab.vue) */
export async function apiGetTeamHierarchy(year?: string): Promise<ApiResponse<any>> {
  return http.get('/pm/dashboard/team-members', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET /api/pm/dashboard/member-kpis?year=... — Get member KPI (Used in PmTeamMembersTab.vue) */
export async function apiGetMemberKpi(year?: string): Promise<ApiResponse<any>> {
  return http.get('/pm/dashboard/member-kpis', { params: year ? { year } : {} }).then(r => r.data)
}

/** GET /api/pm/dashboard/team-members/{memberId}/kpis?year=... — Get KPI details for a specific member */
export async function apiGetMemberKpiDetails(memberId: string, year: number): Promise<ApiResponse<any[]>> {
  return http.get(`/pm/dashboard/team-members/${memberId}/kpis`, { params: { year } }).then(r => r.data)
}

/** Đề xuất KPI cá nhân (402) — member có supervisor = PM */
export interface PmMemberKpiApprovalItem {
  assignmentId: string
  cycleId: string
  userId: string
  userFullName: string
  /** Các roles.code, nối bằng ||| — từ BE list PM approvals. */
  userRoleCodes?: string | null
  kpiName: string
  targetDescription: string | null
  targetValue: number | null
  weight: number | null
  categoryName: string | null
  unitCode: number | null
  calculationRuleCode: number | null
  calculationTypeCode: number | null
  typeCode: number | null
  requestedAt: string | null
  justification: string | null
}

export async function apiListPmMemberKpiApprovals(
  year: number,
): Promise<ApiResponse<PmMemberKpiApprovalItem[]>> {
  return http
    .get('/pm/dashboard/member-kpi-approvals', { params: { year } })
    .then((r) => r.data)
}

export async function apiPmMemberKpiApprovalDecision(body: {
  year: number
  assignmentId: string
  approve: boolean
  rejectReason?: string
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/member-kpi-approvals/decision', body).then((r) => r.data)
}

export async function apiPmSubmitFeedbackToGm(body: {
  year: number
  assignmentId: string
  feedbackNote: string
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/gm-feedback', body).then((r) => r.data)
}

export async function apiPmMemberFeedbackDecision(body: {
  year: number
  assignmentId: string
  approve: boolean
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/member-feedbacks/decision', body).then((r) => r.data)
}

/** PM chấp nhận feedback (407→404) + lưu cascade trong một request — khớp transaction backend. */
export async function apiPmAcceptMemberFeedbackWithCascade(body: {
  year: number
  memberFeedbackAssignmentId: string
  kpiInformationId: string
  cycleId: string
  parentAssignmentId?: string | null
  memberTargets: Record<string, number | null>
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/member-feedbacks/accept-with-cascade', body).then((r) => r.data)
}

export async function apiPmSaveMemberKpiComment(body: {
  year: number
  assignmentId: string
  pmComment: string
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/member-kpi-comment', body).then((r) => r.data)
}

export async function apiPmSaveMemberSupervisorComment(body: {
  year: number
  memberId: string
  pmComment: string
  /** true = tab Promotion KPI; false/omit = KPI Member (portfolio). */
  promotion?: boolean
}): Promise<ApiResponse<null>> {
  return http.post('/pm/dashboard/member-supervisor-comment', body).then((r) => r.data)
}

export type PmMemberReviewMeta = {
  evaluationCommentsPortfolio: string | null
  evaluationCommentsPromotion: string | null
  supervisorCommentsPortfolio: string | null
  supervisorCommentsPromotion: string | null
}

/** GET /v1/pm/dashboard/team-members/{memberId}/review-meta?year= */
export async function apiGetPmMemberReviewMeta(
  memberId: string,
  year: number,
): Promise<ApiResponse<PmMemberReviewMeta>> {
  return http
    .get(`/pm/dashboard/team-members/${memberId}/review-meta`, { params: { year } })
    .then((r) => r.data)
}

export async function apiDeleteSelfCreatedPmKpi(assignmentId: string): Promise<ApiResponse<null>> {
  return http.delete(`/kpi/pm/portfolio/${assignmentId}`).then((r) => r.data)
}

// ==========================================
// SERVICE EXPORT
// ==========================================

export const pmKpiService = {
  getDashboard: (year?: number) => apiGetPmKpiDashboard(year).then(r => r.data),
  getInitialization: (year?: string) => apiGetPmDashboardInit(year).then(r => r.data),
  getProcessTimeline: (year: number) => apiGetPmProcessTimeline(year),
  scoreItem: (memberId: string, itemId: string, score: number) => apiPmScore(memberId, itemId, score).then(r => r.data),
  approveSheet: (memberId: string, year: number) => apiPmApproveSheet(memberId, year).then(r => r.data),
  
  // Tích hợp API mới
  getRegistrationInitData: () => apiGetRegistrationInitData().then(r => r.data),
  registerKpi: (payload: KpiRegistrationRequest) => apiRegisterKpi(payload).then(r => r.data),
  getKpiDetail: (kpiId: string, parentAssignmentId?: string) =>
    apiGetKpiDetail(kpiId, parentAssignmentId).then((r) => r.data),
  cascadeKpi: (payload: any) => apiCascadeKpi(payload).then(r => r.data),
  bulkUpdateKpiStatus: (payload: any) => apiBulkUpdateKpiStatus(payload).then(r => r.data),
  getTeamHierarchy: (year?: string) => apiGetTeamHierarchy(year).then(r => r.data),
  getPmPortfolioEvaluationGate: (year: number) =>
    apiGetPmPortfolioEvaluationGate(year).then((r) => r.data),
  getMemberKpi: (year?: string) => apiGetMemberKpi(year).then(r => r.data),
  getMemberKpiDetails: (memberId: string, year: number) => apiGetMemberKpiDetails(memberId, year).then(r => r.data),
  listMemberKpiApprovals: (year: number) =>
    apiListPmMemberKpiApprovals(year).then((r) => r.data),
  decideMemberKpiApproval: (body: { year: number; assignmentId: string; approve: boolean; rejectReason?: string }) =>
    apiPmMemberKpiApprovalDecision(body).then((r) => r.data),
  submitFeedbackToGm: (body: { year: number; assignmentId: string; feedbackNote: string }) =>
    apiPmSubmitFeedbackToGm(body).then((r) => r.data),
  decideMemberFeedback: (body: { year: number; assignmentId: string; approve: boolean }) =>
    apiPmMemberFeedbackDecision(body).then((r) => r.data),
  acceptMemberFeedbackWithCascade: (body: Parameters<typeof apiPmAcceptMemberFeedbackWithCascade>[0]) =>
    apiPmAcceptMemberFeedbackWithCascade(body).then((r) => r.data),
  saveMemberKpiComment: (body: Parameters<typeof apiPmSaveMemberKpiComment>[0]) =>
    apiPmSaveMemberKpiComment(body).then((r) => r.data),
  saveMemberSupervisorComment: (body: Parameters<typeof apiPmSaveMemberSupervisorComment>[0]) =>
    apiPmSaveMemberSupervisorComment(body).then((r) => r.data),
  getMemberReviewMeta: (memberId: string, year: number) =>
    apiGetPmMemberReviewMeta(memberId, year).then((r) => r.data),
  deleteSelfCreatedPmKpi: (assignmentId: string) => apiDeleteSelfCreatedPmKpi(assignmentId).then((r) => r.data),
}

// Thêm alias để tương thích với file PmAssignKpiDrawer.vue ở bước trước (vì component đang import tên này)
export const KpiPmService = pmKpiService;