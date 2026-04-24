<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import { useMemberKpiDraftStore } from '@/stores/member-kpi-drafts.store'
import type { MemberKpiDashboard, KpiItem, EvidenceFormCase, MemberKpiEvaluationStatus } from '@/types/kpi'
import MemberProcessTimeline from '@/components/member/MemberProcessTimeline.vue'
import CreateIndividualKpiDrawer, { type CreateIndividualKpiPayload } from '@/components/kpi/CreateIndividualKpiDrawer.vue'
import {
  parseWeightedPayload,
  buildWeightedPayload,
  parseCommentPayload,
  buildCommentPayload,
  parseWorkAmountPayload,
  buildWorkAmountPayload,
  type WeightedFormState,
  type UrlNamePair,
  type WorkAmountFormState,
} from '@/utils/memberKpiEvidenceDetail'

const route = useRoute()
const memberKpiDraftStore = useMemberKpiDraftStore()

/** Cách build JSON evidences — tách KPI thư viện (801–804 + workAmounts) vs sheet cũ. */
type EvidencePayloadKind = 'weighted' | 'comment' | 'workAmount_new' | 'legacy'

/** JSON đã lưu dạng workAmounts — ưu tiên trước calculationRuleCode (tránh A.2a gán nhầm 804 trong DB). */
function jsonHasWorkAmountsData(jsonSource: string): boolean {
  const raw = jsonSource.trim()
  if (!raw || raw === '{}' || raw === 'null') return false
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!Array.isArray(o.workAmounts) || o.workAmounts.length === 0) return false
    return true
  } catch {
    return false
  }
}

function resolveEvidencePayloadKind(item: KpiItem, jsonSource: string): EvidencePayloadKind {
  if (jsonHasWorkAmountsData(jsonSource)) return 'workAmount_new'

  const code = item.calculationRuleCode
  if (code === 804) return 'weighted'
  if (code === 803) return 'comment'
  const raw = jsonSource.trim()
  if (raw && raw !== '{}' && raw !== 'null') {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(o.workAmounts)) return 'workAmount_new'
    } catch {
      /* ignore */
    }
  }
  if (code === 801 || code === 802) {
    if (isMonthlyWaTimesheetKpi(item)) return 'workAmount_new'
  }
  return 'legacy'
}

function urlPairsToPendingUrls(pairs: UrlNamePair[], idPrefix: string): PendingEvidenceUrl[] {
  return pairs
    .map(p => {
      const u = String(p.url ?? '').trim()
      if (!u) return null
      const ref = normalizeEvidenceReference(u)
      if (!ref || !isValidEvidenceReference(ref)) return null
      const name = String(p.name ?? '').trim()
      const row: PendingEvidenceUrl = {
        id: `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`,
        url: ref,
      }
      if (name) row.name = name
      return row
    })
    .filter((x): x is PendingEvidenceUrl => x != null)
}

function hydrateWorkAmountDrawerFromParsed(item: KpiItem, jsonSource: string) {
  const parsed = parseWorkAmountPayload(jsonSource)
  const raw = jsonSource.trim()
  const hasJson = raw !== '' && raw !== '{}' && raw !== 'null'
  const hasHours = parsed.workAmounts.some(
    w => (Number(w.spentHours) || 0) !== 0 || (Number(w.standardHours) || 0) !== 0,
  )
  if (hasJson && hasHours) {
    waTimeRows.value = parsed.workAmounts
      .filter(w => (Number(w.spentHours) || 0) !== 0 || (Number(w.standardHours) || 0) !== 0)
      .map((w, i) => ({
        id: `${item.id}-wm-${i}`,
        month: String(w.month),
        spent: String(Number(w.spentHours) || 0),
        standard: String(Number(w.standardHours) || 0),
      }))
    if (!waTimeRows.value.length) waTimeRows.value = [newWaTimeRow()]
  } else if (item.waTimeRecords?.length) {
    waTimeRows.value = item.waTimeRecords.map((r, i) => ({
      id: `${item.id}-w-${i}`,
      month: (() => {
        const m = Number.parseInt(String((r as { month?: string }).month ?? '1'), 10)
        return m >= 1 && m <= 12 ? String(m) : '1'
      })(),
      spent: r.spent,
      standard: r.standard,
    }))
  } else {
    waTimeRows.value = [newWaTimeRow()]
  }
  evidenceNoteDraft.value = parsed.note || item.evidenceNote || ''
  pendingEvidenceUrls.value = urlPairsToPendingUrls(parsed.files, `${item.id}-f`)
}

function attachCertificateIfNeeded(payload: Record<string, unknown>) {
  const cert = certificateOutcomeDraft.value.trim()
  if (cert) payload.certificateOutcomeNote = cert
}

/** Tooltip Target — mock theo mã KPI (không dùng description từ API) */
const MOCK_KPI_GUIDELINE_TOOLTIPS: Record<string, string> = {
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

function kpiGuidelineTooltipKey(item: KpiItem): string | null {
  const c = item.code.trim().toUpperCase().replace(/\s+/g, '')
  if (c.startsWith('A.1') || c.startsWith('A1')) return 'A.1'
  if (c.startsWith('A.2')) return 'A.2'
  if (c.startsWith('A.3')) return 'A.3'
  if (c.startsWith('A.4')) return 'A.4'
  if (c.startsWith('A.5')) return 'A.5'
  return null
}

// ── Evidence drawer (đa case - giống mock HTML) ────────────────────────────────
function itemBlobText(item: KpiItem): string {
  return `${item.name} ${item.description ?? ''} ${item.target.replace(/<[^>]*>/g, '')}`
}

/** A.2a + Work Amount: layout timesheet (monthly) — không dùng \\bWA\\b trong blob (dễ trùng chữ trong mô tả A.1…) */
function isMonthlyWorkAmountCase(item: KpiItem): boolean {
  const c = item.code.trim().toUpperCase().replace(/\s+/g, '')
  const blob = itemBlobText(item)
  if (c.startsWith('A.2')) return true
  if (/WORK\s*AMOUNT/i.test(blob)) return true
  if (item.evidenceFormCase === 'monthly') return true
  return false
}

/** KPI nhóm B - chứng chỉ ngoại ngữ: khối mô tả thực tế (trước đây upload_only) */
function isBLanguageCertificateKpi(item: KpiItem): boolean {
  const code = item.code.toUpperCase()
  const blob = itemBlobText(item)
  return code.includes('B.3') || /LANGUAGE|TOEIC|JLPT|CHỨNG CHỈ|NGOẠI NGỮ/i.test(blob)
}

function resolveEvidenceCase(item: KpiItem): EvidenceFormCase {
  if (item.group === 'B') return 'category_b'
  if (item.evidenceFormCase === 'upload_only') return 'upload_only'
  if (isMonthlyWorkAmountCase(item)) return 'monthly'
  return 'general'
}

function formatEvidenceJsonSummary(item: KpiItem): string | undefined {
  const jsonSource = memberKpiDraftStore.getDraft(item.id)?.evidencesJson ?? item.evidencesJson
  const raw = String(jsonSource ?? '').trim()
  if (!raw || raw === '{}' || raw === 'null') return undefined

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const note = String(parsed.note ?? parsed.text ?? '').trim()
    const result = String(parsed.result ?? '').trim()
    const planActualRecords = Array.isArray(parsed.planActualRecords)
      ? (parsed.planActualRecords as unknown[])
          .map((row) => {
            if (!row || typeof row !== 'object') return undefined
            const r = row as Record<string, unknown>
            return String(r.actual ?? '').trim()
          })
          .filter(Boolean)
      : []
    const evdNames = Array.isArray(parsed.evd)
      ? (parsed.evd as unknown[])
          .map((row) => {
            if (!row || typeof row !== 'object') return undefined
            const r = row as Record<string, unknown>
            return String(r.name ?? '').trim() || String(r.url ?? '').trim()
          })
          .filter(Boolean)
      : []

    if (item.group === 'B') {
      if (note) return note.length > 64 ? `${note.slice(0, 63)}…` : note
    }

    if (result) return result
    if (planActualRecords.length) return planActualRecords.join(' | ')
    if (note) return note
    if (evdNames.length) return evdNames.join(', ')
  } catch {
    // fallback to other fields when JSON parsing fails
  }
  return undefined
}

function formatKpiActualResult(item: KpiItem): string {
  const evidenceDisplay = formatEvidenceJsonSummary(item)
  if (evidenceDisplay) return evidenceDisplay

  if (item.group === 'B') {
    const c = item.evidenceNote?.trim()
    if (!c) return '-'
    return c.length > 64 ? `${c.slice(0, 63)}…` : c
  }

  const r = item.result?.toString().trim()
  return r || '-'
}

/** Mã KPI dạng A.2x (A.2a, A.2, …) */
function isA2MonthlyKpi(item: KpiItem): boolean {
  const c = item.code.trim().toUpperCase().replace(/\s+/g, '')
  return c.startsWith('A.2')
}

/** Layout monthly: A.2* hoặc Work Amount (WA) - form Spent / Standard, không có cột dự án */
function isMonthlyWaTimesheetKpi(item: KpiItem): boolean {
  if (isA2MonthlyKpi(item)) return true
  const blob = itemBlobText(item)
  return /WORK\s*AMOUNT/i.test(blob)
}

/** Tooltip cột Target: mock guideline theo mã A.1–A.5; các KPI khác chỉ dùng target (plain) */
function kpiTargetTooltip(item: KpiItem): string {
  const key = kpiGuidelineTooltipKey(item)
  if (key && MOCK_KPI_GUIDELINE_TOOLTIPS[key]) return MOCK_KPI_GUIDELINE_TOOLTIPS[key]
  const strip = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return strip(item.target) || '—'
}

type PlanActualDraftRow = { id: string; plan: string; actual: string }

function newPlanActualRow(): PlanActualDraftRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    plan: '',
    actual: '',
  }
}

/** Lấy số đầu tiên trong chuỗi (hỗ trợ "90%", "3.2 h", v.v.) */
function parseNumericFromField(s: string): number | null {
  const m = s.trim().replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const v = Number.parseFloat(m[0])
  return Number.isFinite(v) ? v : null
}

/** Nối các giá trị Thực tế (Actual) đã nhập - hiển thị cột Actual Result */
function joinActualResultTexts(records: { actual: string }[]): string | undefined {
  const parts = records.map(r => r.actual.trim()).filter(Boolean)
  if (!parts.length) return undefined
  return parts.join(' | ')
}

type WaTimeDraftRow = { id: string; month: string; spent: string; standard: string }

const WA_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}))

function newWaTimeRow(): WaTimeDraftRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    month: '1',
    spent: '',
    standard: '',
  }
}

function sumWaNumeric(rows: WaTimeDraftRow[], key: 'spent' | 'standard'): number {
  let s = 0
  for (const r of rows) {
    const v = parseNumericFromField(r[key])
    if (v !== null) s += v
  }
  return s
}

/** Tổng Spent ÷ tổng Standard (KPI A.2 / monthly) */
function waTimeTotalsRatio(rows: WaTimeDraftRow[]): string | undefined {
  const sumSpent = sumWaNumeric(rows, 'spent')
  const sumStd = sumWaNumeric(rows, 'standard')
  if (sumStd === 0) return undefined
  return ((sumSpent / sumStd) * 100).toFixed(1) + '%'
}

