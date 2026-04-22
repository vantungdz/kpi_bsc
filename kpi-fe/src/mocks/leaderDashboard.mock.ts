/**
 * Mock Leader Dashboard — team + đủ 11 KPI cá nhân (đồng bộ cấu trúc MOCK_TEAM_MEMBERS[0])
 */
import { isReadonlyKpiYear, MOCK_TEAM_MEMBERS, type KpiLineMock } from '@/mocks/leaderManager.mock'
import { MOCK_PROMOTION_KPI_ITEMS } from '@/mocks/member-kpi.mock'
import type { EvalPhase, KpiItem, LeaderKpiDashboard, LeaderTeamMember, MemberKpiEvaluationStatus } from '@/types/kpi'

/** Mid-year active → timeline giống prototype Process timeline */
const phase: EvalPhase = 'mid_year'

export type MyKpiCaseType = 'monthly' | 'project_metrics' | 'general' | 'upload_only'

export interface LeaderMyKpiDisplayRow {
  index: number
  /** id dòng trong MOCK (vd a1a) — map trạng thái đánh giá */
  lineId: string
  caseLabel: string
  caseType: MyKpiCaseType
  caseBadgeClass: string
  code: string
  title: string
  targetSummary: string
  targetHint: string
  weight: number
  evidenceStatus: 'submitted' | 'missing' | 'pending'
  selfScore: number | null
  evidenceDrawerName: string
  evidenceTargetDesc: string
  /** Trạng thái đánh giá KPI (cột Trạng thái bảng cá nhân) */
  evaluationStatus: MemberKpiEvaluationStatus
  /** Điểm PM (mock) — null nếu chưa chấm */
  pmScore: number | null
  /** Ghi chú gửi PM (drawer evidence) */
  evidenceNote?: string
  /** KPI chứng chỉ: mô tả thực tế khác mục tiêu sheet (vd JLPT N2 thay TOEIC đăng ký) */
  certificateOutcomeNote?: string
  /** Dòng nhóm (A)/(B) — hiển thị trước dòng KPI đầu tiên của nhóm */
  groupBanner?: string
}

/** Drawer / layout case theo id dòng KPI (cùng sheet 834) */
const CASE_FOR_LINE: Record<string, MyKpiCaseType> = {
  a1a: 'project_metrics',
  a2a: 'monthly',
  a3a: 'project_metrics',
  a4: 'general',
  a5a: 'general',
  a6: 'general',
  a7: 'general',
  b1: 'general',
  b2: 'general',
  b3: 'upload_only',
  b4: 'upload_only',
}

/** Mock trạng thái đánh giá theo id dòng — đủ các nhánh UI */
const EVAL_STATUS_BY_LINE_ID: Record<string, MemberKpiEvaluationStatus> = {
  a1a: 'pending_approval',
  a2a: 'revision',
  a3a: 'overdue',
  a4: 'pending_approval',
  a5a: 'not_started',
  a6: 'approved',
  a7: 'approved',
  b1: 'revision',
  b2: 'not_started',
  b3: 'overdue',
  b4: 'pending_approval',
}

/** Mock điểm PM theo dòng — null = chưa có điểm */
const PM_SCORE_BY_LINE_ID: Record<string, number | null> = {
  a1a: null,
  a2a: null,
  a3a: null,
  a4: null,
  a5a: null,
  a6: null,
  a7: null,
  b1: null,
  b2: null,
  b3: null,
  b4: null,
}

const BADGE_FOR_LINE: Record<string, string> = {
  a1a: 'bg-indigo-100 text-indigo-800',
  a2a: 'bg-blue-100 text-blue-700',
  a3a: 'bg-purple-100 text-purple-700',
  a4: 'bg-amber-100 text-amber-800',
  a5a: 'bg-cyan-100 text-cyan-800',
  a6: 'bg-slate-200 text-slate-800',
  a7: 'bg-teal-100 text-teal-700',
  b1: 'bg-emerald-100 text-emerald-800',
  b2: 'bg-emerald-100 text-emerald-700',
  b3: 'bg-pink-100 text-pink-700',
  b4: 'bg-rose-100 text-rose-700',
}

function parseCodeFromTitle(title: string): string {
  const t = title.trim().split(/\s+/)
  return t[0] ?? title
}

function shortTitleWithoutCode(title: string): string {
  const i = title.indexOf(' ')
  return i === -1 ? title : title.slice(i + 1).trim()
}

