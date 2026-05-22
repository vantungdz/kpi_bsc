/**
 * Pure helper functions for Member KPI dashboard — no reactive state, no store deps.
 * Can be imported by any component or composable.
 */
import type { KpiItem, MemberKpiEvaluationStatus } from '@/types/kpi'
import { KPI_STATUS } from '@/config/constants'

// ── Calculation rule / type codes (mirrors sys_status_codes in DB) ──────────
export const CALC_RULE_SUM = 801
export const CALC_RULE_AVERAGE = 802
export const CALC_RULE_COMMENT = 803
export const CALC_TYPE_PLAN_OVER_ACTUAL = 702

/** 802 → Plan+Actual+Comment; 803/801 → Comment+Actual (nhiều record) */
export type EvidenceFormMode = 'average' | 'comment' | 'sum'

/** Layout nhiều dòng Comment + Actual (803 TB Actual, 801 tổng Actual). */
export function isRecordStyleFormMode(mode: EvidenceFormMode): boolean {
  return mode === 'comment' || mode === 'sum'
}

/** CALC_RULE 801/803 — layout Comment+Actual, roll-up tổng ở bảng PM/GM. */
export function isRecordStyleCalcRule(calculationRuleCode: unknown): boolean {
  const rule = normalizeCalculationRuleCode(calculationRuleCode)
  return rule === CALC_RULE_COMMENT || rule === CALC_RULE_SUM
}

export type PlanActualField = 'comment' | 'plan' | 'actual'

export function requiredPlanActualFields(mode: EvidenceFormMode): PlanActualField[] {
  return isRecordStyleFormMode(mode) ? ['comment', 'actual'] : ['comment', 'plan', 'actual']
}

export function planActualRowPartiallyFilled(
  row: { comment: string; plan: string; actual: string },
  fields: PlanActualField[],
): boolean {
  const vals = fields.map(f => String(row[f] ?? '').trim())
  return vals.some(v => v.length > 0) && vals.some(v => v.length === 0)
}

/** CALC_RULE 803 — trung bình cộng các giá trị Actual (số) trên nhiều record. */
export function averageActualNumeric(rows: Array<{ actual: string }>): number | null {
  const values = rows
    .map(r => parseNumericFromField(String(r.actual ?? '')))
    .filter((n): n is number => n != null)
  if (!values.length) return null
  return values.reduce((sum, x) => sum + x, 0) / values.length
}

export function averageActualResultDisplay(rows: Array<{ actual: string }>): string | undefined {
  const avg = averageActualNumeric(rows)
  if (avg == null) return undefined
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(2)
}

/** CALC_RULE 801 — tổng các giá trị Actual (số) trên nhiều record. */
export function sumActualNumeric(rows: Array<{ actual: string }>): number | null {
  const values = rows
    .map(r => parseNumericFromField(String(r.actual ?? '')))
    .filter((n): n is number => n != null)
  if (!values.length) return null
  return values.reduce((sum, x) => sum + x, 0)
}

export function sumActualResultDisplay(rows: Array<{ actual: string }>): string | undefined {
  const total = sumActualNumeric(rows)
  if (total == null) return undefined
  return Number.isInteger(total) ? String(total) : total.toFixed(2)
}

export function recordStyleMetricNumeric(
  mode: EvidenceFormMode,
  rows: Array<{ actual: string }>,
): number | null {
  if (mode === 'sum') return sumActualNumeric(rows)
  if (mode === 'comment') return averageActualNumeric(rows)
  return null
}

export function recordStyleResultDisplay(
  mode: EvidenceFormMode,
  rows: Array<{ actual: string }>,
): string | undefined {
  if (mode === 'sum') return sumActualResultDisplay(rows)
  if (mode === 'comment') return averageActualResultDisplay(rows)
  return undefined
}

