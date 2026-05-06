/**
 * GM-only mock for /gm/employee-evaluation.
 * Does not import or mutate PM manager mock data.
 * Teams contain only members the GM scores (direct PM line — no “via another member” rows in this dataset).
 */

import type { GmDepartmentMock } from '@/types/gm-workspace'

/** Section tối thiểu cho mock hub `/gm/employee-evaluation` (không phụ thuộc DB giả). */
const GM_EVAL_SECTION_DEPARTMENTS: GmDepartmentMock[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1
  const managers = [
    'Thai Van Liem',
    'Nguyen Van A',
    'Tran Thi B',
    'Le Van C',
    'Pham Ba Quoc Tai',
    'Dinh Thi E',
    'Vu Hoang F',
    'Hoang Van G',
    'Bui Thi H',
    'Le Van K',
  ] as const
  return {
    id: `S${n}`,
    name: `Section ${n}`,
    manager: managers[i] ?? `Manager ${n}`,
    health: 0,
    progress: 0,
    risks: { critical: 0, medium: 0 },
    responsibility: '-',
    breakdown: '—',
    impact: null,
    kpis: [],
  }
})

export type GmEmployeeSheetStatus = 'pending_pm' | 'self_scoring' | 'approved'

/** Mô tả mock đồng bộ `sys_status_codes` (ASM) trong `init-db.sql` — dùng cho cột tiến độ khi không có API. */
export function gmMockAsmStatusDescription(status: GmEmployeeSheetStatus): string {
  if (status === 'pending_pm') return 'Chờ PM chấm điểm Final'
  if (status === 'self_scoring') return 'Member đã nộp bằng chứng 1st Half, chờ PM duyệt'
  return 'Đã chốt sổ hoàn toàn (Kết thúc vòng đời)'
}

export interface GmEvidenceTable {
  title: string
  icon: string
  accent: 'indigo' | 'emerald'
  headers: string[]
  rows: string[][]
  footer?: string[]
  /** Đường dẫn tài liệu đính kèm — GM mở trong tab mới. */
  attachmentUrl?: string
  /** Nhãn cho `attachmentUrl` (mặc định UI: «Xem bằng chứng đính kèm»). */
  attachmentLabel?: string
}

export interface GmKpiItem {
  id: string
  index: number
  title: string
  target: string
  weight: number
  evidenceButtonLabel: string
  evidenceButtonIcon: string
  evidenceTone: 'blue' | 'emerald'
  selfScore: number
  evidence: GmEvidenceTable
  /** ASM assignment từ hub API: 502 = review GM (không chấm), 602 = chấm điểm GM + comment. */
  hubAssignmentStatusCode?: number | null
}

export interface GmKpiGroup {
  groupTitle: string
  items: GmKpiItem[]
}

export interface GmEvalMember {
  id: string
  code: string
  name: string
  role: string
  initials: string
  initialsClass: string
  rank: string
  status: GmEmployeeSheetStatus
  /** `sys_status_codes.name` (ASM) — cột Tiến độ; mock dùng {@link gmMockAsmStatusDescription}. */
  assignmentStatusDisplay?: string | null
  /** Cột Thao tác (chấm/duyệt GM): bật khi có assignment ASM 502 hoặc 602. */
  gmApprovalActionEnabled?: boolean
  /** `users.id` (assignee) — API hub; mock: `GM_MOCK_HUB_EVAL_USER_UUID`. */
  evaluationUserId?: string
  selfScoreDisplay: string | null
  canScore: boolean
  projectIds: string[]
  employeeComment?: string
  groups: GmKpiGroup[]
}

export interface GmEvalPmBroker {
  id: string
  name: string
  unit: string
}

/** Nhánh Leader → các member (mock hub đánh giá GM). */
export interface GmEvalLeaderBranch {
  leaderKey: string
  /** Bảng KPI của leader — GM mở drawer chấm giống PM/member. */
  sheet: GmEvalMember
  members: GmEvalMember[]
}

