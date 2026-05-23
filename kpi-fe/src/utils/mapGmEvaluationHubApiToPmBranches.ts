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
import {
  fallbackKpiUnitSelectOptions,
  formatKpiTargetWithUnit,
  KPI_UNIT_CODE,
} from '@/utils/kpiUnitCodes'
import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'
import {
  CALC_RULE_AVERAGE,
  CALC_RULE_SUM,
  formatNumericTarget,
  formatPmPortfolioActualCell,
  isRecordStyleCalcRule,
  normalizeCalculationRuleCode,
  parseNumericFromField,
  parsePmPortfolioEvidenceString,
  pmPortfolioActualDisplayMode,
} from '@/utils/memberKpiHelpers'
import { canSupervisorViewMemberSelfEvaluation } from '@/utils/memberEvaluationVisibility'

/** Ngữ cảnh suy đơn vị cho drawer đánh giá GM. */
export type GmDrawerUnitContext = {
  unitCode?: number | null
  unitName?: string | null
  calculationTypeCode?: number | null
  calcRuleCode?: number | null
  evidenceData?: Array<{ plan?: string; actual?: string }>
  evidencesJson?: string | null
}

function unitCodeFromUnitName(name: string | null | undefined): number | null {
  const raw = String(name ?? '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes('percent') || lower === '%') return KPI_UNIT_CODE.PERCENT
  for (const opt of fallbackKpiUnitSelectOptions()) {
    if (opt.label.toLowerCase() === lower || opt.value.toLowerCase() === lower) {
      return opt.unitCode
    }
  }
  return null
}

/** Suy `unit_code` khi API/DB thiếu — đồng bộ PM member drawer. */
export function resolveGmDrawerUnitCode(ctx: GmDrawerUnitContext): number | null {
  const direct = ctx.unitCode
  const n = typeof direct === 'number' ? direct : Number(direct)
  if (Number.isFinite(n) && n > 0) return Math.trunc(n)

  const fromName = unitCodeFromUnitName(ctx.unitName)
  if (fromName != null) return fromName

  return null
}

const BSC_GROUP_LABELS: Record<string, string> = {
  A: '(A) Core Operations & Technical Excellence',
  B: '(B) People Development & Knowledge Sharing',
  C: '(C) Strategic Management & Governance',
}

function categoryToGroupKey(categoryName: string): string {
  const t = categoryName.trim()
  if (!t) return 'Other'
  if (/^\(A\)|^A[\s.:)/-]/i.test(t) || /core operations/i.test(t)) return 'A'
  if (/^\(B\)|^B[\s.:)/-]/i.test(t) || /people development/i.test(t)) return 'B'
  if (/^\(C\)|^C[\s.:)/-]/i.test(t) || /strategic management/i.test(t)) return 'C'
  return t
}

function groupLabelForCategory(categoryName: string): string {
  const key = categoryToGroupKey(categoryName)
  return BSC_GROUP_LABELS[key] ?? (categoryName.trim() || 'Other')
}

function unitCodeFromTargetDescription(td: string | null | undefined): number | null {
  const raw = String(td ?? '').trim()
  if (!raw.startsWith('{')) return null
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const u = o.unitCode ?? o.unit_code
    const n = typeof u === 'number' ? u : Number(u)
    return Number.isFinite(n) ? Math.trunc(n) : null
  } catch {
    return null
  }
}