/** Hiển thị cột Actual Result từ JSON evidences (Member/Leader table). */
export function formatActualResultFromEvidencesJson(
  evidencesJson: string | null | undefined,
  calcRule: number | null | undefined,
  calcType: number | null | undefined,
): string {
  if (!evidencesJson) return '-'
  try {
    const parsed = JSON.parse(evidencesJson) as Record<string, unknown>
    const rule = normalizeCalculationRuleCode(calcRule)
    const stored = String(parsed.actual ?? parsed.result ?? '').trim()
    if (rule === CALC_RULE_SUM || rule === CALC_RULE_COMMENT) {
      if (stored) return stored
    }
    const records = Array.isArray(parsed.planActualRecords)
      ? (parsed.planActualRecords as Array<{ plan?: string; actual?: string }>)
      : []
    if (records.length && rule === CALC_RULE_AVERAGE) {
      const values = records
        .map(r => computeRatioPreview(String(r.plan ?? ''), String(r.actual ?? ''), calcType))
        .filter((v): v is string => v !== null)
        .map(v => parseNumericFromField(v))
        .filter((n): n is number => n !== null)
      if (values.length) {
        const avg = values.reduce((s, x) => s + x, 0) / values.length
        return `${avg.toFixed(1)}%`
      }
    }
    if (records.length && rule === CALC_RULE_COMMENT) {
      const display = averageActualResultDisplay(
        records.map(r => ({ actual: String(r.actual ?? '') })),
      )
      if (display) return display
    }
    if (records.length && rule === CALC_RULE_SUM) {
      const display = sumActualResultDisplay(
        records.map(r => ({ actual: String(r.actual ?? '') })),
      )
      if (display) return display
    }
    const waRecords = Array.isArray(parsed.waTimeRecords)
      ? (parsed.waTimeRecords as Array<{ spent?: string }>)
      : []
    if (waRecords.length) {
      const totalSpent = waRecords.reduce((s, r) => s + (parseFloat(String(r.spent ?? '')) || 0), 0)
      if (totalSpent > 0) return `${totalSpent}h`
    }
    const note = String(parsed.note ?? parsed.content ?? '').trim()
    if (note) return note.length > 40 ? `${note.slice(0, 40)}…` : note
  } catch {
    /* ignore */
  }
  return '-'
}

export const WA_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}))

// ── Numeric parsing ──────────────────────────────────────────────────────────
/** Lấy số đầu tiên trong chuỗi (hỗ trợ "90%", "3.2 h", v.v.) */
export function parseNumericFromField(s: string): number | null {
  const m = s.trim().replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const v = Number.parseFloat(m[0])
  return Number.isFinite(v) ? v : null
}

/** Chỉ giữ ký tự hợp lệ khi gõ số nguyên / số thực không âm (một dấu thập phân). */
export function sanitizeNumericDecimalInput(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/,/g, '.').replace(/-/g, '').replace(/[^\d.]/g, '')
  const dotIdx = s.indexOf('.')
  if (dotIdx !== -1) {
    s = s.slice(0, dotIdx) + '.' + s.slice(dotIdx + 1).replace(/\./g, '')
  }
  return s
}

// ── Evidence form mode ───────────────────────────────────────────────────────
/** Chuẩn hóa mã rule từ API (number, string, BigDecimal JSON). */
export function normalizeCalculationRuleCode(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function resolveFormMode(item: KpiItem): EvidenceFormMode {
  const rule = normalizeCalculationRuleCode(item.calculationRuleCode)
  if (rule === CALC_RULE_SUM) return 'sum'
  if (rule === CALC_RULE_COMMENT) return 'comment'
  if (rule === CALC_RULE_AVERAGE) return 'average'
  return 'comment'
}

/** PM portfolio — parse chuỗi lưu ở assignment (JSON hoặc text thuần legacy). */
export type PmEvidencePlanRow = { plan: string; actual: string; comment: string; content: string }

/** Link/file đính kèm trong evidences (`files` = upload, `urls` = link; legacy `evd`). */
export type PmEvidenceAttachment = { url: string; name: string }

export function isUploadedEvidenceFileUrl(url: string): boolean {
  return /\/uploads\//i.test(String(url ?? '').trim())
}

function mapEvidencePair(x: unknown): PmEvidenceAttachment | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  const url = String(r.url ?? '').trim()
  if (!url) return null
  const name = String(r.name ?? r.fileName ?? '').trim()
  return { url, name: name || url }
}

