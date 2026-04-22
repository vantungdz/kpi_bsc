import type { GmKpiDashboard } from '@/types/kpi'

export function getMockGmKpiDashboard(year = 2025): GmKpiDashboard {
  return {
    year,
    currentPhase: 'year_end',
    phaseProgressPct: 78,
    coreTargets: [
      {
        id: 'ct-1',
        code: 'C.1',
        name: 'Gross Profit Achievement',
        target: '>= 32.0%',
        overallValue: '34.2%',
        overallMet: true,
        unit: '%',
        progressPct: 100,
        breakdown: [
          { sectionId: 'S1', sectionName: 'S1 - Thai Van Liem', value: '34.5%', met: true },
          { sectionId: 'S2', sectionName: 'S2 - Nguyen Van A', value: '31.0%', met: false, warning: true },
          { sectionId: 'S3', sectionName: 'S3 - Tran Thi B', value: '38.0%', met: true },
          { sectionId: 'S4', sectionName: 'S4 - Le Van C', value: '33.2%', met: true },
          { sectionId: 'S5', sectionName: 'S5 - Pham Ba Quoc Tai', value: '35.1%', met: true },
          { sectionId: 'S6', sectionName: 'S6 - Dinh Thi E', value: '30.5%', met: false, warning: true },
          { sectionId: 'S7', sectionName: 'S7 - Vu Hoang F', value: '36.0%', met: true },
          { sectionId: 'S8', sectionName: 'S8 - Hoang Van G', value: '33.8%', met: true },
          { sectionId: 'S9', sectionName: 'S9 - Bui Thi H', value: '32.1%', met: true },
          { sectionId: 'S10', sectionName: 'S10 - Le Van K', value: '34.0%', met: false, warning: true },
        ],
      },
      {
        id: 'ct-2',
        code: 'C.3',
        name: 'Idle Rate (Non-billable)',
        target: '<= 17.0 MM',
        overallValue: '14.5 MM',
        overallMet: true,
        unit: 'MM',
        progressPct: 85,
        breakdown: [
          { sectionId: 'S1', sectionName: 'S1 - Thai Van Liem', value: '2.5 MM', met: true },
          { sectionId: 'S2', sectionName: 'S2 - Nguyen Van A', value: '1.0 MM', met: true },
          { sectionId: 'S3', sectionName: 'S3 - Tran Thi B', value: '4.5 MM', met: false, warning: true },
          { sectionId: 'S4', sectionName: 'S4 - Le Van C', value: '1.5 MM', met: true },
          { sectionId: 'S5', sectionName: 'S5 - Pham Ba Quoc Tai', value: '0.5 MM', met: true },
          { sectionId: 'S6', sectionName: 'S6 - Dinh Thi E', value: '3.5 MM', met: false, warning: true },
          { sectionId: 'S7', sectionName: 'S7 - Vu Hoang F', value: '1.0 MM', met: true },
          { sectionId: 'S8', sectionName: 'S8 - Hoang Van G', value: '1.2 MM', met: true },
          { sectionId: 'S9', sectionName: 'S9 - Bui Thi H', value: '0.9 MM', met: true },
          { sectionId: 'S10', sectionName: 'S10 - Le Van K', value: '1.1 MM', met: true },
        ],
      },
      {
        id: 'ct-3',
        code: 'A.1d',
        name: 'Customer Satisfaction',
        target: 'Average Score >= 3.0',
        overallValue: '4.0',
        overallMet: true,
        unit: 'score',
        progressPct: 80,
        breakdown: [
          { sectionId: 'S1', sectionName: 'S1 - Thai Van Liem', value: '4.2', met: true },
          { sectionId: 'S2', sectionName: 'S2 - Nguyen Van A', value: '3.8', met: true },
          { sectionId: 'S3', sectionName: 'S3 - Tran Thi B', value: '4.5', met: true },
          { sectionId: 'S4', sectionName: 'S4 - Le Van C', value: '2.8', met: false, warning: true },
          { sectionId: 'S5', sectionName: 'S5 - Pham Ba Quoc Tai', value: '4.8', met: true },
          { sectionId: 'S6', sectionName: 'S6 - Dinh Thi E', value: '3.2', met: true },
          { sectionId: 'S7', sectionName: 'S7 - Vu Hoang F', value: '4.0', met: true },
          { sectionId: 'S8', sectionName: 'S8 - Hoang Van G', value: '3.9', met: true },
          { sectionId: 'S9', sectionName: 'S9 - Bui Thi H', value: '4.1', met: true },
          { sectionId: 'S10', sectionName: 'S10 - Le Van K', value: '3.6', met: true },
        ],
      },
      {
        id: 'ct-4',
        code: 'A.7',
        name: 'Security Compliance',
        target: 'No major violations',
        overallValue: 'Secure',
        overallMet: true,
        unit: 'violations',
        progressPct: 100,
        breakdown: [
          { sectionId: 'S1', sectionName: 'S1 - Thai Van Liem', value: '0 violations', met: true },
          { sectionId: 'S2', sectionName: 'S2 - Nguyen Van A', value: '0 violations', met: true },
          { sectionId: 'S3', sectionName: 'S3 - Tran Thi B', value: '0 violations', met: true },
          { sectionId: 'S4', sectionName: 'S4 - Le Van C', value: '1 Minor', met: false, warning: true },
          { sectionId: 'S5', sectionName: 'S5 - Pham Ba Quoc Tai', value: '0 violations', met: true },
          { sectionId: 'S6', sectionName: 'S6 - Dinh Thi E', value: '0 violations', met: true },
          { sectionId: 'S7', sectionName: 'S7 - Vu Hoang F', value: '0 violations', met: true },
          { sectionId: 'S8', sectionName: 'S8 - Hoang Van G', value: '0 violations', met: true },
          { sectionId: 'S9', sectionName: 'S9 - Bui Thi H', value: '0 violations', met: true },
          { sectionId: 'S10', sectionName: 'S10 - Le Van K', value: '0 violations', met: true },
        ],
      },
    ],
    sections: [
      { id: 'S1', name: 'Section 1', managerId: 'u-pm-s1', managerName: 'Thai Van Liem', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 85, pendingCount: 2 },
      { id: 'S2', name: 'Section 2', managerId: 'u-pm-s2', managerName: 'Nguyen Van A', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 100, pendingCount: 0 },
      { id: 'S3', name: 'Section 3', managerId: 'u-pm-s3', managerName: 'Tran Thi B', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 40, pendingCount: 5 },
      { id: 'S4', name: 'Section 4', managerId: 'u-pm-s4', managerName: 'Le Van C', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 90, pendingCount: 1 },
      { id: 'S5', name: 'Section 5', managerId: 'u-pm-s5', managerName: 'Pham Ba Quoc Tai', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 100, pendingCount: 0 },
      { id: 'S6', name: 'Section 6', managerId: 'u-pm-s6', managerName: 'Dinh Thi E', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 60, pendingCount: 3 },
      { id: 'S7', name: 'Section 7', managerId: 'u-pm-s7', managerName: 'Vu Hoang F', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 75, pendingCount: 0 },
      { id: 'S8', name: 'Section 8', managerId: 'u-pm-s8', managerName: 'Hoang Van G', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 80, pendingCount: 0 },
      { id: 'S9', name: 'Section 9', managerId: 'u-pm-s9', managerName: 'Bui Thi H', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 88, pendingCount: 1 },
      { id: 'S10', name: 'Section 10', managerId: 'u-pm-s10', managerName: 'Le Van K', memberCount: 10, targetSetupPct: 100, midYearPct: 100, yearEndPct: 72, pendingCount: 2 },
    ],
    summary: {
      totalMembers: 100,
      byRank: [
        { label: 'Employee (R1-R3)', count: 85 },
        { label: 'Leader (R4-R5)', count: 35 },
        { label: 'Manager (R6-R7)', count: 12 },
      ],
      yearEndCompleted: 103,
      highPerformers: 45,
      meetsTarget: 50,
      underperforming: 8,
      pendingEvaluation: 29,
      missingEvidence: 12,
      pendingApproval: 15,
      overdue: 2,
    },
  }
}

