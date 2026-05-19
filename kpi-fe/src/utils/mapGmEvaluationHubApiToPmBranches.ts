import type {
  GmEvalLeaderBranch,
  GmEvalMember,
  GmEvalPmBranch,
  GmEvidenceTable,
  GmEmployeeSheetStatus,
  GmKpiGroup,
  GmKpiItem,
} from '@/types/gm-employee-evaluation'
import type { GmEvaluationHubApiResponse, GmEvaluationHubAssignmentApiRow } from '@/types/gm-evaluation-hub-api'
import { codesFromPersistedCalculationMethod } from '@/utils/kpiCalculationCodes'
import { isRecordStyleCalcRule, parsePmPortfolioEvidenceString } from '@/utils/memberKpiHelpers'

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

function parseReviewScore(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  if (n >= 1 && n <= 5) return Math.round(n)
  if (n > 5 && n <= 100) return Math.min(5, Math.max(1, Math.round(n / 20)))
  return null
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
    const commentRaw = r.comment ?? r.note
    const commentStr = typeof commentRaw === 'string' ? commentRaw.trim() : ''
    const label = commentStr 
    rows.push([
      label,
      `Plan: ${evidenceJsonCell(plan)} · Actual: ${evidenceJsonCell(actual)}`,
    ])
  })
}

function planActualEvidenceRowsFromObject(o: Record<string, unknown>): string[][] {
  const rows: string[][] = []
  const records = o.planActualRecords
  if (!Array.isArray(records) || records.length === 0) return rows

  records.forEach((rec) => {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      const fallback = evidenceJsonCell(rec).trim()
      if (fallback) rows.push([fallback, '', ''])
      return
    }
    const r = rec as Record<string, unknown>
    const content = evidenceJsonCell(r.content ?? r.comment ?? r.note ?? '').trim()
    const plan = evidenceJsonCell(r.plan ?? r.total ?? '').trim()
    const actual = evidenceJsonCell(r.actual ?? r.completed ?? '').trim()
    rows.push([content, plan, actual])
  })

  const contentNorm =
    typeof o.content === 'string'
      ? o.content.trim()
      : typeof o.text === 'string'
        ? o.text.trim()
        : ''
  if (contentNorm) rows.push([contentNorm, '', ''])

  const noteNorm = typeof o.note === 'string' ? o.note.trim() : ''
  if (noteNorm) rows.push([noteNorm, '', ''])

  const appendAttachmentRows = (arr: unknown, groupLabel: string) => {
    if (!Array.isArray(arr) || arr.length === 0) return
    arr.forEach((item, i) => {
      if (typeof item === 'string') {
        const s = item.trim()
        if (s) rows.push([`${groupLabel} #${i + 1}`, '', s])
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
        rows.push([name, '', url || evidenceJsonCell(item)])
        return
      }
      rows.push([`${groupLabel} #${i + 1}`, '', evidenceJsonCell(item)])
    })
  }
  appendAttachmentRows(o.evd, 'Evidence files')
  appendAttachmentRows(o.files, 'File')
  appendAttachmentRows(o.urls, 'URL')

  return rows
}