/** Một PM + cấu trúc PM → Leader → Member. */
export interface GmEvalPmBranch {
  pm: GmEvalMember
  leaders: GmEvalLeaderBranch[]
  directMembers: GmEvalMember[]
  /** Id section — khớp {@link GM_EVAL_SECTION_DEPARTMENTS}. */
  sectionId?: string
  sectionName?: string
}

export const GM_EVAL_PM_BROKERS: GmEvalPmBroker[] = [
  { id: 'pm-liem', name: 'Thái Văn Liêm', unit: 'Software Dev 1' },
  { id: 'pm-nguyen-a', name: 'Nguyễn Văn A', unit: 'Software Dev 2' },
  { id: 'pm-tran-b', name: 'Trần Thị B', unit: 'Quality Assurance' },
  { id: 'pm-le-c', name: 'Lê Văn C', unit: 'PMO' },
]

/** UUID cố định (mock) — gửi kèm POST evaluation-hub/confirm (`evaluationUserId`). */
const GM_MOCK_HUB_EVAL_USER_UUID: Record<string, string> = {
  'gm-834': '10000000-0000-4000-a000-000000000834',
  'gm-801': '10000000-0000-4000-a000-000000000801',
  'gm-805': '10000000-0000-4000-a000-000000000805',
  'gm-820': '10000000-0000-4000-a000-000000000820',
  'pm-liem': '20000000-0000-4000-a000-000000000001',
  'pm-nguyen-a': '20000000-0000-4000-a000-000000000002',
  'pm-tran-b': '20000000-0000-4000-a000-000000000003',
  'pm-le-c': '20000000-0000-4000-a000-000000000004',
  'pm-liem-ld1': '30000000-0000-4000-a000-000000000101',
  'pm-liem-ld2': '30000000-0000-4000-a000-000000000102',
  'pm-na-ld1': '30000000-0000-4000-a000-000000000201',
  'pm-lc-ld1': '30000000-0000-4000-a000-000000000301',
}

/** BSC — Financial (GM mock). */
const gmBscFinancial: GmKpiGroup = {
  groupTitle: '(Financial) Khía cạnh Tài chính (GM mock)',
  items: [
    {
      id: 'g-f1',
      index: 1,
      title: 'F.1 Productivity & cost awareness',
      target: 'Target: deliver value within budget / productivity baseline',
      weight: 100,
      evidenceButtonLabel: 'Summary',
      evidenceButtonIcon: 'fas fa-coins',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Cost / productivity',
        icon: 'fas fa-coins',
        accent: 'indigo',
        headers: ['Metric', 'Value'],
        rows: [
          ['Burn vs plan', 'On track'],
          ['Throughput', '+8% YoY'],
        ],
        attachmentUrl: 'https://docs.google.com/spreadsheets/d/mock-financial-kpi',
        attachmentLabel: 'Bảng theo dõi hiệu quả (mock)',
      },
    },
  ],
}

/** BSC — Customer (GM mock). */
const gmBscCustomer: GmKpiGroup = {
  groupTitle: '(Customer) Khía cạnh Khách hàng (GM mock)',
  items: [
    {
      id: 'g-cu1',
      index: 2,
      title: 'C.1 Stakeholder alignment & satisfaction',
      target: 'Target: stakeholder alignment',
      weight: 100,
      evidenceButtonLabel: 'Feedback',
      evidenceButtonIcon: 'fas fa-comments',
      evidenceTone: 'blue',
      selfScore: 5,
      evidence: {
        title: 'Feedback',
        icon: 'fas fa-comments',
        accent: 'indigo',
        headers: ['Source', 'Score'],
        rows: [['PM', '5']],
        attachmentUrl: 'https://forms.example/360-feedback/mock-member',
        attachmentLabel: 'Phiếu phản hồi 360°',
      },
    },
  ],
}