export function getMockSectionMembers(sectionId: string) {
  const base = [
    { id: 'E1', name: 'Tran Van Phuoc', rank: 'R3', targetStatus: 'Approved' as const, midYearStatus: 'Approved' as const, finalStatus: 'Evaluating' as const, score: null },
    { id: 'E2', name: 'Le Thi D', rank: 'R2', targetStatus: 'Approved' as const, midYearStatus: 'Approved' as const, finalStatus: 'Completed' as const, score: 4.2 },
    { id: 'E3', name: 'Nguyen Hoang E', rank: 'R4', targetStatus: 'Approved' as const, midYearStatus: 'Approved' as const, finalStatus: 'Evaluating' as const, score: null },
    { id: 'E4', name: 'Pham Van F', rank: 'R2', targetStatus: 'Approved' as const, midYearStatus: 'Approved' as const, finalStatus: 'Completed' as const, score: 3.8 },
    { id: 'E5', name: 'Vo Thi G', rank: 'R1', targetStatus: 'Approved' as const, midYearStatus: 'Approved' as const, finalStatus: 'Not Started' as const, score: null },
  ]
  return base.map(m => ({ ...m, id: `${sectionId}-${m.id}` }))
}

// ── GM Layout workspace (GmLayout.vue + GmDepartmentInvestigation) ───────────
// Thay bằng API thật: chỉ cần thay import / fetch và gán vào cùng shape dữ liệu.

/** Loại KPI chiến lược — đồng bộ form tạo & tag UI toàn GM workspace. */
export type GmStrategicKpiKind = 'cascading' | 'individual' | 'promotion'

/** Khía cạnh BSC — đồng bộ form tạo Strategic KPI & nhóm diagnostics. */
export type GmBscPerspective = 'financial' | 'customer' | 'internal' | 'learning'

export const GM_BSC_ORDER: GmBscPerspective[] = ['financial', 'customer', 'internal', 'learning']

export const GM_BSC_LABELS: Record<GmBscPerspective, string> = {
  financial: 'Financial',
  customer: 'Customer',
  internal: 'Internal Process',
  learning: 'Learning & Growth',
}

export function normalizeGmBscPerspective(raw: unknown): GmBscPerspective {
  const s = String(raw ?? '').trim()
  if (s === 'financial' || s === 'customer' || s === 'internal' || s === 'learning') return s
  return 'internal'
}

export type GmDeptKpiStatus = 'fail' | 'warn' | 'active' | 'pass'

export interface GmDeptKpiMock {
  /** Mã KPI (vd. A.1a) — mock chuẩn 11 mục/section. */
  code?: string
  /** Viết tắt hiển thị (vd. IE). */
  abbr?: string
  /** Nhóm A: mục tiêu vận hành · B: đào tạo nhân viên. */
  category?: 'A' | 'B'
  name: string
  weight: number
  target: string
  actual: string
  status: GmDeptKpiStatus
  kpiType: GmStrategicKpiKind
  /** Khía cạnh BSC (form tạo KPI) — diagnostics nhóm theo trường này. */
  bscPerspective?: GmBscPerspective
  /** ISO — khoảng hoạt động trong **một** năm dương lịch (mock; «Năm nguồn» sao chép). */
  activityStartDate?: string
  activityEndDate?: string
}

export interface GmDepartmentMock {
  id: string
  name: string
  manager: string
  health: number
  progress: number
  risks: { critical: number; medium: number }
  responsibility: string
  breakdown: string
  impact: string | null
  kpis: GmDeptKpiMock[]
}

/** Member trong bảng Investigate — trùng field GmDepartmentInvestigation cần */
export interface GmMemberDetailMock {
  id: string
  name: string
  rank: string
  leader: string
  status: string
  rootCause: string
  dueIn: number | null
  priority: string
  scoreSelf: string
  scoreMgr: string
  deptId: string
  relatedKpi: string
  relatedKpiType: GmStrategicKpiKind
}

export type GmInvestigationMember = GmMemberDetailMock

/** Trạng thái nộp KPI / minh chứng (drawer Chi tiết tình trạng Nộp KPI). */
export type GmKpiSubmissionStatus = 'submitted' | 'submitted_with_file' | 'missing_data'

export interface GmModalKpiItemMock {
  code: string
  obj: string
  weight: number
  target: string
  actual: string
  isFail: boolean
  rootCause: string
  score: string
  kpiType: GmStrategicKpiKind
  submissionStatus: GmKpiSubmissionStatus
  /** Dòng mô tả mục tiêu dưới tên KPI (vd. kế thừa Khối + trọng số). */
  targetSummary?: string
  /** % hoàn thành (submission hoặc Actual/Target) — card rollout diagnostics. */
  actualProgressPct?: string | null
  /** Đường dẫn minh chứng (Drive/Wiki/Jira…) — GM mở tab mới. */
  evidenceAttachmentUrl?: string | null
}

/** Hồ sơ nhân viên cho drawer Nộp KPI (GM layout + diagnostics). */
export interface GmMemberKpiDrawerProfile {
  name: string
  rank?: string
  leader?: string
  /** Tên phòng ban hiển thị dạng in hoa (vd. SOFTWARE DEV 1). */
  departmentLabel?: string
}

/** Một member + một dòng KPI (đúng ngữ cảnh KPI đang mở trong diagnostics). */
export interface GmPmKpiMemberRolloutRow {
  profile: GmMemberKpiDrawerProfile
  item: GmModalKpiItemMock
}

/** Drawer “Chi tiết” theo PM — tất cả member dưới PM cho **một** KPI. */
export interface GmPmKpiRolloutPayload {
  pmName: string
  pmUnitLine?: string
  kpiName: string
  kpiTarget: string
  rows: GmPmKpiMemberRolloutRow[]
}

/** Số KPI chuẩn mỗi section (nhóm A + B theo spec công ty). */
export const GM_LAYOUT_STANDARD_KPI_COUNT = 11

const GM_LAYOUT_KPI_ISO = {
  activityStartDate: '2026-01-01',
  activityEndDate: '2026-12-31',
} as const

/**
 * 11 KPI / section — nhóm A (8) + nhóm B đào tạo (3), đồng bộ tài liệu nội bộ.
 * `deptIndex` chỉ dùng để xoay nhẹ trạng thái mock giữa các section.
 */
export function gmLayoutDeptKpisStandard11(deptIndex: number): GmDeptKpiMock[] {
  const rot: GmDeptKpiStatus[] = ['pass', 'pass', 'active', 'warn', 'fail']
  const st = (i: number): GmDeptKpiStatus => rot[(deptIndex + i) % rot.length]!
  const n = deptIndex
  return [
    {
      code: 'A.1a',
      abbr: 'IE',
      category: 'A',
      name: 'Individual Efficiency',
      weight: 10,
      target: '≥ 95% tương đương WA',
      actual: `${90 + (n % 8)}%`,
      status: st(0),
      kpiType: 'cascading',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.2a',
      abbr: 'WA',
      category: 'A',
      name: 'Work Amount',
      weight: 9,
      target: 'Theo baseline dự án',
      actual: `${1.0 + (n % 5) * 0.1} MM`,
      status: st(1),
      kpiType: 'cascading',
      bscPerspective: 'financial',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.3a',
      abbr: 'IQ',
      category: 'A',
      name: 'Individual Quality',
      weight: 10,
      target: '≥ 98%',
      actual: `${82 + (n % 12)}%`,
      status: st(2),
      kpiType: 'cascading',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.4',
      abbr: 'CS',
      category: 'A',
      name: 'Customer Satisfaction',
      weight: 8,
      target: '≥ 4.5',
      actual: `${(4.2 + (n % 6) * 0.05).toFixed(2)}`,
      status: st(3),
      kpiType: 'promotion',
      bscPerspective: 'customer',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.5a',
      abbr: 'TD',
      category: 'A',
      name: 'Task Delivery',
      weight: 11,
      target: '≥ 95%',
      actual: `${88 + (n % 10)}%`,
      status: st(4),
      kpiType: 'cascading',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.6',
      abbr: 'PC',
      category: 'A',
      name: 'Process Compliance',
      weight: 9,
      target: '100%',
      actual: `${95 + (n % 5)}%`,
      status: st(5),
      kpiType: 'individual',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.7',
      abbr: 'SC',
      category: 'A',
      name: 'Security Compliance',
      weight: 8,
      target: '0 major',
      actual: n % 7 === 0 ? '1 Minor' : '0 violations',
      status: st(6),
      kpiType: 'individual',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'A.8a',
      abbr: 'OW',
      category: 'A',
      name: 'Onsite Work',
      weight: 8,
      target: '≥ 80%',
      actual: `${75 + (n % 20)}%`,
      status: st(7),
      kpiType: 'cascading',
      bscPerspective: 'internal',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'B.1',
      abbr: 'IM',
      category: 'B',
      name: 'Improvement',
      weight: 9,
      target: 'Hoàn thành 100%',
      actual: `${90 + (n % 8)}%`,
      status: st(8),
      kpiType: 'individual',
      bscPerspective: 'learning',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'B.2',
      abbr: 'CO',
      category: 'B',
      name: 'Contribution',
      weight: 9,
      target: '≥ 3.5 điểm',
      actual: `${(3.6 + (n % 8) * 0.05).toFixed(2)}`,
      status: st(9),
      kpiType: 'promotion',
      bscPerspective: 'learning',
      ...GM_LAYOUT_KPI_ISO,
    },
    {
      code: 'B.3',
      abbr: 'LC',
      category: 'B',
      name: 'Language Capability',
      weight: 9,
      target: 'TOEIC ≥ 650',
      actual: `${Math.min(100, Math.round(((660 + (n % 5) * 5) / 650) * 100))}%`,
      status: st(10),
      kpiType: 'individual',
      bscPerspective: 'learning',
      ...GM_LAYOUT_KPI_ISO,
    },
  ]
}

