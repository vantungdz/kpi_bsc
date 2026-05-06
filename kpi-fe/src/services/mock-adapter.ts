/**
 * mock-adapter.ts
 * Custom Axios adapter for KPI system — intercepts HTTP requests and serves
 * responses from src/mocks/ when VITE_USE_MOCK=true.
 */
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type { LoginResponse, AuthTokens, ApiResponse } from "@/types/api";
import { mockResponse } from "@/utils/mock";
import { generateMockToken, generateMockRefreshToken } from "@/utils/mock";
import { MOCK_USERS_DB } from "@/mocks/auth.mock";
import type { GmKpiDashboard, KpiSectionMember } from "@/types/kpi";
import type { GmDiagnosticsHierarchyApiData } from "@/types/gm-diagnostics-api";
import type { GmCreateStrategicKpiResponseData } from "@/types/gm-strategic-kpi-create";
import type { GmStrategicKpiEditData } from "@/types/gm-strategic-kpi-edit";
import type {
  GmCreateKpiTemplateItemBody,
  GmKpiTemplateItemRow,
  GmKpiTemplatePackageRow,
  GmUpdateKpiTemplateBody,
  GmUpdateKpiTemplateItemBody,
} from "@/types/gm-kpi-template";
import type { GmKpiCategoryItem } from "@/types/gm-kpi-category";
import type {
  GmEvaluationHubApiResponse,
  GmEvaluationHubConfirmResult,
} from "@/types/gm-evaluation-hub-api";
import type {
  GmApprovedKpiDecisionResultApi,
  GmApprovedKpiQueueItemApi,
} from "@/types/gm-approved-kpi-api";
import type { GmKpiCycleOption } from "@/types/gm-kpi-cycle";
import type { KpiCalculationReferenceData } from "@/types/kpi-calculation-reference";
import type { KpiTypeOption } from "@/types/kpi-type-option";
import type { KpiUnitOption } from "@/types/kpi-unit";
import type { MemberByRankOption } from "@/types/member-by-rank";
import type { RankOption } from "@/types/rank-option";
import type { DepartmentManagerOption } from "@/types/department-manager";
import type {
  GmDepartmentApiRow,
  GmDepartmentAssignedKpiApiRow,
  GmDepartmentMemberApiRow,
  GmDepartmentMemberCandidateApiRow,
} from "@/types/gm-department-api";
import { getFallbackCalculationReference } from "@/utils/calculationReferenceFallback";
import { fallbackKpiUnitSelectOptions } from "@/utils/kpiUnitCodes";
import { getMockLeaderKpiDashboard } from "@/mocks/leader-kpi.mock";
import { getMockPmKpiDashboard } from "@/mocks/pm-kpi.mock";
import {
  MOCK_CAMPAIGNS,
  MOCK_EMPLOYEE_PROGRESS,
  MOCK_PAST_EMPLOYEE_PROGRESS,
  MOCK_EMPLOYEES,
  MOCK_EMAIL_TEMPLATES,
  MOCK_DEPARTMENTS,
  MOCK_RANK_OPTIONS,
} from "@/mocks/admin.mock";
import type { Employee, EmailTemplate } from "@/mocks/admin.mock";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function extractPath(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? "";
  const withoutHost = url.replace(/^https?:\/\/[^/]+/, "");
  const withoutApi = withoutHost.replace(/^\/api/, "");
  const withoutVersion = withoutApi.replace(/^\/v\d+/, "");
  return withoutVersion.split("?")[0] || "/";
}

function getQueryParams(
  config: InternalAxiosRequestConfig,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (config.params) {
    for (const [k, v] of Object.entries(config.params)) result[k] = String(v);
  }
  try {
    const qIdx = (config.url ?? "").indexOf("?");
    if (qIdx >= 0) {
      new URLSearchParams((config.url ?? "").slice(qIdx + 1)).forEach(
        (v, k) => {
          result[k] = v;
        },
      );
    }
  } catch {
    /* ignore */
  }
  return result;
}

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  if (!config.data) return {} as T;
  if (typeof config.data === "string") return JSON.parse(config.data) as T;
  return config.data as T;
}