function mapEvidencePairArray(arr: unknown): PmEvidenceAttachment[] {
  if (!Array.isArray(arr)) return []
  return arr.map(mapEvidencePair).filter((x): x is PmEvidenceAttachment => x != null)
}

/** Tách `files` (upload) và `urls` (link); dữ liệu cũ gộp trong `files` được chuyển sang `urls` nếu không phải upload. */
export function splitEvidenceFilesAndUrls(o: Record<string, unknown>): {
  files: PmEvidenceAttachment[]
  urls: PmEvidenceAttachment[]
} {
  const files: PmEvidenceAttachment[] = []
  const urls: PmEvidenceAttachment[] = []
  const seen = new Set<string>()

  const push = (target: PmEvidenceAttachment[], item: PmEvidenceAttachment) => {
    if (seen.has(item.url)) return
    seen.add(item.url)
    target.push(item)
  }

  for (const item of mapEvidencePairArray(o.files)) {
    if (isUploadedEvidenceFileUrl(item.url)) push(files, item)
    else push(urls, item)
  }
  for (const item of [...mapEvidencePairArray(o.urls), ...mapEvidencePairArray(o.evd)]) {
    push(urls, item)
  }
  return { files, urls }
}

export function mergeEvidenceAttachments(
  files: PmEvidenceAttachment[],
  urls: PmEvidenceAttachment[],
): PmEvidenceAttachment[] {
  const seen = new Set<string>()
  const out: PmEvidenceAttachment[] = []
  for (const a of [...files, ...urls]) {
    if (seen.has(a.url)) continue
    seen.add(a.url)
    out.push(a)
  }
  return out
}

function extractPmEvidenceAttachments(o: Record<string, unknown>): PmEvidenceAttachment[] {
  const { files, urls } = splitEvidenceFilesAndUrls(o)
  return mergeEvidenceAttachments(files, urls)
}

export type KpiSupervisorEvaluationCommentsOpts = {
  statusCode?: number | null
  pmScore?: number | null
  gmScore?: number | null
  pmEvaluationComment?: string | null
  gmEvaluationComment?: string | null
}

/** Nhận xét PM/GM theo KPI — `evidences.pmComment` / `evidences.gmComment` (legacy: chỉ `gmComment`). */
export function parseKpiSupervisorEvaluationComments(
  raw: string | null | undefined,
  opts?: KpiSupervisorEvaluationCommentsOpts,
): { pmComment: string; gmComment: string } {
  let pm = String(opts?.pmEvaluationComment ?? '').trim()
  let gm = String(opts?.gmEvaluationComment ?? '').trim()

  const trimmed = (raw ?? '').trim()
  if (trimmed) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>
      const jsonPm = typeof o.pmComment === 'string' ? o.pmComment.trim() : ''
      const jsonGm = typeof o.gmComment === 'string' ? o.gmComment.trim() : ''
      if (jsonPm) pm = jsonPm
      if (jsonGm) gm = jsonGm

      if (!jsonPm && jsonGm && !pm && !gm) {
        const legacy = jsonGm
        const sc = Number(opts?.statusCode)
        const hasGmScore =
          opts?.gmScore != null && Number.isFinite(Number(opts.gmScore))
        const hasPmScore =
          opts?.pmScore != null && Number.isFinite(Number(opts.pmScore))
        const waitingGm =
          sc === KPI_STATUS.FIRST_WAITING_GM_APPROVAL ||
          sc === KPI_STATUS.SECOND_WAITING_GM_APPROVAL
        const gmDone = (Number.isFinite(sc) && sc >= KPI_STATUS.COMPLETED) || hasGmScore

        if (gmDone) gm = legacy
        else if (waitingGm || (hasPmScore && !hasGmScore)) pm = legacy
        else gm = legacy
      }
    } catch {
      /* ignore */
    }
  }

  if (!pm && !gm) {
    const apiGm = String(opts?.gmEvaluationComment ?? '').trim()
    const apiPm = String(opts?.pmEvaluationComment ?? '').trim()
    if (apiPm) pm = apiPm
    else if (apiGm) {
      const sc = Number(opts?.statusCode)
      const hasGmScore =
        opts?.gmScore != null && Number.isFinite(Number(opts.gmScore))
      const hasPmScore =
        opts?.pmScore != null && Number.isFinite(Number(opts.pmScore))
      const waitingGm =
        sc === KPI_STATUS.FIRST_WAITING_GM_APPROVAL ||
        sc === KPI_STATUS.SECOND_WAITING_GM_APPROVAL
      const gmDone = (Number.isFinite(sc) && sc >= KPI_STATUS.COMPLETED) || hasGmScore
      if (gmDone) gm = apiGm
      else if (waitingGm || (hasPmScore && !hasGmScore)) pm = apiGm
      else gm = apiGm
    }
  }

  return { pmComment: pm, gmComment: gm }
}