/** 10 section (S1–S10), mỗi section 10 thành viên trong `gmLayoutMockMembersDetails`. */
export const GM_LAYOUT_SECTION_IDS = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
] as const

export const GM_LAYOUT_MEMBERS_PER_SECTION = 10

/** Tên leader (người) — gán luân phiên cho member mock; diagnostics nhóm theo tên này. */
const GM_LAYOUT_TEAM_LEADER_NAMES = ['Nguyễn Văn Lâm', 'Trần Thị Mai', 'Lê Quốc Hùng'] as const

function buildGmLayoutMockMembersDetails(): GmMemberDetailMock[] {
  const ranks = ['R1', 'R2', 'R3', 'R4', 'R5'] as const
  const statuses = ['Pending', 'Approved', 'Overdue'] as const
  const rows: GmMemberDetailMock[] = []
  for (const deptId of GM_LAYOUT_SECTION_IDS) {
    const sn = deptId.slice(1)
    for (let m = 1; m <= GM_LAYOUT_MEMBERS_PER_SECTION; m++) {
      rows.push({
        id: `${deptId}-M${String(m).padStart(2, '0')}`,
        name: `Thành viên Section ${sn} · ${m}`,
        rank: ranks[(m + sn.charCodeAt(0)) % ranks.length]!,
        leader: GM_LAYOUT_TEAM_LEADER_NAMES[(m % 3) as 0 | 1 | 2]!,
        status: statuses[m % statuses.length]!,
        rootCause: m % 4 === 0 ? 'Mock evidence' : '',
        dueIn: m % 4 === 0 ? 0 : m % 3 === 0 ? -1 : 2,
        priority: m % 5 === 0 ? 'Critical' : 'Medium',
        scoreSelf: `${(3 + (m % 5) * 0.1).toFixed(1)}`,
        scoreMgr: `${(3.2 + (m % 4) * 0.1).toFixed(1)}`,
        deptId,
        relatedKpi: 'Individual Efficiency',
        relatedKpiType: 'cascading',
      })
    }
  }
  return rows
}

/** Departments + KPI từng phòng — nguồn cho master list & diagnostics */
export const gmLayoutMockDepartments: GmDepartmentMock[] = [
  {
    id: 'S1',
    name: 'Section 1',
    manager: 'Thai Van Liem',
    health: 82,
    progress: 80,
    risks: { critical: 1, medium: 2 },
    responsibility: 'Leader X (2)',
    breakdown: '2 Missing Evidences',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(0),
  },
  {
    id: 'S2',
    name: 'Section 2',
    manager: 'Nguyen Van A',
    health: 98,
    progress: 100,
    risks: { critical: 0, medium: 0 },
    responsibility: '-',
    breakdown: 'All Clear',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(1),
  },
  {
    id: 'S3',
    name: 'Section 3',
    manager: 'Tran Thi B',
    health: 45,
    progress: 40,
    risks: { critical: 3, medium: 5 },
    responsibility: 'Leader Tran Thi B',
    breakdown: 'Missing Evidence (3)<br/>Leader Delay (2)',
    impact: 'Blocking 2 Delivery KPIs (SD1)',
    kpis: gmLayoutDeptKpisStandard11(2),
  },
  {
    id: 'S4',
    name: 'Section 4',
    manager: 'Le Van C',
    health: 88,
    progress: 90,
    risks: { critical: 0, medium: 1 },
    responsibility: 'Leader Z (1)',
    breakdown: 'Late Self-Eval (1)',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(3),
  },
  {
    id: 'S5',
    name: 'Section 5',
    manager: 'Pham Ba Quoc Tai',
    health: 86,
    progress: 88,
    risks: { critical: 0, medium: 1 },
    responsibility: '-',
    breakdown: 'All Clear',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(4),
  },
  {
    id: 'S6',
    name: 'Section 6',
    manager: 'Dinh Thi E',
    health: 78,
    progress: 72,
    risks: { critical: 1, medium: 2 },
    responsibility: 'Leader (1)',
    breakdown: '1 pending review',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(5),
  },
  {
    id: 'S7',
    name: 'Section 7',
    manager: 'Vu Hoang F',
    health: 82,
    progress: 80,
    risks: { critical: 0, medium: 2 },
    responsibility: '-',
    breakdown: 'Stable',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(6),
  },
  {
    id: 'S8',
    name: 'Section 8',
    manager: 'Hoang Van G',
    health: 80,
    progress: 82,
    risks: { critical: 0, medium: 1 },
    responsibility: '-',
    breakdown: 'Stable',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(7),
  },
  {
    id: 'S9',
    name: 'Section 9',
    manager: 'Bui Thi H',
    health: 84,
    progress: 86,
    risks: { critical: 0, medium: 0 },
    responsibility: '-',
    breakdown: 'All Clear',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(8),
  },
  {
    id: 'S10',
    name: 'Section 10',
    manager: 'Le Van K',
    health: 76,
    progress: 74,
    risks: { critical: 1, medium: 1 },
    responsibility: 'Leader (1)',
    breakdown: '2 items to close',
    impact: null,
    kpis: gmLayoutDeptKpisStandard11(9),
  },
]

export const gmLayoutMockMembersDetails: GmMemberDetailMock[] = buildGmLayoutMockMembersDetails()

/** KPI list trong drawer “Chi tiết tình trạng Nộp KPI” — nhóm theo loại strategic. */
export const gmLayoutMockMemberModalKpiItems: GmModalKpiItemMock[] = [
  {
    code: 'A.1a',
    obj: 'Individual Efficiency',
    weight: 30,
    target: 'WA theo dự án',
    actual: '—',
    isFail: false,
    rootCause: '',
    score: '—',
    kpiType: 'cascading',
    submissionStatus: 'submitted',
    targetSummary: 'Mục tiêu: Kế thừa từ Khối (W: 30%)',
  },
  {
    code: 'A.3a',
    obj: 'Individual Quality',
    weight: 30,
    target: 'IQ đạt ngưỡng dự án',
    actual: '—',
    isFail: true,
    rootCause: '',
    score: '—',
    kpiType: 'individual',
    submissionStatus: 'missing_data',
    targetSummary: 'Mục tiêu: Kế thừa từ R&D (W: 30%)',
  },
  {
    code: 'B.2',
    obj: 'Training / Certifications',
    weight: 20,
    target: '2 chứng chỉ / năm',
    actual: '—',
    isFail: false,
    rootCause: '',
    score: '—',
    kpiType: 'individual',
    submissionStatus: 'submitted_with_file',
    targetSummary: 'Mục tiêu: KPI độc lập theo rank (W: 20%)',
    evidenceAttachmentUrl: 'https://drive.google.com/file/d/mock-gm-training-cert/view',
  },
  {
    code: 'C.1',
    obj: 'Individual Delivery Commitment',
    weight: 20,
    target: 'Cam kết giao hàng cá nhân',
    actual: '—',
    isFail: false,
    rootCause: '',
    score: '—',
    kpiType: 'promotion',
    submissionStatus: 'submitted',
    targetSummary: 'Mục tiêu: Giao đích danh (W: 20%)',
  },
]