/** BSC — Internal process (GM mock). */
const gmBscInternalProcess: GmKpiGroup = {
  groupTitle: '(Internal process) Quy trình nội bộ (GM mock)',
  items: [
    {
      id: 'g-ip1',
      index: 3,
      title: 'IP.1 Delivery & outcomes',
      target: 'Target: on track',
      weight: 53,
      evidenceButtonLabel: 'Summary',
      evidenceButtonIcon: 'fas fa-table',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Delivery summary',
        icon: 'fas fa-chart-bar',
        accent: 'indigo',
        headers: ['Sprint', 'Done', 'Notes'],
        rows: [
          ['S1', '100%', 'Met scope'],
          ['S2', '95%', 'Minor slip'],
        ],
        attachmentUrl: 'https://drive.google.com/file/d/mock-gm-delivery-summary/view',
        attachmentLabel: 'Báo cáo sprint (Drive)',
      },
    },
    {
      id: 'g-ip2',
      index: 4,
      title: 'IP.2 Quality & rework',
      target: 'Target: low rework',
      weight: 47,
      evidenceButtonLabel: 'Defects',
      evidenceButtonIcon: 'fas fa-bug',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Quality',
        icon: 'fas fa-bug',
        accent: 'indigo',
        headers: ['Metric', 'Value'],
        rows: [['Rework', '3%']],
        attachmentUrl: 'https://docs.google.com/spreadsheets/d/mock-quality-metrics',
        attachmentLabel: 'Bảng metric chất lượng',
      },
    },
  ],
}

/** BSC — Learning & growth (GM mock). */
const gmBscLearningGrowth: GmKpiGroup = {
  groupTitle: '(Learning & growth) Học hỏi & phát triển (GM mock)',
  items: [
    {
      id: 'g-lg1',
      index: 5,
      title: 'LG.1 Learning & capability',
      target: 'Target: 1 certification / quarter',
      weight: 50,
      evidenceButtonLabel: 'Certs',
      evidenceButtonIcon: 'fas fa-award',
      evidenceTone: 'emerald',
      selfScore: 3,
      evidence: {
        title: 'Learning',
        icon: 'fas fa-award',
        accent: 'emerald',
        headers: ['Course', 'Status'],
        rows: [['AWS basics', 'In progress']],
        attachmentUrl: 'https://learn.example/courses/aws-basics/certificate',
        attachmentLabel: 'Tiến độ khóa học',
      },
    },
    {
      id: 'g-lg2',
      index: 6,
      title: 'LG.2 Knowledge sharing',
      target: 'Target: 2 tech talks',
      weight: 50,
      evidenceButtonLabel: 'Links',
      evidenceButtonIcon: 'fas fa-share-alt',
      evidenceTone: 'emerald',
      selfScore: 4,
      evidence: {
        title: 'Sharing',
        icon: 'fas fa-share-alt',
        accent: 'emerald',
        headers: ['Topic', 'Link'],
        rows: [['Vue perf', 'https://wiki.example/vue']],
        attachmentUrl: 'https://wiki.example/vue',
        attachmentLabel: 'Ghi chú & slide tech talk',
      },
    },
  ],
}

/** Tab Promotion — giữ từ khóa «Promotion» trong tiêu đề để `isGmEvalPromotionKpiGroup`. */
const gmGroupPromotion: GmKpiGroup = {
  groupTitle: '(Promotion) Thăng tiến & năng lực (GM mock)',
  items: [
    {
      id: 'g-p1',
      index: 7,
      title: 'P.1 Readiness for next level',
      target: 'Target: role scope & impact at next band',
      weight: 60,
      evidenceButtonLabel: 'Scope',
      evidenceButtonIcon: 'fas fa-layer-group',
      evidenceTone: 'blue',
      selfScore: 4,
      evidence: {
        title: 'Promotion readiness',
        icon: 'fas fa-stairs',
        accent: 'indigo',
        headers: ['Signal', 'Note'],
        rows: [
          ['Scope', 'Led cross-team initiative'],
          ['Impact', 'Measurable cost reduction'],
        ],
        attachmentUrl: 'https://wiki.example/promotion-readiness-mock',
        attachmentLabel: 'Tóm tắt readiness (wiki)',
      },
    },
    {
      id: 'g-p2',
      index: 8,
      title: 'P.2 Leadership & values',
      target: 'Target: role model aligned to company values',
      weight: 40,
      evidenceButtonLabel: 'Feedback',
      evidenceButtonIcon: 'fas fa-people-arrows',
      evidenceTone: 'emerald',
      selfScore: 4,
      evidence: {
        title: '360 / values',
        icon: 'fas fa-people-arrows',
        accent: 'emerald',
        headers: ['Area', 'Score'],
        rows: [['Values', '4.5'], ['Leadership', '4']],
        attachmentUrl: 'https://forms.example/promotion-360-mock',
        attachmentLabel: 'Phiếu 360 Promotion',
      },
    },
  ],
}

