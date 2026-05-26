/**
 * kpi-gm.service.ts
 * API calls cho GM KPI Dashboard
 *
 * Khi VITE_USE_MOCK=true: intercepted bởi mock-adapter.ts (payload tối thiểu, không file mock lớn).
 * Khi VITE_USE_MOCK=false: gọi thẳng backend Java
 */
import http from "@/services/api";
import type { ApiResponse } from "@/types/api";
import type { GmDiagnosticsHierarchyApiData } from "@/types/gm-diagnostics-api";
import type { GmKpiCategoryItem } from "@/types/gm-kpi-category";
import type {
  GmApprovedKpiDecisionBody,
  GmApprovedKpiDecisionResultApi,
  GmApprovedKpiQueueItemApi,
} from "@/types/gm-approved-kpi-api";
import type {
  GmEvaluationHubApiResponse,
  GmEvaluationHubConfirmBody,
  GmEvaluationHubConfirmResult,
  GmEvaluationHubUnlockBody,
} from "@/types/gm-evaluation-hub-api";
import type { GmKpiCycleOption } from "@/types/gm-kpi-cycle";
import type { GmCreateStrategicKpiResponseData } from "@/types/gm-strategic-kpi-create";
import type { GmPromotionCycleOption } from "@/types/gm-promotion-cycle";
import type { GmStrategicKpiEditData } from "@/types/gm-strategic-kpi-edit";
import type { GmTimelineIssueGroup } from "@/types/gm-workspace";
import type {
  GmCreateKpiTemplateBody,
  GmCreateKpiTemplateItemBody,
  GmKpiTemplateItemRow,
  GmKpiTemplatePackageRow,
  GmUpdateKpiTemplateBody,
  GmUpdateKpiTemplateItemBody,
} from "@/types/gm-kpi-template";
import type {
  GmAddDepartmentMembersBody,
  GmCreateDepartmentBody,
  GmDepartmentApiRow,
  GmDepartmentMemberCandidateApiRow,
  GmMemberApiRow,
  GmUpdateDepartmentBody,
} from "@/types/gm-department-api";
import type { GmKpiDashboard, KpiSection, KpiSectionMember } from "@/types/kpi";
import type {
  CreateGmRatingScaleBody,
  GmRatingScaleCycleStatus,
  GmRatingScaleDetail,
  GmRatingScaleLevel,
  GmRatingScaleSummary,
  PatchGmRatingScaleCycleStatusBody,
  SaveGmRatingScaleLevelBody,
} from "@/types/gm-rating-scale";

/** GET /kpi/gm/rating-scales */
export async function apiListGmRatingScales(): Promise<GmRatingScaleSummary[]> {
  return http
    .get<ApiResponse<GmRatingScaleSummary[]>>("/kpi/gm/rating-scales")
    .then((r) => r.data.data ?? []);
}

/** GET /kpi/gm/rating-scales/years/{year} */
export async function apiGetGmRatingScaleByYear(
  year: number,
): Promise<GmRatingScaleDetail> {
  return http
    .get<ApiResponse<GmRatingScaleDetail>>(`/kpi/gm/rating-scales/years/${year}`)
    .then((r) => r.data.data!);
}

/** PATCH /kpi/gm/rating-scales/cycles/{cycleId}/status */
export async function apiPatchGmRatingScaleCycleStatus(
  cycleId: string,
  body: PatchGmRatingScaleCycleStatusBody,
): Promise<GmRatingScaleCycleStatus> {
  return http
    .patch<ApiResponse<GmRatingScaleCycleStatus>>(
      `/kpi/gm/rating-scales/cycles/${cycleId}/status`,
      body,
    )
    .then((r) => r.data.data!);
}

/** POST /kpi/gm/rating-scales */
export async function apiCreateGmRatingScale(
  body: CreateGmRatingScaleBody,
): Promise<GmRatingScaleDetail> {
  return http
    .post<ApiResponse<GmRatingScaleDetail>>("/kpi/gm/rating-scales", body)
    .then((r) => r.data.data!);
}

/** POST /kpi/gm/rating-scales/cycles/{cycleId}/levels */
export async function apiAddGmRatingScaleLevel(
  cycleId: string,
  body: SaveGmRatingScaleLevelBody,
): Promise<GmRatingScaleLevel> {
  return http
    .post<ApiResponse<GmRatingScaleLevel>>(
      `/kpi/gm/rating-scales/cycles/${cycleId}/levels`,
      body,
    )
    .then((r) => r.data.data!);
}