/** Donut “KPI Portfolio Status” — tổng 142 = 78+28+18+18; C = 251.33 (r=40) */
export const gmLayoutMockPortfolioDonut = {
  centerTotal: 142,
  centerSubtitle: 'Targets',
  circles: [
    { stroke: '#10b981', strokeDasharray: '137.93 251.33', strokeDashoffset: '0' },
    { stroke: '#f59e0b', strokeDasharray: '49.54 251.33', strokeDashoffset: '-137.93' },
    { stroke: '#3b82f6', strokeDasharray: '31.84 251.33', strokeDashoffset: '-187.47' },
    { stroke: '#ef4444', strokeDasharray: '31.84 251.33', strokeDashoffset: '-219.31' },
  ],
  legend: [
    { label: 'Completed (Pass)', value: 78, dotClass: 'bg-emerald-500', badgeClass: 'text-emerald-800 bg-emerald-100' },
    { label: 'On Track (Active)', value: 18, dotClass: 'bg-blue-500', badgeClass: 'text-blue-900 bg-blue-100' },
    { label: 'At Risk (Warning)', value: 28, dotClass: 'bg-amber-400', badgeClass: 'text-amber-900 bg-amber-100' },
    { label: 'Failed', value: 18, dotClass: 'bg-red-500', badgeClass: 'text-red-900 bg-red-100' },
  ],
  /** Badge xu hướng thẻ “Sức khỏe doanh nghiệp” (theo năm có thể ghi đè trong snapshot). */
  healthTrendLabel: '+4.2% so với tháng trước',
  healthMonthlyTrend: [
    { label: 'T1', value: 75 },
    { label: 'T2', value: 78 },
    { label: 'T3', value: 80 },
    { label: 'T4', value: 76 },
    { label: 'T5', value: 79 },
    { label: 'T6', value: 81 },
    { label: 'T7', value: 82.3 },
    { label: 'T8', value: null },
    { label: 'T9', value: null },
    { label: 'T10', value: null },
    { label: 'T11', value: null },
    { label: 'T12', value: null },
  ],
} satisfies GmPortfolioDonutData

export type GmIssueTypeId = 'pending_approval' | 'not_submitted' | 'missing_evidence'

export interface GmTimelineIssueType {
  id: GmIssueTypeId
  text: string
  dotClass: string
}

export interface GmTimelineIssueDetail {
  kpi: string
  pm: string
  leader: string
  member: string
  bottleneck: 'PM' | 'Leader' | 'Member'
  reason: string
}

export interface GmTimelineIssueBucket {
  id: GmIssueTypeId
  title: string
  iconClass: string
  items: GmTimelineIssueDetail[]
}

/** Process Timeline — Mid-Year “View Issues” popover + drawer detail */
export const gmLayoutMockMidYearIssues = {
  pendingKpisLine: 'Pending: 15 KPIs',
  popoverTitle: '15 KPI Process Issues',
  bullets: [
    { text: '6 pending approval', dotClass: 'text-amber-600' },
    { text: '5 chưa submit', dotClass: 'text-amber-600' },
    { text: '4 thiếu evidence', dotClass: 'text-rose-500' },
  ],
  issueTypes: [
    { id: 'pending_approval', text: '6 pending approval', dotClass: 'text-amber-600' },
    { id: 'not_submitted', text: '5 chưa submit', dotClass: 'text-amber-600' },
    { id: 'missing_evidence', text: '4 thiếu evidence', dotClass: 'text-rose-500' },
  ] as GmTimelineIssueType[],
  issueDetails: [
    {
      id: 'pending_approval',
      title: 'KPIs Pending Approval',
      iconClass: 'bg-orange-100 text-orange-600',
      items: [
        {
          kpi: 'Quality Index',
          pm: 'Tran Thi B',
          leader: 'Tran Quoc L3',
          member: 'Vu Thi H',
          bottleneck: 'PM',
          reason: 'Waiting for Final PM Review',
        },
        {
          kpi: 'Delivery Rate',
          pm: 'Thai Van Liem',
          leader: 'Nguyen Van L1',
          member: 'Nguyen Hoang E',
          bottleneck: 'Leader',
          reason: 'Score disputed by Leader',
        },
        {
          kpi: 'Customer Satisfaction',
          pm: 'Nguyen Van A',
          leader: 'Le Thi L2',
          member: 'Le Thi D',
          bottleneck: 'PM',
          reason: 'PM has not approved the evidence',
        },
      ],
    },
    {
      id: 'not_submitted',
      title: 'KPIs Chưa Submit',
      iconClass: 'bg-orange-100 text-orange-600',
      items: [
        {
          kpi: 'Process Compliance',
          pm: 'Thai Van Liem',
          leader: 'Le Thi L2',
          member: 'Tran Van F',
          bottleneck: 'Member',
          reason: 'Missed deadline to submit form',
        },
        {
          kpi: 'Training Hours',
          pm: 'Le Van C',
          leader: 'Dao Quang P',
          member: 'Pham Van M',
          bottleneck: 'Member',
          reason: 'No submission found on system',
        },
      ],
    },
    {
      id: 'missing_evidence',
      title: 'KPIs Thiếu Evidence',
      iconClass: 'bg-rose-100 text-rose-600',
      items: [
        {
          kpi: 'Quality Index',
          pm: 'Tran Thi B',
          leader: 'Tran Quoc L3',
          member: 'Tran Van Phuoc',
          bottleneck: 'Member',
          reason: 'Jira links missing in the report',
        },
        {
          kpi: 'Delivery Rate',
          pm: 'Nguyen Van A',
          leader: 'Le Thi L2',
          member: 'Le Thi D',
          bottleneck: 'Leader',
          reason: 'Leader requested timesheet re-upload',
        },
        {
          kpi: 'Process Compliance',
          pm: 'Thai Van Liem',
          leader: 'Nguyen Van L1',
          member: 'Nguyen Hoang E',
          bottleneck: 'Member',
          reason: 'No document attached',
        },
      ],
    },
  ] as GmTimelineIssueBucket[],
} as const

/** Process Timeline — KPI Setting (Jan–Mar): mock ~80% + View Issues để test GM layout. */
export const gmLayoutMockSettingIssues = {
  pendingKpisLine: 'Tiến độ giai đoạn: ~80%',
  popoverTitle: 'KPI Setting — còn vấn đề mở',
  bullets: [
    { text: '2 KPI chưa khóa trọng số', dotClass: 'text-amber-600' },
    { text: '1 thiếu baseline đầu kỳ', dotClass: 'text-rose-500' },
  ],
  issueTypes: [
    { id: 'pending_approval', text: '1 chờ Leader duyệt khóa', dotClass: 'text-amber-600' },
    { id: 'not_submitted', text: '1 chưa nộp mục tiêu phòng', dotClass: 'text-amber-600' },
    { id: 'missing_evidence', text: '1 thiếu baseline', dotClass: 'text-rose-500' },
  ] as GmTimelineIssueType[],
  issueDetails: [
    {
      id: 'pending_approval',
      title: 'KPI Setting — Chờ duyệt khóa',
      iconClass: 'bg-orange-100 text-orange-600',
      items: [
        {
          kpi: 'Delivery Rate',
          pm: 'Thai Van Liem',
          leader: 'Nguyen Van L1',
          member: 'Nguyen Hoang E',
          bottleneck: 'Leader',
          reason: 'Chờ Leader xác nhận trọng số giai đoạn',
        },
      ],
    },
    {
      id: 'not_submitted',
      title: 'KPI Setting — Chưa nộp mục tiêu',
      iconClass: 'bg-orange-100 text-orange-600',
      items: [
        {
          kpi: 'Training Hours',
          pm: 'Le Van C',
          leader: 'Dao Quang P',
          member: 'Pham Van M',
          bottleneck: 'Member',
          reason: 'Chưa nộp form mục tiêu phòng ban',
        },
      ],
    },
    {
      id: 'missing_evidence',
      title: 'KPI Setting — Thiếu baseline',
      iconClass: 'bg-rose-100 text-rose-600',
      items: [
        {
          kpi: 'Quality Index',
          pm: 'Tran Thi B',
          leader: 'Tran Quoc L3',
          member: 'Vu Thi H',
          bottleneck: 'Member',
          reason: 'Chưa đính kèm baseline đo lường đầu kỳ',
        },
      ],
    },
  ] as GmTimelineIssueBucket[],
} as const

/** Process Timeline — Year-End (khi đã tới Nov–Dec và có KPI lệch). */
export const gmLayoutMockYearEndIssues = {
  pendingKpisLine: 'Cần xử lý: 5 KPIs',
  popoverTitle: 'Year-End — 5 KPI cần rà soát',
  bullets: [
    { text: '2 chờ GM phê duyệt cuối năm', dotClass: 'text-amber-600' },
    { text: '2 chưa đóng bằng chứng', dotClass: 'text-rose-500' },
    { text: '1 điểm tranh chấp Leader', dotClass: 'text-amber-600' },
  ],
  issueTypes: [
    { id: 'pending_approval', text: '2 chờ GM phê duyệt', dotClass: 'text-amber-600' },
    { id: 'not_submitted', text: '2 chưa đóng evidence', dotClass: 'text-rose-500' },
    { id: 'missing_evidence', text: '1 tranh chấp điểm', dotClass: 'text-amber-600' },
  ] as GmTimelineIssueType[],
  issueDetails: [
    {
      id: 'pending_approval',
      title: 'Year-End — Chờ phê duyệt GM',
      iconClass: 'bg-violet-100 text-violet-700',
      items: [
        {
          kpi: 'Innovation Index',
          pm: 'Le Van C',
          leader: 'Nguyen Van L1',
          member: 'Pham Van M',
          bottleneck: 'PM',
          reason: 'Final GM sign-off pending',
        },
      ],
    },
    {
      id: 'not_submitted',
      title: 'Year-End — Chưa đóng hồ sơ',
      iconClass: 'bg-orange-100 text-orange-600',
      items: [
        {
          kpi: 'Cost Efficiency',
          pm: 'Thai Van Liem',
          leader: 'Le Thi L2',
          member: 'Tran Van F',
          bottleneck: 'Member',
          reason: 'Year-end pack not uploaded',
        },
      ],
    },
    {
      id: 'missing_evidence',
      title: 'Year-End — Tranh chấp / thiếu minh chứng',
      iconClass: 'bg-rose-100 text-rose-600',
      items: [
        {
          kpi: 'Delivery Rate',
          pm: 'Nguyen Van A',
          leader: 'Dao Quang P',
          member: 'Le Thi D',
          bottleneck: 'Leader',
          reason: 'Leader rejected self-assessment score',
        },
      ],
    },
  ] as GmTimelineIssueBucket[],
} as const

