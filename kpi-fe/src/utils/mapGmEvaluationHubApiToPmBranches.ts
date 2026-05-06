import type {
  GmEvalLeaderBranch,
  GmEvalMember,
  GmEvalPmBranch,
  GmEvidenceTable,
  GmEmployeeSheetStatus,
  GmKpiGroup,
  GmKpiItem,
} from '@/mocks/gmEmployeeEvaluation.mock'
import type { GmEvaluationHubApiResponse, GmEvaluationHubAssignmentApiRow } from '@/types/gm-evaluation-hub-api'

function initialsFromName(name: string): string {
  const p = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!p.length) return '?'
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return (p[0]![0] + p[p.length - 1]![0]).toUpperCase()
}

/** Gộp ASM trên mọi KPI của user — đồng bộ ngưỡng với logic cũ (503 = chờ PM, ≥601 = đã chốt). */
function sheetStatusFromRows(rows: GmEvaluationHubAssignmentApiRow[]): GmEmployeeSheetStatus {
  const codes = rows
    .map((r) => r.statusCode)
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
  if (!codes.length) return 'self_scoring'
  if (codes.some((c) => c === 502 || c === 602)) return 'pending_pm'
  if (codes.every((c) => c >= 601)) return 'approved'
  return 'self_scoring'
}

function asmProgressLabel(row: GmEvaluationHubAssignmentApiRow): string {
  const d = (row.assignmentStatusDescription ?? '').trim()
  if (d) return d
  return (row.assignmentStatusName ?? '').trim()
}

/** Các mô tả ASM (`description`, fallback `name`) khác nhau trên các assignment của cùng user. */
function assignmentStatusDisplayFromRows(rows: GmEvaluationHubAssignmentApiRow[]): string | null {
  if (!rows.length) return null
  const labels = [...new Set(rows.map((r) => asmProgressLabel(r)).filter(Boolean))]
  if (!labels.length) return null
  if (labels.length === 1) return labels[0]!
  return [...labels].sort((a, b) => a.localeCompare(b)).join(' · ')
}

/** Nút chấm/duyệt GM (502 = 1st chờ GM, 602 = Final chờ GM). */
function gmApprovalActionEnabledFromRows(rows: GmEvaluationHubAssignmentApiRow[]): boolean {
  return rows.some((r) => {
    const c = Number(r.statusCode)
    return c === 502 || c === 602
  })
}

function parseSelfScore(row: GmEvaluationHubAssignmentApiRow): number {
  const raw = row.endSelfScore ?? row.midSelfScore
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return 0
  if (n >= 0 && n <= 5) return Math.min(5, Math.max(0, Math.round(n)))
  if (n <= 100) return Math.min(5, Math.max(0, Math.round(n / 20)))
  return Math.min(5, Math.max(0, Math.round(n)))
}

function parseWeight(row: GmEvaluationHubAssignmentApiRow): number {
  const raw = row.weight
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n) || n <= 0) return 100
  return Math.min(100, Math.max(1, Math.round(n * 100) / 100))
}

/** Hiển thị một giá trị JSON trong bảng minh chứng (tránh `[object Object]`). */
function evidenceJsonCell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  const t = typeof v
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return '—'
  }
}

function pushScalarField(rows: string[][], label: string, v: unknown) {
  if (typeof v !== 'string') return
  const s = v.trim()
  if (!s) return
  rows.push([label, s])
}

function appendAttachmentArray(rows: string[][], arr: unknown, groupLabel: string) {
  if (!Array.isArray(arr) || arr.length === 0) return
  arr.forEach((item, i) => {
    if (typeof item === 'string') {
      const s = item.trim()
      if (s) rows.push([`${groupLabel} #${i + 1}`, s])
      return
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const it = item as Record<string, unknown>
      const nameRaw = it.name ?? it.fileName ?? it.label
      const name =
        typeof nameRaw === 'string' && nameRaw.trim()
          ? nameRaw.trim()
          : `${groupLabel} #${i + 1}`
      const urlRaw = it.url ?? it.href ?? it.path
      const url = typeof urlRaw === 'string' && urlRaw.trim() ? urlRaw.trim() : ''
      rows.push([name, url || evidenceJsonCell(item)])
      return
    }
    rows.push([`${groupLabel} #${i + 1}`, evidenceJsonCell(item)])
  })
}