/** PUT /kpi/gm/rating-scales/cycles/{cycleId}/levels/{levelId} */
export async function apiUpdateGmRatingScaleLevel(
  cycleId: string,
  levelId: string,
  body: SaveGmRatingScaleLevelBody,
): Promise<GmRatingScaleLevel> {
  return http
    .put<ApiResponse<GmRatingScaleLevel>>(
      `/kpi/gm/rating-scales/cycles/${cycleId}/levels/${levelId}`,
      body,
    )
    .then((r) => r.data.data!);
}

/** DELETE /kpi/gm/rating-scales/cycles/{cycleId}/levels/{levelId} */
export async function apiDeleteGmRatingScaleLevel(
  cycleId: string,
  levelId: string,
): Promise<void> {
  await http.delete(
    `/kpi/gm/rating-scales/cycles/${cycleId}/levels/${levelId}`,
  );
}

/** GET /api/kpi/gm/dashboard?year=2025 */
export async function apiGetGmKpiDashboard(
  year?: number,
): Promise<ApiResponse<GmKpiDashboard>> {
  return http
    .get("/kpi/gm/dashboard", { params: year ? { year } : {} })
    .then((r) => r.data);
}

/** GET /api/kpi/gm/sections/:sectionId/members?year=2025 */
export async function apiGetSectionMembers(
  sectionId: string,
  year?: number,
): Promise<ApiResponse<KpiSectionMember[]>> {
  return http
    .get(`/kpi/gm/sections/${sectionId}/members`, {
      params: year ? { year } : {},
    })
    .then((r) => r.data);
}

/** GET /kpi/gm/departments/:id/member-candidates — user chưa thuộc phòng (q, rankCode lặp). */
export async function apiListGmDepartmentMemberCandidates(
  departmentId: string,
  opts?: { q?: string; rankCodes?: string[] },
): Promise<GmDepartmentMemberCandidateApiRow[]> {
  const id = encodeURIComponent(departmentId.trim());
  const params: Record<string, string | string[] | undefined> = {};
  const q = opts?.q?.trim();
  if (q) params.q = q;
  const rc = opts?.rankCodes?.filter(Boolean);
  if (rc?.length) params.rankCode = rc;
  return http
    .get<
      ApiResponse<GmDepartmentMemberCandidateApiRow[]>
    >(`/kpi/gm/departments/${id}/member-candidates`, { params })
    .then((r) => r.data.data);
}

/** POST /kpi/gm/departments/:id/members */
export async function apiAddGmDepartmentMembers(
  departmentId: string,
  body: GmAddDepartmentMembersBody,
): Promise<GmDepartmentApiRow> {
  const id = encodeURIComponent(departmentId.trim());
  return http
    .post<
      ApiResponse<GmDepartmentApiRow>
    >(`/kpi/gm/departments/${id}/members`, body)
    .then((r) => r.data.data);
}

/** DELETE /kpi/gm/departments/:id/members/:userId */
export async function apiRemoveGmDepartmentMember(
  departmentId: string,
  userId: string,
): Promise<void> {
  const did = encodeURIComponent(departmentId.trim());
  const uid = encodeURIComponent(userId.trim());
  await http.delete<ApiResponse<null>>(
    `/kpi/gm/departments/${did}/members/${uid}`,
  );
}

export interface GmMemberKpiAssignment {
  assignmentId: string
  kpiInformationId: string
  kpiInfoTargetValue: number | null
  assignmentTargetValue: number | null
  weight: number | null
  masterName: string
  unitName: string | null
}

export interface GmCopyKpiItemPayload {
  kpiInfoId: string
  targetValue: number | null
}

/** Lấy KPI assignment của member cho chức năng Copy KPI */
export async function apiGetMemberKpiAssignments(
  userId: string,
  cycleId: string,
): Promise<GmMemberKpiAssignment[]> {
  const uid = encodeURIComponent(userId.trim())
  return http
    .get<ApiResponse<GmMemberKpiAssignment[]>>(`/kpi/gm/members/${uid}/kpi-assignments`, {
      params: { cycleId }
    })
    .then((r) => r.data.data)
}

