/**
 * kpi-admin.service.ts
 * API calls cho Admin module
 */
import type { AxiosResponse } from "axios";
import http from "@/services/api";
import type { ApiResponse } from "@/types/api";
import type {
  Campaign,
  EmployeeProgress,
  Employee,
  EmailTemplate,
  Section,
  RankOption,
  JobTitleOption,
  AdminKpiCycle,
  LeaderMemberCandidate,
} from "@/mocks/admin.mock";

/** Chuẩn hóa list từ BaseResponse hoặc mảng thô. */
function unwrapList<T>(response: AxiosResponse<unknown>): T[] {
  const body = response.data;
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && "data" in body) {
    const inner = (body as ApiResponse<T[]>).data;
    return Array.isArray(inner) ? inner : [];
  }
  return [];
}

// ── KPI cycles (kỳ đánh giá / kpi_cycles) ─────────────────────────────────────

export interface CreateAdminKpiCycleBody {
  year: number;
  name: string;
  goalSettingStartDate: string;
  goalSettingEndDate: string;
  midYearStartDate: string;
  midYearEndDate: string;
  endYearStartDate: string;
  endYearEndDate: string;
  activateImmediately?: boolean;
}

export type KpiCyclePhaseKey = "goal_setting" | "mid_year" | "end_year";

export interface UpdateKpiCyclePhaseDatesBody {
  phase: KpiCyclePhaseKey;
  startDate: string;
  endDate: string;
}

export async function apiGetKpiCycles(): Promise<AdminKpiCycle[]> {
  return http.get("/admin/kpi-cycles").then((r) => r.data?.data ?? r.data);
}

export async function apiCreateKpiCycle(
  data: CreateAdminKpiCycleBody,
): Promise<AdminKpiCycle> {
  return http
    .post("/admin/kpi-cycles", data)
    .then((r) => r.data?.data ?? r.data);
}

export async function apiPatchKpiCycleStatus(
  id: string,
  statusCode: 201 | 202,
): Promise<AdminKpiCycle> {
  return http
    .patch(`/admin/kpi-cycles/${id}`, { statusCode })
    .then((r) => r.data?.data ?? r.data);
}

export async function apiPutKpiCyclePhaseDates(
  id: string,
  data: UpdateKpiCyclePhaseDatesBody,
): Promise<AdminKpiCycle> {
  return http
    .put(`/admin/kpi-cycles/${id}/phase-dates`, data)
    .then((r) => r.data?.data ?? r.data);
}

export async function apiDeleteKpiCycle(id: string): Promise<void> {
  return http.delete(`/admin/kpi-cycles/${id}`).then(() => {});
}

// ── Campaigns ──────────────────────────────────────────────────────────────────

export async function apiGetCampaigns(): Promise<Campaign[]> {
  return http.get("/admin/campaigns").then(unwrapList<Campaign>);
}

/**
 * Lấy tiến độ nhân viên theo period string.
 * Backend nhận: "current" | "future" | "past_YYYY" (ví dụ "past_2025")
 */
export async function apiGetEmployeeProgress(
  period: string,
): Promise<EmployeeProgress[]> {
  return http
    .get("/admin/campaigns/progress", { params: { period } })
    .then(unwrapList<EmployeeProgress>);
}

export type NotifyPhase = "goal_setting" | "mid_year" | "end_year";
export type NotifyRecipientType = "all" | "individual" | "department";

export type CampaignNotifyOptions = {
  message?: string;
  emailTemplateId?: string;
  phase?: NotifyPhase;
  recipientType?: NotifyRecipientType;
  employeeIds?: string[];
  departmentIds?: string[];
};

/**
 * Gửi thông báo KPI (toàn công ty hoặc nhóm đã chọn).
 */
export async function apiSendMassMail(
  campaignId: string,
  message?: string,
  options?: CampaignNotifyOptions,
): Promise<void> {
  const msg = options?.message ?? message ?? "";
  const body: Record<string, unknown> = {
    type: "all",
    message: msg,
    recipientType: options?.recipientType ?? "all",
  };
  if (options?.phase) body.phase = options.phase;
  if (options?.emailTemplateId) body.emailTemplateId = options.emailTemplateId;
  if (options?.employeeIds?.length) body.employeeIds = options.employeeIds;
  if (options?.departmentIds?.length) body.departmentIds = options.departmentIds;
  return http.post(`/admin/campaigns/${campaignId}/notify`, body).then(() => {});
}

/**
 * Gửi email nhắc nhở một nhân viên.
 */
export async function apiSendRemind(
  campaignId: string,
  employeeId: string,
  message?: string,
  options?: Pick<CampaignNotifyOptions, "message" | "emailTemplateId" | "phase">,
): Promise<void> {
  const msg = options?.message ?? message ?? "";
  const body: Record<string, unknown> = {
    type: "single",
    employeeId,
    message: msg,
  };
  if (options?.emailTemplateId) body.emailTemplateId = options.emailTemplateId;
  if (options?.phase) body.phase = options.phase;
  return http.post(`/admin/campaigns/${campaignId}/notify`, body).then(() => {});
}