function appendPlanActualRecords(rows: string[][], arr: unknown) {
  if (!Array.isArray(arr) || arr.length === 0) return
  arr.forEach((rec, i) => {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      rows.push([`planActualRecords[${i}]`, evidenceJsonCell(rec)])
      return
    }
    const r = rec as Record<string, unknown>
    const plan = r.plan ?? r.total
    const actual = r.actual ?? r.completed
    rows.push([
      `Kế hoạch / thực tế #${i + 1}`,
      `Kế hoạch: ${evidenceJsonCell(plan)} · Thực tế: ${evidenceJsonCell(actual)}`,
    ])
  })
}

/**
 * Chuỗi hóa JSON `kpi_assignments.evidences` (JSONB) cho drawer GM —
 * hỗ trợ `evd`, `files`, `urls`, `note`, `text`, `result`, `planActualRecords` (đồng bộ kiểu member sheet).
 */
function evidenceRowsFromObject(o: Record<string, unknown>): string[][] {
  const rows: string[][] = []
  appendAttachmentArray(rows, o.evd, 'Tệp minh chứng')
  appendAttachmentArray(rows, o.files, 'File')
  appendAttachmentArray(rows, o.urls, 'URL')
  pushScalarField(rows, 'Ghi chú (note)', o.note)
  const noteTrim = typeof o.note === 'string' ? o.note.trim() : ''
  const textTrim = typeof o.text === 'string' ? o.text.trim() : ''
  if (textTrim && textTrim !== noteTrim) {
    rows.push(['Text', textTrim])
  }
  const resultNorm =
    o.result !== undefined && o.result !== null ? evidenceJsonCell(o.result).trim() : ''
  if (resultNorm) {
    rows.push(['Kết quả', resultNorm])
  }
  appendPlanActualRecords(rows, o.planActualRecords)

  const consumed = new Set([
    'evd',
    'files',
    'urls',
    'note',
    'text',
    'result',
    'planActualRecords',
  ])
  const actualNorm =
    o.actual !== undefined && o.actual !== null ? evidenceJsonCell(o.actual).trim() : ''
  if (actualNorm !== '' && actualNorm === resultNorm) {
    consumed.add('actual')
  }
  for (const [k, v] of Object.entries(o)) {
    if (consumed.has(k)) continue
    rows.push([k, evidenceJsonCell(v)])
  }
  return rows
}

function evidenceFromRow(row: GmEvaluationHubAssignmentApiRow): GmEvidenceTable {
  const raw = String(row.evidences ?? '').trim()
  if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
    try {
      const j = JSON.parse(raw) as unknown
      if (Array.isArray(j)) {
        return {
          title: 'Minh chứng / JSON',
          icon: 'fas fa-file-code',
          accent: 'indigo',
          headers: ['#', 'Mục'],
          rows: j.map((x, i) => [String(i + 1), typeof x === 'string' ? x : evidenceJsonCell(x)]),
        }
      }
      if (j && typeof j === 'object') {
        const o = j as Record<string, unknown>
        return {
          title: 'Minh chứng',
          icon: 'fas fa-paperclip',
          accent: 'emerald',
          headers: ['Khóa', 'Giá trị'],
          rows: evidenceRowsFromObject(o),
        }
      }
    } catch {
      /* fall through */
    }
  }
  return {
    title: 'Minh chứng / ghi chú',
    icon: 'fas fa-clipboard-list',
    accent: 'indigo',
    headers: ['Trường', 'Giá trị'],
    rows: [
      ['Mã ASM', String(row.statusCode ?? '—')],
      ['Trạng thái giao', asmProgressLabel(row) || '—'],
      ['Mô tả target', row.targetDescription ?? '—'],
      ...(raw && !raw.startsWith('{') ? [['Evidences (raw)', raw]] : []),
    ],
  }
}

function toKpiItem(row: GmEvaluationHubAssignmentApiRow, index: number): GmKpiItem {
  const code = (row.masterCode ?? '').trim()
  const name = (row.masterName ?? '').trim()
  const title = [code, name].filter(Boolean).join(' · ') || `KPI ${index + 1}`
  return {
    id: String(row.assignmentId),
    index: index + 1,
    title,
    /** Không gán mô tả target JSON dài vào drawer — chỉ hiển thị tiêu đề KPI (UI GM). */
    target: '',
    weight: parseWeight(row),
    evidenceButtonLabel: 'Minh chứng',
    evidenceButtonIcon: 'fas fa-file-alt',
    evidenceTone: 'blue',
    selfScore: parseSelfScore(row),
    evidence: evidenceFromRow(row),
    hubAssignmentStatusCode:
      typeof row.statusCode === 'number' && Number.isFinite(row.statusCode)
        ? row.statusCode
        : null,
  }
}