function targetSummaryFromSubtitle(subtitle: string): string {
  return subtitle.replace(/^Mục tiêu:\s*/i, '').replace(/^Mục tiêu\s*/i, '').trim()
}

function evidenceStatusFromScore(score: number): 'submitted' | 'missing' | 'pending' {
  if (score >= 4) return 'submitted'
  if (score >= 3) return 'pending'
  return 'missing'
}

function lineToDisplayRow(line: KpiLineMock): LeaderMyKpiDisplayRow {
  const code = parseCodeFromTitle(line.title)
  const caseType = CASE_FOR_LINE[line.id] ?? 'general'
  const zone = line.index <= 7 ? '(A)' : '(B)'
  const caseLabel = `${zone} ${code}`

  return {
    index: line.index,
    lineId: line.id,
    caseLabel,
    caseType,
    caseBadgeClass: BADGE_FOR_LINE[line.id] ?? 'bg-slate-100 text-slate-700',
    code,
    title: line.title,
    targetSummary: targetSummaryFromSubtitle(line.subtitle),
    targetHint: `${line.evidenceLabel} · ${line.evidenceDetail.title}`,
    weight: line.weight,
    evidenceStatus: evidenceStatusFromScore(line.selfScore),
    selfScore: line.selfScore,
    evidenceDrawerName: shortTitleWithoutCode(line.title),
    evidenceTargetDesc: line.subtitle.trim(),
    evaluationStatus: EVAL_STATUS_BY_LINE_ID[line.id] ?? 'not_started',
    pmScore: PM_SCORE_BY_LINE_ID[line.id] ?? null,
    evidenceNote: '',
    certificateOutcomeNote:
      line.id === 'b3'
        ? 'Thực tế nộp minh chứng: JLPT N2 (12/2024). Sheet đăng ký: TOEIC 700 / JLPT N3 — đính kèm scan / link tra cứu.'
        : undefined,
    groupBanner:
      line.index === 1
        ? '(A) Hiệu suất & Chất lượng dự án'
        : line.index === 8
          ? '(B) Mục tiêu đào tạo & phát triển'
          : undefined,
  }
}

/** 11 KPI — lấy từ mock nhân viên 834 (cùng bộ sheet chuẩn) */
function buildMyKpiRowsFromTemplate(): LeaderMyKpiDisplayRow[] {
  const member = MOCK_TEAM_MEMBERS[0]
  return member.groups.flatMap((g) => g.lines).map(lineToDisplayRow)
}

const BASE_MY_KPI_ROWS: LeaderMyKpiDisplayRow[] = buildMyKpiRowsFromTemplate()

export function getLeaderMyKpiDisplayRows(year: number): LeaderMyKpiDisplayRow[] {
  const readonly = isReadonlyKpiYear(year)
  if (readonly) {
    return BASE_MY_KPI_ROWS.map((r) => ({
      ...r,
      evidenceStatus: 'submitted' as const,
      selfScore: r.selfScore === null ? 4 : Math.max(r.selfScore, 4),
      evaluationStatus: 'approved' as const,
      certificateOutcomeNote:
        r.lineId === 'b3'
          ? 'Đã chốt: JLPT N2 (minh chứng đã xác minh). Mục tiêu đăng ký trên sheet: TOEIC 700 / JLPT N3.'
          : undefined,
    }))
  }
  return BASE_MY_KPI_ROWS.map((r) => ({ ...r }))
}

function toKpiItem(row: LeaderMyKpiDisplayRow): KpiItem {
  return {
    id: `kpi-${row.code}-${row.index}`,
    code: row.code,
    name: row.title,
    description: row.targetHint,
    target: row.targetSummary,
    weight: row.weight,
    group: row.caseLabel,
    evaluationStatus: row.evaluationStatus,
    evidenceStatus: row.evidenceStatus,
    selfScore: row.selfScore,
    pmScore: row.pmScore ?? null,
    leaderScore: null,
    evidenceNote: row.evidenceNote,
    certificateOutcomeNote: row.certificateOutcomeNote,
  }
}

function mockMySheet(year: number, items: KpiItem[], rows: LeaderMyKpiDisplayRow[]) {
  const locked = isReadonlyKpiYear(year)
  const submitted = rows.filter((r) => r.evidenceStatus === 'submitted').length
  return {
    id: 'sheet-leader-self',
    userId: 'leader-1',
    userName: 'Leader Demo',
    rank: 'L2',
    year,
    phase,
    items,
    totalWeight: 160,
    evidenceCount: locked ? rows.length : submitted,
    evidenceTotalCount: rows.length,
    status: locked ? ('approved' as const) : ('submitted' as const),
  }
}