/** Thứ tự nhóm KPI Individual / Cascading trong drawer (BSC, không gồm Promotion). */
const GM_EVAL_BSC_CASCADE_GROUPS: GmKpiGroup[] = [
  gmBscFinancial,
  gmBscCustomer,
  gmBscInternalProcess,
  gmBscLearningGrowth,
]

/** Đủ BSC + Promotion — PM hub / leader sheet / member đầy đủ. */
const GM_EVAL_FULL_MEMBER_GROUPS: GmKpiGroup[] = [...GM_EVAL_BSC_CASCADE_GROUPS, gmGroupPromotion]

/** Drawer: tab Promotion — nhận diện theo tiêu đề nhóm. */
export function isGmEvalPromotionKpiGroup(group: GmKpiGroup): boolean {
  return /\bpromotion\b/i.test(group.groupTitle)
}

function emptyGmGroups(): GmKpiGroup[] {
  return []
}

/** Mock: mặc định ASM 602 (chấm điểm GM) nếu chưa có `hubAssignmentStatusCode` trên từng KPI. */
function withHubAsmDefaultOnItems(groups: GmKpiGroup[]): GmKpiGroup[] {
  return groups.map((g) => ({
    ...g,
    items: g.items.map((it) => ({
      ...it,
      hubAssignmentStatusCode: it.hubAssignmentStatusCode ?? 602,
    })),
  }))
}

const teamLiem: GmEvalMember[] = [
  {
    id: 'gm-834',
    code: '834',
    name: 'Nguyen Quang Huy',
    role: 'Dev - Production',
    initials: 'QH',
    initialsClass: 'bg-indigo-100 text-indigo-700',
    rank: 'R1',
    status: 'pending_pm',
    assignmentStatusDisplay: gmMockAsmStatusDescription('pending_pm'),
    gmApprovalActionEnabled: true,
    evaluationUserId: GM_MOCK_HUB_EVAL_USER_UUID['gm-834'],
    selfScoreDisplay: '4.00',
    canScore: true,
    projectIds: ['alpha'],
    employeeComment: 'Direct PM line (GM mock).',
    groups: withHubAsmDefaultOnItems(structuredClone(GM_EVAL_FULL_MEMBER_GROUPS)),
  },
  {
    id: 'gm-801',
    code: '801',
    name: 'Lê Thị Mai',
    role: 'BA - Production',
    initials: 'LM',
    initialsClass: 'bg-rose-100 text-rose-700',
    rank: 'R2',
    status: 'pending_pm',
    assignmentStatusDisplay: gmMockAsmStatusDescription('pending_pm'),
    gmApprovalActionEnabled: true,
    selfScoreDisplay: '4.00',
    canScore: true,
    projectIds: ['alpha'],
    groups: withHubAsmDefaultOnItems(structuredClone(GM_EVAL_FULL_MEMBER_GROUPS)),
  },
  {
    id: 'gm-805',
    code: '805',
    name: 'Phạm Đức Anh',
    role: 'Dev - Maintenance',
    initials: 'PA',
    initialsClass: 'bg-sky-100 text-sky-700',
    rank: 'R2',
    status: 'approved',
    assignmentStatusDisplay: gmMockAsmStatusDescription('approved'),
    gmApprovalActionEnabled: false,
    evaluationUserId: GM_MOCK_HUB_EVAL_USER_UUID['gm-805'],
    selfScoreDisplay: '4.00',
    canScore: true,
    projectIds: ['beta'],
    groups: withHubAsmDefaultOnItems(structuredClone([gmBscInternalProcess, gmGroupPromotion])),
  },
  {
    id: 'gm-820',
    code: '820',
    name: 'Hoàng Minh Tuấn',
    role: 'Dev - Production',
    initials: 'HT',
    initialsClass: 'bg-violet-100 text-violet-700',
    rank: 'R1',
    status: 'self_scoring',
    assignmentStatusDisplay: gmMockAsmStatusDescription('self_scoring'),
    gmApprovalActionEnabled: false,
    evaluationUserId: GM_MOCK_HUB_EVAL_USER_UUID['gm-820'],
    selfScoreDisplay: null,
    canScore: false,
    projectIds: ['alpha'],
    groups: emptyGmGroups(),
  },
]