export function parsePmPortfolioEvidenceString(raw: string | null | undefined): {
  rows: PmEvidencePlanRow[]
  content: string
  note: string
  legacyPlain: string
  attachments: PmEvidenceAttachment[]
} {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    return { rows: [], content: '', note: '', legacyPlain: '', attachments: [] }
  }
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    const attachments = extractPmEvidenceAttachments(o)
    const pr = o.planActualRecords
    if (Array.isArray(pr)) {
      const rows = pr.map((x) => {
        const r = (x ?? {}) as Record<string, unknown>
        const comment = String(r.comment ?? '')
        const content = String(r.content ?? '').trim() || comment
        return {
          plan: String(r.plan ?? ''),
          actual: String(r.actual ?? ''),
          comment,
          content,
        }
      })
      return {
        rows,
        content: typeof o.content === 'string' ? o.content : '',
        note: typeof o.note === 'string' ? o.note : '',
        legacyPlain: '',
        attachments,
      }
    }
    return {
      rows: [],
      content: typeof o.content === 'string' ? o.content : '',
      note: typeof o.note === 'string' ? o.note : '',
      legacyPlain: '',
      attachments,
    }
  } catch {
    return { rows: [], content: '', note: '', legacyPlain: trimmed, attachments: [] }
  }
}

/** Chuẩn hoá href cho link evidence (giữ path tuyệt đối `/api/...`). */
export function normalizeEvidenceHref(url: string): string {
  const internal = resolveEvidenceDownloadUrl(url)
  if (internal.startsWith('/api/uploads/')) return internal
  const u = url.trim()
  if (!u) return '#'
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u
  return `https://${u}`
}