function isPromotionAssignmentRow(row: GmEvaluationHubAssignmentApiRow): boolean {
  return /\bpromotion\b/i.test(String(row.kpiTypeName ?? '').trim())
}

function avgSelfFromItems(items: GmKpiItem[]): string | null {
  if (!items.length) return null
  const s = items.reduce((a, i) => a + i.selfScore, 0) / items.length
  return s.toFixed(2)
}

function buildUserMember(
  rows: GmEvaluationHubAssignmentApiRow[],
  userId: string,
  displayName: string,
  roleLabel: string,
  brokerId: string,
  rankFallback: string,
): GmEvalMember {
  const safeName = displayName.trim() || userId
  const promotionRows = rows.filter(isPromotionAssignmentRow)
  const nonPromotionRows = rows.filter((r) => !isPromotionAssignmentRow(r))
  const groups: GmKpiGroup[] = []

  if (nonPromotionRows.length > 0) {
    const items = nonPromotionRows.map((r, i) => toKpiItem(r, i))
    const cats = [
      ...new Set(nonPromotionRows.map((r) => r.categoryName).filter((x): x is string => Boolean(x?.trim()))),
    ]
    groups.push({
      groupTitle: cats.length ? cats.join(' · ') : 'KPI Individual / Cascading',
      items,
    })
  }

  if (promotionRows.length > 0) {
    const items = promotionRows.map((r, i) => toKpiItem(r, i))
    const cats = [
      ...new Set(promotionRows.map((r) => r.categoryName).filter((x): x is string => Boolean(x?.trim()))),
    ]
    groups.push({
      groupTitle: cats.length ? `Promotion · ${cats.join(' · ')}` : 'Promotion',
      items,
    })
  }

  if (groups.length === 0) {
    groups.push({
      groupTitle: 'KPI được giao (chu kỳ)',
      items: [],
    })
  }

  const flatItems = groups.flatMap((g) => g.items)
  const st = sheetStatusFromRows(rows)
  return {
    id: `hub-${brokerId}-u-${userId}`,
    code: (rows[0]?.userUsername ?? userId).slice(0, 20),
    name: safeName,
    role: roleLabel,
    initials: initialsFromName(safeName),
    initialsClass: 'bg-indigo-100 text-indigo-800',
    rank: (rows[0]?.rankCode ?? rankFallback).trim() || '—',
    status: st,
    assignmentStatusDisplay: assignmentStatusDisplayFromRows(rows),
    gmApprovalActionEnabled: gmApprovalActionEnabledFromRows(rows),
    evaluationUserId: userId,
    selfScoreDisplay: avgSelfFromItems(flatItems),
    canScore: true,
    projectIds: [brokerId],
    groups,
  }
}

/** Tag vai trò trên hub: ưu tiên mã role DB (`roles.code`), fallback tên nếu không có mã. */
function roleLabelFromRow(row: GmEvaluationHubAssignmentApiRow | undefined, fallback: string): string {
  const raw = (row?.memberRoleCode ?? row?.memberRoleName ?? fallback).trim()
  return raw || fallback
}

function groupRowsByUserId(rows: GmEvaluationHubAssignmentApiRow[], brokerId: string): GmEvalMember[] {
  const m = new Map<string, GmEvaluationHubAssignmentApiRow[]>()
  for (const r of rows) {
    const uid = String(r.userId ?? '').trim()
    if (!uid) continue
    if (!m.has(uid)) m.set(uid, [])
    m.get(uid)!.push(r)
  }
  return [...m.entries()].map(([uid, list]) => {
    const role = roleLabelFromRow(list[0], 'MEMBER')
    return buildUserMember(list, uid, String(list[0]?.userFullName ?? uid), role, brokerId, list[0]?.rankCode ?? '—')
  })
}

/**
 * Gộp payload phẳng từ `GET /kpi/gm/evaluation-hub/assignments` thành cây Section → PM → Leader → Member
 * (đủ props cho `GmKpiEvaluationPanel`).
 */