// ── Sections (Departments) ─────────────────────────────────────────────────────

/** Lấy danh sách phòng ban từ bảng departments */
export async function apiGetSections(): Promise<Section[]> {
  return http.get("/admin/sections").then(unwrapList<Section>);
}

// ── Ranks ──────────────────────────────────────────────────────────────────────

/** Lấy danh sách cấp bậc từ bảng ranks */
export async function apiGetRanks(): Promise<RankOption[]> {
  return http.get("/admin/ranks").then((r) => r.data?.data ?? r.data);
}

// ── Job Titles ─────────────────────────────────────────────────────────────────

/** Lấy danh sách chức danh từ bảng job_titles */
export async function apiGetJobTitles(): Promise<JobTitleOption[]> {
  return http.get("/admin/job-titles").then((r) => r.data?.data ?? r.data);
}

// ── Employees ──────────────────────────────────────────────────────────────────

export async function apiGetEmployees(): Promise<Employee[]> {
  return http.get("/admin/employees").then(unwrapList<Employee>);
}

export async function apiGetLeaderMemberCandidates(
  departmentId: string,
): Promise<LeaderMemberCandidate[]> {
  return http
    .get("/admin/employees/leader-member-candidates", {
      params: { departmentId },
    })
    .then(unwrapList<LeaderMemberCandidate>);
}

export async function apiCreateEmployee(
  data: Record<string, unknown>,
): Promise<Employee> {
  return http
    .post("/admin/employees", data)
    .then((r) => r.data?.data ?? r.data);
}

export async function apiUpdateEmployee(
  id: string,
  data: Record<string, unknown>,
): Promise<Employee> {
  return http
    .put(`/admin/employees/${id}`, data)
    .then((r) => r.data?.data ?? r.data);
}

// ── Email Templates ────────────────────────────────────────────────────────────

export async function apiGetEmailTemplates(): Promise<EmailTemplate[]> {
  return http.get("/admin/email-templates").then(unwrapList<EmailTemplate>);
}

export async function apiCreateEmailTemplate(
  data: Omit<EmailTemplate, "id">,
): Promise<EmailTemplate> {
  return http
    .post("/admin/email-templates", data)
    .then((r) => r.data?.data ?? r.data);
}

export async function apiUpdateEmailTemplate(
  id: string,
  data: Partial<EmailTemplate>,
): Promise<EmailTemplate> {
  return http
    .put(`/admin/email-templates/${id}`, data)
    .then((r) => r.data?.data ?? r.data);
}

export async function apiDeleteEmailTemplate(id: string): Promise<void> {
  return http.delete(`/admin/email-templates/${id}`).then(() => {});
}

// ── Facade ─────────────────────────────────────────────────────────────────────

export const adminKpiService = {
  getKpiCycles: () => apiGetKpiCycles(),
  createKpiCycle: (data: CreateAdminKpiCycleBody) => apiCreateKpiCycle(data),
  patchKpiCycleStatus: (id: string, statusCode: 201 | 202) =>
    apiPatchKpiCycleStatus(id, statusCode),
  updateKpiCyclePhaseDates: (id: string, data: UpdateKpiCyclePhaseDatesBody) =>
    apiPutKpiCyclePhaseDates(id, data),
  deleteKpiCycle: (id: string) => apiDeleteKpiCycle(id),

  getCampaigns: () => apiGetCampaigns(),
  getEmployeeProgress: (period: string) => apiGetEmployeeProgress(period),
  sendMassMail: (
    campaignId: string,
    message?: string,
    options?: CampaignNotifyOptions,
  ) => apiSendMassMail(campaignId, message, options),
  sendRemind: (
    campaignId: string,
    employeeId: string,
    message?: string,
    options?: Pick<CampaignNotifyOptions, "message" | "emailTemplateId" | "phase">,
  ) => apiSendRemind(campaignId, employeeId, message, options),

  getSections: () => apiGetSections(),
  getRanks: () => apiGetRanks(),
  getJobTitles: () => apiGetJobTitles(),
  getEmployees: () => apiGetEmployees(),
  getLeaderMemberCandidates: (departmentId: string) =>
    apiGetLeaderMemberCandidates(departmentId),
  createEmployee: (data: Record<string, unknown>) => apiCreateEmployee(data),
  updateEmployee: (id: string, data: Record<string, unknown>) =>
    apiUpdateEmployee(id, data),

  getEmailTemplates: () => apiGetEmailTemplates(),
  createEmailTemplate: (data: Omit<EmailTemplate, "id">) =>
    apiCreateEmailTemplate(data),
  updateEmailTemplate: (id: string, data: Partial<EmailTemplate>) =>
    apiUpdateEmailTemplate(id, data),
  deleteEmailTemplate: (id: string) => apiDeleteEmailTemplate(id),
};