function targetBannerPlain(item: KpiItem): string {
  const strip = (s: string) => s.replace(/<[^>]*>/g, '').trim()
  return `${strip(item.target)}${item.description ? ` · ${item.description}` : ''}`
}

/** Hiển thị ka.target_value / ki.target_value trong drawer */
function formatNumericTarget(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-'
  const n = Number(v)
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
}

/** Đồng bộ dropdown 1–5 với API (Double / string) */
function normalizeDetailSelfScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  if (r < 1 || r > 5) return null
  return r
}

/**
 * Không chỉnh evidence khi: KPI đề xuất chờ duyệt (402/403), hoặc đã nộp đợt (5xx/6xx).
 * README Flow 3 + Flow 5 — ASM từ init-db.sql.
 */
function isKpiWorkflowLocked(item: KpiItem): boolean {
  const c = item.statusCode
  if (c === undefined || c === null) return false
  return [402, 403, 501, 502, 503, 601, 602, 603].includes(c)
}

const EVIDENCE_MAX_FILES = 5
const EVIDENCE_MAX_URLS = 5
/** Bộ lọc hộp thoại chọn file; validate thêm bằng `isEvidenceFileAllowed` */
const EVIDENCE_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png'

type PendingEvidenceFile = { id: string; file: File }
type PendingEvidenceUrl = { id: string; url: string; name?: string }

const evidencePanelOpen = ref(false)
const selectedDrawerItem = ref<KpiItem | null>(null)
const evidenceNoteDraft = ref('')
/** KPI chứng chỉ: mô tả chứng chỉ thực tế nếu khác mục tiêu sheet */
const certificateOutcomeDraft = ref('')
const pendingEvidenceFiles = ref<PendingEvidenceFile[]>([])
const pendingEvidenceUrls = ref<PendingEvidenceUrl[]>([])
const evidenceUrlDraft = ref('')
const evidenceUploadHint = ref('')
const evidenceUrlHint = ref('')
/** Điểm tự đánh giá trong drawer (đồng bộ bảng Self Score sau khi Lưu Evidence) */
const detailSelfScore = ref<number | null>(null)
/** Bản ghi Plan / Actual trong drawer (layout general) */
const generalPlanActualRows = ref<PlanActualDraftRow[]>([newPlanActualRow()])

/** KPI monthly (A.2…): Spent time / Standard time */
const waTimeRows = ref<WaTimeDraftRow[]>([newWaTimeRow()])
/** Lỗi validate form Work Amount (tháng / Spent / Standard) */
const waFormError = ref('')

const canAddMoreWaRows = computed(() => {
  if (waTimeRows.value.length >= 12) return false
  const used = new Set(waTimeRows.value.map(r => r.month))
  return WA_MONTH_OPTIONS.some(m => !used.has(m.value))
})

function getWaMonthOptionsForRow(row: WaTimeDraftRow) {
  const usedElsewhere = new Set(
    waTimeRows.value.filter(r => r.id !== row.id).map(r => r.month),
  )
  return WA_MONTH_OPTIONS.filter(m => !usedElsewhere.has(m.value) || m.value === row.month)
}

function validateWaTimeRows(): string | null {
  const months = waTimeRows.value.map(r => r.month)
  if (new Set(months).size !== months.length) return 'Không được chọn trùng tháng giữa các dòng.'

  for (const r of waTimeRows.value) {
    if (!r.spent.trim() || !r.standard.trim()) {
      return `Tháng ${r.month}: vui lòng nhập đủ Spent time và Standard time.`
    }
    if (parseNumericFromField(r.spent) === null || parseNumericFromField(r.standard) === null) {
      return `Tháng ${r.month}: Spent và Standard phải là số hợp lệ.`
    }
  }
  if (sumWaNumeric(waTimeRows.value, 'standard') === 0) {
    return 'Tổng Standard time phải lớn hơn 0 để tính tỉ lệ (%).'
  }
  return null
}

watch(
  waTimeRows,
  () => {
    waFormError.value = ''
  },
  { deep: true },
)

const allowedEvidenceExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'jpg',
  'jpeg',
  'png',
])

const allowedEvidenceMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
])

function isEvidenceFileAllowed(file: File): boolean {
  const ext = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : ''
  if (ext && allowedEvidenceExtensions.has(ext)) return true
  return !!file.type && allowedEvidenceMimes.has(file.type)
}

function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onEvidenceFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!picked.length) return

  evidenceUploadHint.value = ''

  let slot = EVIDENCE_MAX_FILES - pendingEvidenceFiles.value.length
  if (slot <= 0) {
    evidenceUploadHint.value = `Đã đủ ${EVIDENCE_MAX_FILES} file. Xóa bớt để thêm file mới.`
    return
  }

  const rejected: string[] = []
  let truncated = false

  for (const file of picked) {
    if (slot <= 0) {
      truncated = true
      break
    }
    if (!isEvidenceFileAllowed(file)) {
      rejected.push(file.name)
      continue
    }
    pendingEvidenceFiles.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
    })
    slot--
  }

  const parts: string[] = []
  if (rejected.length)
    parts.push(`Loại file không hỗ trợ (chỉ PDF, Word, Excel, CSV, JPG, PNG): ${rejected.join(', ')}`)
  if (truncated)
    parts.push(`Chỉ được tối đa ${EVIDENCE_MAX_FILES} file; một số file chưa được thêm.`)
  if (parts.length) evidenceUploadHint.value = parts.join(' ')
}

function removePendingEvidenceFile(id: string) {
  pendingEvidenceFiles.value = pendingEvidenceFiles.value.filter(f => f.id !== id)
  if (pendingEvidenceFiles.value.length < EVIDENCE_MAX_FILES) {
    const h = evidenceUploadHint.value
    if (h.includes('Đã đủ') || h.includes('chưa được thêm') || h.includes('Một số file'))
      evidenceUploadHint.value = ''
  }
}

function normalizeEvidenceUrlInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Giữ đường dẫn gốc `/evidence/...` — không gắn `https://` (tránh `https:///path`). */
function normalizeEvidenceReference(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/')) return t
  return normalizeEvidenceUrlInput(t)
}

function isValidEvidenceHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Cho phép URL đầy đủ hoặc đường dẫn cùng site (bắt đầu bằng `/`). */
function isValidEvidenceReference(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (t.startsWith('/')) return true
  return isValidEvidenceHttpUrl(t)
}

function addPendingEvidenceUrl() {
  evidenceUrlHint.value = ''
  const normalized = normalizeEvidenceUrlInput(evidenceUrlDraft.value)
  if (!normalized) {
    evidenceUrlHint.value = 'Nhập URL (http hoặc https).'
    return
  }
  if (!isValidEvidenceHttpUrl(normalized)) {
    evidenceUrlHint.value = 'URL không hợp lệ. Ví dụ: https://drive.google.com/...'
    return
  }
  if (pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS) {
    evidenceUrlHint.value = `Tối đa ${EVIDENCE_MAX_URLS} URL. Xóa bớt để thêm.`
    return
  }
  if (pendingEvidenceUrls.value.some(x => x.url === normalized)) {
    evidenceUrlHint.value = 'URL này đã có trong danh sách.'
    return
  }
  pendingEvidenceUrls.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: normalized,
  })
  evidenceUrlDraft.value = ''
}

function removePendingEvidenceUrl(id: string) {
  pendingEvidenceUrls.value = pendingEvidenceUrls.value.filter(u => u.id !== id)
  if (pendingEvidenceUrls.value.length < EVIDENCE_MAX_URLS) {
    const h = evidenceUrlHint.value
    if (h.includes('Tối đa') || h.includes('đã có trong danh sách')) evidenceUrlHint.value = ''
  }
}

function onEvidenceUrlDraftKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addPendingEvidenceUrl()
  }
}

const drawerCase = computed<EvidenceFormCase>(() => {
  if (!selectedDrawerItem.value) return 'general'
  return resolveEvidenceCase(selectedDrawerItem.value)
})

const isUploadOnlyDrawer = computed(() => drawerCase.value === 'upload_only')

const canSaveEvidence = computed(() => {
  const s = detailSelfScore.value
  if (s === null || s < 1 || s > 5) return false
  if (selectedDrawerItem.value && isKpiWorkflowLocked(selectedDrawerItem.value)) return false
  return true
})

const canAddEvidenceRecords = computed(
  () => selectedDrawerItem.value && !isKpiWorkflowLocked(selectedDrawerItem.value),
)

/** Đã nộp KPI: chỉ xem, không lưu chỉnh sửa — vẫn mở được drawer */
const evidenceDrawerReadOnly = computed(
  () => !!(selectedDrawerItem.value && isKpiWorkflowLocked(selectedDrawerItem.value)),
)

const attachmentHubTitle = computed(() => {
  if (isUploadOnlyDrawer.value) return 'Chứng chỉ / Bằng cấp Đính kèm'
  if (drawerCase.value === 'category_b') return 'Minh chứng & Đính kèm'
  return 'Tài liệu Minh chứng Đính kèm (Bổ trợ)'
})

const hasEvidenceAttachments = computed(
  () => pendingEvidenceFiles.value.length > 0 || pendingEvidenceUrls.value.length > 0,
)

/** evd có `name` → hiển thị trong khối FILE (theo tên); cùng bản ghi vẫn có dòng URL riêng. */
const pendingEvidenceNamedRows = computed(() =>
  pendingEvidenceUrls.value.filter(r => (r.name ?? '').trim().length > 0),
)

const evidenceFileSectionCount = computed(
  () => pendingEvidenceFiles.value.length + pendingEvidenceNamedRows.value.length,
)

const hasFileAttachmentsSection = computed(
  () => pendingEvidenceFiles.value.length > 0 || pendingEvidenceNamedRows.value.length > 0,
)

const hasEvidenceUrlList = computed(() => pendingEvidenceUrls.value.length > 0)

function addGeneralPlanActualRow() {
  generalPlanActualRows.value.push(newPlanActualRow())
}

function removeGeneralPlanActualRow(id: string) {
  if (generalPlanActualRows.value.length <= 1) return
  generalPlanActualRows.value = generalPlanActualRows.value.filter(r => r.id !== id)
}

function addWaTimeRow() {
  if (!canAddMoreWaRows.value) return
  const used = new Set(waTimeRows.value.map(r => r.month))
  const free = WA_MONTH_OPTIONS.find(m => !used.has(m.value))
  if (!free) return
  const row = newWaTimeRow()
  row.month = free.value
  waTimeRows.value.push(row)
}

function removeWaTimeRow(id: string) {
  if (waTimeRows.value.length <= 1) return
  waTimeRows.value = waTimeRows.value.filter(r => r.id !== id)
}

function workAmountFormStateFromWaRows(): WorkAmountFormState {
  const acc = new Map<number, { spent: number; std: number }>()
  for (let m = 1; m <= 12; m++) acc.set(m, { spent: 0, std: 0 })
  for (const r of waTimeRows.value) {
    const m = Number.parseInt(String(r.month), 10)
    if (!Number.isFinite(m) || m < 1 || m > 12) continue
    const cur = acc.get(m) ?? { spent: 0, std: 0 }
    cur.spent += parseNumericFromField(r.spent) ?? 0
    cur.std += parseNumericFromField(r.standard) ?? 0
    acc.set(m, cur)
  }
  const workAmounts = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const v = acc.get(month)!
    return { month, spentHours: v.spent, standardHours: v.std }
  })
  const filePairs: UrlNamePair[] = pendingEvidenceUrls.value.map(u => ({
    url: u.url,
    name: (u.name ?? '').trim(),
  }))
  return {
    note: evidenceNoteDraft.value.trim(),
    workAmounts,
    files: filePairs.length ? filePairs : [{ url: '', name: '' }],
  }
}