// ── Strategic KPIs Tracking: KPI → PM (section) → (Leader) → member (GmKpiDiagnosticsTable) ─
// Mặc định: 11 KPI × 10 section (`pmOwners`) — đồng bộ `gmLayoutMockDepartments` + members.
/** Trạng thái hiển thị badge (theo mock index.html GM). */
export type GmHierarchyStatus = 'success' | 'warning' | 'danger'

/** Leader trung gian dưới PM — nhóm member (cascading 2 cấp). */
export interface GmHierarchyLeader {
  id: string
  name: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  members: GmHierarchyMember[]
}

export interface GmHierarchyMember {
  id: string
  name: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blocker: string
  rank?: string
  leader?: string
  /**
   * Chỉ tiêu số PM giao cho member (vd. 10) — drawer hiển thị số thô.
   * Trên bảng diagnostics, Actual member = (submissionActual / submissionTarget) * 100%.
   */
  submissionTarget?: number
  /** Giá trị số member nộp chờ PM (vd. 5). */
  submissionActual?: number
  /** Link tài liệu đính kèm (mock) — hiển thị trong drawer rollout. */
  evidenceAttachmentUrl?: string
}

/** PM được giao KPI — cấp dưới trong `members` (phẳng) hoặc `leaders` (PM → Leader → Member). */
export interface GmHierarchyPm {
  id: string
  /** Tên PM (owner cascading / delivery). */
  name: string
  /** Ngữ cảnh: nhóm / dự án (không thay thế vai trò PM). */
  unitLine?: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  /**
   * Member trực tiếp dưới PM (không có leader trung gian trong mock).
   * Khi có `leaders` (độ dài > 0), bảng diagnostics dùng cây leader và thường để `members` rỗng.
   */
  members: GmHierarchyMember[]
  /** PM quản lý leader, leader quản lý member — ưu tiên hiển thị khi có phần tử. */
  leaders?: GmHierarchyLeader[]
}

/** Vòng đời KPI chiến lược trên GM workspace — `inactive` = chờ GM duyệt kích hoạt (tab Approved KPI). */
export type GmKpiLifecycleStatus = 'active' | 'inactive'

export interface GmHierarchyKpi {
  id: string
  name: string
  weight: string
  target: string
  actual: string
  status: GmHierarchyStatus
  blockerSummary: string
  kpiType: GmStrategicKpiKind
  /** Khía cạnh BSC — nhóm collapse trên bảng Strategic KPIs Tracking & Diagnostics. */
  bscPerspective?: GmBscPerspective
  /** Mặc định coi như đang hoạt động; `inactive` không hiện diagnostics cho đến khi GM duyệt. */
  lifecycleStatus?: GmKpiLifecycleStatus
  /** KPI quan trọng — ưu tiên đầu danh sách diagnostics + icon sao. */
  isImportant?: boolean
  /** Giao theo PM — drill-down: cấp dưới của từng PM. */
  pmOwners: GmHierarchyPm[]
  /** Bấm Investigate — map sang workspace `departments` + tên KPI thật */
  investigateDeptId?: string
  investigateKpiName?: string
  /** ISO — khoảng hoạt động trong **một** năm dương lịch (mock; «Năm nguồn» sao chép). */
  activityStartDate?: string
  activityEndDate?: string
}

function mapDeptKpiStatusToHierarchy(status: GmDeptKpiStatus): GmHierarchyStatus {
  if (status === 'fail') return 'danger'
  if (status === 'warn') return 'warning'
  if (status === 'active') return 'warning'
  return 'success'
}

function gmLayoutMemberDetailStatusToHierarchy(s: string): GmHierarchyStatus {
  const t = String(s ?? '').toLowerCase()
  if (t.includes('overdue')) return 'danger'
  if (t.includes('pending')) return 'warning'
  return 'success'
}

/** `%` trong chuỗi actual mock (vd. `90%`, `4.2%`) — dùng rollup cấp KPI. */
function parseTrailingNumberPercent(s: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(String(s))
  return m ? Number(m[1]) : null
}

/** Rollup Actual/Status từ danh sách member (dùng cho dòng Leader). */
function rollupFromMemberList(
  members: GmHierarchyMember[],
  fallbackActual: string,
): { status: GmHierarchyStatus; actual: string } {
  if (members.length === 0) return { status: 'success', actual: fallbackActual }
  const has = (st: GmHierarchyStatus) => members.some((m) => m.status === st)
  const status: GmHierarchyStatus = has('danger') ? 'danger' : has('warning') ? 'warning' : 'success'
  const pcts = members.map((m) => parseTrailingNumberPercent(m.actual))
  if (pcts.length > 0 && pcts.every((n) => n != null)) {
    const sum = pcts.reduce((a, b) => a! + b!, 0)!
    const avg = sum / pcts.length
    return { status, actual: `${Math.round(avg * 10) / 10}%` }
  }
  return { status, actual: members[0]?.actual ?? fallbackActual }
}

function buildLeadersUnderPm(
  pmMembers: GmHierarchyMember[],
  pmRowId: string,
  k: GmDeptKpiMock,
): GmHierarchyLeader[] {
  const groups = new Map<string, GmHierarchyMember[]>()
  for (const mem of pmMembers) {
    const raw = String(mem.leader ?? '').trim()
    const key = raw.length > 0 ? raw : '__DIRECT__'
    const arr = groups.get(key) ?? []
    arr.push(mem)
    groups.set(key, arr)
  }

  const keys = [...groups.keys()].sort((a, b) => {
    if (a === '__DIRECT__') return -1
    if (b === '__DIRECT__') return 1
    return a.localeCompare(b, 'vi')
  })

  return keys.map((key, idx) => {
    const members = groups.get(key)!
    const displayName = key === '__DIRECT__' ? 'Trực tiếp PM' : key
    const rollup = rollupFromMemberList(members, k.actual)
    const slug =
      key === '__DIRECT__'
        ? 'direct'
        : stripAsciiSlug(key) || `g${idx}`
    return {
      id: `${pmRowId}-ldr-${idx}-${slug}`,
      name: displayName,
      target: k.target,
      actual: rollup.actual,
      status: rollup.status,
      /** Tooltip / Investigate — không dùng làm nhãn nhóm trên UI diagnostics. */
      blockerSummary: '',
      members,
    }
  })
}

function stripAsciiSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
}

function rollupHierarchyKpiFromPmOwners(
  pmOwners: GmHierarchyPm[],
  templateActual: string,
): { status: GmHierarchyStatus; actual: string } {
  const has = (st: GmHierarchyStatus) => pmOwners.some((p) => p.status === st)
  const status: GmHierarchyStatus = has('danger') ? 'danger' : has('warning') ? 'warning' : 'success'

  const pcts = pmOwners.map((p) => parseTrailingNumberPercent(p.actual))
  if (pcts.length > 0 && pcts.every((n) => n != null)) {
    const sum = pcts.reduce((a, b) => a! + b!, 0)!
    const avg = sum / pcts.length
    return { status, actual: `${Math.round(avg * 10) / 10}%` }
  }
  return { status, actual: pmOwners[0]?.actual ?? templateActual ?? '—' }
}

/**
 * Sinh toàn bộ dòng **Strategic KPIs Tracking & Diagnostics** từ cùng nguồn
 * `departments[].kpis` + `members[]` (deptId).
 *
 * Mô hình mock: **11 KPI toàn công ty** — mỗi KPI một dòng, **`pmOwners` = 10 section**
 * (mỗi section một PM + tối đa 10 member rollout), đồng bộ với Create Section / drawer.
 */
