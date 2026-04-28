/**
 * kpi-gm.service.ts
 * API calls cho GM KPI Dashboard
 *
 * Khi VITE_USE_MOCK=true: intercepted bởi mock-adapter.ts → dùng gm-kpi.mock.ts
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
} from "@/types/gm-evaluation-hub-api";
import type { GmKpiCycleOption } from "@/types/gm-kpi-cycle";
import type { GmCreateStrategicKpiResponseData } from "@/types/gm-strategic-kpi-create";
import type { GmStrategicKpiEditData } from "@/types/gm-strategic-kpi-edit";
import type { GmTimelineIssueBucket } from "@/types/gm-workspace";
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
  GmUpdateDepartmentBody,
} from "@/types/gm-department-api";
import type { GmKpiDashboard, KpiSection, KpiSectionMember } from "@/types/kpi";

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

/** GET /kpi/gm/kpi-cycles-for-evaluation — `year` ≥ năm hiện tại (dropdown năm đánh giá / header). */
export async function apiGetGmKpiCyclesForEvaluation(): Promise<
  GmKpiCycleOption[]
> {
  return http
    .get<ApiResponse<GmKpiCycleOption[]>>("/kpi/gm/kpi-cycles-for-evaluation")
    .then((r) => r.data.data);
}

/** GET /kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá GM (ASM 501–503, 601–603). */
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

/** GET /kpi/gm/approved-kpi-queue?cycleId= — ASM 401/402/403 (tab Approved KPI). */
export async function apiGetGmApprovedKpiQueue(
  cycleId: string,
): Promise<GmApprovedKpiQueueItemApi[]> {
  return http
    .get<
      ApiResponse<GmApprovedKpiQueueItemApi[]>
    >(`/kpi/gm/approved-kpi-queue`, { params: { cycleId: cycleId.trim() } })
    .then((r) => r.data.data);
}

/** POST /kpi/gm/approved-kpi-queue/decision — 403→404 hoặc 403→406. */
export async function apiPostGmApprovedKpiDecision(
  body: GmApprovedKpiDecisionBody,
): Promise<GmApprovedKpiDecisionResultApi> {
  return http
    .post<
      ApiResponse<GmApprovedKpiDecisionResultApi>
    >("/kpi/gm/approved-kpi-queue/decision", body)
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
): Promise<GmKpiTemplateItemRow[]> {
  const id = encodeURIComponent(templateId.trim());
  return http
    .get<
      ApiResponse<GmKpiTemplateItemRow[]>
    >(`/kpi/gm/kpi-templates/${id}/items`)
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
  pendingKpisLine: string;
  popoverTitle: string;
  /** Không dùng từ API — mock có thể có, API bỏ qua. */
  bullets?: { text: string; dotClass: string }[];
  issueDetails: GmTimelineIssueBucket[];
}

/** Response toàn bộ API GET /kpi/gm/process-timeline */
export interface GmProcessTimelineApiResponse {
  setting: GmProcessTimelineApiPhase | null;
  midYear: GmProcessTimelineApiPhase | null;
  yearEnd: GmProcessTimelineApiPhase | null;
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
  getKpiTemplates: () => apiGetGmKpiTemplates(),
  getKpiTemplateItems: (templateId: string) =>
    apiGetGmKpiTemplateItems(templateId),
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
  getApprovedKpiQueue: (cycleId: string) => apiGetGmApprovedKpiQueue(cycleId),
  decideApprovedKpiQueue: (body: GmApprovedKpiDecisionBody) =>
    apiPostGmApprovedKpiDecision(body),
  getProcessTimeline: (cycleId: string) => apiGetGmProcessTimeline(cycleId),
};
