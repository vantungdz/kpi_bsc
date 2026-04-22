/**
 * Strategic KPI tree cho PM — cùng shape `LeaderStrategicKpiNode` để UI đồng bộ
 * bảng "Strategic KPIs Tracking & Diagnostics" (LeaderDashboard).
 */
import {
  MOCK_PM_EMPLOYEES,
  flattenKpiItems,
  type PmManagerKpiItem,
} from '@/data/pmManager.mock'
import type { PmTeamMember } from '@/types/kpi'
import type {
  LeaderStrategicKpiNode,
  LeaderStrategicMemberRow,
  StrategicKpiTypeKey,
  StrategicStatusTone,
} from '@/mocks/leader-strategic-tree.mock'

const STRATEGIC_TYPE_BY_LINE_ID: Record<string, StrategicKpiTypeKey> = {
  a1a: 'cascading',
  a2a: 'independent',
  a3a: 'cascading',
  a4: 'cascading',
  a5a: 'cascading',
  a6: 'independent',
  a7: 'independent',
  b1: 'cascading',
  b2: 'independent',
  b3: 'direct',
  b4: 'direct',
}

const templateEmp =
  MOCK_PM_EMPLOYEES.find((e) => flattenKpiItems(e).length >= 11) ?? MOCK_PM_EMPLOYEES[0]
const TEMPLATE_LINES = flattenKpiItems(templateEmp)