function normalizeCalcRuleCode(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

function rowCalcRuleCode(row: GmEvaluationHubAssignmentApiRow): number | null {
  const fromExplicit = normalizeCalcRuleCode(
    row.calculationRuleCode ?? row.calcRuleCode ?? row.calculation_rule_code,
  )
  if (fromExplicit != null) return fromExplicit

  const persisted =
    typeof row.calculationMethod === 'string' && row.calculationMethod.trim()
      ? row.calculationMethod.trim()
      : typeof row.calculation_method === 'string' && row.calculation_method.trim()
        ? row.calculation_method.trim()
        : ''
  if (!persisted) return null
  return codesFromPersistedCalculationMethod(persisted).calculationRuleCode
}

function isImplicitCommentRuleRows(rows: string[][]): boolean {
  if (!rows.length) return false
  const hasAnyActual = rows.some((r) => String(r[2] ?? '').trim() !== '')
  if (!hasAnyActual) return false
  const hasAnyPlan = rows.some((r) => String(r[1] ?? '').trim() !== '')
  return !hasAnyPlan
}

function parseEvidenceObject(raw: string): Record<string, unknown> | null {
  if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) return null
  try {
    const j = JSON.parse(raw) as unknown
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      return j as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

/**
 * Chuỗi hóa JSON `kpi_assignments.evidences` (JSONB) cho drawer GM —
 * hỗ trợ `evd`, `files`, `urls`, `note`, `text`, `result`, `planActualRecords` (đồng bộ kiểu member sheet).
 */
function evidenceRowsFromObject(o: Record<string, unknown>): string[][] {
  const rows: string[][] = []
  appendAttachmentArray(rows, o.evd, 'Evidence files')
  appendAttachmentArray(rows, o.files, 'File')
  appendAttachmentArray(rows, o.urls, 'URL')
  pushScalarField(rows, 'Note', o.note)

  const actualNorm =
    o.actual !== undefined && o.actual !== null
      ? evidenceJsonCell(o.actual).trim()
      : o.result !== undefined && o.result !== null
        ? evidenceJsonCell(o.result).trim()
        : ''
  if (actualNorm) rows.push(['Actual', actualNorm])

  const contentNorm =
    typeof o.content === 'string'
      ? o.content.trim()
      : typeof o.text === 'string'
        ? o.text.trim()
        : ''
  if (contentNorm) rows.push(['content', contentNorm])

  appendPlanActualRecords(rows, o.planActualRecords)

  const consumed = new Set([
    'evd',
    'files',
    'urls',
    'note',
    'actual',
    'content',
    'text',
    'result',
    'planActualRecords',
  ])
  for (const [k, v] of Object.entries(o)) {
    if (consumed.has(k)) continue
    if (k === 'leaderFeedback') {
      if (typeof v === 'string' && v.trim()) {
        rows.push(['Leader Feedback', v.trim()])
      }
      continue
    }
    if (k === 'waTimeRecords') {
      if (Array.isArray(v) && v.length > 0) {
        rows.push(['waTimeRecords', evidenceJsonCell(v)])
      }
      continue
    }
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && !v.trim()) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
  }
  return rows
}

/** Bảng Evidence từ `kpi_assignments.evidences` — dùng chung evaluation sheet & diagnostics drawer. */
export function evidenceTableFromEvidencesJson(
  evidences: string | null | undefined,
  calculationRuleCode?: number | null,
): GmEvidenceTable {
  const isCommentRule803 = isRecordStyleCalcRule(calculationRuleCode)
  const raw = String(evidences ?? '').trim()
  if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
    try {
      const j = JSON.parse(raw) as unknown
      if (Array.isArray(j)) {
        return {
          title: 'Evidence / JSON',
          icon: 'fas fa-file-code',
          accent: 'indigo',
          headers: ['#', 'Item'],
          rows: j.map((x, i) => [String(i + 1), typeof x === 'string' ? x : evidenceJsonCell(x)]),
        }
      }
      if (j && typeof j === 'object') {
        const o = j as Record<string, unknown>
        const planActualRows = planActualEvidenceRowsFromObject(o)
        if (planActualRows.length > 0) {
          const hidePlanCol = isCommentRule803 || isImplicitCommentRuleRows(planActualRows)
          const rows = hidePlanCol
            ? planActualRows.map((r) => [r[0] ?? '', r[2] ?? ''])
            : planActualRows
          return {
            title: 'Evidence',
            icon: 'fas fa-paperclip',
            accent: 'emerald',
            headers: hidePlanCol ? ['Content', 'Actual'] : ['Content', 'Plan', 'Actual'],
            rows,
          }
        }
        const rows = evidenceRowsFromObject(o)
        return {
          title: 'Evidence',
          icon: 'fas fa-paperclip',
          accent: 'emerald',
          headers: ['Key', 'Value'],
          rows,
        }
      }
    } catch {
      /* fall through */
    }
  }
  const fallbackRows: string[][] = []
  if (raw) {
    fallbackRows.push(['content', raw])
  }
  return {
    title: 'Evidence',
    icon: 'fas fa-paperclip',
    accent: 'emerald',
    headers: ['Key', 'Value'],
    rows: fallbackRows,
  }
}