const TEAM_CURRENT: LeaderTeamMember[] = [
  { id: '834', name: 'Nguyen Quang Huy', rank: 'R1', role: 'Dev - Production', progress: 72, sheetStatus: 'submitted', score: 3.8, pendingCount: 2 },
  { id: '812', name: 'Trần Văn Phước', rank: 'R3', role: 'Dev - Production', progress: 30, sheetStatus: 'draft', score: null, pendingCount: 0 },
  { id: '801', name: 'Lê Thị Mai', rank: 'R2', role: 'BA - Analysis', progress: 85, sheetStatus: 'submitted', score: 4.1, pendingCount: 1 },
  { id: '799', name: 'Phạm Đức Anh', rank: 'R2', role: 'Dev - Backend', progress: 100, sheetStatus: 'approved', score: 4.25, pendingCount: 0 },
]

const TEAM_PAST: LeaderTeamMember[] = [
  { id: '834', name: 'Nguyen Quang Huy', rank: 'R1', role: 'Dev - Production', progress: 100, sheetStatus: 'approved', score: 3.95, pendingCount: 0 },
  { id: '812', name: 'Trần Văn Phước', rank: 'R3', role: 'Dev - Production', progress: 100, sheetStatus: 'approved', score: 3.9, pendingCount: 0 },
  { id: '801', name: 'Lê Thị Mai', rank: 'R2', role: 'BA - Analysis', progress: 100, sheetStatus: 'approved', score: 4.15, pendingCount: 0 },
  { id: '799', name: 'Phạm Đức Anh', rank: 'R2', role: 'Dev - Backend', progress: 100, sheetStatus: 'approved', score: 4.25, pendingCount: 0 },
]

/** Panel Chi tiết NV — bảng KPI theo MOCK_TEAM_MEMBERS */
export interface TeamMemberKpiPanelRow {
  lineId: string
  index: number
  title: string
  /** Một dòng mô tả mục tiêu (vd IE ≥ 3.0) */
  targetLine: string
  weight: number
  evidenceLabel: string
  evidenceIcon: string
  evidenceTone: 'blue' | 'emerald'
  selfScore: number | null
  certificateOutcomeNote?: string
  /** Bảng minh chứng chi tiết — hiển thị khi expand evidence panel */
  evidenceDetail: {
    title: string
    titleIcon: string
    accent: 'indigo' | 'emerald'
    headers: string[]
    rows: string[][]
  }
}

export interface TeamMemberKpiPanelGroup {
  label: string
  rows: TeamMemberKpiPanelRow[]
}

const PANEL_CERT_BY_MEMBER_LINE: Record<string, Partial<Record<string, string>>> = {
  '834': {
    b3: 'Thực tế (minh chứng): JLPT N2 (12/2024). Mục tiêu đăng ký trên sheet: TOEIC 700 / JLPT N3.',
  },
}

function kpiLineToPanelRow(line: KpiLineMock, memberId: string): TeamMemberKpiPanelRow {
  const targetLine = line.subtitle.replace(/^Mục tiêu:\s*/i, '').replace(/^Mục tiêu\s*/i, '').trim() || line.subtitle
  return {
    lineId: line.id,
    index: line.index,
    title: line.title,
    targetLine,
    weight: line.weight,
    evidenceLabel: line.evidenceLabel,
    evidenceIcon: line.evidenceIcon,
    evidenceTone: line.evidenceVariant === 'emerald' ? 'emerald' : 'blue',
    selfScore: line.selfScore,
    certificateOutcomeNote: PANEL_CERT_BY_MEMBER_LINE[memberId]?.[line.id],
    evidenceDetail: {
      title: line.evidenceDetail.title,
      titleIcon: line.evidenceDetail.titleIcon,
      accent: line.evidenceDetail.accent,
      headers: line.evidenceDetail.headers,
      rows: line.evidenceDetail.rows,
    },
  }
}

export function getTeamMemberKpiPanelGroups(memberId: string): TeamMemberKpiPanelGroup[] {
  const member = MOCK_TEAM_MEMBERS.find((m) => m.id === memberId)
  if (!member?.groups?.length) return []
  return member.groups.map((g) => ({
    label: g.label.toUpperCase(),
    rows: g.lines.map((line) => kpiLineToPanelRow(line, memberId)),
  }))
}