export function buildGmKpiHierarchyRowsFromDepartmentLayout(
  departments: GmDepartmentMock[],
  members: GmMemberDetailMock[],
): GmHierarchyKpi[] {
  if (!departments.length) return []
  const canonical = departments[0]!.kpis
  if (!canonical.length) return []

  const rows: GmHierarchyKpi[] = []

  for (let kIdx = 0; kIdx < canonical.length; kIdx++) {
    const template = canonical[kIdx]!
    const pmOwners: GmHierarchyPm[] = departments.map((dept) => {
      const k = dept.kpis[kIdx] ?? template
      const deptMembers = members.filter((m) => m.deptId === dept.id).slice(0, 10)
      const hm = mapDeptKpiStatusToHierarchy(k.status)
      const pmMembers: GmHierarchyMember[] = deptMembers.map((m, mi) => ({
        id: m.id,
        name: m.name,
        target: k.target,
        actual: /%/.test(String(k.actual))
          ? k.actual
          : m.scoreMgr !== '-' && m.scoreMgr.trim()
            ? m.scoreMgr
            : m.scoreSelf !== '-' && m.scoreSelf.trim()
              ? m.scoreSelf
              : k.actual,
        status: gmLayoutMemberDetailStatusToHierarchy(m.status),
        blocker: m.rootCause?.trim() ? m.rootCause : '—',
        rank: m.rank,
        leader: m.leader,
        submissionTarget: 10,
        submissionActual: Math.min(10, 7 + (mi % 4)),
      }))
      const codeKey = k.code ?? `k${kIdx}`
      const pmRowId = `layout-section-${dept.id}-${codeKey}`
      const useLeaderTree =
        pmMembers.length > 0 && pmMembers.some((mem) => String(mem.leader ?? '').trim().length > 0)
      const leaders = useLeaderTree ? buildLeadersUnderPm(pmMembers, pmRowId, k) : undefined
      return {
        id: pmRowId,
        name: dept.manager,
        unitLine: `PM · ${dept.name}`,
        target: k.target,
        actual: k.actual,
        status: hm,
        blockerSummary: deptMembers.length
          ? `${deptMembers.length} thành viên · rollout ${dept.name}`
          : `Chưa có thành viên mock · ${dept.name}`,
        members: useLeaderTree ? [] : pmMembers,
        leaders,
      }
    })

    const rollup = rollupHierarchyKpiFromPmOwners(pmOwners, template.actual)
    const labelPrefix = template.code ? `${template.code} · ` : ''

    rows.push({
      id: `layout-global-kpi-${template.code ?? kIdx}`,
      name: `${labelPrefix}${template.name}`,
      weight: `${template.weight}%`,
      target: template.target,
      actual: rollup.actual,
      status: rollup.status,
      blockerSummary:
        pmOwners.length > 0
          ? `${pmOwners.length} section · đồng bộ member mock`
          : 'Chưa có section',
      kpiType: template.kpiType,
      bscPerspective: template.bscPerspective ?? normalizeGmBscPerspective(undefined),
      isImportant: template.name === 'Individual Quality',
      investigateDeptId: departments[0]!.id,
      investigateKpiName: template.name,
      activityStartDate: template.activityStartDate,
      activityEndDate: template.activityEndDate,
      pmOwners,
    })
  }
  return rows
}

/** Mặc định GmKpiDiagnosticsTable / snapshot — đồng bộ `gmLayoutMockDepartments` + members. */
export const gmKpiHierarchyMockRows: GmHierarchyKpi[] = buildGmKpiHierarchyRowsFromDepartmentLayout(
  gmLayoutMockDepartments,
  gmLayoutMockMembersDetails,
)

// ── GM Workspace: chọn năm (dropdown header) ────────────────────────────────
export interface GmMidYearIssuesData {
  /** `false` = không hiển thị View Issues dù đã tới mốc. Mặc định suy từ issueTypes/issueDetails. */
  hasOpenIssues?: boolean
  pendingKpisLine: string
  popoverTitle: string
  bullets: { text: string; dotClass: string }[]
  issueTypes?: GmTimelineIssueType[]
  issueDetails?: GmTimelineIssueBucket[]
}

/** Có dữ liệu vấn đề để hiện View Issues (sau khi đã tới mốc timeline). */
export function gmTimelinePhaseHasOpenIssues(data: GmMidYearIssuesData | null | undefined): boolean {
  if (!data) return false
  if (data.hasOpenIssues === false) return false
  const types = data.issueTypes
  if (types && types.length === 0) return false
  if (types && types.length > 0) return true
  const details = data.issueDetails
  if (details?.some((b) => b.items.length > 0)) return true
  return false
}

export interface GmPortfolioDonutData {
  centerTotal: number
  centerSubtitle: string
  circles: { stroke: string; strokeDasharray: string; strokeDashoffset: string }[]
  legend: { label: string; value: number; dotClass: string; badgeClass: string }[]
  /** Badge xu hướng thẻ “Sức khỏe doanh nghiệp” (tùy năm). */
  healthTrendLabel?: string
  /** Điểm % sức khỏe theo tháng — modal biểu đồ (null = chưa có dữ liệu). */
  healthMonthlyTrend?: { label: string; value: number | null }[]
}

export interface GmWorkspaceCycleOption {
  id: string
  label: string
}

export const gmWorkspaceCycleOptions: GmWorkspaceCycleOption[] = [
  { id: '2026', label: '2026' },
  { id: '2025', label: '2025' },
  { id: '2024', label: '2024' },
  { id: '2023', label: '2023' },
]

/** Snapshot dữ liệu UI theo từng năm (mock — API thật trả về cùng shape). */
export interface GmWorkspaceCycleSnapshot {
  departments: GmDepartmentMock[]
  portfolioDonut: GmPortfolioDonutData
  midYearIssues: GmMidYearIssuesData
  /** KPI Setting (Jan–Mar): ~80% + View Issues (mock GM). */
  settingIssues?: GmMidYearIssuesData | null
  /** Year-End View Issues — chỉ truyền khi có KPI lệch; bỏ qua/undefined = không hiện nút. */
  yearEndIssues?: GmMidYearIssuesData | null
  hierarchyKpis: GmHierarchyKpi[]
  membersDetails: GmMemberDetailMock[]
  /** KPI chiến lược đang `inactive` — tab Approved KPI; duyệt xong đưa vào master `departments`. */
  inactivePendingKpis: GmHierarchyKpi[]
  /** KPI cá nhân GM — tab KPI cá nhân (mock theo năm). */
  personalKpiRows: GmPersonalKpiRowMock[]
}

/** Trạng thái hiển thị dòng KPI cá nhân GM (mock). */
export type GmPersonalKpiRowStatus = 'good' | 'warn' | 'pending'

/** Một dòng KPI cá nhân trên tab KPI cá nhân (GM) — không có mã KPI. */
export interface GmPersonalKpiRowMock {
  id: string
  bscPerspective: GmBscPerspective
  objective: string
  target: string
  weight: number
  actual: string
  /** Điểm GM tự nhập — coi là điểm cuối (không luồng duyệt PM). */
  finalScore: string
  status: GmPersonalKpiRowStatus
}

/** Mock KPI cá nhân GM — một nguồn; snapshot năm dùng `structuredClone` của danh sách này (API thật: fetch theo user + năm). */
export function buildDefaultGmPersonalKpiRows(): GmPersonalKpiRowMock[] {
  return [
    {
      id: 'gm-pk-1',
      bscPerspective: 'financial',
      objective: 'Kỷ luật chi phí trong phạm vi vai trò',
      target: '≤ 102% ngân sách được giao',
      weight: 10,
      actual: '98%',
      finalScore: '4.3',
      status: 'good',
    },
    {
      id: 'gm-pk-2',
      bscPerspective: 'customer',
      objective: 'Individual Quality',
      target: '≥ 98%',
      weight: 12,
      actual: '88%',
      finalScore: '3.8',
      status: 'warn',
    },
    {
      id: 'gm-pk-3',
      bscPerspective: 'internal',
      objective: 'Individual Efficiency',
      target: '≥ 95% tương đương WA',
      weight: 12,
      actual: '92%',
      finalScore: '4.2',
      status: 'good',
    },
    {
      id: 'gm-pk-4',
      bscPerspective: 'internal',
      objective: 'Task Delivery',
      target: '≥ 95%',
      weight: 11,
      actual: '96%',
      finalScore: '4.5',
      status: 'good',
    },
    {
      id: 'gm-pk-5',
      bscPerspective: 'learning',
      objective: 'Improvement / Kaizen',
      target: 'Hoàn thành 100%',
      weight: 9,
      actual: '90%',
      finalScore: '4.0',
      status: 'pending',
    },
    {
      id: 'gm-pk-6',
      bscPerspective: 'learning',
      objective: 'Language Capability',
      target: 'TOEIC ≥ 650',
      weight: 8,
      actual: 'Đạt 96%',
      finalScore: '4.1',
      status: 'good',
    },
  ]
}