/** Bulk assign KPI đã chọn sang member mới */
export async function apiCopyKpisToMember(
  targetUserId: string,
  cycleId: string,
  sourceUserId: string,
  items: GmCopyKpiItemPayload[],
): Promise<void> {
  const uid = encodeURIComponent(targetUserId.trim())
  await http.post<ApiResponse<null>>(`/kpi/gm/members/${uid}/copy-kpis`, {
    cycleId,
    sourceUserId,
    items,
  })
}

/** DELETE /kpi/gm/members/:userId — xóa hoàn toàn nhân viên khỏi hệ thống (GM). */
export async function apiDeleteGmMember(userId: string): Promise<void> {
  const uid = encodeURIComponent(userId.trim())
  await http.delete<ApiResponse<null>>(`/kpi/gm/members/${uid}`)
}

/** GET /kpi/gm/members — danh sách user active, không phụ thuộc phòng ban. */
export async function apiListGmMembers(): Promise<GmMemberApiRow[]> {
  return http
    .get<ApiResponse<GmMemberApiRow[]>>("/kpi/gm/members")
    .then((r) => r.data.data)
}

/** GET /kpi/gm/departments — danh sách phòng ban; `year` lọc KPI team theo năm chu kỳ. */
export async function apiListGmDepartments(
  year?: number,
): Promise<GmDepartmentApiRow[]> {
  return http
    .get<
      ApiResponse<GmDepartmentApiRow[]>
    >("/kpi/gm/departments", { params: year != null ? { year } : {} })
    .then((r) => r.data.data);
}

/** POST /kpi/gm/departments — tạo phòng ban (không có mã code). */
export async function apiCreateGmDepartment(
  body: GmCreateDepartmentBody,
): Promise<GmDepartmentApiRow> {
  return http
    .post<ApiResponse<GmDepartmentApiRow>>("/kpi/gm/departments", body)
    .then((r) => r.data.data);
}

/** PUT /kpi/gm/departments/:id */
export async function apiUpdateGmDepartment(
  departmentId: string,
  body: GmUpdateDepartmentBody,
): Promise<GmDepartmentApiRow> {
  const id = encodeURIComponent(departmentId.trim());
  return http
    .put<ApiResponse<GmDepartmentApiRow>>(`/kpi/gm/departments/${id}`, body)
    .then((r) => r.data.data);
}

/** DELETE /kpi/gm/departments/:id — xóa mềm. */
export async function apiDeleteGmDepartment(
  departmentId: string,
): Promise<ApiResponse<null>> {
  const id = encodeURIComponent(departmentId.trim());
  return http
    .delete<ApiResponse<null>>(`/kpi/gm/departments/${id}`)
    .then((r) => r.data);
}

/** Tránh gọi trùng `diagnostics-hierarchy` cùng `year` khi layout + drawer chạy song song. */
const diagnosticsHierarchyInflight = new Map<
  number,
  Promise<GmDiagnosticsHierarchyApiData>
>();

/** GET /kpi/gm/diagnostics-hierarchy?year= — catalog + Strategic diagnostics tree */
export async function apiGetGmDiagnosticsHierarchy(
  year: number,
): Promise<GmDiagnosticsHierarchyApiData> {
  const cached = diagnosticsHierarchyInflight.get(year);
  if (cached) return cached;

  const p = http
    .get<ApiResponse<GmDiagnosticsHierarchyApiData>>(
      "/kpi/gm/diagnostics-hierarchy",
      { params: { year } },
    )
    .then((r) => r.data.data)
    .finally(() => {
      diagnosticsHierarchyInflight.delete(year);
    });

  diagnosticsHierarchyInflight.set(year, p);
  return p;
}

/** GET /kpi/gm/kpi-categories — danh sách `kpi_categories` (dropdown tạo KPI). */
export async function apiGetGmKpiCategories(): Promise<GmKpiCategoryItem[]> {
  return http
    .get<ApiResponse<GmKpiCategoryItem[]>>("/kpi/gm/kpi-categories")
    .then((r) => r.data.data);
}

/** GET /kpi/gm/kpi-cycles-with-kpis — chu kỳ DB đã có `kpis_information` (năm nguồn sao chép). */
export async function apiGetGmKpiCyclesWithKpis(): Promise<GmKpiCycleOption[]> {
  return http
    .get<ApiResponse<GmKpiCycleOption[]>>("/kpi/gm/kpi-cycles-with-kpis")
    .then((r) => r.data.data);
}