const teamNguyenA: GmEvalMember[] = teamLiem.slice(0, 3)
const teamTranB: GmEvalMember[] = teamLiem.slice(0, 2)
const teamLeC: GmEvalMember[] = [teamLiem[0]!, teamLiem[2]!]

const GM_EVAL_TEAM_BY_PM: Record<string, GmEvalMember[]> = {
  'pm-liem': teamLiem,
  'pm-nguyen-a': teamNguyenA.map((e, i) => ({
    ...e,
    id: `${e.id}-na-${i}`,
    code: `${e.code}-NA`,
  })),
  'pm-tran-b': teamTranB.map((e, i) => ({
    ...e,
    id: `${e.id}-tb-${i}`,
    code: `${e.code}-TB`,
  })),
  'pm-le-c': teamLeC.map((e, i) => ({
    ...e,
    id: `${e.id}-lc-${i}`,
    code: `${e.code}-LC`,
  })),
}

export function flattenGmKpiItems(emp: GmEvalMember): GmKpiItem[] {
  return emp.groups.flatMap((g) => g.items)
}

export function getGmEvalBroker(id: string): GmEvalPmBroker | undefined {
  return GM_EVAL_PM_BROKERS.find((b) => b.id === id)
}

export function getGmEvalTeam(pmId: string): GmEvalMember[] {
  return structuredClone(GM_EVAL_TEAM_BY_PM[pmId] ?? [])
}

export function gmEvalPmRowStats(pmId: string) {
  const branches = getGmEvalPmHubTree().filter((b) => b.pm.projectIds.includes(pmId))
  if (!branches.length) {
    const members = getGmEvalTeam(pmId)
    return {
      memberCount: members.length,
      pendingPmCount: members.filter((e) => e.status === 'pending_pm').length,
    }
  }
  let memberCount = 0
  let pendingPmCount = 0
  for (const br of branches) {
    const members = [...br.leaders.flatMap((l) => [l.sheet, ...l.members]), ...br.directMembers]
    memberCount += members.length
    pendingPmCount += members.filter((e) => e.status === 'pending_pm').length
  }
  return { memberCount, pendingPmCount }
}

/** Clone KPI template — `slug` gắn vào `item.id` để điểm GM không trùng giữa các section. */
function cloneKpiGroupsWithPmSlug(slug: string): GmKpiGroup[] {
  const safe = slug.replace(/[^a-zA-Z0-9-]/g, '')
  const templates: GmKpiGroup[] = GM_EVAL_FULL_MEMBER_GROUPS
  return withHubAsmDefaultOnItems(structuredClone(templates)).map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, id: `${it.id}__${safe}` })),
  }))
}