function parseHubNumericField(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function calculationTypeFromHubRow(row: GmEvaluationHubAssignmentApiRow): number | null {
  const raw = row.calculationTypeCode
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function hubRowUnitContext(row: GmEvaluationHubAssignmentApiRow): GmDrawerUnitContext {
  const raw = row.unitCode
  const n = typeof raw === 'number' ? raw : Number(raw)
  return {
    unitCode: Number.isFinite(n) && n > 0 ? Math.trunc(n) : unitCodeFromTargetDescription(row.targetDescription),
    unitName: row.unitName ?? null,
    calculationTypeCode: calculationTypeFromHubRow(row),
    calcRuleCode: rowCalcRuleCode(row),
    evidenceData: parsePmPortfolioEvidenceString(row.evidences).rows,
    evidencesJson: row.evidences ?? null,
  }
}

function unitCodeFromHubRow(row: GmEvaluationHubAssignmentApiRow): number | null {
  return resolveGmDrawerUnitCode(hubRowUnitContext(row))
}

function hubItemTargetRaw(row: GmEvaluationHubAssignmentApiRow): string {
  const tv = parseHubNumericField(row.targetValue)
  if (tv != null) return formatNumericTarget(tv)
  const rawInput = extractRawInputFromApiTargetDescription(row.targetDescription)
  const n = parseNumericFromField(rawInput)
  if (n != null) return formatNumericTarget(n)
  const t = rawInput.trim()
  return t || '-'
}

function hubItemTargetDisplay(row: GmEvaluationHubAssignmentApiRow): string {
  return formatKpiTargetWithUnit(hubItemTargetRaw(row), unitCodeFromHubRow(row))
}

/** Dùng chung drawer GM — gắn đơn vị cho target/actual (cột Plan trong Evidences không dùng). */
export function formatGmDrawerValueWithUnit(
  value: unknown,
  ctx: GmDrawerUnitContext,
): string {
  const text = String(value ?? '').trim() || '-'
  if (text === '-') return '-'
  return formatKpiTargetWithUnit(text, resolveGmDrawerUnitCode(ctx))
}

export function gmDrawerUnitContextFromItem(item: GmKpiItem): GmDrawerUnitContext {
  return {
    unitCode: item.unitCode ?? null,
    unitName: item.unitName ?? null,
    calculationTypeCode: item.calculationTypeCode ?? null,
    calcRuleCode: item.calcRuleCode ?? null,
    evidenceData: item.evidenceData,
    evidencesJson: null,
  }
}

/** Tổng hợp Actual dạng số — dùng khi đơn vị KPI không phải % (vd MM, Point). */
function hubItemActualNumericSummary(row: GmEvaluationHubAssignmentApiRow): string {
  const parsed = parsePmPortfolioEvidenceString(row.evidences)
  const rows = parsed.rows
  if (!rows.length) return '-'
  const nums = rows
    .map((r) => parseNumericFromField(String(r.actual ?? '')))
    .filter((n): n is number => n != null)
  if (!nums.length) {
    return '-'
  }
  const rule = rowCalcRuleCode(row)
  if (rule === CALC_RULE_SUM) {
    const total = nums.reduce((a, c) => a + c, 0)
    return formatNumericTarget(total)
  }
  const avg = nums.reduce((a, c) => a + c, 0) / nums.length
  return formatNumericTarget(avg)
}

function hubItemActualRaw(row: GmEvaluationHubAssignmentApiRow): string {
  const unitCtx = hubRowUnitContext(row)
  const unitCode = resolveGmDrawerUnitCode(unitCtx)
  if (unitCode != null && unitCode !== KPI_UNIT_CODE.PERCENT) {
    return hubItemActualNumericSummary(row)
  }
  const rule = rowCalcRuleCode(row)
  const calcType = calculationTypeFromHubRow(row)
  return (
    formatPmPortfolioActualCell(
      row.evidences,
      calcType,
      pmPortfolioActualDisplayMode(rule),
      { actualOnly: true },
    ) || '-'
  )
}

function buildKpiGroupsFromRows(
  rows: GmEvaluationHubAssignmentApiRow[],
  isPromotion: boolean,
): GmKpiGroup[] {
  const byCat = new Map<string, GmEvaluationHubAssignmentApiRow[]>()
  for (const r of rows) {
    const cat = (r.categoryName ?? '').trim() || 'Other'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(r)
  }
  const sortedCats = [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  return sortedCats.map((cat) => {
    const catRows = byCat.get(cat)!
    const groupKey = categoryToGroupKey(cat)
    const baseLabel = groupLabelForCategory(cat)
    return {
      groupKey,
      groupTitle: isPromotion ? `Promotion · ${baseLabel}` : baseLabel,
      items: catRows.map((r, i) => toKpiItem(r, i)),
    }
  })
}

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

/** GM có thể xác nhận đánh giá (501/601 bỏ qua PM, hoặc 502/602 sau PM). */
function gmApprovalActionEnabledFromRows(rows: GmEvaluationHubAssignmentApiRow[]): boolean {
  return rows.some((r) => {
    const c = Number(r.statusCode)
    return c === 501 || c === 502 || c === 601 || c === 602
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
  const statusCode =
    typeof row.statusCode === 'number' && Number.isFinite(row.statusCode)
      ? row.statusCode
      : null
  if (!canSupervisorViewMemberSelfEvaluation(statusCode, 'gm')) {
    return {
      title: 'Evidence',
      icon: 'fas fa-paperclip',
      accent: 'emerald',
      headers: [],
      rows: [],
    }
  }
  return evidenceTableFromEvidencesJson(row.evidences, rowCalcRuleCode(row))
}

function toKpiItem(row: GmEvaluationHubAssignmentApiRow, index: number): GmKpiItem {
  const code = (row.masterCode ?? '').trim()
  const name = (row.masterName ?? '').trim()
  const title = [code, name].filter(Boolean).join(' · ') || `KPI ${index + 1}`
  const statusCode =
    typeof row.statusCode === 'number' && Number.isFinite(row.statusCode)
      ? row.statusCode
      : null
  const gmCanViewMemberEval = canSupervisorViewMemberSelfEvaluation(statusCode, 'gm')
  const evidenceObject = gmCanViewMemberEval
    ? parseEvidenceObject(String(row.evidences ?? '').trim())
    : null
  const calcRuleCode = rowCalcRuleCode(row)
  const parsedEvidences = gmCanViewMemberEval
    ? parsePmPortfolioEvidenceString(row.evidences)
    : { rows: [], content: '', note: '', legacyPlain: '', attachments: [] }
  const unitCtx = hubRowUnitContext(row)
  const unitCode = resolveGmDrawerUnitCode(unitCtx)
  const calculationTypeCode = calculationTypeFromHubRow(row)
  const gmComment =
    evidenceObject && typeof evidenceObject.gmComment === 'string'
      ? evidenceObject.gmComment.trim()
      : ''
  const actualRaw = gmCanViewMemberEval ? hubItemActualRaw(row) : '-'
  return {
    id: String(row.assignmentId),
    index: index + 1,
    title,
    code,
    name: name || title,
    target: hubItemTargetDisplay(row),
    targetRaw: hubItemTargetRaw(row),
    actualRaw,
    actualResult: gmCanViewMemberEval
      ? formatGmDrawerValueWithUnit(actualRaw, unitCtx)
      : '-',
    unitCode,
    unitName: row.unitName ?? null,
    calculationTypeCode,
    statusCode:
      typeof row.statusCode === 'number' && Number.isFinite(row.statusCode)
        ? row.statusCode
        : null,
    statusDesc: asmProgressLabel(row) || undefined,
    weight: parseWeight(row),
    calcRuleCode,
    evidenceButtonLabel: 'Evidence',
    evidenceButtonIcon: 'fas fa-file-alt',
    evidenceTone: 'blue',
    selfScore: gmCanViewMemberEval ? parseSelfScore(row) : 0,
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
    creatorRoleCode:
      row.creatorRoleCode != null && String(row.creatorRoleCode).trim() !== ''
        ? String(row.creatorRoleCode).trim().toUpperCase()
        : undefined,
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
  const visible = items.filter((i) =>
    canSupervisorViewMemberSelfEvaluation(
      i.hubAssignmentStatusCode ?? i.statusCode,
      'gm',
    ),
  )
  if (!visible.length) return null
  const s = visible.reduce((a, i) => a + i.selfScore, 0) / visible.length
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
    groups.push(...buildKpiGroupsFromRows(nonPromotionRows, false))
  }

  if (promotionRows.length > 0) {
    groups.push(...buildKpiGroupsFromRows(promotionRows, true))
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