/** GET /common/kpi-cycles — mọi chu kỳ trong `kpi_cycles` (dropdown header GM). */
export async function apiGetGmKpiCyclesForHeader(): Promise<GmKpiCycleOption[]> {
  return http
    .get<ApiResponse<GmKpiCycleOption[]>>("/common/kpi-cycles")
    .then((r) => r.data.data);
}

/** GET /kpi/gm/kpi-cycles-for-evaluation — chu kỳ kpi_cycles, year ≥ hiện tại (dropdown Evaluation year). */
export async function apiGetGmKpiCyclesForEvaluation(): Promise<
  GmKpiCycleOption[]
> {
  return http
    .get<ApiResponse<GmKpiCycleOption[]>>("/kpi/gm/kpi-cycles-for-evaluation")
    .then((r) => r.data.data);
}

/** GET /kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá GM (ASM 501–504, 601–604). */
export async function apiGetGmEvaluationHubAssignments(
  cycleId: string,
): Promise<GmEvaluationHubApiResponse> {
  return http
    .get<ApiResponse<GmEvaluationHubApiResponse>>(
      "/kpi/gm/evaluation-hub/assignments",
      {
        params: { cycleId },
      },
    )
    .then((r) => r.data.data);
}

/** POST /kpi/gm/evaluation-hub/confirm — GM xác nhận: 502→503, 602→603. */
export async function apiPostGmEvaluationHubConfirm(
  body: GmEvaluationHubConfirmBody,
): Promise<GmEvaluationHubConfirmResult> {
  return http
    .post<
      ApiResponse<GmEvaluationHubConfirmResult>
    >("/kpi/gm/evaluation-hub/confirm", body)
    .then((r) => r.data.data);
}

export async function apiPostGmEvaluationHubUnlock(
  body: GmEvaluationHubUnlockBody,
): Promise<GmEvaluationHubConfirmResult> {
  return http
    .post<
      ApiResponse<GmEvaluationHubConfirmResult>
    >("/kpi/gm/evaluation-hub/unlock", body)
    .then((r) => r.data.data);
}

export type GmEvaluationRejectBody = {
  cycleId: string
  evaluationUserId: string
  promotion?: boolean
  assignmentId?: string
  rejectAll?: boolean
  rejectReason: string
}

export type GmEvaluationRejectResult = { updatedCount: number }

/** POST /kpi/gm/evaluation-hub/reject */
export async function apiPostGmEvaluationHubReject(
  body: GmEvaluationRejectBody,
): Promise<GmEvaluationRejectResult> {
  return http
    .post<ApiResponse<GmEvaluationRejectResult>>("/kpi/gm/evaluation-hub/reject", body)
    .then((r) => r.data.data);
}

/** GET /kpi/gm/approved-kpi-queue?cycleId= — ASM 401/402/403. Feedback 407 xử lý ở Strategic diagnostics. */
export async function apiGetGmApprovedKpiQueue(
  cycleId: string,
): Promise<GmApprovedKpiQueueItemApi[]> {
  return http
    .get<
      ApiResponse<GmApprovedKpiQueueItemApi[]>
    >(`/kpi/gm/approved-kpi-queue`, { params: { cycleId: cycleId.trim() } })
    .then((r) => r.data.data);
}

/** POST /kpi/gm/approved-kpi-queue/decision — 403→405/406 hoặc 407→404. */
export async function apiPostGmApprovedKpiDecision(
  body: GmApprovedKpiDecisionBody,
): Promise<GmApprovedKpiDecisionResultApi> {
  return http
    .post<
      ApiResponse<GmApprovedKpiDecisionResultApi>
    >("/kpi/gm/approved-kpi-queue/decision", body)
    .then((r) => r.data.data);
}

/** POST /kpi/gm/approved-kpi-queue/feedback-split — duyệt feedback Individual/Promotion bằng KPI mới cho member. */
export async function apiPostGmFeedbackSplitKpi(body: {
  cycleId: string
  feedbackAssignmentId: string
  newKpi: Record<string, unknown>
}): Promise<GmApprovedKpiDecisionResultApi> {
  return http
    .post<
      ApiResponse<GmApprovedKpiDecisionResultApi>
    >("/kpi/gm/approved-kpi-queue/feedback-split", body)
    .then((r) => r.data.data);
}

/** POST /kpi/strategic-kpis — GM tạo KPI chiến lược (201). */
export async function apiCreateGmStrategicKpi(
  body: Record<string, unknown>,
): Promise<ApiResponse<GmCreateStrategicKpiResponseData>> {
  return http
    .post<
      ApiResponse<GmCreateStrategicKpiResponseData>
    >("/kpi/strategic-kpis", body)
    .then((r) => r.data);
}