function itemForEmployee(empId: string, lineId: string): PmManagerKpiItem | undefined {
  const emp = MOCK_PM_EMPLOYEES.find((e) => e.id === empId)
  if (!emp) return undefined
  return flattenKpiItems(emp).find((i) => i.id === lineId)
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function saltNum(memberId: string, key: string): number {
  let h = 0
  const s = `${memberId}:${key}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 19
}

function parseCodeFromTitle(title: string): string {
  const t = title.trim().split(/\s+/)
  return t[0] ?? title
}

function targetDescriptionFromSubtitle(subtitle: string): string {
  return subtitle.replace(/^Mục tiêu:\s*/i, '').replace(/^Mục tiêu\s*/i, '').replace(/^Target:\s*/i, '').trim() || subtitle
}

function targetPctForLine(lineId: string): number {
  return 84 + (saltNum('seed', lineId) % 12)
}

function evidenceSubmittedForItem(item: PmManagerKpiItem): boolean {
  return item.selfScore >= 3
}

function toneFromPerformance(
  actual: number,
  target: number,
  sheetStatus: string,
  pending: number,
): { tone: StrategicStatusTone; label: string; alert: string } {
  if (sheetStatus === 'draft') {
    return {
      tone: 'danger',
      label: 'Chưa nộp phiếu',
      alert: 'Phiếu KPI còn ở bản nháp',
    }
  }
  if (actual < target - 12) {
    return {
      tone: 'danger',
      label: 'Nguy hiểm',
      alert: pending > 0 ? `Thiếu minh chứng (${pending})` : 'Actual thấp hơn Target đáng kể',
    }
  }
  if (actual < target - 3 || pending >= 2) {
    return {
      tone: 'warning',
      label: 'Cảnh báo',
      alert: pending > 0 ? `Cần bổ sung evidence (${pending})` : 'Sát ngưỡng Target',
    }
  }
  if (actual >= target) {
    return {
      tone: 'success',
      label: 'Đạt chỉ tiêu',
      alert: pending > 0 ? `Theo dõi nhẹ (${pending} mục)` : 'Ổn định',
    }
  }
  return {
    tone: 'neutral',
    label: 'Theo dõi',
    alert: 'Đang tiến hành',
  }
}

function pmScoreMock(memberId: string, lineId: string): number {
  const base = 3.2 + (saltNum(memberId, lineId) % 14) / 10
  return Math.round(base * 10) / 10
}

function buildPmMemberRow(
  tm: PmTeamMember,
  lineId: string,
  targetPct: number,
  item: PmManagerKpiItem,
  roleLine: string,
): LeaderStrategicMemberRow {
  const submitted = evidenceSubmittedForItem(item)
  let pendingCount = 0
  if (tm.sheetStatus === 'draft') pendingCount = 3
  else if (!submitted) pendingCount = 2
  else if (tm.awaitingPmReview) pendingCount = 1

  const base = (tm.selfScore ?? tm.pmScore ?? 2.8) * 19 + saltNum(tm.id, lineId) - 6
  const actualPct = Math.min(108, Math.max(52, Math.round(base)))
  const { tone, label, alert } = toneFromPerformance(
    actualPct,
    targetPct,
    tm.sheetStatus,
    pendingCount,
  )
  const pmScore =
    tm.sheetStatus === 'draft' ? null : tm.pmScore ?? pmScoreMock(tm.id, lineId)

  return {
    memberId: tm.id,
    name: tm.name,
    rank: tm.rank,
    roleLine,
    initials: initialsFromName(tm.name),
    targetPct,
    actualPct,
    pmScore,
    statusLabel: label,
    statusTone: tone,
    alertText: alert,
    sheetSelfScore: item.selfScore,
  }
}

function aggregateMembers(
  members: LeaderStrategicMemberRow[],
  targetPct: number,
): Pick<
  LeaderStrategicKpiNode,
  'actualPct' | 'pmAvgScore' | 'statusLabel' | 'statusTone' | 'alertText'
> {
  if (members.length === 0) {
    return {
      actualPct: 0,
      pmAvgScore: 0,
      statusLabel: '—',
      statusTone: 'neutral',
      alertText: 'Chưa có nhân viên',
    }
  }
  const avg = Math.round(members.reduce((s, r) => s + r.actualPct, 0) / members.length)
  const pmVals = members.map((r) => r.pmScore).filter((x): x is number => x !== null)
  const pmAvgScore =
    pmVals.length > 0
      ? Math.round((pmVals.reduce((a, b) => a + b, 0) / pmVals.length) * 10) / 10
      : 0
  const worst = members.reduce((w, r) => {
    const order = { danger: 3, warning: 2, neutral: 1, success: 0 }
    return order[r.statusTone] > order[w.statusTone] ? r : w
  }, members[0]).statusTone
  const dangerN = members.filter((r) => r.statusTone === 'danger').length
  const warnN = members.filter((r) => r.statusTone === 'warning').length
  let alertText = 'Team đồng bộ tốt'
  if (dangerN > 0) alertText = `${dangerN} nhân viên có nguy cơ / thiếu dữ liệu`
  else if (warnN > 0) alertText = `${warnN} nhân viên cần theo dõi`

  let statusLabel = 'Tốt'
  let statusTone: StrategicStatusTone = 'success'
  if (worst === 'danger') {
    statusLabel = 'Rủi ro hệ thống'
    statusTone = 'danger'
  } else if (worst === 'warning') {
    statusLabel = 'Cảnh báo'
    statusTone = 'warning'
  } else if (avg < targetPct - 5) {
    statusLabel = 'Cảnh báo'
    statusTone = 'warning'
    alertText = 'TB Actual thấp hơn Target nhóm'
  }

  return {
    actualPct: avg,
    pmAvgScore,
    statusLabel,
    statusTone,
    alertText,
  }
}

function buildPmKpiNode(
  line: PmManagerKpiItem,
  filteredTeam: PmTeamMember[],
  projectId: string,
  risksOnly: boolean,
): LeaderStrategicKpiNode | null {
  const typeKey = STRATEGIC_TYPE_BY_LINE_ID[line.id] ?? 'independent'
  const targetPct = targetPctForLine(line.id)
  const members: LeaderStrategicMemberRow[] = []
  for (const tm of filteredTeam) {
    const emp = MOCK_PM_EMPLOYEES.find((e) => e.id === tm.id)
    if (projectId !== 'all' && emp && !emp.projectIds.includes(projectId)) continue
    const itemLine = itemForEmployee(tm.id, line.id)
    if (!itemLine) continue
    members.push(
      buildPmMemberRow(tm, line.id, targetPct, itemLine, emp?.role ?? 'Member'),
    )
  }
  const visible = risksOnly
    ? members.filter((r) => r.statusTone === 'danger' || r.statusTone === 'warning')
    : members
  if (risksOnly && visible.length === 0) return null
  const agg = aggregateMembers(visible, targetPct)
  const ed = line.evidence
  return {
    lineId: line.id,
    sheetIndex: line.index,
    code: parseCodeFromTitle(line.title),
    title: line.title,
    targetDescription: targetDescriptionFromSubtitle(line.target),
    targetSubtitle: line.target.trim(),
    weight: line.weight,
    typeKey,
    targetPct,
    ...agg,
    members: visible,
    referenceSelfScore: line.selfScore,
    evidenceLabel: line.evidenceButtonLabel,
    evidenceIcon: line.evidenceButtonIcon,
    evidenceTone: line.evidenceTone === 'emerald' ? 'emerald' : 'blue',
    evidenceBlockTitle: ed.title,
    evidenceBlockTitleIcon: ed.icon,
    evidenceHeaders: [...ed.headers],
    evidenceRows: ed.rows.map((r) => [...r]),
  }
}

/** Danh sách phẳng KPI (A1–B4) cho PM, cùng contract UI với Leader strategic tree. */
export function getPmStrategicKpiTree(
  projectId: string,
  team: PmTeamMember[],
  risksOnly: boolean,
  searchQ: string,
): LeaderStrategicKpiNode[] {
  const q = searchQ.trim().toLowerCase()
  const filteredTeam = q
    ? team.filter((m) => m.name.toLowerCase().includes(q) || m.rank.toLowerCase().includes(q))
    : team

  if (filteredTeam.length === 0) return []

  const out: LeaderStrategicKpiNode[] = []
  for (const line of TEMPLATE_LINES) {
    const node = buildPmKpiNode(line, filteredTeam, projectId, risksOnly)
    if (node) out.push(node)
  }
  return out
}