function remapEvalMemberForSection(m: GmEvalMember, deptId: string): GmEvalMember {
  const inner = m.id.replace(/[^a-zA-Z0-9-]/g, '')
  const slug = `${deptId}-${inner}`.replace(/[^a-zA-Z0-9-]/g, '')
  return {
    ...m,
    id: `${deptId}__${m.id}`,
    groups: withHubAsmDefaultOnItems(structuredClone(m.groups)).map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it, id: `${it.id}__${slug}` })),
    })),
  }
}

function resolveGmEvalBrokerIdForManager(managerName: string, deptIndex: number): string {
  const raw = managerName.trim().toLowerCase()
  const n = raw.normalize('NFD').replace(/\p{M}/gu, '')
  if (/thai.*liem|thai\s+van\s+liem/.test(n)) return 'pm-liem'
  if (/nguyen.*van.*a/.test(n)) return 'pm-nguyen-a'
  if (/tran.*thi.*b/.test(n)) return 'pm-tran-b'
  if (/le.*van.*c/.test(n)) return 'pm-le-c'
  const order = GM_EVAL_PM_BROKERS.map((b) => b.id)
  return order[deptIndex % order.length]!
}

function buildGmEvalPmHubMemberForBrokerScoped(b: GmEvalPmBroker, dept: GmDepartmentMock): GmEvalMember {
  const meta = GM_PM_HUB_ROW_META[b.id] ?? {
    status: 'pending_pm' as const,
    canScore: true,
    fullKpis: true,
    initialsClass: 'bg-indigo-100 text-indigo-700',
    rank: 'PM',
    gmApprovalActionEnabled: false,
  }
  const slug = `${dept.id}-${b.id}`.replace(/[^a-zA-Z0-9-]/g, '')
  const groups = meta.fullKpis ? cloneKpiGroupsWithPmSlug(slug) : emptyGmGroups()
  return {
    id: `gm-pmhub-${dept.id}`,
    code: dept.id,
    name: dept.manager,
    role: `Project manager · ${dept.name}`,
    initials: initialsFromPmName(dept.manager),
    initialsClass: meta.initialsClass,
    rank: meta.rank,
    status: meta.status,
    assignmentStatusDisplay: gmMockAsmStatusDescription(meta.status),
    gmApprovalActionEnabled: meta.gmApprovalActionEnabled,
    evaluationUserId: GM_MOCK_HUB_EVAL_USER_UUID[b.id],
    selfScoreDisplay: avgSelfScoreFromGroups(groups),
    canScore: meta.canScore,
    projectIds: [b.id],
    employeeComment: undefined,
    groups,
  }
}

function initialsFromPmName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]!.charAt(0)
    const b = parts[parts.length - 1]!.charAt(0)
    return (a + b).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function avgSelfScoreFromGroups(groups: GmKpiGroup[]): string | null {
  const items = groups.flatMap((g) => g.items)
  if (!items.length) return null
  const sum = items.reduce((s, i) => s + i.selfScore, 0)
  return (sum / items.length).toFixed(2)
}

/** Cấu hình slice team theo `getGmEvalTeam(pmId)` (index bán khai [start, end)). */
type GmEvalPmTreeLeaderDef = {
  key: string
  name: string
  code: string
  role: string
  initialsClass: string
  slice: readonly [number, number]
}

type GmEvalPmTreeLayout = {
  leaderDefs: readonly GmEvalPmTreeLeaderDef[]
  directSlice: readonly [number, number] | null
}

