/**
 * kpi-admin.service.ts
 * API calls cho Admin module
 */
import http from "@/services/api";
import type {
  Campaign,
  EmployeeProgress,
  Employee,
  EmailTemplate,
  Section,
  RankOption,
  JobTitleOption,
} from "@/mocks/admin.mock";

// ── Campaigns ──────────────────────────────────────────────────────────────────

export async function apiGetCampaigns(): Promise<Campaign[]> {
  return http.get("/admin/campaigns").then((r) => r.data?.data ?? r.data);
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
    .then((r) => r.data?.data ?? r.data);
}

/**
 * Gửi thông báo KPI cho toàn bộ nhân viên.
 * type = "all" → backend gửi mass mail đến toàn công ty.
 */
export async function apiSendMassMail(
  campaignId: string,
  message?: string,
): Promise<void> {
  return http
    .post(`/admin/campaigns/${campaignId}/notify`, {
      type: "all",
      message: message ?? "",
    })
    .then(() => {});
}

/**
 * Gửi email nhắc nhở cá nhân (Remind) cho một nhân viên cụ thể.
 * type = "single" → backend chỉ gửi cho employeeId đó.
 */
export async function apiSendRemind(
  campaignId: string,
  employeeId: string,
  message?: string,
): Promise<void> {
  return http
    .post(`/admin/campaigns/${campaignId}/notify`, {
      type: "single",
      employeeId,
      message: message ?? "",
    })
    .then(() => {});
}

// ── Sections (Departments) ─────────────────────────────────────────────────────

/** Lấy danh sách phòng ban từ bảng departments */
export async function apiGetSections(): Promise<Section[]> {
  return http.get("/admin/sections").then((r) => r.data?.data ?? r.data);
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
  return http.get("/admin/employees").then((r) => r.data?.data ?? r.data);
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
  return http.get("/admin/email-templates").then((r) => r.data?.data ?? r.data);
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

// ── Facade ─────────────────────────────────────────────────────────────────────

export const adminKpiService = {
  getCampaigns: () => apiGetCampaigns(),
  getEmployeeProgress: (period: string) => apiGetEmployeeProgress(period),
  sendMassMail: (campaignId: string, message?: string) =>
    apiSendMassMail(campaignId, message),
  sendRemind: (campaignId: string, employeeId: string, message?: string) =>
    apiSendRemind(campaignId, employeeId, message),

  getSections: () => apiGetSections(),
  getRanks: () => apiGetRanks(),
  getJobTitles: () => apiGetJobTitles(),
  getEmployees: () => apiGetEmployees(),
  createEmployee: (data: Record<string, unknown>) => apiCreateEmployee(data),
  updateEmployee: (id: string, data: Record<string, unknown>) =>
    apiUpdateEmployee(id, data),

  getEmailTemplates: () => apiGetEmailTemplates(),
  createEmailTemplate: (data: Omit<EmailTemplate, "id">) =>
    apiCreateEmailTemplate(data),
  updateEmailTemplate: (id: string, data: Partial<EmailTemplate>) =>
    apiUpdateEmailTemplate(id, data),
};