/** DELETE /kpi/strategic-kpis/:kpiInformationId — GM xóa KPI kỳ + assignments (mềm). */
export async function apiDeleteGmStrategicKpi(
  kpiInformationId: string,
): Promise<ApiResponse<null>> {
  const id = encodeURIComponent(kpiInformationId.trim());
  return http
    .delete<ApiResponse<null>>(`/kpi/strategic-kpis/${id}`)
    .then((r) => r.data);
}

/** GET /kpi/strategic-kpis/:id — dữ liệu form sửa KPI. */
export async function apiGetGmStrategicKpiForEdit(
  kpiInformationId: string,
): Promise<GmStrategicKpiEditData> {
  const id = encodeURIComponent(kpiInformationId.trim());
  return http
    .get<ApiResponse<GmStrategicKpiEditData>>(`/kpi/strategic-kpis/${id}`)
    .then((r) => {
      const d = r.data.data;
      if (!d) throw new Error(r.data.message ?? "Không tải được KPI để sửa");
      return d;
    });
}

/** PUT /kpi/strategic-kpis/:id — cập nhật KPI kỳ. */
export async function apiUpdateGmStrategicKpi(
  kpiInformationId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<GmCreateStrategicKpiResponseData>> {
  const id = encodeURIComponent(kpiInformationId.trim());
  return http
    .put<
      ApiResponse<GmCreateStrategicKpiResponseData>
    >(`/kpi/strategic-kpis/${id}`, body)
    .then((r) => r.data);
}

/** GET /kpi/gm/kpi-templates — {@code kpi_templates}. */
export async function apiGetGmKpiTemplates(): Promise<
  GmKpiTemplatePackageRow[]
> {
  return http
    .get<ApiResponse<GmKpiTemplatePackageRow[]>>("/kpi/gm/kpi-templates")
    .then((r) => r.data.data);
}

/** GET /kpi/gm/kpi-templates/:id/items — mục trong gói + master. */
export async function apiGetGmKpiTemplateItems(
  templateId: string,
  year?: number | string,
): Promise<GmKpiTemplateItemRow[]> {
  const id = encodeURIComponent(templateId.trim());
  const y = year != null ? Number.parseInt(String(year).trim(), 10) : undefined
  return http
    .get<
      ApiResponse<GmKpiTemplateItemRow[]>
    >(`/kpi/gm/kpi-templates/${id}/items`, { params: Number.isFinite(y) ? { year: y } : {} })
    .then((r) => r.data.data);
}

/** POST /kpi/gm/kpi-templates — tạo gói mẫu. */
export async function apiCreateGmKpiTemplate(
  body: GmCreateKpiTemplateBody,
): Promise<GmKpiTemplatePackageRow> {
  return http
    .post<ApiResponse<GmKpiTemplatePackageRow>>("/kpi/gm/kpi-templates", body)
    .then((r) => r.data.data);
}

/** PUT /kpi/gm/kpi-templates/:templateId */
export async function apiUpdateGmKpiTemplate(
  templateId: string,
  body: GmUpdateKpiTemplateBody,
): Promise<GmKpiTemplatePackageRow> {
  const id = encodeURIComponent(templateId.trim());
  return http
    .put<
      ApiResponse<GmKpiTemplatePackageRow>
    >(`/kpi/gm/kpi-templates/${id}`, body)
    .then((r) => r.data.data);
}

/** DELETE /kpi/gm/kpi-templates/:templateId */
export async function apiDeleteGmKpiTemplate(
  templateId: string,
): Promise<ApiResponse<null>> {
  const id = encodeURIComponent(templateId.trim());
  return http
    .delete<ApiResponse<null>>(`/kpi/gm/kpi-templates/${id}`)
    .then((r) => r.data);
}

/** POST /kpi/gm/kpi-templates/:templateId/items — KPI trong template (master is_global=false). */
export async function apiCreateGmKpiTemplateItem(
  templateId: string,
  body: GmCreateKpiTemplateItemBody,
): Promise<GmKpiTemplateItemRow> {
  const id = encodeURIComponent(templateId.trim());
  return http
    .post<
      ApiResponse<GmKpiTemplateItemRow>
    >(`/kpi/gm/kpi-templates/${id}/items`, body)
    .then((r) => r.data.data);
}

/** PUT /kpi/gm/kpi-templates/:templateId/items/:itemId */
export async function apiUpdateGmKpiTemplateItem(
  templateId: string,
  itemId: string,
  body: GmUpdateKpiTemplateItemBody,
): Promise<GmKpiTemplateItemRow> {
  const tid = encodeURIComponent(templateId.trim());
  const iid = encodeURIComponent(itemId.trim());
  return http
    .put<
      ApiResponse<GmKpiTemplateItemRow>
    >(`/kpi/gm/kpi-templates/${tid}/items/${iid}`, body)
    .then((r) => r.data.data);
}

/** DELETE /kpi/gm/kpi-templates/:templateId/items/:itemId */
export async function apiDeleteGmKpiTemplateItem(
  templateId: string,
  itemId: string,
): Promise<ApiResponse<null>> {
  const tid = encodeURIComponent(templateId.trim());
  const iid = encodeURIComponent(itemId.trim());
  return http
    .delete<ApiResponse<null>>(`/kpi/gm/kpi-templates/${tid}/items/${iid}`)
    .then((r) => r.data);
}

/** Phase data trả về từ API cho 1 giai đoạn timeline.
 * Structural subtype của {@link GmMidYearIssuesData} — tương thích trực tiếp với prop GmProcessTimeline. */
export interface GmProcessTimelineApiPhase {
  hasOpenIssues?: boolean;
  operationalIssueCount?: number;
  totalDistinctEmployeesAffected?: number;
  pendingKpisLine: string;
  popoverTitle: string;
  /** Không dùng từ API — mock có thể có, API bỏ qua. */
  bullets?: { text: string; dotClass: string }[];
  issueGroups: GmTimelineIssueGroup[];
}

/** Response toàn bộ API GET /kpi/gm/process-timeline */
export interface GmProcessTimelineApiResponse {
  setting: GmProcessTimelineApiPhase | null;
  midYear: GmProcessTimelineApiPhase | null;
  yearEnd: GmProcessTimelineApiPhase | null;
}

export type GmPromotionTimelineActiveSegment =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'

/** Response GET /kpi/gm/promotion-process-timeline */
export interface GmPromotionProcessTimelineApiResponse {
  promotionCycleId: string
  name: string
  startDate: string
  endDate: string
  durationMonths: number
  statusCode: number
  activeSegment: GmPromotionTimelineActiveSegment
  progressPercent: number
  operational: GmProcessTimelineApiPhase
}

/** GET /kpi/gm/process-timeline?cycleId= — 3 phases issues cho timeline card. */
export async function apiGetGmProcessTimeline(
  cycleId: string,
): Promise<GmProcessTimelineApiResponse> {
  return http
    .get<ApiResponse<GmProcessTimelineApiResponse>>(
      "/kpi/gm/process-timeline",
      {
        params: { cycleId: cycleId.trim() },
      },
    )
    .then((r) => r.data.data);
}

/** GET /kpi/gm/promotion-cycles?year= — dropdown khi tạo KPI promotion. */
export async function apiGetGmPromotionCycles(
  year: number,
): Promise<GmPromotionCycleOption[]> {
  return http
    .get<ApiResponse<GmPromotionCycleOption[]>>("/kpi/gm/promotion-cycles", {
      params: { year },
    })
    .then((r) => r.data.data ?? []);
}

/** GET /kpi/gm/promotion-process-timeline?promotionCycleId= */
export async function apiGetGmPromotionProcessTimeline(
  promotionCycleId: string,
): Promise<GmPromotionProcessTimelineApiResponse> {
  return http
    .get<ApiResponse<GmPromotionProcessTimelineApiResponse>>(
      '/kpi/gm/promotion-process-timeline',
      { params: { promotionCycleId: promotionCycleId.trim() } },
    )
    .then((r) => r.data.data);
}

/** POST /kpi/gm/personal-evaluation/submit — GM khóa đợt KPI cá nhân: 405→503 (giữa kỳ) / 503→603 (cuối kỳ). */
export async function apiPostGmPersonalEvaluationSubmit(
  cycleId: string,
  promotion = false,
): Promise<void> {
  await http.post<ApiResponse<unknown>>("/kpi/gm/personal-evaluation/submit", {
    cycleId: cycleId.trim(),
    promotion,
  });
}

// ── GM Reports endpoints ─────────────────────────────────────────────────────
import type {
  GmReportLevelDistributionData,
  GmReportSectionBellCurveData,
  GmReportSectionAnalyticsData,
  GmReportComplianceData,
} from "@/types/gm-report";

/** GET /kpi/gm/reports/score-distribution */
export async function apiGetGmReportLevelDistribution(params: {
  year: number;
  compareYears?: number[];
  sectionId?: string;
}): Promise<GmReportLevelDistributionData> {
  const query: Record<string, string | number | string[] | number[]> = {
    year: params.year,
  };
  if (params.compareYears?.length) {
    query.compareYears = params.compareYears;
  }
  if (params.sectionId) query.sectionId = params.sectionId;
  return http
    .get<ApiResponse<GmReportLevelDistributionData>>(
      "/kpi/gm/reports/score-distribution",
      { params: query },
    )
    .then((r) => r.data.data);
}

/** GET /kpi/gm/reports/section-bell-curve */
export async function apiGetGmReportSectionBellCurve(
  year: number,
): Promise<GmReportSectionBellCurveData> {
  return http
    .get<ApiResponse<GmReportSectionBellCurveData>>(
      "/kpi/gm/reports/section-bell-curve",
      { params: { year } },
    )
    .then((r) => r.data.data);
}

/** GET /kpi/gm/reports/section-analytics */
export async function apiGetGmReportSectionAnalytics(
  year: number,
): Promise<GmReportSectionAnalyticsData> {
  return http
    .get<ApiResponse<GmReportSectionAnalyticsData>>(
      "/kpi/gm/reports/section-analytics",
      { params: { year } },
    )
    .then((r) => r.data.data);
}

/** GET /kpi/gm/reports/compliance */
export async function apiGetGmReportCompliance(
  year: number,
): Promise<GmReportComplianceData> {
  return http
    .get<ApiResponse<GmReportComplianceData>>(
      "/kpi/gm/reports/compliance",
      { params: { year } },
    )
    .then((r) => r.data.data);
}

export const gmKpiService = {
  getDashboard: (year?: number) =>
    apiGetGmKpiDashboard(year).then((r) => r.data),
  listDepartments: (year?: number) => apiListGmDepartments(year),
  listDepartmentMemberCandidates: (
    departmentId: string,
    opts?: { q?: string; rankCodes?: string[] },
  ) => apiListGmDepartmentMemberCandidates(departmentId, opts),
  addDepartmentMembers: (
    departmentId: string,
    body: GmAddDepartmentMembersBody,
  ) => apiAddGmDepartmentMembers(departmentId, body),
  removeDepartmentMember: (departmentId: string, userId: string) =>
    apiRemoveGmDepartmentMember(departmentId, userId),
  deleteMember: (userId: string) => apiDeleteGmMember(userId),
  listMembers: () => apiListGmMembers(),
  getMemberKpiAssignments: (userId: string, cycleId: string) =>
    apiGetMemberKpiAssignments(userId, cycleId),
  copyKpisToMember: (
    targetUserId: string,
    cycleId: string,
    sourceUserId: string,
    items: GmCopyKpiItemPayload[],
  ) => apiCopyKpisToMember(targetUserId, cycleId, sourceUserId, items),
  createDepartment: (body: GmCreateDepartmentBody) =>
    apiCreateGmDepartment(body),
  updateDepartment: (departmentId: string, body: GmUpdateDepartmentBody) =>
    apiUpdateGmDepartment(departmentId, body),
  deleteDepartment: (departmentId: string) =>
    apiDeleteGmDepartment(departmentId),
  getSectionMembers: (sectionId: string, year?: number) =>
    apiGetSectionMembers(sectionId, year).then((r) => r.data),
  getDiagnosticsHierarchy: (year: number) => apiGetGmDiagnosticsHierarchy(year),
  getKpiCategories: () => apiGetGmKpiCategories(),
  getKpiCyclesWithKpis: () => apiGetGmKpiCyclesWithKpis(),
  getKpiCyclesForHeader: () => apiGetGmKpiCyclesForHeader(),
  getKpiCyclesForEvaluation: () => apiGetGmKpiCyclesForEvaluation(),
  createStrategicKpi: (body: Record<string, unknown>) =>
    apiCreateGmStrategicKpi(body),
  deleteStrategicKpi: (kpiInformationId: string) =>
    apiDeleteGmStrategicKpi(kpiInformationId),
  getStrategicKpiForEdit: (kpiInformationId: string) =>
    apiGetGmStrategicKpiForEdit(kpiInformationId),
  updateStrategicKpi: (
    kpiInformationId: string,
    body: Record<string, unknown>,
  ) => apiUpdateGmStrategicKpi(kpiInformationId, body),
  splitFeedbackAssigneeToNewKpi: (body: {
    cycleId: string
    feedbackAssignmentId: string
    newKpi: Record<string, unknown>
  }) => apiPostGmFeedbackSplitKpi(body),
  getKpiTemplates: () => apiGetGmKpiTemplates(),
  getKpiTemplateItems: (templateId: string, year?: number | string) =>
    apiGetGmKpiTemplateItems(templateId, year),
  createKpiTemplate: (body: GmCreateKpiTemplateBody) =>
    apiCreateGmKpiTemplate(body),
  updateKpiTemplate: (templateId: string, body: GmUpdateKpiTemplateBody) =>
    apiUpdateGmKpiTemplate(templateId, body),
  deleteKpiTemplate: (templateId: string) => apiDeleteGmKpiTemplate(templateId),
  createKpiTemplateItem: (
    templateId: string,
    body: GmCreateKpiTemplateItemBody,
  ) => apiCreateGmKpiTemplateItem(templateId, body),
  updateKpiTemplateItem: (
    templateId: string,
    itemId: string,
    body: GmUpdateKpiTemplateItemBody,
  ) => apiUpdateGmKpiTemplateItem(templateId, itemId, body),
  deleteKpiTemplateItem: (templateId: string, itemId: string) =>
    apiDeleteGmKpiTemplateItem(templateId, itemId),
  getEvaluationHubAssignments: (cycleId: string) =>
    apiGetGmEvaluationHubAssignments(cycleId),
  confirmEvaluationHub: (body: GmEvaluationHubConfirmBody) =>
    apiPostGmEvaluationHubConfirm(body),
  unlockEvaluationHub: (body: GmEvaluationHubUnlockBody) =>
    apiPostGmEvaluationHubUnlock(body),
  rejectEvaluationHub: (body: GmEvaluationRejectBody) =>
    apiPostGmEvaluationHubReject(body),
  getApprovedKpiQueue: (cycleId: string) => apiGetGmApprovedKpiQueue(cycleId),
  decideApprovedKpiQueue: (body: GmApprovedKpiDecisionBody) =>
    apiPostGmApprovedKpiDecision(body),
  getProcessTimeline: (cycleId: string) => apiGetGmProcessTimeline(cycleId),
  getPromotionCycles: (year: number) => apiGetGmPromotionCycles(year),
  getPromotionProcessTimeline: (promotionCycleId: string) =>
    apiGetGmPromotionProcessTimeline(promotionCycleId),
  submitPersonalEvaluation: (cycleId: string, promotion = false) =>
    apiPostGmPersonalEvaluationSubmit(cycleId, promotion),
  getReportLevelDistribution: (params: {
    year: number;
    compareYears?: number[];
    sectionId?: string;
  }) => apiGetGmReportLevelDistribution(params),
  getReportSectionBellCurve: (year: number) =>
    apiGetGmReportSectionBellCurve(year),
  getReportSectionAnalytics: (year: number) =>
    apiGetGmReportSectionAnalytics(year),
  getReportCompliance: (year: number) => apiGetGmReportCompliance(year),
  listRatingScales: () => apiListGmRatingScales(),
  getRatingScaleByYear: (year: number) => apiGetGmRatingScaleByYear(year),
  patchRatingScaleCycleStatus: (
    cycleId: string,
    body: PatchGmRatingScaleCycleStatusBody,
  ) => apiPatchGmRatingScaleCycleStatus(cycleId, body),
  createRatingScale: (body: CreateGmRatingScaleBody) =>
    apiCreateGmRatingScale(body),
  addRatingScaleLevel: (cycleId: string, body: SaveGmRatingScaleLevelBody) =>
    apiAddGmRatingScaleLevel(cycleId, body),
  updateRatingScaleLevel: (
    cycleId: string,
    levelId: string,
    body: SaveGmRatingScaleLevelBody,
  ) => apiUpdateGmRatingScaleLevel(cycleId, levelId, body),
  deleteRatingScaleLevel: (cycleId: string, levelId: string) =>
    apiDeleteGmRatingScaleLevel(cycleId, levelId),
};