/** Lấy tên file đã lưu trên server từ URL `/api/uploads/{uuid}.ext`. */
export function extractStoredEvidenceFileName(url: string): string | null {
  const u = url.trim()
  const m = u.match(/\/uploads\/([^/?#]+)/i)
  return m?.[1] ?? null
}

/**
 * Chuẩn hoá URL tải file nội bộ về cùng origin (tránh CORS khi DB lưu http://localhost:8081/...).
 */
export function resolveEvidenceDownloadUrl(url: string): string {
  const u = url.trim()
  if (!u) return '#'
  const pathMatch = u.match(/\/api\/uploads\/[^?#]+/i)
  if (pathMatch) return pathMatch[0]
  if (u.startsWith('/api/uploads/')) return u
  if (/^https?:\/\//i.test(u)) {
    try {
      const pathname = new URL(u).pathname
      const idx = pathname.indexOf('/api/uploads/')
      if (idx >= 0) return pathname.slice(idx)
    } catch {
      /* ignore */
    }
  }
  return u
}

export type EvidenceAttachmentRef = { url: string; name?: string }

/** Nhãn hiển thị: file upload → tên file; link ngoài → URL hoặc tên. */
export function evidenceAttachmentLabel(att: EvidenceAttachmentRef): string {
  const url = String(att.url ?? '').trim()
  const name = String(att.name ?? '').trim()
  if (isUploadedEvidenceFileUrl(url) && name) return name
  return name || url || 'evidence'
}

export function evidenceAttachmentTitle(att: EvidenceAttachmentRef): string {
  const url = String(att.url ?? '').trim()
  const name = String(att.name ?? '').trim()
  if (name && url && name !== url) return `${name} — ${url}`
  return url || name
}

/** File upload → tải xuống; link ngoài → mở tab mới. */
export async function activateEvidenceAttachment(att: EvidenceAttachmentRef): Promise<void> {
  const url = String(att.url ?? '').trim()
  if (!url) return
  if (isUploadedEvidenceFileUrl(url)) {
    await downloadEvidenceAttachment(url, evidenceAttachmentLabel(att))
    return
  }
  window.open(normalizeEvidenceHref(url), '_blank', 'noopener,noreferrer')
}

/** Tải file minh chứng (upload nội bộ hoặc URL ngoài). */
export async function downloadEvidenceAttachment(
  url: string,
  filename?: string,
): Promise<void> {
  const name = (filename ?? '').trim() || 'evidence'
  const storedName = extractStoredEvidenceFileName(url)

  if (storedName) {
    try {
      const token = localStorage.getItem('kpi_accessToken')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
      const downloadUrl =
        `${apiBase}/upload/download/${encodeURIComponent(storedName)}?as=${encodeURIComponent(name)}`
      const response = await fetch(downloadUrl, { headers })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = name
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      return
    } catch {
      // fallback: static file cùng origin
    }
  }

  const href = resolveEvidenceDownloadUrl(url)
  if (!href || href === '#') return

  const isInternalUpload = href.includes('/uploads/')

  if (isInternalUpload) {
    try {
      const token = localStorage.getItem('kpi_accessToken')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetch(href, { headers })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = name
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      return
    } catch {
      /* fallback below */
    }
  }

  const anchor = document.createElement('a')
  anchor.href = href.startsWith('/') ? href : normalizeEvidenceHref(href)
  anchor.download = name
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function isEvidenceImageUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)
}

/** `list` — nối từng % theo dòng; `mean` — TB % (802); `sum` — tổng Actual (801). */
export type PmPortfolioActualDisplayMode = 'list' | 'mean' | 'sum'

export function pmPortfolioActualDisplayMode(
  calculationRuleCode: unknown,
): PmPortfolioActualDisplayMode {
  const rule = normalizeCalculationRuleCode(calculationRuleCode)
  if (rule === CALC_RULE_AVERAGE) return 'mean'
  if (rule === CALC_RULE_SUM) return 'sum'
  return 'list'
}

function meanPercentFromRatioPreviewStrings(bits: string[]): string {
  const nums: number[] = []
  for (const b of bits) {
    const t = b.trim()
    const m = t.match(/^(\d+(?:\.\d+)?)\s*%$/i)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n)) nums.push(n)
      continue
    }
    const n = parseNumericFromField(t)
    if (n != null && Number.isFinite(n)) nums.push(n)
  }
  if (nums.length === 0) return bits.join(' · ')
  const avg = nums.reduce((a, c) => a + c, 0) / nums.length
  // Không giới hạn 100% — tỷ lệ KPI có thể >100% (vd 200% hoàn thành).
  const safe = Number.isFinite(avg) ? Math.max(0, avg) : 0
  return `${safe.toFixed(1)}%`
}

export type FormatPmPortfolioActualCellOpts = {
  /** Chỉ hiển thị khi có Actual thật — không dùng comment/note/plan làm thay thế. */
  actualOnly?: boolean
}

/** Tóm tắt một dòng cho cột Thực tế bảng PM (JSON hoặc text). */
export function formatPmPortfolioActualCell(
  raw: string | null | undefined,
  calculationTypeCode: number | null | undefined,
  displayMode: PmPortfolioActualDisplayMode = 'list',
  opts?: FormatPmPortfolioActualCellOpts,
): string {
  const actualOnly = opts?.actualOnly === true
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    const pr = o.planActualRecords
    if (Array.isArray(pr) && pr.length) {
      const rows = pr as Array<{ plan?: string; actual?: string }>
      const bits = rows
        .map((r) =>
          computeRatioPreview(String(r.plan ?? ''), String(r.actual ?? ''), calculationTypeCode),
        )
        .filter((b): b is string => Boolean(b))
      if (bits.length) {
        return displayMode === 'mean' ? meanPercentFromRatioPreviewStrings(bits) : bits.join(' · ')
      }
      const numericActuals = rows
        .map((r) => parseNumericFromField(String(r.actual ?? '')))
        .filter((n): n is number => n != null)
      if (numericActuals.length && !bits.length) {
        if (displayMode === 'sum') {
          const total = numericActuals.reduce((a, c) => a + c, 0)
          return Number.isInteger(total) ? String(total) : total.toFixed(2)
        }
        const avg = numericActuals.reduce((a, c) => a + c, 0) / numericActuals.length
        const avgStr = Number.isInteger(avg) ? String(avg) : avg.toFixed(2)
        return displayMode === 'mean' ? avgStr : avgStr
      }
      if (!actualOnly) {
        const texts = rows
          .map((r) => String(r.actual ?? r.plan ?? '').trim())
          .filter(Boolean)
        if (texts.length) return texts.slice(0, 2).join(' · ') + (texts.length > 2 ? '…' : '')
      }
    }
    // KPI 801/803: ưu tiên actual/result đã tổng hợp khi lưu drawer.
    const actual = String(o.actual ?? o.result ?? '').trim()
    if (actual) return actual
    if (!actualOnly) {
      const content = String(o.content ?? '').trim()
      if (content) return content
      const note = String(o.note ?? '').trim()
      if (note) return note
    }
  } catch {
    if (!actualOnly) return trimmed
  }
  return ''
}