export function mapGmEvaluationHubApiToPmBranches(api: GmEvaluationHubApiResponse): GmEvalPmBranch[] {
  const rows = Array.isArray(api.assignments) ? api.assignments : []
  if (!rows.length) return []

  const bySection = new Map<string, GmEvaluationHubAssignmentApiRow[]>()
  for (const r of rows) {
    const sid = String(r.sectionId ?? '').trim() || 'unknown'
    if (!bySection.has(sid)) bySection.set(sid, [])
    bySection.get(sid)!.push(r)
  }

  const branches: GmEvalPmBranch[] = []
  for (const [sectionId, sectionRows] of bySection) {
    const head = sectionRows[0]!
    const sectionName = head.sectionName?.trim() || 'Khối'
    const mgrId = String(head.sectionManagerId ?? '').trim()
    const mgrName = head.sectionManagerFullName?.trim() || 'PM khối'
    const brokerId = `hub-${sectionId}`

    if (!mgrId) {
      const pm = buildUserMember([], `pm-${sectionId}`, mgrName, 'PM', brokerId, 'PM')
      const directMembers = groupRowsByUserId(sectionRows, brokerId)
      for (const m of directMembers) {
        if (!m.projectIds.includes(brokerId)) m.projectIds = [...m.projectIds, brokerId]
      }
      if (!pm.projectIds.includes(brokerId)) pm.projectIds = [...pm.projectIds, brokerId]
      branches.push({
        pm,
        leaders: [],
        directMembers,
        sectionId: sectionId === 'unknown' ? undefined : sectionId,
        sectionName,
      })
      continue
    }

    const pmRows = sectionRows.filter((r) => String(r.userId) === mgrId)
    const otherRows = sectionRows.filter((r) => String(r.userId) !== mgrId)

    const pm = buildUserMember(
      pmRows.length ? pmRows : [],
      mgrId,
      mgrName,
      pmRows.length ? roleLabelFromRow(pmRows[0], 'PM') : 'PM',
      brokerId,
      'PM',
    )

    const directRows = otherRows.filter((r) => {
      const sup = String(r.assigneeSupervisorId ?? '').trim()
      return !sup || sup === mgrId
    })
    const ledRows = otherRows.filter((r) => {
      const sup = String(r.assigneeSupervisorId ?? '').trim()
      return Boolean(sup) && sup !== mgrId
    })

    const bySup = new Map<string, GmEvaluationHubAssignmentApiRow[]>()
    for (const r of ledRows) {
      const sup = String(r.assigneeSupervisorId!).trim()
      if (!bySup.has(sup)) bySup.set(sup, [])
      bySup.get(sup)!.push(r)
    }

    const leaders: GmEvalLeaderBranch[] = []
    for (const [supId, supMemberRows] of bySup) {
      const supName =
        supMemberRows[0]?.assigneeSupervisorFullName?.trim() ||
        `Supervisor ${supId.slice(0, 8)}`
      const leaderOwn = sectionRows.filter((r) => String(r.userId) === supId)
      const sheet = buildUserMember(
        leaderOwn,
        supId,
        supName,
        leaderOwn.length ? roleLabelFromRow(leaderOwn[0], 'LEADER') : 'LEADER',
        brokerId,
        'LEADER',
      )
      const members = groupRowsByUserId(
        supMemberRows.filter((r) => String(r.userId) !== supId),
        brokerId,
      )
      for (const m of members) {
        if (!m.projectIds.includes(brokerId)) m.projectIds = [...m.projectIds, brokerId]
      }
      leaders.push({
        leaderKey: `${sectionId}::${supId}`,
        sheet,
        members,
      })
    }

    const leaderIds = new Set(bySup.keys())
    const actualDirectRows = directRows.filter((r) => !leaderIds.has(String(r.userId)))
    const directMembers = groupRowsByUserId(actualDirectRows, brokerId)
    for (const m of directMembers) {
      if (!m.projectIds.includes(brokerId)) m.projectIds = [...m.projectIds, brokerId]
    }
    if (!pm.projectIds.includes(brokerId)) pm.projectIds = [...pm.projectIds, brokerId]

    branches.push({
      pm,
      leaders,
      directMembers,
      sectionId: sectionId === 'unknown' ? undefined : sectionId,
      sectionName,
    })
  }

  return branches
}