function buildDrawerEvidencesPayload(item: KpiItem, kind: EvidencePayloadKind): Record<string, unknown> {
  if (kind === 'weighted') {
    const rows = generalPlanActualRows.value.map(({ plan, actual }) => ({ plan, actual }))
    const w: WeightedFormState = {
      text: evidenceNoteDraft.value.trim(),
      result: joinActualResultTexts(generalPlanActualRows.value.map(({ actual }) => ({ actual }))) ?? '',
      note: evidenceNoteDraft.value.trim(),
      planActualRecords: rows,
      evd: pendingEvidenceUrls.value.map(u => ({
        url: u.url,
        name: (u.name ?? '').trim(),
      })),
    }
    const out = buildWeightedPayload(w)
    attachCertificateIfNeeded(out)
    return out
  }
  if (kind === 'comment') {
    const out = buildCommentPayload({
      note: evidenceNoteDraft.value.trim(),
      files: pendingEvidenceUrls.value.map(u => ({
        url: u.url,
        name: (u.name ?? '').trim(),
      })),
    })
    attachCertificateIfNeeded(out)
    return out
  }
  if (kind === 'workAmount_new') {
    const out = buildWorkAmountPayload(workAmountFormStateFromWaRows())
    attachCertificateIfNeeded(out)
    return out
  }
  return buildMemberEvidencesPayload(item, resolveEvidenceCase(item))
}

function openEvidencePanel(item: KpiItem) {
  /* Flow 2 / 3 — BE từ chối PATCH nếu 404/402/403; chặn UI sớm */
  if (item.statusCode === 404 || item.statusCode === 402 || item.statusCode === 403) return
  selectedDrawerItem.value = item

  const draft = memberKpiDraftStore.getDraft(item.id)
  const jsonSource = draft?.evidencesJson ?? item.evidencesJson ?? ''
  detailSelfScore.value =
    draft?.selfScore != null && Number.isFinite(Number(draft.selfScore))
      ? Math.min(5, Math.max(1, Math.round(Number(draft.selfScore))))
      : normalizeDetailSelfScore(item.selfScore)

  certificateOutcomeDraft.value = item.certificateOutcomeNote ?? ''
  pendingEvidenceFiles.value = []
  evidenceUrlDraft.value = ''
  evidenceUploadHint.value = ''
  evidenceUrlHint.value = ''
  waFormError.value = ''

  const kind = resolveEvidencePayloadKind(item, jsonSource)

  if (kind === 'weighted') {
    const p = parseWeightedPayload(jsonSource)
    evidenceNoteDraft.value = p.note || p.text || item.evidenceNote || ''
    generalPlanActualRows.value =
      p.planActualRecords?.length
        ? p.planActualRecords.map((row, i) => ({
            id: `${item.id}-p-${i}`,
            plan: row.plan,
            actual: row.actual,
          }))
        : [newPlanActualRow()]
    pendingEvidenceUrls.value = urlPairsToPendingUrls(p.evd, `${item.id}-evd`)
    evidencePanelOpen.value = true
    return
  }

  if (kind === 'comment') {
    const p = parseCommentPayload(jsonSource)
    evidenceNoteDraft.value = p.note || item.evidenceNote || ''
    pendingEvidenceUrls.value = urlPairsToPendingUrls(p.files, `${item.id}-cf`)
    evidencePanelOpen.value = true
    return
  }

  if (kind === 'workAmount_new') {
    hydrateWorkAmountDrawerFromParsed(item, jsonSource)
    evidencePanelOpen.value = true
    return
  }

  evidenceNoteDraft.value = item.evidenceNote ?? ''
  const persisted = item.planActualRecords
  if (persisted?.length) {
    generalPlanActualRows.value = persisted.map((r, i) => ({
      id: `${item.id}-p-${i}`,
      plan: r.plan,
      actual: r.actual,
    }))
  } else {
    generalPlanActualRows.value = [newPlanActualRow()]
  }

  const waPersisted = item.waTimeRecords
  if (waPersisted?.length) {
    waTimeRows.value = waPersisted.map((r, i) => ({
      id: `${item.id}-w-${i}`,
      month: (() => {
        const m = Number.parseInt(String((r as { month?: string }).month ?? '1'), 10)
        return m >= 1 && m <= 12 ? String(m) : '1'
      })(),
      spent: r.spent,
      standard: r.standard,
    }))
  } else {
    waTimeRows.value = [newWaTimeRow()]
  }

  pendingEvidenceUrls.value = []
  evidencePanelOpen.value = true
}

function closeEvidencePanel() {
  evidencePanelOpen.value = false
  selectedDrawerItem.value = null
  certificateOutcomeDraft.value = ''
  detailSelfScore.value = null
  generalPlanActualRows.value = [newPlanActualRow()]
  waTimeRows.value = [newWaTimeRow()]
  waFormError.value = ''
  pendingEvidenceFiles.value = []
  pendingEvidenceUrls.value = []
  evidenceUrlDraft.value = ''
  evidenceUploadHint.value = ''
  evidenceUrlHint.value = ''
}

watch(evidencePanelOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function onEscapeClose(e: KeyboardEvent) {
  if (e.key === 'Escape' && evidencePanelOpen.value) closeEvidencePanel()
}

onUnmounted(() => {
  window.removeEventListener('keydown', onEscapeClose)
  document.body.style.overflow = ''
})

// ── State ──────────────────────────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const dashboardData = ref<MemberKpiDashboard | null>(null)
const selectedYear = ref(new Date().getFullYear())

const memberExtraSheetItems = ref<KpiItem[]>([])
const showCreateIndividualKpiDrawer = ref(false)

const PHASE_STEPS = [
  { key: 'target_setup', label: 'Target Setup', statusLabel: 'Approved' },
  { key: 'mid_year', label: 'Mid-Year Review', statusLabel: 'Approved' },
  { key: 'year_end', label: 'Final Evaluation', statusLabel: 'Self-Evaluating' },
]

// ── Data loading ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  loading.value = true
  memberExtraSheetItems.value = []
  try {
    dashboardData.value = await memberKpiService.getDashboard(selectedYear.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onEscapeClose)
  const qy = Number(route.query.year)
  if (Number.isFinite(qy)) selectedYear.value = qy
  loadDashboard()
})

// ── Computed ───────────────────────────────────────────────────────────────────
const sheet = computed(() => {
  const s = dashboardData.value?.sheet
  if (!s) return null
  if (!memberExtraSheetItems.value.length) return s
  const extraWeight = memberExtraSheetItems.value.reduce((a, b) => a + b.weight, 0)
  return {
    ...s,
    items: [...s.items, ...memberExtraSheetItems.value],
    totalWeight: s.totalWeight + extraWeight,
  }
})

const currentPhaseIndex = computed(() => {
  if (!dashboardData.value) return 2
  return PHASE_STEPS.findIndex(s => s.key === dashboardData.value!.phase)
})

/** Fallback header khi thiếu category từ API */
const legacySheetGroupLabels: Record<string, string> = {
  A: '(A) Hiệu suất, Cải tiến, Năng lực chuyên môn (Operational)',
  B: '(B) Mục tiêu đào tạo, chia sẻ & nâng cấp bản thân',
  C: '(C) Mục tiêu cấp quản lý (Management)',
  P: '(P) Định hướng thăng tiến - Promotion KPI (Direct Assignment)',
  I: '(I) Individual KPI (tự tạo)',
}

type KpiCategorySection = { key: string; headerLabel: string; items: KpiItem[] }

/** Nhóm theo kpi_categories (categoryId / categoryName từ API). */
function groupKpiItemsByCategory(items: KpiItem[]): KpiCategorySection[] {
  const map = new Map<string, { headerLabel: string; items: KpiItem[] }>()
  for (const item of items) {
    const key = item.categoryId?.trim() || `sheet-group-${item.group}`
    const headerLabel =
      (item.categoryName && item.categoryName.trim()) ||
      legacySheetGroupLabels[item.group] ||
      `Nhóm ${item.group}`
    const cur = map.get(key)
    if (!cur) map.set(key, { headerLabel, items: [item] })
    else cur.items.push(item)
  }
  return [...map.entries()].map(([key, v]) => ({ key, headerLabel: v.headerLabel, items: v.items }))
}

/** Bảng Personal KPI — không Promotion; header từ kpi_categories */
const personalGroupedSections = computed((): KpiCategorySection[] => {
  if (!sheet.value) return []
  return groupKpiItemsByCategory(sheet.value.items.filter(i => i.group !== 'P'))
})

/** Tab Promotion — cùng cách nhóm theo category */
const promotionGroupedSections = computed((): KpiCategorySection[] => {
  if (!sheet.value) return []
  return groupKpiItemsByCategory(sheet.value.items.filter(i => i.group === 'P'))
})

const promotionItemsFlat = computed(() => sheet.value?.items.filter(i => i.group === 'P') ?? [])

const promotionWeightSum = computed(() =>
  promotionItemsFlat.value.reduce((s, i) => s + i.weight, 0),
)

const promotionSelfWeightedAvg = computed((): number | null => {
  const rows = promotionItemsFlat.value.filter(i => i.selfScore !== null)
  if (!rows.length) return null
  let num = 0
  let den = 0
  for (const i of rows) {
    num += (i.selfScore ?? 0) * i.weight
    den += i.weight
  }
  return den ? num / den : null
})

const promotionPmWeightedAvg = computed((): number | null => {
  const rows = promotionItemsFlat.value.filter(i => i.pmScore !== null)
  if (!rows.length) return null
  let num = 0
  let den = 0
  for (const i of rows) {
    num += (i.pmScore ?? 0) * i.weight
    den += i.weight
  }
  return den ? num / den : null
})

/** README Flow 3 — POST /kpi/member/individual-kpi (ASM 402) */
async function onMemberIndividualKpiSaved(payload: CreateIndividualKpiPayload) {
  await memberKpiService.createIndividualKpi({
    cycleYear: payload.cycleYear,
    kpiName: payload.kpiName,
    description: payload.description?.trim() || undefined,
    weight: payload.weight,
    categoryId: payload.categoryId,
    calculationRuleCode: payload.calculationRuleCode,
  })
  await loadDashboard()
}

const isCurrentYear = computed(() => selectedYear.value === new Date().getFullYear())

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK: Trạng thái hạn tự đánh giá KPI - CHỈ ĐỂ DEMO UI
// Khi nối API: lấy deadline thật, tính daysLeft / isOverdue, xóa mockDeadlineUiMode & nút Test.
//
// 🟢 normal   - bình thường → không hiện banner
// 🟡 warning - gần đến hạn (còn ≤ N ngày; N lấy từ MOCK_WARNING_DAYS_LEFT khi mock)
// 🔴 overdue - đã quá hạn
//
// Đổi giá trị khởi tạo `mockDeadlineUiMode` hoặc bấm nút Test Vàng/Đỏ/Xanh trên banner.
// ═══════════════════════════════════════════════════════════════════════════════
type MockKpiDeadlineUiMode = 'normal' | 'warning' | 'overdue'

/** Trạng thái mock: đổi 'normal' | 'warning' | 'overdue' để xem 3 UI */
const mockDeadlineUiMode = ref<MockKpiDeadlineUiMode>('warning')