/** Có ít nhất một giá trị Actual hợp lệ trong evidences (dùng roll-up node cha / validation). */
export function pmPortfolioHasActualInEvidences(
  raw: string | null | undefined,
  calculationTypeCode: number | null | undefined,
  displayMode: PmPortfolioActualDisplayMode = 'list',
): boolean {
  return (
    formatPmPortfolioActualCell(raw, calculationTypeCode, displayMode, {
      actualOnly: true,
    }).trim() !== ''
  )
}

/** Compute Actual/Plan or Plan/Actual ratio preview for a single record row */
export function computeRatioPreview(
  planStr: string,
  actualStr: string,
  calcTypeCode: number | null | undefined,
): string | null {
  const plan = parseNumericFromField(planStr)
  const actual = parseNumericFromField(actualStr)
  if (plan === null || actual === null || plan === 0) return null
  const ratio =
    calcTypeCode === CALC_TYPE_PLAN_OVER_ACTUAL
      ? (plan / actual) * 100
      : (actual / plan) * 100
  return ratio.toFixed(1) + '%'
}

/** Labels for Plan/Actual columns based on CALC_TYPE direction */
export function ratioLabels(calcTypeCode: number | null | undefined): {
  plan: string
  actual: string
  formula: string
} {
  if (calcTypeCode === CALC_TYPE_PLAN_OVER_ACTUAL) {
    return { plan: 'Plan (number)', actual: 'Actual (number)', formula: 'Plan / Actual × 100%' }
  }
  return { plan: 'Plan (number)', actual: 'Actual (number)', formula: 'Actual / Plan × 100%' }
}