/** Mock KPI chờ GM kích hoạt — nhóm BSC giống diagnostics. */
export function buildDefaultGmInactivePendingKpis(): GmHierarchyKpi[] {
  return [
    {
      id: 'gm-inactive-fin-margin',
      name: 'Cải thiện biên lợi nhuận vận hành (draft)',
      weight: '8%',
      target: '≥ 12%',
      actual: '—',
      status: 'warning',
      blockerSummary: 'Đề xuất từ PM Khối Tài chính · chờ GM duyệt để đưa vào KPI Setting',
      kpiType: 'cascading',
      bscPerspective: 'financial',
      lifecycleStatus: 'inactive',
      isImportant: true,
      pmOwners: [],
    },
    {
      id: 'gm-inactive-cust-nps',
      name: 'Chương trình NPS khu vực (draft)',
      weight: '6%',
      target: '≥ 42 điểm',
      actual: '—',
      status: 'warning',
      blockerSummary: 'Chưa kích hoạt — không rollout xuống PM',
      kpiType: 'individual',
      bscPerspective: 'customer',
      lifecycleStatus: 'inactive',
      pmOwners: [],
    },
    {
      id: 'gm-inactive-int-cycle',
      name: 'Rút ngắn lead time phát hành (draft)',
      weight: '10%',
      target: '−15% so với baseline',
      actual: '—',
      status: 'warning',
      blockerSummary: 'Chờ GM phê duyệt để bắt đầu theo dõi trong năm',
      kpiType: 'cascading',
      bscPerspective: 'internal',
      lifecycleStatus: 'inactive',
      pmOwners: [],
    },
    {
      id: 'gm-inactive-learn-pipeline',
      name: 'Pipeline lãnh đạo cấp trung (draft)',
      weight: '5%',
      target: 'Hoàn thành 2 lớp / năm',
      actual: '—',
      status: 'warning',
      blockerSummary: 'HR đề xuất · inactive cho đến khi GM kích hoạt',
      kpiType: 'promotion',
      bscPerspective: 'learning',
      lifecycleStatus: 'inactive',
      pmOwners: [],
    },
  ]
}

/** Chuyển dòng inactive (tab duyệt) → mục master phòng ban đầu (đồng bộ builder hierarchy). */
export function hierarchyInactiveKpiToDeptKpiMock(row: GmHierarchyKpi): GmDeptKpiMock {
  const wStr = String(row.weight ?? '')
    .replace(/%/g, '')
    .trim()
  const w = Number.parseInt(wStr, 10)
  const weight = Number.isFinite(w) && w > 0 ? w : 5
  return {
    name: String(row.name ?? '').trim() || 'Strategic KPI',
    weight,
    target: String(row.target ?? '—'),
    actual: String(row.actual ?? '—').trim() || '—',
    status: 'active',
    kpiType: row.kpiType,
    bscPerspective: row.bscPerspective ?? normalizeGmBscPerspective(undefined),
  }
}

function snap2025(): GmWorkspaceCycleSnapshot {
  return {
    departments: structuredClone(gmLayoutMockDepartments),
    portfolioDonut: structuredClone(gmLayoutMockPortfolioDonut) as unknown as GmPortfolioDonutData,
    midYearIssues: structuredClone(gmLayoutMockMidYearIssues) as unknown as GmMidYearIssuesData,
    settingIssues: structuredClone(gmLayoutMockSettingIssues) as unknown as GmMidYearIssuesData,
    yearEndIssues: structuredClone(gmLayoutMockYearEndIssues) as unknown as GmMidYearIssuesData,
    hierarchyKpis: structuredClone(gmKpiHierarchyMockRows),
    membersDetails: structuredClone(gmLayoutMockMembersDetails),
    inactivePendingKpis: structuredClone(buildDefaultGmInactivePendingKpis()),
    personalKpiRows: structuredClone(buildDefaultGmPersonalKpiRows()),
  }
}

/** Kỳ hiện tại (mock) — cùng shape dữ liệu baseline với 2025. */
function snap2026(): GmWorkspaceCycleSnapshot {
  return structuredClone(snap2025())
}

function snap2023(): GmWorkspaceCycleSnapshot {
  const s = snap2025()
  s.portfolioDonut.centerTotal = 156
  s.portfolioDonut.legend = [
    { label: 'Completed (Pass)', value: 82, dotClass: 'bg-emerald-500', badgeClass: 'text-emerald-800 bg-emerald-100' },
    { label: 'On Track (Active)', value: 22, dotClass: 'bg-blue-500', badgeClass: 'text-blue-900 bg-blue-100' },
    { label: 'At Risk (Warning)', value: 30, dotClass: 'bg-amber-400', badgeClass: 'text-amber-900 bg-amber-100' },
    { label: 'Failed', value: 22, dotClass: 'bg-red-500', badgeClass: 'text-red-900 bg-red-100' },
  ]
  s.portfolioDonut.healthTrendLabel = '+2.1% so với tháng trước'
  s.midYearIssues = {
    pendingKpisLine: 'Pending: 8 KPIs',
    popoverTitle: '8 KPI Process Issues',
    bullets: [
      { text: '3 pending approval', dotClass: 'text-amber-600' },
      { text: '2 chưa submit', dotClass: 'text-amber-600' },
      { text: '3 thiếu evidence', dotClass: 'text-rose-500' },
    ],
    issueTypes: [
      { id: 'pending_approval', text: '3 pending approval', dotClass: 'text-amber-600' },
      { id: 'not_submitted', text: '2 chưa submit', dotClass: 'text-amber-600' },
      { id: 'missing_evidence', text: '3 thiếu evidence', dotClass: 'text-rose-500' },
    ],
    issueDetails: gmLayoutMockMidYearIssues.issueDetails,
  }
  const s3 = s.departments.find((d) => d.id === 'S3')
  const qi = s3?.kpis.find((k) => k.name === 'Individual Quality')
  if (qi) {
    qi.actual = '90%'
    qi.status = 'warn'
  }
  const del = s.departments.find((d) => d.id === 'S1')?.kpis.find((k) => k.name === 'Task Delivery')
  if (del) {
    del.actual = '88%'
    del.status = 'warn'
  }
  s.hierarchyKpis = buildGmKpiHierarchyRowsFromDepartmentLayout(s.departments, s.membersDetails)
  const iqRow = s.hierarchyKpis.find((r) => r.id === 'layout-global-kpi-A.3a')
  if (iqRow) {
    iqRow.actual = '91%'
    iqRow.status = 'warning'
    iqRow.blockerSummary = '1 PM cần theo dõi (mock năm 2023)'
  }
  return s
}

function snap2024(): GmWorkspaceCycleSnapshot {
  const s = snap2025()
  s.portfolioDonut.centerTotal = 138
  s.portfolioDonut.legend = [
    { label: 'Completed (Pass)', value: 90, dotClass: 'bg-emerald-500', badgeClass: 'text-emerald-800 bg-emerald-100' },
    { label: 'On Track (Active)', value: 15, dotClass: 'bg-blue-500', badgeClass: 'text-blue-900 bg-blue-100' },
    { label: 'At Risk (Warning)', value: 18, dotClass: 'bg-amber-400', badgeClass: 'text-amber-900 bg-amber-100' },
    { label: 'Failed', value: 15, dotClass: 'bg-red-500', badgeClass: 'text-red-900 bg-red-100' },
  ]
  s.portfolioDonut.healthTrendLabel = '+5.8% so với tháng trước'
  s.midYearIssues = {
    pendingKpisLine: 'Pending: 3 KPIs',
    popoverTitle: '3 KPI Process Issues',
    bullets: [
      { text: '1 pending approval', dotClass: 'text-amber-600' },
      { text: '1 chưa submit', dotClass: 'text-amber-600' },
      { text: '1 thiếu evidence', dotClass: 'text-rose-500' },
    ],
    issueTypes: [
      { id: 'pending_approval', text: '1 pending approval', dotClass: 'text-amber-600' },
      { id: 'not_submitted', text: '1 chưa submit', dotClass: 'text-amber-600' },
      { id: 'missing_evidence', text: '1 thiếu evidence', dotClass: 'text-rose-500' },
    ],
    issueDetails: gmLayoutMockMidYearIssues.issueDetails,
  }
  const s3 = s.departments.find((d) => d.id === 'S3')
  const qi = s3?.kpis.find((k) => k.name === 'Individual Quality')
  if (qi) {
    qi.actual = '97%'
    qi.status = 'pass'
  }
  s.hierarchyKpis = buildGmKpiHierarchyRowsFromDepartmentLayout(s.departments, s.membersDetails)
  const iqRow = s.hierarchyKpis.find((r) => r.id === 'layout-global-kpi-A.3a')
  if (iqRow) {
    iqRow.actual = '97%'
    iqRow.status = 'success'
    iqRow.blockerSummary = 'Ổn định (mock năm 2024)'
  }
  return s
}