/** Số ngày còn lại (hiển thị khi mock = warning) - API thật: diff(today, deadline) */
const MOCK_WARNING_DAYS_LEFT = 3

/** true = hiện nút Test Vàng/Đỏ/Xanh; đặt false trước khi release nếu không cần */
const SHOW_MOCK_KPI_DEADLINE_UI_TOGGLES = true

type KpiDeadlineBannerVm = {
  kind: 'warning' | 'overdue'
  title: string
  subtitle?: string
  daysLeft?: number
  bgClass: string
  borderClass: string
  iconWrapClass: string
  titleClass: string
  subtitleClass: string
  ctaClass: string
  icon: string
}

const kpiDeadlineBanner = computed((): KpiDeadlineBannerVm | null => {
  const m = mockDeadlineUiMode.value
  if (m === 'normal') return null
  if (m === 'overdue') {
    return {
      kind: 'overdue',
      title: 'Đã quá hạn tự đánh giá KPI',
      subtitle:
        'Vui lòng hoàn tất tự đánh giá và nộp bảng KPI sớm nhất để PM/HR xử lý.',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      iconWrapClass: 'bg-rose-100 text-rose-600',
      titleClass: 'text-rose-900',
      subtitleClass: 'text-rose-800/95',
      ctaClass: 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700',
      icon: 'fas fa-exclamation-circle',
    }
  }
  return {
    kind: 'warning',
    title: 'Kỳ đánh giá KPI đang diễn ra',
    daysLeft: MOCK_WARNING_DAYS_LEFT,
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    iconWrapClass: 'bg-amber-100 text-amber-600',
    titleClass: 'text-amber-900',
    subtitleClass: 'text-amber-800/95',
    ctaClass: 'rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700',
    icon: 'fas fa-clock',
  }
})

function scrollToKpiSelfEvalSection() {
  document.getElementById('member-kpi-self-eval-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Payload JSON lưu vào DB (kpi_assignments.evidences) — khớp parse phía BE */
function buildMemberEvidencesPayload(item: KpiItem, caseKey: EvidenceFormCase): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const noteTrim = evidenceNoteDraft.value.trim()
  if (noteTrim) payload.text = noteTrim
  const cert = certificateOutcomeDraft.value.trim()
  if (cert) payload.certificateOutcomeNote = cert

  if (caseKey === 'general') {
    const rows = generalPlanActualRows.value.map(({ plan, actual }) => ({ plan, actual }))
    payload.planActualRecords = rows
    payload.result = joinActualResultTexts(rows)
  } else if (caseKey === 'monthly' && isMonthlyWaTimesheetKpi(item)) {
    payload.waTimeRecords = waTimeRows.value.map(({ month, spent, standard }) => ({
      month,
      spent,
      standard,
    }))
    payload.result = waTimeTotalsRatio(waTimeRows.value)
  } else if (caseKey === 'category_b') {
    payload.result = noteTrim || undefined
  }
  return payload
}

// ── Actions ────────────────────────────────────────────────────────────────────
/** Lưu vào Pinia draft + đồng bộ hiển thị local; không PATCH API (flush khi Submit Đánh Giá). */
function saveEvidenceDetail() {
  if (!selectedDrawerItem.value || !canSaveEvidence.value) return
  const item = selectedDrawerItem.value
  const jsonHint =
    memberKpiDraftStore.getDraft(item.id)?.evidencesJson ?? item.evidencesJson ?? ''
  const kind = resolveEvidencePayloadKind(item, jsonHint)

  waFormError.value = ''
  const needsWa =
    kind === 'workAmount_new'
    || (kind === 'legacy' && resolveEvidenceCase(item) === 'monthly' && isMonthlyWaTimesheetKpi(item))
  if (needsWa) {
    const waErr = validateWaTimeRows()
    if (waErr) {
      waFormError.value = waErr
      return
    }
  }

  const scoreRaw = detailSelfScore.value!
  const score = Math.min(5, Math.max(1, Math.round(Number(scoreRaw))))
  saving.value = true
  try {
    const payloadObj = buildDrawerEvidencesPayload(item, kind)
    const evidencesJson = JSON.stringify(payloadObj)
    memberKpiDraftStore.setDraft(item.id, { evidencesJson, selfScore: score })

    item.selfScore = score
    item.evidencesJson = evidencesJson
    const noteTrim = evidenceNoteDraft.value.trim()
    item.evidenceNote = noteTrim || undefined
    item.certificateOutcomeNote = certificateOutcomeDraft.value.trim() || undefined

    if (kind === 'weighted') {
      const rows = generalPlanActualRows.value.map(({ plan, actual }) => ({ plan, actual }))
      item.planActualRecords = rows
      item.result = joinActualResultTexts(rows)
      item.actual = undefined
    } else if (kind === 'comment') {
      item.result = noteTrim || undefined
      item.actual = undefined
    } else if (kind === 'workAmount_new') {
      const waRows = waTimeRows.value.map(({ month, spent, standard }) => ({
        month,
        spent,
        standard,
      }))
      item.waTimeRecords = waRows
      item.result = waTimeTotalsRatio(waTimeRows.value)
      item.actual = undefined
    } else {
      const caseKey = resolveEvidenceCase(item)
      if (caseKey === 'general') {
        const rows = generalPlanActualRows.value.map(({ plan, actual }) => ({ plan, actual }))
        item.planActualRecords = rows
        item.result = joinActualResultTexts(rows)
        item.actual = undefined
      } else if (caseKey === 'monthly' && isMonthlyWaTimesheetKpi(item)) {
        const waRows = waTimeRows.value.map(({ month, spent, standard }) => ({
          month,
          spent,
          standard,
        }))
        item.waTimeRecords = waRows
        item.result = waTimeTotalsRatio(waTimeRows.value)
        item.actual = undefined
      } else if (caseKey === 'category_b') {
        item.result = noteTrim || undefined
        item.actual = undefined
      }
    }

    if (item.evidenceStatus === 'missing') item.evidenceStatus = 'submitted'
    closeEvidencePanel()
  } finally {
    saving.value = false
  }
}

function apiSubmitErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Không thể nộp đánh giá.'
}

async function handleSubmit() {
  if (!dashboardData.value?.canSubmit) return
  submitting.value = true
  try {
    await memberKpiDraftStore.flushAll((id, body) => memberKpiService.updateSheetItem(id, body))
    await memberKpiService.submit(selectedYear.value)
    await loadDashboard()
  } catch (e: unknown) {
    window.alert(apiSubmitErrorMessage(e))
  } finally {
    submitting.value = false
  }
}

// ── Helpers: Trạng thái đánh giá KPI (badge cạnh Hạng mục — không hiện Chờ duyệt / Đã duyệt)
function resolveEvaluationStatus(item: KpiItem): MemberKpiEvaluationStatus {
  if (item.evaluationStatus) return item.evaluationStatus
  if (item.pmScore !== null) return 'approved'
  if (item.evidenceStatus === 'pending') return 'pending_approval'
  if (item.evidenceStatus === 'submitted' && item.selfScore !== null) return 'pending_approval'
  return 'not_started'
}

const MEMBER_EVALUATION_STATUS_UI: Record<
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
    dot: 'bg-amber-400 ring-2 ring-amber-100',
    chip: 'border-amber-200 bg-amber-50 text-amber-950',
    labelVi: 'Chờ duyệt',
    labelEn: 'Pending',
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
}

function memberEvalUi(s: MemberKpiEvaluationStatus) {
  return MEMBER_EVALUATION_STATUS_UI[s]
}

/** Badge cạnh tên KPI: chỉ To Do / Quá hạn / Revision — không hiện sau khi nộp (Chờ duyệt / Đã duyệt). */
function memberShowsInlineEvalStatus(s: MemberKpiEvaluationStatus): boolean {
  return s === 'not_started' || s === 'overdue' || s === 'revision'
}

function memberEvaluationActionHint(s: MemberKpiEvaluationStatus): string {
  const m: Record<MemberKpiEvaluationStatus, string> = {
    not_started: 'Đánh giá ngay',
    overdue: 'Bổ sung gấp',
    revision: 'Cập nhật lại',
    pending_approval: 'Chờ PM/Leader',
    approved: '—',
  }
  return m[s]
}

type ForecastPace = 'ahead' | 'on_track' | 'behind' | null

function calendarYearProgressForSelectedYear(): number {
  const y = selectedYear.value
  const now = new Date()
  if (y < now.getFullYear()) return 1
  if (y > now.getFullYear()) return 0
  const t0 = new Date(y, 0, 1).getTime()
  const t1 = new Date(y, 11, 31, 23, 59, 59, 999).getTime()
  if (t1 <= t0) return 0
  return Math.min(1, Math.max(0, (now.getTime() - t0) / (t1 - t0)))
}

function sumPlanActualNumeric(item: KpiItem): { plan: number; actual: number } | null {
  const recs = item.planActualRecords
  if (!recs?.length) return null
  let plan = 0
  let act = 0
  let has = false
  for (const r of recs) {
    const p = parseNumericFromField(r.plan)
    const a = parseNumericFromField(r.actual)
    if (p !== null) {
      plan += p
      has = true
    }
    if (a !== null) {
      act += a
      has = true
    }
  }
  if (!has) return null
  return { plan, actual: act }
}

function waResultAsUnitFraction(item: KpiItem): number | null {
  const r = item.result?.trim()
  if (!r) return null
  const m = r.match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const v = Number.parseFloat(m[0])
  if (!Number.isFinite(v)) return null
  if (/%/.test(r)) return v / 100
  return null
}

function kpiRatioVsPlan(item: KpiItem): number | null {
  const pa = sumPlanActualNumeric(item)
  if (pa && pa.plan > 0) return pa.actual / pa.plan
  const wa = waResultAsUnitFraction(item)
  if (wa !== null) return wa
  return null
}

function hasMeaningfulActualCell(item: KpiItem): boolean {
  return formatKpiActualResult(item) !== '-'
}

function kpiForecastPace(item: KpiItem): ForecastPace {
  const yp = calendarYearProgressForSelectedYear()
  const ratio = kpiRatioVsPlan(item)
  if (ratio !== null) {
    const lo = yp - 0.12
    const hi = yp + 0.12
    if (ratio < lo) return 'behind'
    if (ratio > hi) return 'ahead'
    return 'on_track'
  }
  const hasActual = hasMeaningfulActualCell(item)
  const hasSelf = item.selfScore !== null
  if (hasActual || hasSelf) {
    if (yp < 0.2) return 'ahead'
    return 'on_track'
  }
  if (yp > 0.33) return 'behind'
  return null
}

const memberKpiStatusCounts = computed(() => {
  const items = sheet.value?.items ?? []
  const c: Record<MemberKpiEvaluationStatus, number> = {
    not_started: 0,
    overdue: 0,
    revision: 0,
    pending_approval: 0,
    approved: 0,
  }
  for (const i of items) {
    c[resolveEvaluationStatus(i)]++
  }
  return c
})

const personalSelfWeightedAvg = computed((): number | null => {
  const items = sheet.value?.items.filter(i => i.group !== 'P') ?? []
  const rows = items.filter(i => i.selfScore !== null)
  if (!rows.length) return null
  let num = 0
  let den = 0
  for (const i of rows) {
    num += (i.selfScore ?? 0) * i.weight
    den += i.weight
  }
  return den ? num / den : null
})

/** Tab chính khu vực KPI (theo prototype UI) */
type MemberKpiMainTab = 'personal' | 'promotion'