/**
 * KPI Promotion (nhóm P) theo thành viên — mock khác nhẹ theo `memberId` để Leader xem trước.
 * Nối API: thay bằng GET promotion rows theo member + year.
 */
export function getTeamMemberPromotionKpiItems(memberId: string): KpiItem[] {
  if (memberId === '799') {
    const base = MOCK_PROMOTION_KPI_ITEMS[0]!
    return [
      {
        ...base,
        id: `promo-${memberId}-p1`,
        selfScore: 3,
        pmScore: null,
        evaluationStatus: 'pending_approval' as MemberKpiEvaluationStatus,
      },
    ]
  }
  if (memberId === '812') {
    return MOCK_PROMOTION_KPI_ITEMS.slice(0, 2).map((it, i) => ({
      ...it,
      id: `promo-${memberId}-${i}`,
      ...(i === 0
        ? {
            selfScore: 3,
            pmScore: 3,
            evaluationStatus: 'approved' as MemberKpiEvaluationStatus,
            evidenceStatus: 'submitted' as const,
          }
        : {
            selfScore: null,
            pmScore: null,
            evaluationStatus: 'not_started' as MemberKpiEvaluationStatus,
          }),
    }))
  }
  return MOCK_PROMOTION_KPI_ITEMS.map((it, i) => ({
    ...it,
    id: `promo-${memberId}-${i}`,
  }))
}

export function getMockLeaderDashboard(year: number): LeaderKpiDashboard {
  const rows = getLeaderMyKpiDisplayRows(year)
  const team = isReadonlyKpiYear(year) ? TEAM_PAST : TEAM_CURRENT
  const locked = isReadonlyKpiYear(year)
  return {
    year,
    phase,
    teamMembers: team,
    mySheet: mockMySheet(year, rows.map(toKpiItem), rows),
    uiHints: locked
      ? undefined
      : {
          /** Đổi số này để thử banner: dương ≤7 = vàng; âm = đỏ quá hạn */
          selfEvalDaysRemaining: 3,
        },
  }
}

export type LeaderProcessStepState = 'completed' | 'active' | 'upcoming'

export interface LeaderProcessTimelineStep {
  id: string
  title: string
  dateRange: string
  state: LeaderProcessStepState
  /** Dòng phụ dưới vòng tròn (vd 100% Complete) */
  footnote?: string
  /** Màu chữ tiêu đề bước */
  titleClass: string
  pendingKpiHint?: string
}

/** Số ngày coi là “sắp hết hạn” cho banner cảnh báo (mock đồng bộ FE) */
export const LEADER_SELF_EVAL_WARN_DAYS = 7

export function getLeaderProcessTimeline(
  phase: EvalPhase,
  pendingKpiCount: number,
): LeaderProcessTimelineStep[] {
  const s1Done = phase !== 'target_setup'
  const s2Done = phase === 'year_end'
  const s3Done = false

  return [
    {
      id: 'target_setup',
      title: 'KPI Setting',
      dateRange: 'Jan - Mar',
      state: !s1Done ? 'active' : 'completed',
      titleClass: !s1Done ? 'text-blue-700' : 'text-emerald-700',
      footnote: s1Done ? '100% Complete' : undefined,
    },
    {
      id: 'mid_year',
      title: 'Mid-Year Review',
      dateRange: 'Jun - Jul',
      state: s2Done ? 'completed' : s1Done ? 'active' : 'upcoming',
      titleClass: s2Done ? 'text-emerald-700' : s1Done ? 'text-blue-700' : 'text-slate-500',
      footnote:
        s2Done
          ? '100% Complete'
          : s1Done
            ? `Pending: ${pendingKpiCount} KPIs`
            : 'Not started',
      pendingKpiHint: s1Done && !s2Done && pendingKpiCount > 0 ? String(pendingKpiCount) : undefined,
    },
    {
      id: 'year_end',
      title: 'Year-End Review',
      dateRange: 'Nov - Dec',
      state: s3Done ? 'completed' : phase === 'year_end' ? 'active' : 'upcoming',
      titleClass: phase === 'year_end' ? 'text-blue-700' : 'text-slate-500',
      footnote: phase === 'year_end' ? `Pending: ${pendingKpiCount} KPIs` : 'Not started',
    },
  ]
}