const GM_EVAL_PM_TREE_LAYOUT: Record<string, GmEvalPmTreeLayout> = {
  'pm-liem': {
    leaderDefs: [
      {
        key: 'pm-liem-ld1',
        name: 'Đỗ Văn Hùng',
        code: 'LD-HUONG',
        role: 'Tech Lead · Software Dev 1',
        initialsClass: 'bg-amber-100 text-amber-800',
        slice: [0, 2],
      },
      {
        key: 'pm-liem-ld2',
        name: 'Trần Thị Lan',
        code: 'LD-LAN',
        role: 'Team Lead · Software Dev 1',
        initialsClass: 'bg-amber-100 text-amber-700',
        slice: [2, 3],
      },
    ],
    directSlice: [3, 4],
  },
  'pm-nguyen-a': {
    leaderDefs: [
      {
        key: 'pm-na-ld1',
        name: 'Phạm Minh Tuấn',
        code: 'LD-TUAN',
        role: 'Engineering Lead · Software Dev 2',
        initialsClass: 'bg-amber-100 text-amber-800',
        slice: [0, 2],
      },
    ],
    directSlice: [2, 3],
  },
  'pm-tran-b': {
    leaderDefs: [],
    directSlice: [0, 2],
  },
  'pm-le-c': {
    leaderDefs: [
      {
        key: 'pm-lc-ld1',
        name: 'Võ Thị Hạnh',
        code: 'LD-HANH',
        role: 'Delivery Lead · PMO',
        initialsClass: 'bg-amber-100 text-amber-800',
        slice: [0, 1],
      },
    ],
    directSlice: [1, 2],
  },
}

const GM_LEADER_EVAL_META: Record<
  string,
  {
    status: GmEmployeeSheetStatus
    canScore: boolean
    fullKpis: boolean
    rank: string
    gmApprovalActionEnabled: boolean
  }
> = {
  'pm-liem-ld1': {
    status: 'pending_pm',
    canScore: true,
    fullKpis: true,
    rank: 'TL',
    gmApprovalActionEnabled: true,
  },
  'pm-liem-ld2': {
    status: 'approved',
    canScore: true,
    fullKpis: true,
    rank: 'TL',
    gmApprovalActionEnabled: false,
  },
  'pm-na-ld1': {
    status: 'pending_pm',
    canScore: true,
    fullKpis: true,
    rank: 'EL',
    gmApprovalActionEnabled: true,
  },
  'pm-lc-ld1': {
    status: 'pending_pm',
    canScore: true,
    fullKpis: true,
    rank: 'DL',
    gmApprovalActionEnabled: true,
  },
}

const GM_PM_HUB_ROW_META: Record<
  string,
  {
    status: GmEmployeeSheetStatus
    canScore: boolean
    fullKpis: boolean
    initialsClass: string
    rank: string
    gmApprovalActionEnabled: boolean
  }
> = {
  'pm-liem': {
    status: 'pending_pm',
    canScore: true,
    fullKpis: true,
    initialsClass: 'bg-indigo-100 text-indigo-700',
    rank: 'PM',
    gmApprovalActionEnabled: true,
  },
  'pm-nguyen-a': {
    status: 'pending_pm',
    canScore: true,
    fullKpis: true,
    initialsClass: 'bg-rose-100 text-rose-700',
    rank: 'PM',
    gmApprovalActionEnabled: true,
  },
  'pm-tran-b': {
    status: 'approved',
    canScore: true,
    fullKpis: true,
    initialsClass: 'bg-sky-100 text-sky-700',
    rank: 'PM',
    gmApprovalActionEnabled: false,
  },
  'pm-le-c': {
    status: 'self_scoring',
    canScore: false,
    fullKpis: false,
    initialsClass: 'bg-violet-100 text-violet-700',
    rank: 'PM',
    gmApprovalActionEnabled: false,
  },
}

function withPmProjectId(emp: GmEvalMember, pmBrokerId: string): GmEvalMember {
  if (emp.projectIds.includes(pmBrokerId)) return emp
  return { ...emp, projectIds: [...emp.projectIds, pmBrokerId] }
}

function cloneKpiGroupsForLeaderSlug(leaderSlug: string): GmKpiGroup[] {
  const safe = leaderSlug.replace(/[^a-zA-Z0-9-]/g, '')
  const templates: GmKpiGroup[] = GM_EVAL_FULL_MEMBER_GROUPS
  return withHubAsmDefaultOnItems(structuredClone(templates)).map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, id: `${it.id}__ld-${safe}` })),
  }))
}