const memberKpiMainTab = ref<MemberKpiMainTab>('personal')

function memberKpiTabButtonClass(tab: MemberKpiMainTab) {
  const active = memberKpiMainTab.value === tab
  return active
    ? 'border-blue-600 text-blue-600'
    : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
}

function memberKpiTabIconClass(tab: MemberKpiMainTab) {
  return memberKpiMainTab.value === tab ? 'text-blue-600' : 'text-slate-400'
}
</script>

<template>
  <div class="max-w-[1500px] mx-auto space-y-6 animate-fade-in">

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mr-3" />
      <span class="text-slate-500 font-medium">Đang tải dữ liệu KPI...</span>
    </div>

    <template v-else-if="dashboardData && sheet">

      <!-- MOCK: Banner hạn tự đánh giá - xem block comment MOCK trong <script> -->
      <div v-if="kpiDeadlineBanner"
        class="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        :class="[kpiDeadlineBanner.bgClass, kpiDeadlineBanner.borderClass]" role="status">
        <div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            :class="kpiDeadlineBanner.iconWrapClass">
            <i :class="[kpiDeadlineBanner.icon, 'text-lg']" />
          </div>
          <div class="min-w-0">
            <p class="font-bold leading-tight" :class="kpiDeadlineBanner.titleClass">
              {{ kpiDeadlineBanner.title }}
            </p>
            <p v-if="kpiDeadlineBanner.kind === 'warning'" class="mt-1 text-sm leading-snug"
              :class="kpiDeadlineBanner.subtitleClass">
              Còn <strong class="font-bold">{{ kpiDeadlineBanner.daysLeft }}</strong> ngày để bạn tự đánh giá KPI.
            </p>
            <p v-else-if="kpiDeadlineBanner.subtitle" class="mt-1 text-sm leading-snug"
              :class="kpiDeadlineBanner.subtitleClass">
              {{ kpiDeadlineBanner.subtitle }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button type="button" :class="kpiDeadlineBanner.ctaClass" @click="scrollToKpiSelfEvalSection">
            Đánh giá ngay
          </button>
        </div>
      </div>

      <!-- Top Action Bar -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Trang Cá Nhân (My KPI)</h2>
          <p class="text-slate-500 text-sm mt-1">Theo dõi mục tiêu cá nhân, cập nhật bằng chứng và đánh giá hiệu suất.
          </p>
        </div>
        <div class="flex gap-3">
          <select v-model="selectedYear"
            class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-100"
            @change="loadDashboard">
            <option :value="2024">Năm: 2024</option>
            <option :value="2025">Năm: 2025</option>
            <option :value="2026">Năm: 2026</option>
          </select>
        </div>
      </div>

      <MemberProcessTimeline :year="selectedYear" :active-phase="dashboardData.phase" />

      <!-- Tổng hợp nhanh (theo dòng KPI — không gồm Chờ duyệt / Đã duyệt vì nộp theo cả bảng) -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button"
          class="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          @click="scrollToKpiSelfEvalSection">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chưa đánh giá</p>
          <p class="mt-1 text-2xl font-bold text-slate-800">{{ memberKpiStatusCounts.not_started }}</p>
          <p class="mt-1 text-[11px] font-semibold text-blue-600">Đánh giá ngay →</p>
        </button>
        <div class="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-rose-800">Quá hạn</p>
          <p class="mt-1 text-2xl font-bold text-rose-900">{{ memberKpiStatusCounts.overdue }}</p>
          <p class="mt-1 text-[11px] font-semibold text-rose-800">Bổ sung gấp</p>
        </div>
        <div class="rounded-xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-wider text-orange-900">Cần làm lại</p>
          <p class="mt-1 text-2xl font-bold text-orange-950">{{ memberKpiStatusCounts.revision }}</p>
          <p class="mt-1 text-[11px] font-semibold text-orange-900">Cập nhật lại</p>
        </div>
      </div>

      <!-- Bằng chứng + điểm TB (Personal) -->
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div
          class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-emerald-50" />
          <div class="z-10 rounded-xl bg-emerald-100 p-3.5 text-emerald-600">
            <i class="fa-solid fa-file-export text-xl" />
          </div>
          <div class="z-10 min-w-0">
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Tình trạng bằng chứng</p>
            <p class="text-2xl font-bold text-slate-800">
              {{ sheet.evidenceCount }}
              <span class="text-sm font-bold text-slate-400">/ {{ sheet.evidenceTotalCount }}</span>
            </p>
            <p v-if="sheet.evidenceCount < sheet.evidenceTotalCount"
              class="mt-0.5 text-[11px] font-semibold text-orange-500">
              Cần bổ sung {{ sheet.evidenceTotalCount - sheet.evidenceCount }} mục
            </p>
          </div>
        </div>

        <div
          class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-violet-50" />
          <div class="z-10 rounded-xl bg-violet-100 p-3 text-violet-600">
            <i class="fa-solid fa-chart-column text-xl" />
          </div>
          <div class="z-10 min-w-0">
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Avg Self Score (Personal, có trọng số)</p>
            <div class="flex items-baseline gap-2">
              <p class="text-2xl font-bold text-violet-700">
                {{ personalSelfWeightedAvg !== null ? personalSelfWeightedAvg.toFixed(2) : '—' }}
              </p>
              <p class="text-[10px] font-semibold text-violet-500">/ 5.0</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. KPI SHEET - tabs + bảng chi tiết (prototype) -->
      <div id="member-kpi-self-eval-section" class="mt-6 scroll-mt-24">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
          <nav class="flex flex-wrap gap-1" aria-label="KPI dashboard tabs">
            <button type="button"
              class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
              :class="memberKpiTabButtonClass('personal')" @click="memberKpiMainTab = 'personal'">
              <i class="fas fa-bullseye text-base" :class="memberKpiTabIconClass('personal')" />
              Personal KPI
            </button>
            <button type="button"
              class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
              :class="memberKpiTabButtonClass('promotion')" @click="memberKpiMainTab = 'promotion'">
              <i class="fas fa-arrow-trend-up text-base" :class="memberKpiTabIconClass('promotion')" />
              Promotion KPI
            </button>
          </nav>
          <button
            type="button"
            class="mb-1.5 mr-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            @click="showCreateIndividualKpiDrawer = true"
          >
            <i class="fas fa-plus text-xs" aria-hidden="true" />
            Tạo KPI
          </button>
        </div>

        <CreateIndividualKpiDrawer
          v-model="showCreateIndividualKpiDrawer"
          :cycle-id="String(selectedYear)"
          @saved="onMemberIndividualKpiSaved"
        />

        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <!-- Personal KPI -->
          <template v-if="memberKpiMainTab === 'personal'">
            <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <i class="fas fa-list-alt text-slate-400" />
                Chi Tiết Bảng KPI Cá Nhân
              </h3>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="border-b border-slate-200 bg-white">
                  <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th class="w-12 px-5 py-4 text-center">STT</th>
                    <th class="min-w-[200px] px-5 py-4">Hạng Mục (Objectives)</th>
                    <th class="min-w-[10rem] px-5 py-4 text-center">Trạng thái KPI</th>
                    <th class="px-5 py-4">Chỉ Tiêu (Target)</th>
                    <th class="w-24 px-5 py-4 text-center">Trọng số (W)</th>
                    <th class="min-w-[8rem] px-5 py-4 text-center">Actual Result</th>
                    <th class="w-28 bg-sky-50/90 px-5 py-4 text-center text-slate-600">Self Score</th>
                    <th class="w-28 px-5 py-4 text-center">Final Score</th>
                    <th class="w-28 px-5 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="section in personalGroupedSections" :key="section.key">
                    <!-- Group header -->
                    <tr class="bg-amber-50/80 border-y border-amber-100">
                      <td colspan="9" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                        {{ section.headerLabel }}
                      </td>
                    </tr>

                    <!-- KPI Items -->
                    <tr v-for="(item, idx) in section.items" :key="item.id"
                      class="group transition-colors hover:bg-slate-50"
                    >
                      <td class="py-4 px-5 text-center text-sm font-semibold text-slate-400">{{ idx + 1 }}</td>

                      <td class="py-4 px-5">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p class="text-sm font-bold text-slate-900">{{ item.code }} {{ item.name }}</p>
                          <template v-if="memberShowsInlineEvalStatus(resolveEvaluationStatus(item))">
                            <template v-for="evSt in [resolveEvaluationStatus(item)]" :key="`${item.id}-inline-st`">
                              <span
                                class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none"
                                :class="memberEvalUi(evSt).chip"
                                :title="`${memberEvalUi(evSt).labelVi} · ${memberEvaluationActionHint(evSt)}`"
                              >
                                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="memberEvalUi(evSt).dot" />
                                {{ memberEvalUi(evSt).labelVi }}
                              </span>
                            </template>
                          </template>
                        </div>
                      </td>

                      <td class="max-w-[11rem] px-3 py-4 text-center align-top">
                        <span
                          class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold leading-tight text-slate-800"
                          :title="item.assignmentStatusName ?? ''">
                          <span class="text-[9px] font-bold text-slate-400">{{ item.statusCode ?? '—' }}</span>
                          <span class="line-clamp-3 text-center">{{ item.assignmentStatusName ?? '—' }}</span>
                        </span>
                      </td>

                      <td class="max-w-xs py-4 px-5 align-top" :title="kpiTargetTooltip(item)">
                        <div class="cursor-help">
                          <p class="text-sm font-medium text-slate-700" v-html="item.target" />
                        </div>
                      </td>

                      <td class="py-4 px-5 text-center">
                        <span
                          class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md border border-slate-200">
                          {{ item.weight.toFixed(1) }}
                        </span>
                      </td>

                      <!-- Actual Result: Result / Actual (API) -->
                      <td class="py-4 px-5 text-center align-middle">
                        <span class="text-sm font-semibold leading-snug text-slate-700 inline-block"
                          :title="formatKpiActualResult(item)">
                          {{ formatKpiActualResult(item) }}
                        </span>
                      </td>

                      <!-- Self Score (điểm nhập trong chi tiết KPI) -->
                      <td class="bg-sky-50/50 py-4 px-5 text-center align-middle">
                        <span class="text-sm font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span>
                      </td>

                      <!-- PM Score -->
                      <td class="py-4 px-5 text-center align-middle">
                        <span class="text-slate-400 font-medium text-sm">
                          {{ item.pmScore !== null ? item.pmScore : '-' }}
                        </span>
                      </td>

                      <!-- Action — Flow 2: Accept gộp vào Submit Đánh Giá -->
                      <td class="py-4 px-5 text-center align-middle">
                        <template v-for="evSt in [resolveEvaluationStatus(item)]" :key="`${item.id}-evst`">
                          <button type="button"
                            class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                            :class="evSt === 'approved' ? 'pointer-events-none opacity-50' : ''"
                            :title="evSt === 'approved' ? 'Đã duyệt - không chỉnh sửa' : item.statusCode === 402 || item.statusCode === 403 ? 'Chờ PM/GM duyệt KPI đề xuất' : isKpiWorkflowLocked(item) ? 'Xem chi tiết minh chứng (đã nộp)' : 'Tự đánh giá & bằng chứng'"
                            :disabled="evSt === 'approved' || item.statusCode === 402 || item.statusCode === 403"
                            @click="openEvidencePanel(item)">
                            <i class="fas fa-pen text-sm" />
                          </button>
                        </template>
                      </td>
                    </tr>
                  </template>
                </tbody>

                <!-- NEW: TABLE FOOTER FOR TOTALS -->
                <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
                  <!-- Total Score -->
                  <tr>
                    <td colspan="4" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">Tổng
                      cộng (Total
                      score):</td>
                    <td class="py-4 px-5 text-center">
                      <span class="text-sm text-slate-800">160</span><span
                        class="text-xs text-slate-500 font-medium ml-1">pts</span>
                    </td>
                    <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
                    <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-500">123.5</td>
                    <td class="py-4 px-5 text-center">
                      <span class="text-sm text-slate-800">-</span>
                    </td>
                    <td class="py-4 px-5 text-center text-slate-500 text-sm"></td>
                  </tr>
                  <!-- Average Score -->
                  <tr class="bg-violet-50/50 border-t border-slate-200">
                    <td colspan="4" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">Điểm
                      trung bình
                      (Average score):</td>
                    <td class="py-4 px-5"></td>
                    <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">-</td>
                    <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-500">
                      {{ personalSelfWeightedAvg !== null ? personalSelfWeightedAvg.toFixed(2) : '—' }}
                    </td>
                    <td class="py-4 px-5 text-center bg-violet-100/80">
                      <span class="text-lg text-violet-700 font-extrabold">-</span>
                    </td>
                    <td class="py-4 px-5 text-center text-slate-500 text-sm"></td>
                  </tr>
                </tfoot>

              </table>
            </div>

            <!-- COMMENTS SECTION (Giống cấu trúc Excel) -->
            <div class="p-6 border-t border-slate-200 bg-slate-50/30">
              <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <i class="fas fa-comments text-blue-600"></i>
                Comment of employee and supervisor
              </h4>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Employee Column -->
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee's
                      Comment</label>
                    <textarea
                      class="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none shadow-sm"
                      :class="{ 'bg-slate-100 text-slate-500': !isCurrentYear }" placeholder="Nhập ý kiến của bạn..."
                      :readonly="!isCurrentYear"></textarea>
                  </div>

                </div>

                <!-- Supervisor Column -->
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor
                      Comment</label>
                    <textarea
                      class="w-full h-24 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none resize-none"
                      placeholder="Supervisor sẽ nhập ý kiến tại đây..." readonly></textarea>
                  </div>

                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
              <button v-if="isCurrentYear" :disabled="!dashboardData.canSubmit || submitting"
                class="px-4 py-2 bg-slate-900 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleSubmit">
                <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
                <i v-else class="fas fa-paper-plane text-xs" />
                Submit Đánh Giá
              </button>
              <div v-else class="text-sm text-slate-500 font-medium">
                Dữ liệu năm {{ selectedYear }} chỉ để xem
              </div>
            </div>
          </template>

          <template v-else-if="memberKpiMainTab === 'promotion'">
            <div
              class="flex flex-col gap-1 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <i class="fas fa-arrow-trend-up text-slate-400" />
                Chi Tiết Bảng KPI Promotion
              </h3>
              <p class="text-xs font-medium text-slate-500">
                Các hạng mục PM/Leader giao trực tiếp - bấm <strong class="text-slate-700">Thao tác</strong> để khai báo
                minh chứng (giống Personal KPI).
              </p>
            </div>

            <div v-if="promotionItemsFlat.length === 0" class="px-5 py-16 text-center text-sm text-slate-500">
              <i class="fas fa-medal mb-3 text-3xl text-violet-200" />
              <p class="font-medium text-slate-600">Chưa có KPI Promotion</p>
              <p class="mt-1 mx-auto max-w-md text-xs text-slate-400">
                Khi PM/Leader giao mục tiêu thăng tiến (Direct), các dòng sẽ hiển thị tại đây.
              </p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="border-b border-slate-200 bg-white">
                  <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th class="w-12 px-5 py-4 text-center">STT</th>
                    <th class="min-w-[200px] px-5 py-4">Hạng Mục (Objectives)</th>
                    <th class="min-w-[10rem] px-5 py-4 text-center">Trạng thái KPI</th>
                    <th class="px-5 py-4">Chỉ Tiêu (Target)</th>
                    <th class="w-24 px-5 py-4 text-center">Trọng số (W)</th>
                    <th class="min-w-[8rem] px-5 py-4 text-center">Actual Result</th>
                    <th class="w-28 bg-sky-50/90 px-5 py-4 text-center text-slate-600">Self Score</th>
                    <th class="w-28 px-5 py-4 text-center">Final Score</th>
                    <th class="w-28 px-5 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="section in promotionGroupedSections" :key="'p-' + section.key">
                    <tr class="bg-amber-50/80 border-y border-amber-100">
                      <td colspan="9" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                        {{ section.headerLabel }}
                      </td>
                    </tr>
                    <tr v-for="(item, idx) in section.items" :key="item.id"
                      class="group transition-colors hover:bg-slate-50"
                    >
                      <td class="px-5 py-4 text-center text-sm font-semibold text-slate-400">{{ idx + 1 }}</td>
                      <td class="px-5 py-4">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p class="text-sm font-bold text-slate-900">{{ item.code }} {{ item.name }}</p>
                          <template v-if="memberShowsInlineEvalStatus(resolveEvaluationStatus(item))">
                            <template v-for="evSt in [resolveEvaluationStatus(item)]" :key="`${item.id}-promo-inline`">
                              <span
                                class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none"
                                :class="memberEvalUi(evSt).chip"
                                :title="`${memberEvalUi(evSt).labelVi} · ${memberEvaluationActionHint(evSt)}`"
                              >
                                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="memberEvalUi(evSt).dot" />
                                {{ memberEvalUi(evSt).labelVi }}
                              </span>
                            </template>
                          </template>
                        </div>
                        <p v-if="item.certificateOutcomeNote"
                          class="mt-1.5 max-w-xs rounded border border-indigo-100 bg-indigo-50/90 px-2 py-1 text-[10px] font-medium leading-snug text-indigo-900 line-clamp-2"
                          :title="item.certificateOutcomeNote">
                          <i class="fas fa-certificate mr-1 shrink-0 text-indigo-500" />
                          Thực tế (khác sheet): {{ item.certificateOutcomeNote }}
                        </p>
                      </td>
                      <td class="max-w-[11rem] px-3 py-4 text-center align-top">
                        <span
                          class="inline-flex max-w-full flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold leading-tight text-slate-800"
                          :title="item.assignmentStatusName ?? ''">
                          <span class="text-[9px] font-bold text-slate-400">{{ item.statusCode ?? '—' }}</span>
                          <span class="line-clamp-3 text-center">{{ item.assignmentStatusName ?? '—' }}</span>
                        </span>
                      </td>
                      <td class="max-w-xs px-5 py-4 align-top" :title="kpiTargetTooltip(item)">
                        <div class="cursor-help">
                          <p class="text-sm font-medium text-slate-700" v-html="item.target" />
                          <p v-if="item.description" class="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                            {{ item.description }}
                          </p>
                        </div>
                      </td>
                      <td class="px-5 py-4 text-center">
                        <span
                          class="inline-block rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">
                          {{ item.weight.toFixed(1) }}
                        </span>
                      </td>
                      <td class="px-5 py-4 text-center align-middle">
                        <span class="inline-block text-xs font-semibold leading-snug text-slate-700"
                          :title="formatKpiActualResult(item)">
                          {{ formatKpiActualResult(item) }}
                        </span>
                      </td>
                      <td class="bg-sky-50/50 px-5 py-4 text-center align-middle">
                        <span class="text-sm font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span>
                      </td>
                      <td class="px-5 py-4 text-center align-middle">
                        <span class="text-sm font-medium text-slate-400">
                          {{ item.pmScore !== null ? item.pmScore : '-' }}
                        </span>
                      </td>
                      <td class="px-5 py-4 text-center align-middle">
                        <template v-for="evSt in [resolveEvaluationStatus(item)]" :key="`${item.id}-promo-evst`">
                          <button type="button"
                            class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                            :class="evSt === 'approved' ? 'pointer-events-none opacity-50' : ''"
                            :title="evSt === 'approved' ? 'Đã duyệt - không chỉnh sửa' : item.statusCode === 402 || item.statusCode === 403 ? 'Chờ PM/GM duyệt KPI đề xuất' : isKpiWorkflowLocked(item) ? 'Xem chi tiết minh chứng (đã nộp)' : 'Tự đánh giá & bằng chứng'"
                            :disabled="evSt === 'approved' || item.statusCode === 402 || item.statusCode === 403"
                            @click="openEvidencePanel(item)">
                            <i class="fas fa-pen text-sm" />
                          </button>
                        </template>
                      </td>
                    </tr>
                  </template>
                </tbody>
                <tfoot class="border-t-2 border-slate-200 bg-slate-100/80 font-bold">
                  <tr>
                    <td colspan="4" class="px-5 py-4 text-right text-xs uppercase tracking-wider text-slate-700">
                      Tổng trọng số (Promotion W):
                    </td>
                    <td class="px-5 py-4 text-center">
                      <span class="text-sm text-slate-800">{{ promotionWeightSum.toFixed(1) }}</span>
                      <span class="ml-1 text-xs font-medium text-slate-500">pts</span>
                    </td>
                    <td class="px-5 py-4 text-center text-xs font-medium text-slate-400">-</td>
                    <td class="bg-sky-50/50 px-5 py-4 text-center text-sm text-slate-600">
                      {{ promotionSelfWeightedAvg !== null ? promotionSelfWeightedAvg.toFixed(2) : '-' }}
                    </td>
                    <td class="px-5 py-4 text-center text-sm text-slate-600">
                      {{ promotionPmWeightedAvg !== null ? promotionPmWeightedAvg.toFixed(2) : '-' }}
                    </td>
                    <td class="px-5 py-4" />
                  </tr>
                </tfoot>
              </table>
              <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
                <button v-if="isCurrentYear" :disabled="!dashboardData.canSubmit || submitting"
                  class="px-4 py-2 bg-slate-900 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="handleSubmit">
                  <i v-if="submitting" class="fas fa-spinner fa-spin text-xs" />
                  <i v-else class="fas fa-paper-plane text-xs" />
                  Submit Điểm Promotion
                </button>
                <div v-else class="text-sm text-slate-500 font-medium">
                  Dữ liệu năm {{ selectedYear }} chỉ để xem
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

    </template>

    <!-- Drawer: Chi tiết Evidence (đa case - theo mock HTML) -->
    <Teleport to="body">
      <Transition name="evidence-drawer">
        <div v-if="evidencePanelOpen && selectedDrawerItem" class="fixed inset-0 z-[100] flex justify-end" role="dialog"
          aria-modal="true" aria-labelledby="evidence-drawer-title">
          <div class="evidence-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            @click="closeEvidencePanel" />
          <aside
            class="evidence-drawer-panel relative flex h-full max-h-[100dvh] w-full max-w-[700px] min-h-0 flex-col overflow-hidden bg-slate-50 shadow-2xl">
            <div
              class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
              <div>
                <h2 id="evidence-drawer-title" class="flex items-center text-lg font-bold text-slate-800">
                  <i class="fas fa-clipboard-check mr-2 text-indigo-600" />
                  Chi tiết Evidence
                </h2>
                <p class="mt-0.5 text-xs text-slate-500">
                  Khai báo số liệu và đính kèm — bản nháp lưu trên trình duyệt; gửi server khi bạn bấm
                  <span class="font-semibold text-slate-700">Submit Đánh Giá</span>.
                </p>
              </div>
              <button type="button"
                class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng" @click="closeEvidencePanel">
                <i class="fas fa-times text-lg" />
              </button>
            </div>

            <div v-if="evidenceDrawerReadOnly"
              class="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-semibold leading-snug text-amber-950">
              <i class="fas fa-eye mr-2 shrink-0 text-amber-600" />
              Chế độ chỉ xem — KPI đã nộp hoặc đang chờ duyệt; bạn vẫn xem được minh chứng, không lưu chỉnh sửa.
            </div>

            <div class="relative shrink-0 overflow-hidden bg-slate-800 p-5 text-white">
              <div class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03]">
                <i class="fas fa-bullseye text-[10rem]" />
              </div>
              <div class="relative z-10">
                <div class="mb-1.5 flex items-center">
                  <span
                    class="rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    {{ selectedDrawerItem.code }}
                  </span>
                </div>
                <h3 class="mb-1 text-xl font-bold">{{ selectedDrawerItem.name }}</h3>
                <p class="mt-3 cursor-help border-t border-white/10 pt-2 text-xs leading-relaxed text-slate-300"
                  :title="kpiTargetTooltip(selectedDrawerItem)">
                  <i class="fas fa-crosshairs mr-1 shrink-0 text-indigo-400" />
                  Chỉ tiêu (mô tả): <span class="text-slate-100">{{ targetBannerPlain(selectedDrawerItem) }}</span>
                </p>
              </div>
            </div>

            <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
                <div class="flex flex-col gap-6">
                  <!-- Nhóm B - KPI chứng chỉ / ngoại ngữ: mô tả thực tế (cùng layout B) -->
                  <div v-if="drawerCase === 'category_b' && isBLanguageCertificateKpi(selectedDrawerItem)"
                    class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm">
                    <div class="flex items-start gap-3">
                      <i class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600" />
                      <div class="min-w-0">
                        <p class="font-bold text-indigo-950">Mục tiêu giao & chỉ tiêu chuẩn</p>
                        <p class="mt-1 font-medium text-slate-800">
                          <span class="font-semibold text-indigo-900">Mục tiêu (assignment):</span>
                          {{ formatNumericTarget(selectedDrawerItem.assignmentTargetValue) }}
                          <span class="mx-2 text-slate-300">|</span>
                          <span class="font-semibold text-indigo-900">Chỉ tiêu (target_value):</span>
                          {{ formatNumericTarget(selectedDrawerItem.kpiTemplateTargetValue) }}
                        </p>
                        <p class="mt-1 text-xs text-slate-600">{{ targetBannerPlain(selectedDrawerItem) }}</p>
                      </div>
                    </div>
                    <p class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600">
                      Nếu kết quả thực tế <strong>khác</strong> mục tiêu trên - ví dụ đăng ký <strong>TOEIC 700</strong>
                      nhưng chưa đạt, trong khi bạn có <strong>JLPT N2</strong> hoặc chứng chỉ tương đương -
                      hãy ghi rõ chứng chỉ / điểm số thực tế ở ô bên dưới và đính kèm bản scan hoặc link tra cứu để PM
                      đối
                      chiếu.
                    </p>
                    <div>
                      <label class="mb-1 block text-xs font-bold text-slate-700">
                        Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                      </label>
                      <textarea v-model="certificateOutcomeDraft" rows="2"
                        placeholder="Ví dụ: JLPT N2 (12/2025) - đính kèm scan kết quả; mục tiêu TOEIC 700 chưa đạt / không thi lại trong năm."
                        :readonly="evidenceDrawerReadOnly"
                        class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50 read-only:text-slate-700" />
                    </div>
                  </div>

                  <div v-if="drawerCase !== 'category_b'" class="flex flex-col gap-6">
                    <!-- KPI chứng chỉ (Promotion / upload_only): tách mục tiêu sheet vs minh chứng thực tế -->
                    <div v-if="isUploadOnlyDrawer"
                      class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm">
                      <div class="flex items-start gap-3">
                        <i class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600" />
                        <div class="min-w-0">
                          <p class="font-bold text-indigo-950">Mục tiêu giao & chỉ tiêu chuẩn</p>
                          <p class="mt-1 font-medium text-slate-800">
                            <span class="font-semibold text-indigo-900">Mục tiêu (assignment):</span>
                            {{ formatNumericTarget(selectedDrawerItem.assignmentTargetValue) }}
                            <span class="mx-2 text-slate-300">|</span>
                            <span class="font-semibold text-indigo-900">Chỉ tiêu (target_value):</span>
                            {{ formatNumericTarget(selectedDrawerItem.kpiTemplateTargetValue) }}
                          </p>
                          <p class="mt-1 text-xs text-slate-600">{{ targetBannerPlain(selectedDrawerItem) }}</p>
                        </div>
                      </div>
                      <p class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600">
                        Nếu kết quả thực tế <strong>khác</strong> mục tiêu trên - ví dụ đăng ký <strong>TOEIC
                          700</strong>
                        nhưng chưa đạt, trong khi bạn có <strong>JLPT N2</strong> hoặc chứng chỉ tương đương -
                        hãy ghi rõ chứng chỉ / điểm số thực tế ở ô bên dưới và đính kèm bản scan hoặc link tra cứu để PM
                        đối
                        chiếu.
                      </p>
                      <div>
                        <label class="mb-1 block text-xs font-bold text-slate-700">
                          Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                        </label>
                        <textarea v-model="certificateOutcomeDraft" rows="2"
                          placeholder="Ví dụ: JLPT N2 (12/2025) - đính kèm scan kết quả; mục tiêu TOEIC 700 chưa đạt / không thi lại trong năm."
                          :readonly="evidenceDrawerReadOnly"
                          class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50 read-only:text-slate-700" />
                      </div>
                    </div>

                    <!-- CASE: monthly - A.2 / Work Amount: chỉ Spent / Standard; Actual Result = tổng Spent ÷ tổng Standard -->
                    <div
                      v-show="drawerCase === 'monthly' && selectedDrawerItem && isMonthlyWaTimesheetKpi(selectedDrawerItem)"
                      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div class="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-4 py-3">
                        <h4 class="flex items-center text-sm font-bold text-blue-800">
                          <i class="fas fa-clock mr-2 text-blue-600" />
                          Khai báo thời gian (Work Amount)
                        </h4>
                      </div>
                      <div class="p-4">
                        <div class="overflow-x-auto rounded-lg border border-blue-100 bg-blue-50/20">
                          <table class="w-full min-w-[420px] text-left text-sm">
                            <thead
                              class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <tr>
                                <th class="min-w-[8.5rem] px-3 py-2">Tháng</th>
                                <th class="px-3 py-2">Spent (h)</th>
                                <th class="px-3 py-2">Standard (h)</th>
                                <th class="w-14 px-3 py-2 text-center">Xóa</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 bg-white">
                              <tr v-for="row in waTimeRows" :key="row.id">
                                <td class="px-3 py-2">
                                  <select v-model="row.month"
                                    :disabled="evidenceDrawerReadOnly"
                                    class="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 disabled:cursor-default disabled:bg-slate-50 disabled:opacity-90">
                                    <option v-for="m in getWaMonthOptionsForRow(row)" :key="m.value" :value="m.value">
                                      {{ m.label }}
                                    </option>
                                  </select>
                                </td>
                                <td class="px-3 py-2">
                                  <input v-model="row.spent" type="text" inputmode="decimal" placeholder="0"
                                    :readonly="evidenceDrawerReadOnly"
                                    class="w-full min-w-[5rem] rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50" />
                                </td>
                                <td class="px-3 py-2">
                                  <input v-model="row.standard" type="text" inputmode="decimal" placeholder="0"
                                    :readonly="evidenceDrawerReadOnly"
                                    class="w-full min-w-[5rem] rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50" />
                                </td>
                                <td class="px-3 py-2 text-center">
                                  <button v-if="waTimeRows.length > 1 && canAddEvidenceRecords" type="button"
                                    class="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    title="Xóa dòng" @click="removeWaTimeRow(row.id)">
                                    <i class="fas fa-trash-alt text-xs" />
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p v-if="waFormError"
                          class="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                          role="alert">
                          {{ waFormError }}
                        </p>
                        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <button v-if="canAddEvidenceRecords" type="button"
                            class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="!canAddMoreWaRows" :title="canAddMoreWaRows
                              ? 'Thêm dòng (tháng chưa dùng)'
                              : 'Đã đủ 12 dòng hoặc đã dùng hết 12 tháng'
                            " @click="addWaTimeRow">
                            <i class="fas fa-plus mr-1.5 text-xs" /> Thêm dòng
                          </button>
                          <p v-if="waTimeTotalsRatio(waTimeRows) != null" class="text-xs font-semibold text-blue-900">
                            Xem trước tỉ lệ: {{ waTimeTotalsRatio(waTimeRows) }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- CASE: project_metrics -->
                    <div v-show="drawerCase === 'project_metrics'"
                      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div
                        class="flex items-center justify-between border-b border-purple-100 bg-purple-50/50 px-4 py-3">
                        <h4 class="flex items-center text-sm font-bold text-purple-800">
                          <i class="fas fa-chart-line mr-2 text-purple-600" />
                          Khai báo Chỉ số (Metrics) theo Dự án
                        </h4>
                      </div>
                      <div class="p-4">
                        <div
                          class="mb-4 grid grid-cols-12 items-end gap-3 rounded-lg border border-purple-100 bg-purple-50/30 p-3">
                          <div class="col-span-12 sm:col-span-3">
                            <label class="mb-1 block text-[10px] font-bold uppercase text-slate-500">Dự án</label>
                            <input type="text" placeholder="Tên dự án..."
                              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-purple-500" />
                          </div>
                          <div class="col-span-4 sm:col-span-2">
                            <label class="mb-1 block text-[10px] font-bold uppercase text-slate-500">Rework %</label>
                            <input type="number" placeholder="0%"
                              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-purple-500" />
                          </div>
                          <div class="col-span-4 sm:col-span-2">
                            <label class="mb-1 block text-[10px] font-bold uppercase text-slate-500">UT Bug %</label>
                            <input type="number" placeholder="0%"
                              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-purple-500" />
                          </div>
                          <div class="col-span-4 sm:col-span-2">
                            <label class="mb-1 block text-[10px] font-bold uppercase text-slate-500">Degraded %</label>
                            <input type="number" placeholder="0%"
                              class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-purple-500" />
                          </div>
                          <div class="col-span-12 sm:col-span-3">
                            <button type="button"
                              class="flex w-full items-center justify-center rounded bg-purple-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-purple-700">
                              <i class="fas fa-plus mr-1" /> Cập nhật
                            </button>
                          </div>
                        </div>
                        <table class="w-full overflow-hidden rounded-lg border border-slate-200 text-left text-sm">
                          <thead class="bg-slate-50 text-xs text-slate-500">
                            <tr>
                              <th class="border-b border-slate-200 px-3 py-2 font-medium">Dự án</th>
                              <th class="border-b border-slate-200 px-3 py-2 text-center font-medium">Rework</th>
                              <th class="border-b border-slate-200 px-3 py-2 text-center font-medium">UT Bug</th>
                              <th class="border-b border-slate-200 px-3 py-2 text-center font-medium">Degraded</th>
                              <th class="border-b border-slate-200 px-3 py-2 text-center font-medium">Xóa</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td colspan="5" class="bg-slate-50 py-4 text-center text-xs italic text-slate-400">
                                Chưa có dự án nào được khai báo
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <!-- CASE: general -->
                    <div v-show="drawerCase === 'general'"
                      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div class="flex items-center justify-between border-b border-teal-100 bg-teal-50/50 px-4 py-3">
                        <h4 class="flex items-center text-sm font-bold text-teal-800">
                          <i class="fas fa-comment-dots mr-2 text-teal-600" />
                          Khai báo Hành vi / Sự kiện
                        </h4>
                      </div>
                      <div class="p-4">
                        <div class="space-y-4 rounded-lg border border-teal-100 bg-teal-50/30 p-4">
                          <div v-for="(row, rowIdx) in generalPlanActualRows" :key="row.id"
                            class="rounded-lg border border-teal-100/80 bg-white p-3 shadow-sm">
                            <div class="mb-2 flex items-center justify-between gap-2">
                              <span class="text-[10px] font-bold uppercase tracking-wider text-teal-800">Record {{
                                rowIdx +
                                1 }}</span>
                              <button v-if="generalPlanActualRows.length > 1 && canAddEvidenceRecords" type="button"
                                class="rounded p-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa dòng" @click="removeGeneralPlanActualRow(row.id)">
                                <i class="fas fa-trash-alt" />
                              </button>
                            </div>
                            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label class="mb-1 block text-xs font-bold text-slate-600">Mục tiêu
                                  (Plan/Target)</label>
                                <textarea v-model="row.plan" rows="2"
                                  :readonly="evidenceDrawerReadOnly"
                                  class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50" 
                                />
                              </div>
                              <div>
                                <label class="mb-1 block text-xs font-bold text-slate-600">Thực tế
                                  (Actual/Result)</label>
                                <textarea v-model="row.actual" rows="2"
                                  :readonly="evidenceDrawerReadOnly"
                                  class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50" />
                              </div>
                            </div>
                          </div>
                          <div v-if="canAddEvidenceRecords" class="flex justify-end">
                            <button type="button"
                              class="flex items-center rounded bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                              title="Thêm một dòng Plan / Actual"
                              @click="addGeneralPlanActualRow">
                              <i class="fas fa-plus mr-1" /> Thêm Record
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Attachment hub (luôn hiện; nhấn mạnh khi upload_only) -->
                  <div class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div v-show="isUploadOnlyDrawer" class="absolute left-0 top-0 h-1 w-full bg-pink-500" />
                    <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <h4 class="flex items-center text-sm font-bold text-slate-700">
                        <i class="fas fa-paperclip mr-2 text-slate-500" />
                        <span :class="isUploadOnlyDrawer ? 'text-pink-600' : 'text-slate-700'">{{ attachmentHubTitle
                          }}</span>
                      </h4>
                      <span v-show="isUploadOnlyDrawer"
                        class="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-pink-700">Bắt
                        buộc</span>
                    </div>
                    <div class="space-y-4 p-5">
                      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label
                          class="group relative block rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:pointer-events-none"
                          :class="pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES || evidenceDrawerReadOnly
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:border-indigo-400 hover:bg-slate-50'
                            ">
                          <input v-if="pendingEvidenceFiles.length < EVIDENCE_MAX_FILES" type="file" multiple
                            :accept="EVIDENCE_ACCEPT_ATTR"
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0 "
                            title="Chọn file (tối đa 5 file)" @change="onEvidenceFilesChange" 
                            :disabled="evidenceDrawerReadOnly"
                          />
                          <div
                            class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 transition-transform group-hover:scale-110 ">
                            <i class="fas fa-cloud-upload-alt text-2xl" />
                          </div>
                          <p class="text-sm font-bold text-slate-700">Tải File Lên (PC)</p>
                          <p class="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                            PDF, Word, Excel, CSV, JPG, PNG - tối đa {{ EVIDENCE_MAX_FILES }} file
                          </p>
                        </label>
                        <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5">
                          <label class="mb-1 block text-sm font-bold text-slate-700">Thêm link URL</label>
                          <p class="mb-3 text-[10px] uppercase tracking-wider text-slate-400">
                            Jira, Confluence, Drive, cổng tra cứu điểm… - tối đa {{ EVIDENCE_MAX_URLS }} link
                          </p>
                          <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <div class="relative min-w-0 flex-1">
                              <i
                                class="fas fa-link pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input v-model="evidenceUrlDraft" type="text" inputmode="url" autocomplete="url"
                                placeholder="https://..."
                                class="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:ring-1 focus:ring-indigo-500"
                                :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS || evidenceDrawerReadOnly"
                                @keydown="onEvidenceUrlDraftKeydown" />
                            </div>
                            <button type="button"
                              class="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                              :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS"
                              @click="addPendingEvidenceUrl">
                              Thêm URL
                            </button>
                          </div>
                          <p v-if="evidenceUrlHint" class="mt-2 text-xs text-amber-700">{{ evidenceUrlHint }}</p>
                        </div>
                      </div>

                      <!-- Hai khối: FILE (máy + tên file từ evd) và URL / đường dẫn (một dòng evd → hai chỗ nếu có name + url) -->
                      <div class="space-y-4">
                        <div class="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-700">
                          <span class="inline-flex items-center gap-2">
                            <i class="fas fa-file-alt text-slate-500" aria-hidden="true" />
                            File (máy):
                            <span class="tabular-nums text-slate-900">{{ evidenceFileSectionCount }}/{{ EVIDENCE_MAX_FILES }}</span>
                          </span>
                          <span class="hidden sm:inline text-slate-300" aria-hidden="true">|</span>
                          <span class="inline-flex items-center gap-2">
                            <i class="fas fa-link text-indigo-500" aria-hidden="true" />
                            URL / đường dẫn:
                            <span class="tabular-nums text-slate-900">{{ pendingEvidenceUrls.length }}/{{ EVIDENCE_MAX_URLS }}</span>
                          </span>
                          <span v-if="pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES || pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS"
                            class="ml-auto flex flex-wrap gap-2 text-[11px] font-medium text-amber-700">
                            <span v-if="pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES">Đủ file máy</span>
                            <span v-if="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS">Đủ ô link</span>
                          </span>
                        </div>
                        <p v-if="evidenceUploadHint" class="text-xs text-amber-700">{{ evidenceUploadHint }}</p>

                        <!-- FILE ĐÍNH KÈM: upload PC + dòng tên file từ evd -->
                        <div v-if="hasFileAttachmentsSection">
                          <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            File đính kèm
                          </p>
                          <ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <li v-for="row in pendingEvidenceFiles" :key="'f-' + row.id"
                              class="flex items-center gap-3 px-3 py-2.5">
                              <span
                                class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">FILE</span>
                              <i class="fas fa-file-alt shrink-0 text-slate-400" />
                              <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium text-slate-800" :title="row.file.name">{{
                                  row.file.name
                                  }}</p>
                              </div>
                              <button type="button"
                                class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa file" @click="removePendingEvidenceFile(row.id)">
                                <i class="fas fa-times" />
                              </button>
                            </li>
                            <li v-for="row in pendingEvidenceNamedRows" :key="'evname-' + row.id"
                              class="flex items-center gap-3 px-3 py-2.5">
                              <span
                                class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">FILE</span>
                              <i class="fas fa-file-alt shrink-0 text-slate-400" />
                              <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium text-slate-800" :title="(row.name ?? '').trim()">
                                  {{ (row.name ?? '').trim() }}
                                </p>
                              </div>
                              <button type="button"
                                class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa minh chứng (gỡ cả tên và đường dẫn)" @click="removePendingEvidenceUrl(row.id)">
                                <i class="fas fa-times" />
                              </button>
                            </li>
                          </ul>
                        </div>

                        <!-- URL ĐƯỜNG DẪN MINH CHỨNG: luôn hiển thị url (đường dẫn hoặc http) -->
                        <div v-if="hasEvidenceUrlList">
                          <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            URL đường dẫn minh chứng
                          </p>
                          <ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-indigo-100 bg-white">
                            <li v-for="row in pendingEvidenceUrls" :key="'u-' + row.id"
                              class="flex items-center gap-2 px-3 py-2.5">
                              <span
                                class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600">URL</span>
                              <i class="fas fa-external-link-alt shrink-0 text-xs text-slate-400" />
                              <div class="min-w-0 flex-1">
                                <a :href="row.url" target="_blank" rel="noopener noreferrer"
                                  class="block truncate text-sm font-medium text-indigo-700 hover:underline"
                                  :title="row.url">
                                  {{ row.url }}
                                </a>
                              </div>
                              <button type="button"
                                class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa URL" @click="removePendingEvidenceUrl(row.id)">
                                <i class="fas fa-times" />
                              </button>
                            </li>
                          </ul>
                        </div>
                        <p v-if="!hasEvidenceAttachments"
                          class="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500">
                          Chưa có file hoặc URL - thêm ở hai ô phía trên
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <h4 class="flex items-center text-sm font-bold text-slate-700">
                        <i class="fas fa-comment-alt mr-2 text-slate-500" />
                        Ghi chú (Comment cho PM)
                      </h4>
                    </div>
                    <div class="p-4">
                      <textarea v-model="evidenceNoteDraft" rows="3"
                        placeholder="Nhập diễn giải thêm về bằng chứng của bạn..."
                        :readonly="evidenceDrawerReadOnly"
                        class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="flex items-center justify-between border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <!-- LEFT: Select -->
              <div class="flex flex-col">
                <label class="mb-1 text-xs font-semibold text-slate-600">
                  Evaluation
                </label>
                <select
                  class="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-1 focus:ring-sky-500 disabled:cursor-default disabled:bg-slate-50"
                  :disabled="evidenceDrawerReadOnly"
                  :value="detailSelfScore ?? ''" @change="
                    detailSelfScore =
                    ($event.target as HTMLSelectElement).value === ''
                      ? null
                      : parseInt(($event.target as HTMLSelectElement).value, 10)
                    ">
                  <option value="" disabled>- Chưa chọn -</option>
                  <option v-for="n in 5" :key="'ds-' + n" :value="n">{{ n }}</option>
                </select>
              </div>

              <!-- RIGHT: Buttons -->
              <div class="flex items-center space-x-3">
                <button type="button"
                  class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  @click="closeEvidencePanel">
                  Hủy bỏ
                </button>

                <button v-if="!evidenceDrawerReadOnly" type="button"
                  class="flex items-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                  :disabled="!canSaveEvidence || saving"
                  :title="!canSaveEvidence ? 'Vui lòng chọn điểm tự đánh giá (1–5) trước khi lưu' : undefined"
                  @click="saveEvidenceDetail">
                  <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'" class="mr-2 text-sm" />
                  Lưu Evidence
                </button>
                <span v-else class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                  Chỉ xem — không lưu chỉnh sửa
                </span>
              </div>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.evidence-drawer-enter-active,
.evidence-drawer-leave-active {
  transition: opacity 0.3s ease;
}

.evidence-drawer-enter-active .evidence-drawer-panel,
.evidence-drawer-leave-active .evidence-drawer-panel {
  transition: transform 0.3s ease-in-out;
}

.evidence-drawer-enter-from,
.evidence-drawer-leave-to {
  opacity: 0;
}

.evidence-drawer-enter-from .evidence-drawer-panel,
.evidence-drawer-leave-to .evidence-drawer-panel {
  transform: translateX(100%);
}
</style>