/** Định dạng mục tiêu hiển thị từ form tạo KPI (mock). */
export function formatStrategicCreateTargetDisplay(targetValue: string, unit: string): string {
  const t = String(targetValue ?? '').trim()
  if (!t) return '—'
  switch (unit) {
    case 'percent':
      return /%$/.test(t) ? t : `${t}%`
    case 'currency':
      return t.startsWith('$') ? t : `$${t}`
    case 'hours':
      return /\b(h|hr|hrs|hours)\b/i.test(t) ? t : `${t}h`
    case 'days':
      return /\bday/i.test(t) ? t : `${t} days`
    case 'text':
      return t
    case 'MM':
    case 'POINT':
    case 'PRODUCT':
    case 'PROJECT':
    case 'CERTIFICATION':
    case 'ARTICLE':
    case 'PERSON':
      return `${t} ${unit}`.trim()
    default:
      return t
  }
}

/** Chuẩn hoá loại KPI từ payload (hỗ trợ legacy `independent` / `direct`). */
export function normalizeStrategicKpiKind(raw: unknown): GmStrategicKpiKind {
  if (raw === 'cascading' || raw === 'individual' || raw === 'promotion') return raw
  if (raw === 'independent') return 'individual'
  if (raw === 'direct') return 'promotion'
  return 'cascading'
}

/** Một dòng diagnostics từ payload emit của GmCreateStrategicKpiModal (mock). */
export function buildHierarchyKpiFromStrategicCreatePayload(
  payload: Record<string, unknown>,
): GmHierarchyKpi {
  const kpiType = normalizeStrategicKpiKind(payload.kpiType)

  const nameRaw = String(payload.kpiName ?? '').trim()
  const name = nameRaw || 'Strategic KPI'

  const w = String(payload.weightPct ?? '').trim()
  const weight = w.length ? `${w.replace(/%/g, '')}%` : '—'

  const unit = String(payload.unit ?? 'MM')
  const target = formatStrategicCreateTargetDisplay(String(payload.targetValue ?? ''), unit)

  const pmTargets = (payload.pmTargets as Record<string, string> | undefined) ?? {}
  const assignPMs = Array.isArray(payload.assignPMs) ? (payload.assignPMs as string[]) : []

  const editingRowId = String(payload.editingKpiId ?? '').trim()
  const preserveCreatedId = editingRowId.startsWith('kpi-created-') ? editingRowId : ''
  const pmOwnerKey =
    preserveCreatedId.length > 0
      ? preserveCreatedId.replace(/^kpi-created-/, '') || 'id'
      : typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now())
  const rowId = preserveCreatedId.length > 0 ? preserveCreatedId : `kpi-created-${pmOwnerKey}`

  const pmOwners: GmHierarchyPm[] =
    kpiType === 'cascading'
      ? assignPMs.map((pmName, i) => ({
          id: `new-pm-${pmOwnerKey}-${i}`,
          name: pmName,
          unitLine: 'PM · (mock — vừa gán)',
          target: formatStrategicCreateTargetDisplay(
            String(pmTargets[pmName] ?? payload.targetValue ?? ''),
            unit,
          ),
          actual: '—',
          status: 'warning' as GmHierarchyStatus,
          blockerSummary: 'Chờ cập nhật tiến độ',
          members: [],
        }))
      : []

  return {
    id: rowId,
    name,
    weight,
    target,
    actual: '—',
    status: 'warning',
    blockerSummary: 'KPI mới tạo (mock) — chưa có dữ liệu thực tế',
    kpiType,
    bscPerspective: normalizeGmBscPerspective(payload.perspective),
    isImportant: payload.isImportant === true,
    pmOwners,
  }
}

/**
 * Ghép KPI từng phòng ban vào danh sách hierarchy diagnostics.
 * Bỏ qua cặp (deptId, tên KPI) đã có trên dòng hierarchy (investigate*) để tránh trùng mock.
 *
 * Các dòng pivot `layout-global-kpi-*` (11 KPI × mọi section trong `pmOwners`) được coi là
 * đã bao phủ mọi `(dept.id, investigateKpiName)` cho **cùng tên KPI** — không tạo thêm 110 dòng.
 */
export function appendDeptKpisAsHierarchyRows(
  existing: GmHierarchyKpi[],
  departments: GmDepartmentMock[],
): GmHierarchyKpi[] {
  const covered = new Set<string>()
  for (const r of existing) {
    if (r.investigateDeptId && r.investigateKpiName) {
      covered.add(`${r.investigateDeptId}::${String(r.investigateKpiName).trim()}`)
    }
  }
  for (const r of existing) {
    if (!String(r.id).startsWith('layout-global-kpi-')) continue
    const kn = r.investigateKpiName?.trim()
    if (!kn) continue
    for (const d of departments) {
      covered.add(`${d.id}::${kn}`)
    }
  }
  const out = [...existing]
  let seq = 0
  for (const dept of departments) {
    for (const k of dept.kpis) {
      const key = `${dept.id}::${k.name.trim()}`
      if (covered.has(key)) continue
      covered.add(key)
      out.push({
        id: `dept-${dept.id}-kpi-${seq++}`,
        name: `${k.name} · ${dept.name}`,
        weight: `${k.weight}%`,
        target: k.target,
        actual: k.actual,
        status: mapDeptKpiStatusToHierarchy(k.status),
        blockerSummary: 'Theo dữ liệu phòng ban (mock)',
        kpiType: k.kpiType,
        bscPerspective: k.bscPerspective ?? normalizeGmBscPerspective(undefined),
        pmOwners: [],
        investigateDeptId: dept.id,
        investigateKpiName: k.name,
      })
    }
  }
  return out
}

/** KPI phòng ban (danh sách master) từ cùng payload — gắn vào dept đầu khi demo. */
export function buildDeptKpiFromStrategicCreatePayload(payload: Record<string, unknown>): GmDeptKpiMock {
  const kpiType = normalizeStrategicKpiKind(payload.kpiType)
  const name = String(payload.kpiName ?? '').trim() || 'Strategic KPI'
  const w = Number.parseInt(String(payload.weightPct ?? '').replace(/%/g, ''), 10)
  const weight = Number.isFinite(w) && w > 0 ? w : 5
  return {
    name,
    weight,
    target: formatStrategicCreateTargetDisplay(String(payload.targetValue ?? ''), String(payload.unit ?? 'MM')),
    actual: '—',
    status: 'active',
    kpiType,
    bscPerspective: normalizeGmBscPerspective(payload.perspective),
  }
}

/** ISO `yyyy-mm-dd…` → năm dương lịch; không hợp lệ → `null`. */
function calendarYearFromIsoBoundary(iso: string | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null
  const m = /^(\d{4})/.exec(String(iso).trim())
  if (!m) return null
  const y = Number(m[1])
  return Number.isFinite(y) ? y : null
}

/**
 * Gom các năm có KPI kèm `activityStartDate` / `activityEndDate` (mock).
 * Dữ liệu mẫu giả định khoảng hoạt động **nằm trong một năm dương lịch** (vd. 1/1–31/12 cùng năm).
 * Thứ tự: năm mới → cũ.
 */
export function collectYearsFromKpiActivityInSnapshots(
  snapshots: Record<string, GmWorkspaceCycleSnapshot>,
): string[] {
  const years = new Set<number>()
  const addSpan = (start?: string, end?: string) => {
    const ys = calendarYearFromIsoBoundary(start)
    const ye = calendarYearFromIsoBoundary(end)
    if (ys != null && ye != null) {
      const a = Math.min(ys, ye)
      const b = Math.max(ys, ye)
      for (let y = a; y <= b; y++) years.add(y)
    } else if (ys != null) years.add(ys)
    else if (ye != null) years.add(ye)
  }
  for (const snap of Object.values(snapshots)) {
    for (const k of snap.hierarchyKpis) addSpan(k.activityStartDate, k.activityEndDate)
    for (const dept of snap.departments) {
      for (const k of dept.kpis) addSpan(k.activityStartDate, k.activityEndDate)
    }
  }
  return [...years].sort((a, b) => b - a).map(String)
}

export const gmLayoutCycleSnapshots: Record<string, GmWorkspaceCycleSnapshot> = {
  '2026': snap2026(),
  '2025': snap2025(),
  '2024': snap2024(),
  '2023': snap2023(),
}