function buildLeaderBranchFromDef(
  def: GmEvalPmTreeLeaderDef,
  team: GmEvalMember[],
  pmBrokerId: string,
  scopeDeptId?: string,
): GmEvalLeaderBranch {
  const [a, b] = def.slice
  const members = team.slice(a, b).map((m) => withPmProjectId(m, pmBrokerId))
  const meta = GM_LEADER_EVAL_META[def.key] ?? {
    status: 'pending_pm' as const,
    canScore: true,
    fullKpis: true,
    rank: 'TL',
    gmApprovalActionEnabled: false,
  }
  const leaderSlug = scopeDeptId ? `${scopeDeptId}-${def.key}` : def.key
  const groups = meta.fullKpis ? cloneKpiGroupsForLeaderSlug(leaderSlug) : emptyGmGroups()
  const sheet: GmEvalMember = {
    id: scopeDeptId ? `gm-pmhub-leader-${scopeDeptId}-${def.key}` : `gm-pmhub-leader-${def.key}`,
    code: def.code,
    name: def.name,
    role: def.role,
    initials: initialsFromPmName(def.name),
    initialsClass: def.initialsClass,
    rank: meta.rank,
    status: meta.status,
    assignmentStatusDisplay: gmMockAsmStatusDescription(meta.status),
    gmApprovalActionEnabled: meta.gmApprovalActionEnabled,
    evaluationUserId: GM_MOCK_HUB_EVAL_USER_UUID[def.key],
    selfScoreDisplay: avgSelfScoreFromGroups(groups),
    canScore: meta.canScore,
    projectIds: [pmBrokerId],
    employeeComment: undefined,
    groups,
  }
  return {
    leaderKey: scopeDeptId ? `${scopeDeptId}::${def.key}` : def.key,
    sheet,
    members,
  }
}

/**
 * Cây Section → PM → Leader → Member (mock).
 * Mỗi phần tử = một section trong {@link GM_EVAL_SECTION_DEPARTMENTS}.
 */
export function getGmEvalPmHubTree(): GmEvalPmBranch[] {
  return GM_EVAL_SECTION_DEPARTMENTS.map((dept, idx) => {
    const brokerId = resolveGmEvalBrokerIdForManager(dept.manager, idx)
    const broker = GM_EVAL_PM_BROKERS.find((x) => x.id === brokerId)!
    const pm = buildGmEvalPmHubMemberForBrokerScoped(broker, dept)
    const teamBase = getGmEvalTeam(brokerId)
    const team = teamBase.map((m) => remapEvalMemberForSection(m, dept.id))
    const layout = GM_EVAL_PM_TREE_LAYOUT[brokerId]
    if (!layout) {
      return {
        pm,
        leaders: [],
        directMembers: team.map((m) => withPmProjectId(m, brokerId)),
        sectionId: dept.id,
        sectionName: dept.name,
      }
    }
    const leaders = layout.leaderDefs.map((def) =>
      buildLeaderBranchFromDef(def, team, brokerId, dept.id),
    )
    const directMembers = layout.directSlice
      ? team.slice(layout.directSlice[0], layout.directSlice[1]).map((m) => withPmProjectId(m, brokerId))
      : []
    return {
      pm,
      leaders,
      directMembers,
      sectionId: dept.id,
      sectionName: dept.name,
    }
  })
}

/** PM + mọi member có sheet (flatten) — khởi tạo điểm GM / lọc `?pm=`. */
export function flattenGmEvalPmHubTreeForScores(tree: GmEvalPmBranch[]): GmEvalMember[] {
  const out: GmEvalMember[] = []
  for (const br of tree) {
    out.push(br.pm)
    for (const ld of br.leaders) {
      out.push(ld.sheet)
      out.push(...ld.members)
    }
    out.push(...br.directMembers)
  }
  return out
}

/**
 * Hub `/gm/employee-evaluation`: GM chấm PM và member dưới line — danh sách phẳng cho điểm / drawer.
 */
export function getGmEvalPmHubRows(): GmEvalMember[] {
  return flattenGmEvalPmHubTreeForScores(getGmEvalPmHubTree())
}
