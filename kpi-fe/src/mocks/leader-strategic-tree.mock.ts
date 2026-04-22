/**
 * Strategic KPIs cho Leader — danh sách phẳng A1–A8 & B1–B4 (mock sheet 834),
 * mỗi KPI có badge loại Cascading / Independent / Direct.
 */
import { MOCK_TEAM_MEMBERS, type KpiLineMock } from '@/mocks/leaderManager.mock'
import type { LeaderTeamMember } from '@/types/kpi'

export type StrategicKpiTypeKey = 'cascading' | 'independent' | 'direct'

export type StrategicStatusTone = 'success' | 'warning' | 'danger' | 'neutral'

export interface LeaderStrategicMemberRow {
  memberId: string
  name: string
  rank: string
  roleLine: string
  initials: string
  targetPct: number
  actualPct: number
  pmScore: number | null
  statusLabel: string
  statusTone: StrategicStatusTone
  alertText: string
  /** Self trên dòng KPI trong sheet NV (mock), null nếu sheet không có dòng này */
  sheetSelfScore: number | null
}

export interface LeaderStrategicKpiNode {
  lineId: string
  /** STT trên sheet (1–11) */
  sheetIndex: number
  code: string
  title: string
  targetDescription: string
  /** Dòng đầy đủ: "Mục tiêu: IE ≥ 3.0" */
  targetSubtitle: string
  weight: number
  typeKey: StrategicKpiTypeKey
  targetPct: number
  actualPct: number
  pmAvgScore: number
  statusLabel: string
  statusTone: StrategicStatusTone
  alertText: string
  members: LeaderStrategicMemberRow[]
  /** Self score tham chiếu từ sheet mẫu (cột Self trên dòng KPI) */
  referenceSelfScore: number
  evidenceLabel: string
  evidenceIcon: string
  evidenceTone: 'blue' | 'emerald'
  evidenceBlockTitle: string
  evidenceBlockTitleIcon: string
  evidenceHeaders: string[]
  evidenceRows: string[][]
}

const ROLE_LINE: Record<string, string> = {
  '834': 'Dev - Production',
  '812': 'QC - Production',
  '801': 'BA - Production',
  '799': 'Dev - Maintenance',
}

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
  return subtitle.replace(/^Mục tiêu:\s*/i, '').replace(/^Mục tiêu\s*/i, '').trim() || subtitle
}

function targetPctForLine(lineId: string): number {
  return 84 + (saltNum('seed', lineId) % 12)
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

function findKpiLineForMember(memberId: string, lineId: string): KpiLineMock | null {
  const sheet = MOCK_TEAM_MEMBERS.find((x) => x.id === memberId)
  if (!sheet?.groups?.length) return null
  for (const g of sheet.groups) {
    for (const line of g.lines) {
      if (line.id === lineId) return line
    }
  }
  return null
}

function buildMemberRow(
  m: LeaderTeamMember,
  lineId: string,
  targetPct: number,
): LeaderStrategicMemberRow {
  const base = (m.score ?? 2.8) * 19 + saltNum(m.id, lineId) - 6
  const actualPct = Math.min(108, Math.max(52, Math.round(base)))
  const { tone, label, alert } = toneFromPerformance(
    actualPct,
    targetPct,
    m.sheetStatus,
    m.pendingCount,
  )
  const pmScore = m.sheetStatus === 'draft' ? null : pmScoreMock(m.id, lineId)
  const lineFromSheet = findKpiLineForMember(m.id, lineId)
  return {
    memberId: m.id,
    name: m.name,
    rank: m.rank,
    roleLine: ROLE_LINE[m.id] ?? 'Member',
    initials: initialsFromName(m.name),
    targetPct,
    actualPct,
    pmScore,
    statusLabel: label,
    statusTone: tone,
    alertText: alert,
    sheetSelfScore: lineFromSheet?.selfScore ?? null,
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

function templateLines(): KpiLineMock[] {
  const m = MOCK_TEAM_MEMBERS[0]
  return m.groups.flatMap((g) => g.lines)
}

function buildKpiNode(
  line: KpiLineMock,
  team: LeaderTeamMember[],
  risksOnly: boolean,
): LeaderStrategicKpiNode | null {
  const typeKey = STRATEGIC_TYPE_BY_LINE_ID[line.id] ?? 'independent'
  const targetPct = targetPctForLine(line.id)
  const members = team.map((m) => buildMemberRow(m, line.id, targetPct))
  const visible = risksOnly
    ? members.filter((r) => r.statusTone === 'danger' || r.statusTone === 'warning')
    : members
  if (risksOnly && visible.length === 0) return null
  const agg = aggregateMembers(visible, targetPct)
  const ed = line.evidenceDetail
  return {
    lineId: line.id,
    sheetIndex: line.index,
    code: parseCodeFromTitle(line.title),
    title: line.title,
    targetDescription: targetDescriptionFromSubtitle(line.subtitle),
    targetSubtitle: line.subtitle.trim(),
    weight: line.weight,
    typeKey,
    targetPct,
    ...agg,
    members: visible,
    referenceSelfScore: line.selfScore,
    evidenceLabel: line.evidenceLabel,
    evidenceIcon: line.evidenceIcon,
    evidenceTone: line.evidenceVariant === 'emerald' ? 'emerald' : 'blue',
    evidenceBlockTitle: ed.title,
    evidenceBlockTitleIcon: ed.titleIcon,
    evidenceHeaders: [...ed.headers],
    evidenceRows: ed.rows.map((r) => [...r]),
  }
}

/** Danh sách phẳng KPI (đủ A1–B4), không còn nhóm theo type ở UI */
export function getLeaderStrategicKpiTree(
  team: LeaderTeamMember[],
  risksOnly: boolean,
  searchQ: string,
): LeaderStrategicKpiNode[] {
  const q = searchQ.trim().toLowerCase()
  const filteredTeam = q
    ? team.filter((m) => m.name.toLowerCase().includes(q) || m.rank.toLowerCase().includes(q))
    : team

  if (filteredTeam.length === 0) return []

  const linesOrder = templateLines()
  const out: LeaderStrategicKpiNode[] = []
  for (const line of linesOrder) {
    const node = buildKpiNode(line, filteredTeam, risksOnly)
    if (node) out.push(node)
  }
  return out
}