function ok<T>(
  cfg: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<ApiResponse<T>> {
  return {
    data: mockResponse(data),
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    config: cfg,
  };
}

function created<T>(
  cfg: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<ApiResponse<T>> {
  return {
    data: mockResponse(data, null, 201),
    status: 201,
    statusText: "Created",
    headers: { "content-type": "application/json" },
    config: cfg,
  };
}

function fail(
  cfg: InternalAxiosRequestConfig,
  status: number,
  message: string,
): never {
  const err = Object.assign(new Error(message), {
    isAxiosError: true,
    config: cfg,
    response: {
      data: mockResponse(null, message, status),
      status,
      statusText: String(status),
      headers: {},
      config: cfg,
    } as AxiosResponse,
  });
  throw err;
}

type Handler = (
  cfg: InternalAxiosRequestConfig,
  path: string,
) => Promise<AxiosResponse>;
interface Route {
  method: string;
  test: (path: string) => boolean;
  handler: Handler;
}

/** Đồng bộ `document/db/V3__sample_data.sql` — `kpi_categories`. */
const MOCK_GM_KPI_CATEGORIES: GmKpiCategoryItem[] = [
  {
    id: "a2000000-0000-0000-0000-000000000001",
    name: "A - Hiệu quả công việc chuyên môn",
  },
  {
    id: "a2000000-0000-0000-0000-000000000002",
    name: "B - Phát triển bản thân & đóng góp",
  },
  { id: "a2000000-0000-0000-0000-000000000003", name: "C - Năng lực quản lý" },
  { id: "a2000000-0000-0000-0000-000000000004", name: "P - KPI thăng tiến" },
];

/** Đồng bộ `document/db/V3__sample_data.sql` — `kpi_cycles` + `kpis_information`. */
const MOCK_GM_KPI_CYCLES_WITH_KPIS: GmKpiCycleOption[] = [
  {
    id: "c2000000-0000-0000-0000-000000000001",
    year: 2026,
    name: "Năm 2026",
    statusCode: 201,
  },
  {
    id: "c2000000-0000-0000-0000-000000000002",
    year: 2025,
    name: "Năm 2025",
    statusCode: 202,
  },
];

/** Mock in-memory thư viện gói KPI (không dùng strategic KPI / kpiInformation). */
const mockGmKpiTemplateLibrary = {
  packages: [] as GmKpiTemplatePackageRow[],
  itemsByTemplateId: new Map<string, GmKpiTemplateItemRow[]>(),
};

function mockGmKpiTemplateNewId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `m0000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(0, 12)}`;
}

function mockGmTemplateIdFromPath(path: string): string | null {
  const m = path.match(/^\/kpi\/gm\/kpi-templates\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** GM dashboard tối thiểu khi `VITE_USE_MOCK=true`. */
function mockGmMinimalDashboard(year: number): GmKpiDashboard {
  return {
    year,
    currentPhase: "year_end",
    phaseProgressPct: 0,
    coreTargets: [],
    sections: [],
    summary: {
      totalMembers: 0,
      byRank: [],
      yearEndCompleted: 0,
      highPerformers: 0,
      meetsTarget: 0,
      underperforming: 0,
      pendingEvaluation: 0,
      missingEvidence: 0,
      pendingApproval: 0,
      overdue: 0,
    },
  };
}

/** Section members tối thiểu cho mock `GET /kpi/gm/sections/:id/members`. */
function mockGmSectionMembers(sectionId: string): KpiSectionMember[] {
  const base: KpiSectionMember[] = [
    {
      id: "E1",
      name: "Tran Van Phuoc",
      rank: "R3",
      targetStatus: "Approved",
      midYearStatus: "Approved",
      finalStatus: "Evaluating",
      score: null,
    },
    {
      id: "E2",
      name: "Le Thi D",
      rank: "R2",
      targetStatus: "Approved",
      midYearStatus: "Approved",
      finalStatus: "Completed",
      score: 4.2,
    },
    {
      id: "E3",
      name: "Nguyen Hoang E",
      rank: "R4",
      targetStatus: "Approved",
      midYearStatus: "Approved",
      finalStatus: "Evaluating",
      score: null,
    },
    {
      id: "E4",
      name: "Pham Van F",
      rank: "R2",
      targetStatus: "Approved",
      midYearStatus: "Approved",
      finalStatus: "Completed",
      score: 3.8,
    },
    {
      id: "E5",
      name: "Vo Thi G",
      rank: "R1",
      targetStatus: "Approved",
      midYearStatus: "Approved",
      finalStatus: "Not Started",
      score: null,
    },
  ];
  return base.map((m) => ({ ...m, id: `${sectionId}-${m.id}` }));
}

/** In-memory phòng ban — `GET/POST/PUT/DELETE /kpi/gm/departments` (mock). */
function buildInitialMockGmDepartments(): GmDepartmentApiRow[] {
  const now = new Date().toISOString();
  const y = new Date().getFullYear();
  const roles = ["PM", "LEADER", "GM", "MEMBER", "PM"] as const;
  return Array.from({ length: 5 }, (_, i) => {
    const name = `Mock Section ${i + 1}`;
    const manager = `Manager ${i + 1}`;
    const id = `11111111-1111-4111-8111-${String(100_000 + i).padStart(12, "0")}`;
    const members: GmDepartmentMemberApiRow[] = [
      {
        userId: `22222222-2222-4222-8222-${String(200_000 + i * 10).padStart(12, "0")}`,
        fullName: "Nguyễn Minh An",
        email: `minhan.dept${i}@mock.local`,
        rankCode: "B",
      },
      {
        userId: `22222222-2222-4222-8222-${String(200_001 + i * 10).padStart(12, "0")}`,
        fullName: "Trần Thu Hà",
        email: `thuha.dept${i}@mock.local`,
        rankCode: "C",
      },
    ];
    const assignedKpis: GmDepartmentAssignedKpiApiRow[] = [
      {
        assignmentId: `33333333-3333-4333-8333-${String(300_000 + i).padStart(12, "0")}`,
        cycleId: "cccccccc-cccc-4ccc-8ccc-000000000026",
        cycleYear: y,
        kpiInfoId: `44444444-4444-4444-8444-${String(400_000 + i).padStart(12, "0")}`,
        kpiCode: `STR-${i + 1}`,
        kpiName:
          i % 2 === 0
            ? "Tăng trưởng doanh thu khối"
            : "Hoàn thành roadmap sản phẩm",
        statusCode: 405,
        typeCode: 102,
        targetValue: 100,
        weight: 30,
      },
    ];
    return {
      id,
      name,
      parentId: null,
      managerId: null,
      managerFullName: manager,
      managerRoleCode: roles[i % roles.length]!,
      createdAt: now,
      updatedAt: now,
      members,
      assignedKpis,
      kpiYear: y,
    };
  });
}

let mockGmDepartmentRows: GmDepartmentApiRow[] =
  buildInitialMockGmDepartments();

/** User chưa gán phòng — mock GET member-candidates (đủ bản ghi để thử bulk add). */
const MOCK_GM_DEPT_MEMBER_CANDIDATE_POOL: GmDepartmentMemberCandidateApiRow[] = [
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    fullName: "Phạm Thị Mai",
    email: "mai.pham@mock.local",
    rankCode: "B",
    jobTitleLabel: "Product · BA",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
    fullName: "Hoàng Văn Thái",
    email: "hvt@mock.local",
    rankCode: "D",
    jobTitleLabel: "Engineering · Fresher",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
    fullName: "Đào Thị Yến",
    email: "dty@mock.local",
    rankCode: "C",
    jobTitleLabel: "Quality · QA",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
    fullName: "Vũ Minh Tuấn",
    email: "vmt@mock.local",
    rankCode: "B",
    jobTitleLabel: "Engineering · Senior Dev",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000005",
    fullName: "Phạm Quốc An",
    email: "pqa@mock.local",
    rankCode: "B",
    jobTitleLabel: "Platform · DevOps",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000006",
    fullName: "Lê Ngọc Hà",
    email: "lnh@mock.local",
    rankCode: "C",
    jobTitleLabel: "Product · BA",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000007",
    fullName: "Ngô Thanh Tùng",
    email: "ntt@mock.local",
    rankCode: "D",
    jobTitleLabel: "Engineering · Junior",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000008",
    fullName: "Huỳnh Thị Lan",
    email: "htl@mock.local",
    rankCode: "C",
    jobTitleLabel: "Quality · QC",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000009",
    fullName: "Đỗ Văn Khánh",
    email: "dvk@mock.local",
    rankCode: "B",
    jobTitleLabel: "Engineering · Tech Lead",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000010",
    fullName: "Bùi Thị Thu",
    email: "btt@mock.local",
    rankCode: "C",
    jobTitleLabel: "Delivery · Scrum Master",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000011",
    fullName: "Nguyễn Việt Hùng",
    email: "nvh@mock.local",
    rankCode: "D",
    jobTitleLabel: "Engineering · Intern",
  },
  {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000012",
    fullName: "Trịnh Công Tuấn",
    email: "tct@mock.local",
    rankCode: "A",
    jobTitleLabel: "Leadership · Manager",
  },
];

function collectRankCodesFromRequest(
  cfg: InternalAxiosRequestConfig,
): string[] {
  const out: string[] = [];
  const url = cfg.url ?? "";
  const qi = url.indexOf("?");
  if (qi >= 0) {
    new URLSearchParams(url.slice(qi + 1)).getAll("rankCode").forEach((x) => {
      if (x.trim()) out.push(x.trim());
    });
  }
  const p = cfg.params as Record<string, unknown> | undefined;
  if (p?.rankCode != null) {
    const v = p.rankCode;
    if (Array.isArray(v))
      v.forEach((x) => {
        const s = String(x).trim();
        if (s) out.push(s);
      });
    else {
      const s = String(v).trim();
      if (s) out.push(s);
    }
  }
  return [...new Set(out)];
}

function mockGmDepartmentIdFromMembersPath(path: string): string | null {
  const m = path.match(/^\/kpi\/gm\/departments\/([^/]+)\/(?:member-candidates|members)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const routes: Route[] = [
  // ── POST /auth/login ──────────────────────────────────────────────────────
  {
    method: "post",
    test: (p) => p === "/auth/login",
    handler: async (cfg) => {
      await sleep(500);
      const { email, password } = parseBody<{
        email: string;
        password: string;
      }>(cfg);
      const found = MOCK_USERS_DB.find(
        (u) => u.email === email && u.password === password,
      );
      if (!found) fail(cfg, 401, "Email hoặc mật khẩu không đúng.");
      const { password: _pw, ...userData } = found!;
      return ok<LoginResponse>(cfg, {
        accessToken: generateMockToken(userData.id, userData.role),
        refreshToken: generateMockRefreshToken(userData.id),
        user: { ...userData, fullName: userData.name },
      });
    },
  },

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  {
    method: "post",
    test: (p) => p === "/auth/refresh",
    handler: async (cfg) => {
      await sleep(300);
      const { refreshToken } = parseBody<{ refreshToken: string }>(cfg);
      if (!refreshToken?.startsWith("refresh."))
        fail(cfg, 401, "Refresh token không hợp lệ.");
      const userId = atob(refreshToken.replace("refresh.", "")).slice(0, 3);
      return ok<AuthTokens>(cfg, {
        accessToken: generateMockToken(userId, "MEMBER"),
        refreshToken: generateMockRefreshToken(userId),
        expiresIn: 3600,
      });
    },
  },

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  {
    method: "post",
    test: (p) => p === "/auth/logout",
    handler: async (cfg) => {
      await sleep(200);
      return ok(cfg, null);
    },
  },

  // ── GET /kpi/gm/kpi-categories ────────────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/kpi-categories",
    handler: async (cfg) => {
      await sleep(200);
      return ok(cfg, [...MOCK_GM_KPI_CATEGORIES]);
    },
  },

  // ── GET/POST/PUT/DELETE /kpi/gm/kpi-templates — thư viện gói (mock in-memory)
  {
    method: "get",
    test: (p) => p === "/kpi/gm/kpi-templates",
    handler: async (cfg) => {
      await sleep(80);
      return ok<GmKpiTemplatePackageRow[]>(cfg, [
        ...mockGmKpiTemplateLibrary.packages,
      ]);
    },
  },
  {
    method: "post",
    test: (p) => p === "/kpi/gm/kpi-templates",
    handler: async (cfg) => {
      await sleep(80);
      const b = parseBody<{ name?: string; description?: string | null }>(cfg);
      const name = String(b.name ?? "").trim();
      if (!name) fail(cfg, 400, "name required");
      const row: GmKpiTemplatePackageRow = {
        id: mockGmKpiTemplateNewId(),
        name,
        description: b.description == null ? null : String(b.description),
      };
      mockGmKpiTemplateLibrary.packages.push(row);
      mockGmKpiTemplateLibrary.itemsByTemplateId.set(row.id, []);
      return created(cfg, row);
    },
  },
  {
    method: "put",
    test: (p) =>
      /^\/kpi\/gm\/kpi-templates\/[^/]+$/.test(p) && !/\/items(\/|$)/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const id = mockGmTemplateIdFromPath(path);
      if (!id) fail(cfg, 400, "invalid path");
      const idx = mockGmKpiTemplateLibrary.packages.findIndex(
        (x) => x.id === id,
      );
      if (idx < 0) fail(cfg, 404, "template not found");
      const b = parseBody<GmUpdateKpiTemplateBody>(cfg);
      const cur = mockGmKpiTemplateLibrary.packages[idx]!;
      const next: GmKpiTemplatePackageRow = { ...cur };
      if (b.name != null) {
        const n = String(b.name).trim();
        if (!n) fail(cfg, 400, "name cannot be empty");
        next.name = n;
      }
      if (b.description !== undefined) {
        next.description = b.description == null ? null : String(b.description);
      }
      mockGmKpiTemplateLibrary.packages[idx] = next;
      return ok(cfg, next);
    },
  },
  {
    method: "delete",
    test: (p) =>
      /^\/kpi\/gm\/kpi-templates\/[^/]+$/.test(p) && !/\/items(\/|$)/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const id = mockGmTemplateIdFromPath(path);
      if (!id) fail(cfg, 400, "invalid path");
      const i = mockGmKpiTemplateLibrary.packages.findIndex((x) => x.id === id);
      if (i < 0) fail(cfg, 404, "template not found");
      mockGmKpiTemplateLibrary.packages.splice(i, 1);
      mockGmKpiTemplateLibrary.itemsByTemplateId.delete(id);
      return ok(cfg, null);
    },
  },
  {
    method: "get",
    test: (p) => /^\/kpi\/gm\/kpi-templates\/[^/]+\/items$/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const id = mockGmTemplateIdFromPath(path);
      if (!id) fail(cfg, 400, "invalid path");
      return ok<GmKpiTemplateItemRow[]>(cfg, [
        ...(mockGmKpiTemplateLibrary.itemsByTemplateId.get(id) ?? []),
      ]);
    },
  },
  {
    method: "post",
    test: (p) => /^\/kpi\/gm\/kpi-templates\/[^/]+\/items$/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const templateId = mockGmTemplateIdFromPath(path);
      if (!templateId) fail(cfg, 400, "invalid path");
      if (!mockGmKpiTemplateLibrary.packages.some((x) => x.id === templateId)) {
        fail(cfg, 404, "template not found");
      }
      const b = parseBody<GmCreateKpiTemplateItemBody>(cfg);
      const kpiName = String(b.kpiName ?? "").trim();
      if (!kpiName) fail(cfg, 400, "kpiName required");
      const item: GmKpiTemplateItemRow = {
        templateItemId: mockGmKpiTemplateNewId(),
        templateId,
        masterKpiId: mockGmKpiTemplateNewId(),
        masterCode: null,
        masterName: kpiName,
        categoryId: String(b.perspective ?? ""),
        categoryName:
          MOCK_GM_KPI_CATEGORIES.find((c) => c.id === b.perspective)?.name ??
          null,
        typeCode: Number(b.typeCode),
        unitCode: Number(b.unitCode),
        calculationRuleCode: 802,
        calculationTypeCode: 701,
        defaultTargetValue:
          b.defaultTargetValue == null ? null : Number(b.defaultTargetValue),
        defaultWeight: Number(b.defaultWeight),
      };
      const list =
        mockGmKpiTemplateLibrary.itemsByTemplateId.get(templateId) ?? [];
      list.push(item);
      mockGmKpiTemplateLibrary.itemsByTemplateId.set(templateId, list);
      return created(cfg, item);
    },
  },
  {
    method: "put",
    test: (p) => /^\/kpi\/gm\/kpi-templates\/[^/]+\/items\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const m = path.match(
        /^\/kpi\/gm\/kpi-templates\/([^/]+)\/items\/([^/]+)$/,
      );
      if (!m) fail(cfg, 400, "invalid path");
      const templateId = decodeURIComponent(m[1]);
      const itemId = decodeURIComponent(m[2]);
      const list = mockGmKpiTemplateLibrary.itemsByTemplateId.get(templateId);
      const idx = list?.findIndex((x) => x.templateItemId === itemId) ?? -1;
      if (!list || idx < 0) fail(cfg, 404, "item not found");
      const b = parseBody<GmUpdateKpiTemplateItemBody>(cfg);
      const cur = list[idx]!;
      const next: GmKpiTemplateItemRow = { ...cur };
      if (b.kpiName != null)
        next.masterName = String(b.kpiName).trim() || cur.masterName;
      if (b.perspective != null) {
        next.categoryId = String(b.perspective);
        next.categoryName =
          MOCK_GM_KPI_CATEGORIES.find((c) => c.id === b.perspective)?.name ??
          null;
      }
      if (b.typeCode != null) next.typeCode = Number(b.typeCode);
      if (b.unitCode != null) next.unitCode = Number(b.unitCode);
      if (b.defaultTargetValue !== undefined) {
        next.defaultTargetValue =
          b.defaultTargetValue == null ? null : Number(b.defaultTargetValue);
      }
      if (b.defaultWeight != null) next.defaultWeight = Number(b.defaultWeight);
      list[idx] = next;
      mockGmKpiTemplateLibrary.itemsByTemplateId.set(templateId, list);
      return ok(cfg, next);
    },
  },
  {
    method: "delete",
    test: (p) => /^\/kpi\/gm\/kpi-templates\/[^/]+\/items\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(80);
      const m = path.match(
        /^\/kpi\/gm\/kpi-templates\/([^/]+)\/items\/([^/]+)$/,
      );
      if (!m) fail(cfg, 400, "invalid path");
      const templateId = decodeURIComponent(m[1]);
      const itemId = decodeURIComponent(m[2]);
      const list = mockGmKpiTemplateLibrary.itemsByTemplateId.get(templateId);
      if (!list) fail(cfg, 404, "template not found");
      const next = list.filter((x) => x.templateItemId !== itemId);
      if (next.length === list.length) fail(cfg, 404, "item not found");
      mockGmKpiTemplateLibrary.itemsByTemplateId.set(templateId, next);
      return ok(cfg, null);
    },
  },

  // ── GET /kpi/reference/kpi-units ──────────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/kpi-units",
    handler: async (cfg) => {
      await sleep(150);
      return ok<KpiUnitOption[]>(cfg, fallbackKpiUnitSelectOptions());
    },
  },

  // ── GET /kpi/reference/kpi-types-strategic (sys_status_codes KPI_TYPE) ────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/kpi-types-strategic",
    handler: async (cfg) => {
      await sleep(80);
      const rows: KpiTypeOption[] = [
        { code: 102, name: "TEAM", description: "Mục tiêu phòng ban/nhóm" },
        { code: 101, name: "INDIVIDUAL", description: "Mục tiêu cá nhân" },
        { code: 103, name: "PROMOTION", description: "Mục tiêu thăng tiến" },
      ];
      return ok<KpiTypeOption[]>(cfg, rows);
    },
  },

  // ── GET /kpi/reference/ranks ─────────────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/ranks",
    handler: async (cfg) => {
      await sleep(100);
      const mockRanks: RankOption[] = [
        {
          id: "c1000000-0000-0000-0000-000000000001",
          code: "R0",
          name: "Director / GM",
        },
        {
          id: "c1000000-0000-0000-0000-000000000002",
          code: "R1",
          name: "Junior",
        },
        {
          id: "c1000000-0000-0000-0000-000000000003",
          code: "R2",
          name: "Mid-Level",
        },
        {
          id: "c1000000-0000-0000-0000-000000000004",
          code: "R3",
          name: "Senior",
        },
        {
          id: "c1000000-0000-0000-0000-000000000005",
          code: "R4",
          name: "Lead / Principal",
        },
      ];
      return ok<RankOption[]>(cfg, mockRanks);
    },
  },

  // ── GET /kpi/reference/members-by-rank?rankCode= ─────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/members-by-rank",
    handler: async (cfg) => {
      await sleep(100);
      const { rankCode } = getQueryParams(cfg);
      const code = String(rankCode || "")
        .trim()
        .toUpperCase();
      const pool: MemberByRankOption[] = [
        {
          id: "e1000000-0000-0000-0000-000000000005",
          username: "huy.nguyen",
          email: "huy.nguyen@company.vn",
          fullName: "Nguyễn Quang Huy",
          rankCode: "R3",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000006",
          username: "phuoc.tran",
          email: "phuoc.tran@company.vn",
          fullName: "Trần Văn Phước",
          rankCode: "R3",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000007",
          username: "mai.le",
          email: "mai.le@company.vn",
          fullName: "Lê Thị Mai",
          rankCode: "R2",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000009",
          username: "tuan.vu",
          email: "tuan.vu@company.vn",
          fullName: "Vũ Minh Tuấn",
          rankCode: "R2",
          departmentName: "Team Dev 2",
        },
      ];
      const rows = code
        ? pool.filter((m) => String(m.rankCode ?? "").toUpperCase() === code)
        : [];
      return ok<MemberByRankOption[]>(cfg, rows);
    },
  },

  // ── GET /kpi/reference/promotion-assignees ─────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/promotion-assignees",
    handler: async (cfg) => {
      await sleep(120);
      const pool: MemberByRankOption[] = [
        {
          id: "e1000000-0000-0000-0000-000000000005",
          username: "huy.nguyen",
          email: "huy.nguyen@company.vn",
          fullName: "Nguyễn Quang Huy",
          rankCode: "R3",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000006",
          username: "phuoc.tran",
          email: "phuoc.tran@company.vn",
          fullName: "Trần Văn Phước",
          rankCode: "R3",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000007",
          username: "mai.le",
          email: "mai.le@company.vn",
          fullName: "Lê Thị Mai",
          rankCode: "R2",
          departmentName: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000009",
          username: "tuan.vu",
          email: "tuan.vu@company.vn",
          fullName: "Vũ Minh Tuấn",
          rankCode: "R2",
          departmentName: "Team Dev 2",
        },
        {
          id: "e1000000-0000-0000-0000-000000000099",
          username: "no.rank",
          email: "no.rank@company.vn",
          fullName: "User Chưa Rank",
          rankCode: "",
          departmentName: "PMO",
        },
      ];
      return ok<MemberByRankOption[]>(cfg, pool);
    },
  },

  // ── GET /kpi/reference/calculation-reference (CALC_TYPE + CALC_RULE theo type) ─
  {
    method: "get",
    test: (p) => p === "/kpi/reference/calculation-reference",
    handler: async (cfg) => {
      await sleep(150);
      return ok<KpiCalculationReferenceData>(
        cfg,
        getFallbackCalculationReference(),
      );
    },
  },

  // ── GET /kpi/reference/department-managers ───────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/reference/department-managers",
    handler: async (cfg) => {
      await sleep(120);
      const rows: DepartmentManagerOption[] = [
        {
          id: "e1000000-0000-0000-0000-000000000002",
          username: "tquang.minh",
          email: "tquang.minh@company.vn",
          fullName: "Trần Quang Minh",
          managingDepartmentsLabel: "Phòng Công Nghệ",
        },
        {
          id: "e1000000-0000-0000-0000-000000000003",
          username: "tdang.huy",
          email: "tdang.huy@company.vn",
          fullName: "Trần Đăng Huy",
          managingDepartmentsLabel: "Team Dev 1",
        },
        {
          id: "e1000000-0000-0000-0000-000000000004",
          username: "nthi.lan",
          email: "nthi.lan@company.vn",
          fullName: "Nguyễn Thị Lan",
          managingDepartmentsLabel: "Team Dev 2",
        },
      ];
      return ok<DepartmentManagerOption[]>(cfg, rows);
    },
  },

  // ── GET /kpi/gm/kpi-cycles-with-kpis ──────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/kpi-cycles-with-kpis",
    handler: async (cfg) => {
      await sleep(200);
      return ok(cfg, [...MOCK_GM_KPI_CYCLES_WITH_KPIS]);
    },
  },

  // ── GET /kpi/gm/kpi-cycles-for-evaluation — year >= năm hiện tại ───────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/kpi-cycles-for-evaluation",
    handler: async (cfg) => {
      await sleep(120);
      const y0 = new Date().getFullYear();
      const filtered = MOCK_GM_KPI_CYCLES_WITH_KPIS.filter((c) => c.year >= y0);
      const rows =
        filtered.length > 0
          ? filtered
          : [
              {
                id: "c2000000-0000-0000-0000-000000000001",
                year: y0,
                name: `Năm ${y0}`,
                statusCode: 201,
              },
            ];
      return ok<GmKpiCycleOption[]>(cfg, rows);
    },
  },

  // ── GET /kpi/gm/evaluation-hub/assignments?cycleId= — tab đánh giá GM (mock rỗng) ─
  {
    method: "get",
    test: (p) => p === "/kpi/gm/evaluation-hub/assignments",
    handler: async (cfg) => {
      await sleep(200);
      const { cycleId } = getQueryParams(cfg);
      const payload: GmEvaluationHubApiResponse = {
        cycleId: cycleId || "c2000000-0000-0000-0000-000000000001",
        year: new Date().getFullYear(),
        cycleName: "Mock chu kỳ đánh giá",
        assignments: [],
      };
      return ok(cfg, payload);
    },
  },

  // ── POST /kpi/gm/evaluation-hub/confirm — GM xác nhận drawer (mock) ───────
  {
    method: "post",
    test: (p) => p === "/kpi/gm/evaluation-hub/confirm",
    handler: async (cfg) => {
      await sleep(200);
      const body = parseBody<{ lines?: unknown[] }>(cfg);
      const n = Array.isArray(body.lines) ? body.lines.length : 0;
      const out: GmEvaluationHubConfirmResult = { updatedCount: n, skippedCount: 0 };
      return ok(cfg, out);
    },
  },

  // ── POST /kpi/gm/personal-evaluation/submit — GM nộp đợt KPI cá nhân (mock) ─
  {
    method: "post",
    test: (p) => p === "/kpi/gm/personal-evaluation/submit",
    handler: async (cfg) => {
      await sleep(150);
      return ok(cfg, null);
    },
  },

  // ── GET /kpi/gm/approved-kpi-queue?cycleId= — mock: rỗng (tab mock dùng snapshot GmLayout) ─
  {
    method: "get",
    test: (p) => p === "/kpi/gm/approved-kpi-queue",
    handler: async (cfg) => {
      await sleep(100);
      return ok<GmApprovedKpiQueueItemApi[]>(cfg, []);
    },
  },

  // ── POST /kpi/gm/approved-kpi-queue/decision — mock ───────────────────────
  {
    method: "post",
    test: (p) => p === "/kpi/gm/approved-kpi-queue/decision",
    handler: async (cfg) => {
      await sleep(120);
      const out: GmApprovedKpiDecisionResultApi = { updatedCount: 1 };
      return ok(cfg, out);
    },
  },

  // ── GET /kpi/gm/dashboard?year=YYYY ──────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/dashboard",
    handler: async (cfg) => {
      await sleep(400);
      const { year } = getQueryParams(cfg);
      return ok(
        cfg,
        mockGmMinimalDashboard(year ? parseInt(year, 10) : new Date().getFullYear()),
      );
    },
  },

  // ── GET /kpi/gm/diagnostics-hierarchy?year= ───────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/diagnostics-hierarchy",
    handler: async (cfg) => {
      await sleep(400);
      const { year } = getQueryParams(cfg);
      const y = year ? parseInt(year, 10) : 2026;
      const payload: GmDiagnosticsHierarchyApiData = {
        year: Number.isFinite(y) ? y : 2026,
        cycleId: "c2000000-0000-0000-0000-000000000001",
        cycleName: `Năm ${Number.isFinite(y) ? y : 2026}`,
        cycleStatusCode: 201,
        catalogItems: [],
        kpis: [],
      };
      return ok(cfg, payload);
    },
  },

  // ── POST /kpi/gm/strategic-kpis — tạo KPI chiến lược (mock: không ghi DB) ───
  {
    method: "post",
    test: (p) => p === "/kpi/gm/strategic-kpis",
    handler: async (cfg) => {
      await sleep(450);
      const b = parseBody<Record<string, unknown>>(cfg);
      const cycleId = String(
        b.cycleId ?? "c2000000-0000-0000-0000-000000000001",
      );
      const name = String(b.kpiName ?? "KPI").trim() || "KPI";
      const wRaw = b.weightPct;
      const wNum =
        typeof wRaw === "number"
          ? wRaw
          : typeof wRaw === "string"
            ? Number.parseFloat(wRaw.replace("%", "").trim())
            : Number.NaN;
      const weight = Number.isFinite(wNum) ? Math.round(wNum * 100) / 100 : 5;
      const memberIds = Array.isArray(b.memberIds)
        ? (b.memberIds as unknown[]).length
        : 0;
      const assignPms = Array.isArray(b.assignPMs)
        ? (b.assignPMs as unknown[]).length
        : 0;
      const assignmentsCreated =
        memberIds > 0 ? memberIds : assignPms > 0 ? 3 : 0;
      const tvRaw = b.targetValue;
      let targetNum: number | null = null;
      if (typeof tvRaw === "number" && Number.isFinite(tvRaw)) {
        targetNum = tvRaw;
      } else if (tvRaw != null && tvRaw !== "") {
        const n = Number.parseFloat(String(tvRaw).trim());
        if (Number.isFinite(n)) targetNum = n;
      }
      const payload: GmCreateStrategicKpiResponseData = {
        kpiInformationId:
          globalThis.crypto?.randomUUID?.() ?? `mock-info-${Date.now()}`,
        cycleId,
        masterKpiId:
          globalThis.crypto?.randomUUID?.() ?? `mock-master-${Date.now()}`,
        code: null,
        name,
        categoryId: String(b.perspective ?? ""),
        categoryName: null,
        typeCode:
          typeof b.typeCode === "number"
            ? b.typeCode
            : Number.parseInt(String(b.typeCode ?? "101"), 10) || 101,
        calculationRuleCode: 802,
        calculationTypeCode: 701,
        unitCode:
          typeof b.unitCode === "number"
            ? b.unitCode
            : Number.parseInt(String(b.unitCode ?? "902"), 10) || 902,
        isGlobal: true,
        targetDescription:
          b.targetDescription != null &&
          typeof b.targetDescription === "object" &&
          !Array.isArray(b.targetDescription)
            ? (b.targetDescription as import("@/types/gm-strategic-kpi-edit").KpiScoringRulesPayload)
            : null,
        targetValue: targetNum,
        weight,
        isImportant: b.isImportant === true,
        assignmentsCreated,
      };
      return created(cfg, payload);
    },
  },

  // ── GET /kpi/gm/strategic-kpis/:id — form sửa KPI (mock) ───────────────────
  {
    method: "get",
    test: (p) => /^\/kpi\/gm\/strategic-kpis\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(220);
      const id = path.split("/").pop() ?? "mock-kpi-info";
      const payload: GmStrategicKpiEditData = {
        kpiInformationId: id,
        cycleId: "c2000000-0000-0000-0000-000000000001",
        masterKpiId: "a2000000-0000-0000-0000-000000000099",
        typeCode: 102,
        perspective: "a2000000-0000-0000-0000-000000000001",
        kpiName: "Mock KPI (chỉnh sửa)",
        targetDescription: null,
        targetValue: 88,
        unitCode: 902,
        weightPct: 10,
        calculationMethod: "mean_actual_plan",
        isImportant: false,
        assignPMs: [],
        pmTargets: {},
        memberIds: [],
      };
      return ok(cfg, payload);
    },
  },

  // ── PUT /kpi/gm/strategic-kpis/:id — cập nhật KPI (mock) ──────────────────
  {
    method: "put",
    test: (p) => /^\/kpi\/gm\/strategic-kpis\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(400);
      const id = path.split("/").pop() ?? "";
      const b = parseBody<Record<string, unknown>>(cfg);
      const name = String(b.kpiName ?? "KPI").trim() || "KPI";
      const payload: GmCreateStrategicKpiResponseData = {
        kpiInformationId:
          id.trim() !== ""
            ? id
            : (globalThis.crypto?.randomUUID?.() ?? `mock-info-${Date.now()}`),
        cycleId: String(b.cycleId ?? "c2000000-0000-0000-0000-000000000001"),
        masterKpiId:
          globalThis.crypto?.randomUUID?.() ?? `mock-master-${Date.now()}`,
        code: null,
        name,
        categoryId: String(b.perspective ?? ""),
        categoryName: null,
        typeCode:
          typeof b.typeCode === "number"
            ? b.typeCode
            : Number.parseInt(String(b.typeCode ?? "101"), 10) || 101,
        calculationRuleCode: 802,
        calculationTypeCode: 701,
        unitCode:
          typeof b.unitCode === "number"
            ? b.unitCode
            : Number.parseInt(String(b.unitCode ?? "902"), 10) || 902,
        isGlobal: true,
        targetDescription:
          b.targetDescription != null &&
          typeof b.targetDescription === "object" &&
          !Array.isArray(b.targetDescription)
            ? (b.targetDescription as import("@/types/gm-strategic-kpi-edit").KpiScoringRulesPayload)
            : null,
        targetValue:
          typeof b.targetValue === "number" && Number.isFinite(b.targetValue)
            ? b.targetValue
            : b.targetValue != null && b.targetValue !== ""
              ? Number.parseFloat(String(b.targetValue))
              : null,
        weight: 10,
        isImportant: b.isImportant === true,
        assignmentsCreated: 0,
      };
      return ok(cfg, payload);
    },
  },

  // ── DELETE /kpi/gm/strategic-kpis/:id — xóa KPI chiến lược (mock) ─────────
  {
    method: "delete",
    test: (p) => /^\/kpi\/gm\/strategic-kpis\/[^/]+$/.test(p),
    handler: async (cfg) => {
      await sleep(280);
      return {
        data: mockResponse(null, "Đã xóa KPI (mock)."),
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        config: cfg,
      };
    },
  },

  // ── GET/POST/PUT/DELETE /kpi/gm/departments ───────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/gm/departments",
    handler: async (cfg) => {
      await sleep(200);
      const qp = getQueryParams(cfg);
      const parsed =
        qp.year != null && qp.year !== ""
          ? Number.parseInt(qp.year, 10)
          : Number.NaN;
      const y = Number.isFinite(parsed) ? parsed : new Date().getFullYear();
      const rows = [...mockGmDepartmentRows]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({
          ...r,
          kpiYear: y,
          assignedKpis: (r.assignedKpis ?? []).filter((k) => k.cycleYear === y),
        }));
      return ok(cfg, rows);
    },
  },
  {
    method: "post",
    test: (p) => p === "/kpi/gm/departments",
    handler: async (cfg) => {
      await sleep(280);
      const body = parseBody<{
        name: string;
        parentId?: string | null;
        managerId?: string | null;
      }>(cfg);
      if (!body?.name?.trim()) fail(cfg, 400, "Validation failed");
      const now = new Date().toISOString();
      const y = new Date().getFullYear();
      const row: GmDepartmentApiRow = {
        id: mockGmKpiTemplateNewId(),
        name: body.name.trim(),
        parentId: body.parentId ?? null,
        managerId: body.managerId ?? null,
        managerFullName: null,
        managerRoleCode: body.managerId ? "PM" : null,
        createdAt: now,
        updatedAt: now,
        members: [],
        assignedKpis: [],
        kpiYear: y,
      };
      mockGmDepartmentRows = [row, ...mockGmDepartmentRows];
      return created(cfg, row);
    },
  },
  {
    method: "put",
    test: (p) => /^\/kpi\/gm\/departments\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(250);
      const id = decodeURIComponent(path.split("/")[4] ?? "");
      const body = parseBody<{
        name: string;
        parentId?: string | null;
        managerId?: string | null;
      }>(cfg);
      const idx = mockGmDepartmentRows.findIndex((r) => r.id === id);
      if (idx < 0) fail(cfg, 404, "Department not found");
      const cur = mockGmDepartmentRows[idx]!;
      const nextManagerId =
        body.managerId !== undefined ? (body.managerId ?? null) : cur.managerId;
      const updated: GmDepartmentApiRow = {
        ...cur,
        name: body.name?.trim() ?? cur.name,
        parentId:
          body.parentId !== undefined ? (body.parentId ?? null) : cur.parentId,
        managerId: nextManagerId,
        managerRoleCode:
          body.managerId !== undefined
            ? nextManagerId
              ? "PM"
              : null
            : cur.managerRoleCode,
        updatedAt: new Date().toISOString(),
      };
      mockGmDepartmentRows = mockGmDepartmentRows.map((r, i) =>
        i === idx ? updated : r,
      );
      return ok(cfg, updated);
    },
  },
  {
    method: "delete",
    test: (p) => /^\/kpi\/gm\/departments\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(220);
      const id = decodeURIComponent(path.split("/")[4] ?? "");
      const kids = mockGmDepartmentRows.filter((r) => r.parentId === id);
      if (kids.length)
        fail(
          cfg,
          400,
          "Cannot delete department that still has sub-departments",
        );
      const before = mockGmDepartmentRows.length;
      mockGmDepartmentRows = mockGmDepartmentRows.filter((r) => r.id !== id);
      if (mockGmDepartmentRows.length === before)
        fail(cfg, 404, "Department not found");
      return {
        data: mockResponse(null, "Department has been deleted."),
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        config: cfg,
      };
    },
  },
  {
    method: "get",
    test: (p) => /^\/kpi\/gm\/departments\/[^/]+\/member-candidates$/.test(p),
    handler: async (cfg, path) => {
      await sleep(120);
      const deptId = mockGmDepartmentIdFromMembersPath(path);
      if (!deptId) fail(cfg, 400, "invalid path");
      const dept = mockGmDepartmentRows.find((r) => r.id === deptId);
      if (!dept) fail(cfg, 404, "Department not found");
      const memberIds = new Set((dept.members ?? []).map((m) => m.userId));
      const qp = getQueryParams(cfg);
      const q = (qp.q ?? "").trim().toLowerCase();
      const rankFilters = collectRankCodesFromRequest(cfg);
      let list = MOCK_GM_DEPT_MEMBER_CANDIDATE_POOL.filter(
        (c) => !memberIds.has(c.userId),
      );
      if (q) {
        list = list.filter((c) => {
          const hay = `${c.fullName} ${c.email ?? ""} ${c.jobTitleLabel ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
      }
      if (rankFilters.length) {
        const rs = new Set(rankFilters);
        list = list.filter((c) => c.rankCode && rs.has(c.rankCode));
      }
      return ok(cfg, list);
    },
  },
  {
    method: "post",
    test: (p) => /^\/kpi\/gm\/departments\/[^/]+\/members$/.test(p),
    handler: async (cfg, path) => {
      await sleep(200);
      const deptId = mockGmDepartmentIdFromMembersPath(path);
      if (!deptId) fail(cfg, 400, "invalid path");
      const idx = mockGmDepartmentRows.findIndex((r) => r.id === deptId);
      if (idx < 0) fail(cfg, 404, "Department not found");
      const body = parseBody<{ userIds?: string[] }>(cfg);
      const ids = Array.isArray(body.userIds) ? body.userIds : [];
      if (!ids.length) fail(cfg, 400, "userIds required");
      const cur = mockGmDepartmentRows[idx]!;
      const members = [...(cur.members ?? [])];
      const poolById = new Map(
        MOCK_GM_DEPT_MEMBER_CANDIDATE_POOL.map((c) => [c.userId, c]),
      );
      const existing = new Set(members.map((m) => m.userId));
      const toAdd = ids.filter((uid) => uid && !existing.has(uid));
      for (const uid of toAdd) {
        const managedElsewhere = mockGmDepartmentRows.some(
          (r) => r.id !== deptId && r.managerId === uid,
        );
        if (managedElsewhere) {
          fail(
            cfg,
            400,
            "User is set as manager of another department; change that department's manager before adding them here.",
          );
        }
      }
      const toAddSet = new Set(toAdd);
      mockGmDepartmentRows = mockGmDepartmentRows.map((r) => {
        if (r.id === deptId) return r;
        const prev = r.members ?? [];
        const next = prev.filter((m) => !toAddSet.has(m.userId));
        if (next.length === prev.length) return r;
        return { ...r, members: next, updatedAt: new Date().toISOString() };
      });
      const idxAfter = mockGmDepartmentRows.findIndex((r) => r.id === deptId);
      const curAfter = mockGmDepartmentRows[idxAfter]!;
      const membersAfter = [...(curAfter.members ?? [])];
      for (const uid of ids) {
        if (!uid || membersAfter.some((m) => m.userId === uid)) continue;
        const c = poolById.get(uid);
        const row: GmDepartmentMemberApiRow = c
          ? {
              userId: c.userId,
              fullName: c.fullName,
              email: c.email,
              rankCode: c.rankCode,
            }
          : {
              userId: uid,
              fullName: "User",
              email: null,
              rankCode: null,
            };
        membersAfter.push(row);
      }
      const updated: GmDepartmentApiRow = {
        ...curAfter,
        members: membersAfter,
        updatedAt: new Date().toISOString(),
      };
      mockGmDepartmentRows = mockGmDepartmentRows.map((r, i) =>
        i === idxAfter ? updated : r,
      );
      return ok(cfg, updated);
    },
  },
  {
    method: "delete",
    test: (p) => /^\/kpi\/gm\/departments\/[^/]+\/members\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(160);
      const m = path.match(/^\/kpi\/gm\/departments\/([^/]+)\/members\/([^/]+)$/);
      if (!m) fail(cfg, 400, "invalid path");
      const deptId = decodeURIComponent(m[1]);
      const userId = decodeURIComponent(m[2]);
      const idx = mockGmDepartmentRows.findIndex((r) => r.id === deptId);
      if (idx < 0) fail(cfg, 404, "Department not found");
      const cur = mockGmDepartmentRows[idx]!;
      const members = (cur.members ?? []).filter((x) => x.userId !== userId);
      const updated: GmDepartmentApiRow = {
        ...cur,
        members,
        updatedAt: new Date().toISOString(),
      };
      mockGmDepartmentRows = mockGmDepartmentRows.map((r, i) =>
        i === idx ? updated : r,
      );
      return {
        data: mockResponse(null, "Member removed from department."),
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        config: cfg,
      };
    },
  },

  // ── GET /kpi/gm/sections/:id/members ─────────────────────────────────────
  {
    method: "get",
    test: (p) => /^\/kpi\/gm\/sections\/[^/]+\/members$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300);
      const sectionId = path.split("/")[4];
      return ok(cfg, mockGmSectionMembers(sectionId));
    },
  },

  // ── GET /kpi/leader/kpi-info?year=&type=INDIVIDUAL|PROMOTION (GM/PM/Leader sheet cá nhân)
  {
    method: "get",
    test: (p) => p === "/kpi/leader/kpi-info",
    handler: async (cfg) => {
      await sleep(180);
      const q = getQueryParams(cfg);
      const y = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
      const type = (q.type || "INDIVIDUAL").toUpperCase();
      if (type === "PROMOTION") {
        return ok(cfg, {
          year: y,
          categories: [
            {
              id: "mock-cat-promo",
              name: "👥 Customer",
              assignments: [
                {
                  assignmentId: `mock-promo-${y}-1`,
                  kpiName: "Promotion readiness (mock)",
                  kpiCode: "P-MOCK-1",
                  targetValue: 1,
                  targetDescription: "Hoàn thành checklist thăng tiến",
                  weight: 12,
                  typeCode: 103,
                  typeName: "PROMOTION",
                  statusCode: 405,
                  statusName: "ACCEPTED",
                  statusDesc: "Mock",
                  midSelfScore: 3.8,
                  endSelfScore: null,
                  endPmScore: null,
                  evidences: null,
                },
              ],
            },
          ],
          kpiSummary: {
            finalScore: 3.8,
            evaluationComments: "",
            evaluationStatus: "",
          },
        });
      }
      return ok(cfg, {
        year: y,
        categories: [
          {
            id: "mock-cat-fin",
            name: "💰 Financial",
            assignments: [
              {
                assignmentId: `mock-ind-${y}-1`,
                kpiName: "Individual cost discipline (mock)",
                kpiCode: "I-MOCK-1",
                targetValue: 102,
                targetDescription: "≤ 102% ngân sách được giao",
                weight: 10,
                typeCode: 101,
                typeName: "INDIVIDUAL",
                statusCode: 405,
                statusName: "ACCEPTED",
                statusDesc: "Mock",
                midSelfScore: 4.2,
                endSelfScore: null,
                endPmScore: null,
                evidences: null,
              },
            ],
          },
          {
            id: "mock-cat-internal",
            name: "⚙️ Internal Process",
            assignments: [
              {
                assignmentId: `mock-ind-${y}-2`,
                kpiName: "Delivery reliability (mock)",
                kpiCode: "I-MOCK-2",
                targetValue: 95,
                targetDescription: "≥ 95% đúng hạn",
                weight: 11,
                typeCode: 102,
                typeName: "TEAM",
                statusCode: 405,
                statusName: "ACCEPTED",
                statusDesc: "Mock",
                midSelfScore: 3.5,
                endSelfScore: null,
                endPmScore: null,
                evidences: null,
              },
            ],
          },
        ],
        kpiSummary: {
          finalScore: 3.9,
          evaluationComments: "",
          evaluationStatus: "",
        },
      });
    },
  },

  // ── GET /kpi/leader/dashboard?year=YYYY ──────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/leader/dashboard",
    handler: async (cfg) => {
      await sleep(350);
      const { year } = getQueryParams(cfg);
      return ok(cfg, getMockLeaderKpiDashboard(year ? parseInt(year) : 2025));
    },
  },

  // ── GET /kpi/pm/dashboard?year=YYYY ──────────────────────────────────────
  {
    method: "get",
    test: (p) => p === "/kpi/pm/dashboard",
    handler: async (cfg) => {
      await sleep(350);
      const { year } = getQueryParams(cfg);
      return ok(
        cfg,
        getMockPmKpiDashboard(
          year ? parseInt(year, 10) : new Date().getFullYear(),
        ),
      );
    },
  },

  // ── PUT /kpi/pm/sheet/:memberId/:itemId ───────────────────────────────────
  {
    method: "put",
    test: (p) => /^\/kpi\/pm\/sheet\/[^/]+\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300);
      const parts = path.split("/");
      const itemId = parts[5];
      const { pmScore } = parseBody<{ pmScore: number }>(cfg);
      return ok(cfg, { id: itemId, pmScore });
    },
  },

  // ── POST /kpi/pm/sheet/:memberId/approve ──────────────────────────────────
  {
    method: "post",
    test: (p) => /^\/kpi\/pm\/sheet\/[^/]+\/approve$/.test(p),
    handler: async (cfg) => {
      await sleep(400);
      return ok(cfg, null);
    },
  },

  // ── PUT /kpi/leader/sheet/:memberId/:itemId ───────────────────────────────
  {
    method: "put",
    test: (p) => /^\/kpi\/leader\/sheet\/[^/]+\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(300);
      const parts = path.split("/");
      const itemId = parts[5];
      const { leaderScore } = parseBody<{ leaderScore: number }>(cfg);
      return ok(cfg, { id: itemId, leaderScore });
    },
  },
];

// ── In-memory stores for Admin module (simulate persistence in mock mode) ──────
let mockEmployeeStore: Employee[] = [...MOCK_EMPLOYEES];
let mockTemplateStore: EmailTemplate[] = [...MOCK_EMAIL_TEMPLATES];

// ── Admin Routes ───────────────────────────────────────────────────────────────
const adminRoutes: typeof routes = [
  // GET /admin/sections — danh sách phòng ban từ departments
  {
    method: "get",
    test: (p) => p === "/admin/sections",
    handler: async (cfg) => {
      await sleep(200);
      return ok(cfg, MOCK_DEPARTMENTS);
    },
  },

  // GET /admin/ranks — danh sách cấp bậc từ ranks
  {
    method: "get",
    test: (p) => p === "/admin/ranks",
    handler: async (cfg) => {
      await sleep(200);
      return ok(cfg, MOCK_RANK_OPTIONS);
    },
  },

  // GET /admin/campaigns
  {
    method: "get",
    test: (p) => p === "/admin/campaigns",
    handler: async (cfg) => {
      await sleep(300);
      return ok(cfg, MOCK_CAMPAIGNS);
    },
  },

  // GET /admin/campaigns/progress?period=xxx
  {
    method: "get",
    test: (p) => p === "/admin/campaigns/progress",
    handler: async (cfg) => {
      await sleep(250);
      const { period } = getQueryParams(cfg);
      const isPast = period?.startsWith("past");
      return ok(
        cfg,
        isPast ? MOCK_PAST_EMPLOYEE_PROGRESS : MOCK_EMPLOYEE_PROGRESS,
      );
    },
  },

  // POST /admin/campaigns/:id/notify
  {
    method: "post",
    test: (p) => /^\/admin\/campaigns\/[^/]+\/notify$/.test(p),
    handler: async (cfg) => {
      await sleep(600);
      const body = cfg.data ? JSON.parse(cfg.data as string) : {};
      const type: string = body.type ?? "all";
      if (type === "single") {
        const empId: string = body.employeeId ?? "";
        const target = MOCK_EMPLOYEES.find((e) => e.id === empId);
        console.info(
          `[Mock] Remind email → ${target ? target.email : empId}: "${body.message ?? ""}"`,
        );
        return ok(cfg, {
          sent: true,
          type: "single",
          recipient: target?.email ?? empId,
        });
      }
      const emails = MOCK_EMPLOYEES.filter((e) => e.status === "active").map(
        (e) => e.email,
      );
      console.info(
        `[Mock] Mass mail → ${emails.length} nhân viên: "${body.message ?? ""}"`,
      );
      return ok(cfg, { sent: true, type: "all", count: emails.length });
    },
  },

  // GET /admin/employees
  {
    method: "get",
    test: (p) => p === "/admin/employees",
    handler: async (cfg) => {
      await sleep(300);
      return ok(cfg, mockEmployeeStore);
    },
  },

  // POST /admin/employees
  {
    method: "post",
    test: (p) => p === "/admin/employees",
    handler: async (cfg) => {
      await sleep(400);
      const body = parseBody<Omit<Employee, "id">>(cfg);
      const newEmp: Employee = { id: `emp-${Date.now()}`, ...body };
      mockEmployeeStore = [...mockEmployeeStore, newEmp];
      return ok(cfg, newEmp);
    },
  },

  // PUT /admin/employees/:id
  {
    method: "put",
    test: (p) => /^\/admin\/employees\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(350);
      const id = path.split("/")[3];
      const body = parseBody<Partial<Employee>>(cfg);
      mockEmployeeStore = mockEmployeeStore.map((e) =>
        e.id === id ? { ...e, ...body } : e,
      );
      return ok(cfg, mockEmployeeStore.find((e) => e.id === id) ?? body);
    },
  },

  // GET /admin/email-templates
  {
    method: "get",
    test: (p) => p === "/admin/email-templates",
    handler: async (cfg) => {
      await sleep(280);
      return ok(cfg, mockTemplateStore);
    },
  },

  // POST /admin/email-templates
  {
    method: "post",
    test: (p) => p === "/admin/email-templates",
    handler: async (cfg) => {
      await sleep(400);
      const body = parseBody<Omit<EmailTemplate, "id">>(cfg);
      const newTpl: EmailTemplate = { id: `tpl-${Date.now()}`, ...body };
      mockTemplateStore = [...mockTemplateStore, newTpl];
      return ok(cfg, newTpl);
    },
  },

  // PUT /admin/email-templates/:id
  {
    method: "put",
    test: (p) => /^\/admin\/email-templates\/[^/]+$/.test(p),
    handler: async (cfg, path) => {
      await sleep(350);
      const id = path.split("/")[3];
      const body = parseBody<Partial<EmailTemplate>>(cfg);
      mockTemplateStore = mockTemplateStore.map((t) =>
        t.id === id ? { ...t, ...body } : t,
      );
      return ok(cfg, mockTemplateStore.find((t) => t.id === id) ?? body);
    },
  },
];

export const mockAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? "get").toLowerCase();
  const path = extractPath(config);

  for (const route of [...routes, ...adminRoutes]) {
    if (route.method !== method) continue;
    if (route.test(path)) return route.handler(config, path);
  }

  console.warn(`[MockAdapter] No handler for ${method.toUpperCase()} ${path}`);
  fail(config, 404, `[Mock] No handler for ${method.toUpperCase()} ${path}`);
};
