/**
 * Tree view "Team Members — KPI Status" — tổng quan để PM theo dõi / nhắc NV (chấm điểm ở màn Chi tiết).
 */
import {
  MOCK_PM_EMPLOYEES,
  MOCK_PM_PROJECTS,
  flattenKpiItems,
  type PmManagerKpiItem,
} from '@/data/pmManager.mock'
import type { PmTeamMember } from '@/types/kpi'

export type PmKpiTreeKind = 'tree' | 'individual' | 'contribution'

export type ReminderTone = 'rose' | 'amber' | 'emerald'

export interface PmKpiTreeMemberRow {
  memberId: string
  memberCode: string
  name: string
  initials: string
  rank: string
  role: string
  lineWeight: number
  evidenceSubmitted: boolean
  sheetStatus: string
  awaitingSheetReview: boolean
  /** Tiến độ riêng mục KPI này (minh chứng / tự chấm) */
  lineProgressLabel: string
  /** Gợi ý nhắc việc cho PM */
  reminderLabel: string
  reminderTone: ReminderTone
  /** Mock: lần cập nhật gần nhất trên sheet */
  lastUpdatedLabel: string
}

export interface PmKpiTreeGroup {
  lineId: string
  title: string
  kind: PmKpiTreeKind
  weight: number
  summaryText: string
  memberRows: PmKpiTreeMemberRow[]
}

const KIND_BY_LINE: Record<string, PmKpiTreeKind> = {
  a1a: 'tree',
  a2a: 'individual',
  a3a: 'tree',
  a4: 'individual',
  a5a: 'individual',
  a6: 'individual',
  a7: 'individual',
  b1: 'contribution',
  b2: 'contribution',
  b3: 'contribution',
  b4: 'contribution',
}

const templateEmp = MOCK_PM_EMPLOYEES.find((e) => flattenKpiItems(e).length >= 11) ?? MOCK_PM_EMPLOYEES[0]
const TEMPLATE_LINES = flattenKpiItems(templateEmp)

function itemForEmployee(empId: string, lineId: string): PmManagerKpiItem | undefined {
  const emp = MOCK_PM_EMPLOYEES.find((e) => e.id === empId)
  if (!emp) return undefined
  return flattenKpiItems(emp).find((i) => i.id === lineId)
}

function evidenceSubmittedForItem(item: PmManagerKpiItem): boolean {
  return item.selfScore >= 3
}

function mockLastUpdatedLabel(empId: string, year: number): string {
  const d = 3 + (parseInt(empId, 10) % 22)
  const m = 1 + (parseInt(empId, 10) % 11)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${year}`
}

export function sheetStatusLabelVi(status: string): string {
  if (status === 'approved') return 'Đã duyệt'
  if (status === 'submitted') return 'Chờ duyệt'
  if (status === 'draft') return 'Bản nháp'
  return '—'
}

function lineProgressLabel(item: PmManagerKpiItem, submitted: boolean): string {
  if (submitted) return 'Đủ minh chứng'
  if (item.selfScore > 0 && item.selfScore < 3) return 'Đang bổ sung'
  return 'Thiếu minh chứng'
}

function reminderForRow(
  submitted: boolean,
  sheetStatus: string,
  awaiting: boolean,
): { label: string; tone: ReminderTone } {
  if (sheetStatus === 'draft' || !submitted) {
    return { label: 'Nên nhắc', tone: 'rose' }
  }
  if (awaiting || sheetStatus === 'submitted') {
    return { label: 'Theo dõi', tone: 'amber' }
  }
  return { label: 'Ổn định', tone: 'emerald' }
}

function buildSummary(rows: PmKpiTreeMemberRow[]): string {
  const remind = rows.filter((r) => r.reminderTone === 'rose').length
  const watch = rows.filter((r) => r.reminderTone === 'amber').length
  if (remind > 0) return `${remind} nhân viên cần nhắc bổ sung / nộp phiếu...`
  if (watch > 0) return `${watch} nhân viên chờ duyệt hoặc đang theo dõi...`
  return 'Tất cả nhân viên trong nhóm đang ổn định.'
}

export function getPmKpiTreeGroups(
  year: number,
  projectId: string,
  teamMembers: PmTeamMember[],
): PmKpiTreeGroup[] {
  return TEMPLATE_LINES.map((line) => {
    const kind = KIND_BY_LINE[line.id] ?? 'individual'

    const memberRows: PmKpiTreeMemberRow[] = MOCK_PM_EMPLOYEES.filter((emp) => {
      if (projectId !== 'all' && !emp.projectIds.includes(projectId)) return false
      return !!itemForEmployee(emp.id, line.id)
    }).map((emp) => {
      const item = itemForEmployee(emp.id, line.id)!
      const tm = teamMembers.find((m) => m.id === emp.id)
      const submitted = evidenceSubmittedForItem(item)
      const sheetStatus = tm?.sheetStatus ?? 'draft'
      const awaiting = tm?.awaitingPmReview ?? false
      const { label: reminderLabel, tone: reminderTone } = reminderForRow(submitted, sheetStatus, awaiting)

      return {
        memberId: emp.id,
        memberCode: emp.code,
        name: emp.name,
        initials: emp.initials,
        rank: emp.rank,
        role: emp.role,
        lineWeight: item.weight,
        evidenceSubmitted: submitted,
        sheetStatus,
        awaitingSheetReview: awaiting,
        lineProgressLabel: lineProgressLabel(item, submitted),
        reminderLabel: reminderLabel,
        reminderTone: reminderTone,
        lastUpdatedLabel: mockLastUpdatedLabel(emp.id, year),
      }
    })

    return {
      lineId: line.id,
      title: line.title,
      kind,
      weight: line.weight,
      summaryText: buildSummary(memberRows),
      memberRows,
    }
  })
}

export { MOCK_PM_PROJECTS }