function evidenceFromRow(row: GmEvaluationHubAssignmentApiRow): GmEvidenceTable {
  return evidenceTableFromEvidencesJson(row.evidences, rowCalcRuleCode(row))
}

function toKpiItem(row: GmEvaluationHubAssignmentApiRow, index: number): GmKpiItem {
  const code = (row.masterCode ?? '').trim()
  const name = (row.masterName ?? '').trim()
  const title = [code, name].filter(Boolean).join(' · ') || `KPI ${index + 1}`
  const evidenceObject = parseEvidenceObject(String(row.evidences ?? '').trim())
  const calcRuleCode = rowCalcRuleCode(row)
  const parsedEvidences = parsePmPortfolioEvidenceString(row.evidences)
  const gmComment =
    evidenceObject && typeof evidenceObject.gmComment === 'string'
      ? evidenceObject.gmComment.trim()
      : ''
  return {
    id: String(row.assignmentId),
    index: index + 1,
    title,
    /** Không gán mô tả target JSON dài vào drawer — chỉ hiển thị tiêu đề KPI (UI GM). */
    target: '',
    weight: parseWeight(row),
    calcRuleCode,
    evidenceButtonLabel: 'Evidence',
    evidenceButtonIcon: 'fas fa-file-alt',
    evidenceTone: 'blue',
    selfScore: parseSelfScore(row),
    // pmScore = điểm GM đã lưu; pmSeedScore = GM ?? PM (seed dropdown + fallback cột Supervisor Score khi chưa có GM).
    pmScore: parseReviewScore(row.endGmScore),
    pmSeedScore: parseReviewScore(row.endGmScore) ?? parseReviewScore(row.endPmScore),
    evidence: evidenceFromRow(row),
    evidenceData: parsedEvidences.rows,
    evidenceContent:
      parsedEvidences.content || parsedEvidences.note || parsedEvidences.legacyPlain || '',
    evidenceAttachments: parsedEvidences.attachments ?? [],
    gmComment,
    hubAssignmentStatusCode:
      typeof row.statusCode === 'number' && Number.isFinite(row.statusCode)
        ? row.statusCode
        : null,
    assignmentStatusDisplay: asmProgressLabel(row) || null,
  }
}

function hubSummaryFieldFromRows(
  rows: GmEvaluationHubAssignmentApiRow[],
  key:
    | 'evaluationComments'
    | 'evaluationCommentsPromotion'
    | 'supervisorCommentPortfolio'
    | 'supervisorCommentPromotion',
): string {
  for (const row of rows) {
    const s = String(row[key] ?? '').trim()
    if (s) return s
  }
  return ''
}

function isPromotionAssignmentRow(row: GmEvaluationHubAssignmentApiRow): boolean {
  return /\bpromotion\b/i.test(String(row.kpiTypeName ?? '').trim())
}

function isRealAssignmentRow(row: GmEvaluationHubAssignmentApiRow): boolean {
  return Boolean(String(row.assignmentId ?? '').trim())
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
  const assignmentRows = rows.filter(isRealAssignmentRow)
  const promotionRows = assignmentRows.filter(isPromotionAssignmentRow)
  const nonPromotionRows = assignmentRows.filter((r) => !isPromotionAssignmentRow(r))
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
      groupTitle: 'Assigned KPIs (cycle)',
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
    employeeCommentPortfolio: hubSummaryFieldFromRows(rows, 'evaluationComments'),
    employeeCommentPromotion: hubSummaryFieldFromRows(rows, 'evaluationCommentsPromotion'),
    supervisorCommentPortfolio: hubSummaryFieldFromRows(rows, 'supervisorCommentPortfolio'),
    supervisorCommentPromotion: hubSummaryFieldFromRows(rows, 'supervisorCommentPromotion'),
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
    const sectionName = head.sectionName?.trim() || 'Section'
    const mgrId = String(head.sectionManagerId ?? '').trim()
    const mgrName = head.sectionManagerFullName?.trim() || 'Section PM'
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