// ── KPI guideline tooltips ───────────────────────────────────────────────────
export const MOCK_KPI_GUIDELINE_TOOLTIPS: Record<string, string> = {
  'A.1': `A.1 — For [Dev/QC]: Scoring guideline in PE template:
5 point: (Est. Effort/Act. Effort) is >= 120%
4 point: (Est. Effort/Act. Effort) is [110%, 120%)
3 point: (Est. Effort/Act. Effort) is [100%, 110%)
2 point: (Est. Effort/Act. Effort) is [80%, 100%)
1 point: (Est. Effort/Act. Effort) is < 80%

For [CS]: Scoring guideline in PE template`,

  'A.2': `A.2 — For [WAi]:
W5 point: AVG(WAi) >125%, no WAi<90%
4 point: AVG(WAi) >110%, no WAi<80%
3 point: AVG(WAi) >90%
2 point: AVG(WAi) >80%
1 point: AVG(WAi) <=80%
`,

  'A.3': `A.3 — For [IQi] - DEV:
5 point: No rework and Task Delivery >= 4
4 point: No UT-level bugs And No degradation and Task Delivery >= 3, (Rework [3%, 6.96%]: )
3 point: 2 And ( UT-level Bugs <5% And No degradation )
2 point: UT-level Bugs <10% And Degradation <3%
1 point: UT-level Bugs >=10% Or Degradation >= 3%

For [IQi] - QC:
5 point: No rework
4 point: No UT-level bugs And No degradation
3 point: 2 And (UT-level Bugs <5% And No degradation)
2 point: UT-level Bugs <10% And Degradation <3%
1 point: UT-level Bugs >=10% Or Degradation >= 3%`,

  'A.4': `A.4 — [CSi for new customer/project]
5 point: CES is >= 4.76, all items are 4 point or higher
4 point: CES is [4.2 , 4.76), all items are 3 point or higher
3 point: CES is [3.43 , 4.2), no item is 1 point
2 point: CES is [2.76 , 3.43)
1 point: CES is <2.76

[CSi for continuing customer/project]
5 point: Has items improved and No degradation and CES >=4.76
4 point: CES is [4.2 , 4.76), all items are 3 point or higher and No degradation
3 point: CES is [3.43 , 4.2), no item is 1 point and has under 2 items degraded (not related to Quality (1.Project and 3. Product) or Importance Ranking is 3)
2 point: has 2 items degraded
1 point: has 3 or more items degraded`,

  'A.5': `A.5 — For [TDi]:
5 point: Always ahead, no issues, Individual Quality >= 4
4 point: on time, has minor issues
3 point: on time, has major issues
2 point: late or have critical issues.
1 point: late and have critical issues.

For [TDi]- QC:
5 point: Always ahead, no issues, Individual Quality >= 4
4 point: on time, has minor issues, Individual Quality >= 3
3 point: on time, has major issues
2 point: late or have critical issues.
1 point: late and have critical issues.`,
}

export function kpiGuidelineTooltipKey(item: KpiItem): string | null {
  const c = item.code.trim().toUpperCase().replace(/\s+/g, '')
  if (c.startsWith('A.1') || c.startsWith('A1')) return 'A.1'
  if (c.startsWith('A.2')) return 'A.2'
  if (c.startsWith('A.3')) return 'A.3'
  if (c.startsWith('A.4')) return 'A.4'
  if (c.startsWith('A.5')) return 'A.5'
  return null
}

export function kpiTargetTooltip(item: KpiItem): string {
  const key = kpiGuidelineTooltipKey(item)
  if (key && MOCK_KPI_GUIDELINE_TOOLTIPS[key]) return MOCK_KPI_GUIDELINE_TOOLTIPS[key]
  const strip = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return strip(item.target) || '—'
}

export function targetBannerPlain(item: KpiItem): string {
  const strip = (s: string) => s.replace(/<[^>]*>/g, '').trim()
  return `${strip(item.target)}${item.description ? ` · ${item.description}` : ''}`
}

/** Hiển thị ka.target_value / ki.target_value trong drawer */
export function formatNumericTarget(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-'
  const n = Number(v)
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
}

/** Đồng bộ dropdown 1–5 với API (Double / string) */
export function normalizeDetailSelfScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  if (r < 1 || r > 5) return null
  return r
}

// ── Evidence case helpers ────────────────────────────────────────────────────
export function itemBlobText(item: KpiItem): string {
  return `${item.name} ${item.description ?? ''} ${item.target.replace(/<[^>]*>/g, '')}`
}

export function isMonthlyWorkAmountCase(item: KpiItem): boolean {
  const c = item.code.trim().toUpperCase().replace(/\s+/g, '')
  const blob = itemBlobText(item)
  if (c.startsWith('A.2')) return true
  if (/WORK\s*AMOUNT/i.test(blob)) return true
  if (item.evidenceFormCase === 'monthly') return true
  return false
}

export function isBLanguageCertificateKpi(item: KpiItem): boolean {
  const code = item.code.toUpperCase()
  const blob = itemBlobText(item)
  return code.includes('B.3') || /LANGUAGE|TOEIC|JLPT|CHỨNG CHỈ|NGOẠI NGỮ/i.test(blob)
}

// ── Evaluation status UI ─────────────────────────────────────────────────────
const MEMBER_EVAL_ALLOWED = new Set<MemberKpiEvaluationStatus>([
  'not_started',
  'pending_approval',
  'approved',
  'revision',
  'overdue',
  'feedback',
])

export const MEMBER_EVALUATION_STATUS_UI: Record<
  MemberKpiEvaluationStatus,
  { dot: string; chip: string; labelVi: string; labelEn: string }
> = {
  not_started: {
    dot: 'bg-slate-300 ring-2 ring-slate-100',
    chip: 'border-slate-200 bg-slate-50 text-slate-800',
    labelVi: 'Chưa đánh giá',
    labelEn: 'To Do',
  },
  pending_approval: {
    dot: 'bg-sky-500 ring-2 ring-sky-100',
    chip: 'border-sky-200 bg-sky-50 text-sky-900',
    labelVi: 'Chờ PM duyệt',
    labelEn: 'Pending Approval',
  },
  approved: {
    dot: 'bg-emerald-500 ring-2 ring-emerald-100',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    labelVi: 'Đã duyệt',
    labelEn: 'Approved',
  },
  revision: {
    dot: 'bg-orange-500 ring-2 ring-orange-100',
    chip: 'border-orange-200 bg-orange-50 text-orange-950',
    labelVi: 'Cần làm lại',
    labelEn: 'Revision',
  },
  overdue: {
    dot: 'bg-rose-600 ring-2 ring-rose-100',
    chip: 'border-rose-200 bg-rose-50 text-rose-950',
    labelVi: 'Quá hạn',
    labelEn: 'Overdue',
  },
  feedback: {
    dot: 'bg-violet-500 ring-2 ring-violet-100',
    chip: 'border-violet-200 bg-violet-50 text-violet-900',
    labelVi: 'Chờ PM kiểm tra feedback',
    labelEn: 'Feedback',
  },
}

export function toMemberKpiEvaluationStatus(
  raw: string | null | undefined,
): MemberKpiEvaluationStatus {
  if (raw && MEMBER_EVAL_ALLOWED.has(raw as MemberKpiEvaluationStatus))
    return raw as MemberKpiEvaluationStatus
  return 'not_started'
}

export function memberItemEvalStatus(item: KpiItem): MemberKpiEvaluationStatus {
  return toMemberKpiEvaluationStatus(
    item.evaluationStatus != null ? String(item.evaluationStatus) : undefined,
  )
}

export function memberEvalUi(s: MemberKpiEvaluationStatus) {
  return MEMBER_EVALUATION_STATUS_UI[s]
}

/** Badge cạnh tên KPI: chỉ To Do / Quá hạn / Revision */
export function memberShowsInlineEvalStatus(s: MemberKpiEvaluationStatus): boolean {
  return s === 'not_started' || s === 'overdue' || s === 'revision' || s === 'feedback'
}

export function memberEvaluationActionHint(s: MemberKpiEvaluationStatus): string {
  const m: Record<MemberKpiEvaluationStatus, string> = {
    not_started: 'Đánh giá ngay',
    overdue: 'Bổ sung gấp',
    revision: 'Cập nhật lại',
    pending_approval: 'Xem/Sửa',
    approved: 'Chi tiết',
    feedback: 'Chờ PM kiểm tra',
  }
  return m[s]
}
