<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import type { EvidenceFormCase } from '@/types/kpi'
import {
  resolveFormMode,
  ratioLabels,
  computeRatioPreview,
  parseNumericFromField,
  WA_MONTH_OPTIONS,
} from '@/utils/memberKpiHelpers'
import {
  parseRulesFromTargetDescription,
  extractRawInputFromApiTargetDescription,
  resolveScoringScoreForMetric,
} from '@/utils/kpiScoringRulesDsl'

const props = defineProps<{
  open: boolean
  item: any | null
  mode?: 'detail' | 'feedback'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: any): void
}>()
const toast = useToast()
const isFeedbackMode = computed(() => props.mode === 'feedback')

// ── Constants ─────────────────────────────────────────────────────────────────
const EVIDENCE_MAX_FILES = 5
const EVIDENCE_MAX_URLS = 5
const EVIDENCE_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png'

// ── Internal state ────────────────────────────────────────────────────────────
const saving = ref(false)
const detailSelfScore = ref<number | null>(null)
const evidenceNoteDraft = ref('')
const leaderFeedbackDraft = ref('')
const gmCommentDraft = ref('')
const certificateOutcomeDraft = ref('')
const contentDraft = ref('')
const commentActualDraft = ref('')  // actual value input for CALC_RULE 803
const evidenceUrlDraft = ref('')
const evidenceUrlHint = ref('')
const evidenceUploadHint = ref('')

type PendingEvidenceFile = { id: string; file: File }
type PendingEvidenceUrl = { id: string; url: string; name?: string }
const pendingEvidenceFiles = ref<PendingEvidenceFile[]>([])
const pendingEvidenceUrls = ref<PendingEvidenceUrl[]>([])

type PlanActualRow = { id: string; comment: string; plan: string; actual: string }
const generalPlanActualRows = ref<PlanActualRow[]>([])

type WaTimeRow = { id: string; month: string; spent: string; standard: string }
const waTimeRows = ref<WaTimeRow[]>([])

function computeFiniteMaxMetricFromRules(
  rules: Array<
    | { score: number; operator: '<' | '<=' | '>' | '>=' | '='; value: number }
    | { score: number; min: number; max: number; loOpen?: boolean; hiOpen?: boolean }
  >,
): number | null {
  if (!rules.length) return null
  let hasUnboundedUpper = false
  let maxUpper: number | null = null
  for (const r of rules) {
    let upper: number | null = null
    if ('min' in r && 'max' in r) {
      upper = Number.isFinite(r.max) ? r.max : null
    } else {
      if (r.operator === '>' || r.operator === '>=') {
        hasUnboundedUpper = true
        continue
      }
      upper = Number.isFinite(r.value) ? r.value : null
    }
    if (upper != null) {
      maxUpper = maxUpper == null ? upper : Math.max(maxUpper, upper)
    }
  }
  if (hasUnboundedUpper) return null
  return maxUpper
}

// ── Computed ──────────────────────────────────────────────────────────────────

/** Derive group from kpiCode prefix (e.g. 'A.1.3' → 'A', 'B.2' → 'B') */
const itemGroup = computed<string>(() => {
  const code = String(props.item?.kpiCode ?? '')
  return code.split('.')[0] || ''
})

/**
 * canEditEvidence derived from statusCode:
 *   - 402, 403 (pending proposal/accept) → false
 *   - 404 (pending acceptance) → false
 *   - 501, 502, 601, 602, 603 → false (read-only)
 *   - 503 (first-half completed) → true (re-open for year-end edits)
 *   - otherwise (active editing states) → true
 */
const canEditEvidence = computed<boolean>(() => {
  if (isFeedbackMode.value) {
    const code = Number(props.item?.statusCode ?? 0)
    return code === 404
  }
  const code = props.item?.statusCode ?? 0
  const pendingProposal = code === 402 || code === 403
  const pendingAccept = code === 404
  const feedbackPending = code === 407
  const submittedRound = code === 501 || code === 502
    || code === 601 || code === 602 || code === 603
  if (pendingProposal || submittedRound || feedbackPending) return false
  if (pendingAccept) return false
  return true
})

const isReadOnly = computed(() => !canEditEvidence.value)
const canSaveEvidence = computed(() => {
  if (isReadOnly.value) return false
  if (isFeedbackMode.value) return String(leaderFeedbackDraft.value ?? '').trim().length > 0
  const feedbackOnly = Number(props.item?.statusCode ?? 0) === 404
  if (feedbackOnly) return leaderFeedbackDraft.value.trim().length > 0
  if (exceedsMaxMetricRule.value) return false
  // Auto-score available (CALC_RULE 803 with scoring rules + actual entered)
  if (computedEvalScore.value !== null) return true
  return detailSelfScore.value !== null
})

const drawerCase = computed<EvidenceFormCase>(() => {
  if (!props.item) return 'general'
  const g = itemGroup.value
  if (g === 'B') return 'category_b'
  const code = String(props.item.kpiCode ?? '')
  if (code.startsWith('A.2')) return 'monthly'
  return 'general'
})

/**
 * Adapt `resolveFormMode` (which expects a KpiItem) by constructing a minimal
 * KpiItem-like object from the leader assignment's calculationRuleCode.
 */
const drawerFormMode = computed<'average' | 'comment'>(() => {
  if (!props.item) return 'comment'
  return resolveFormMode({
    calculationRuleCode: props.item.calculationRuleCode ?? null,
  } as any)
})

const isUploadOnlyDrawer = computed(() => drawerCase.value === 'upload_only')

const attachmentHubTitle = computed(() => {
  if (isUploadOnlyDrawer.value) return 'Chứng chỉ / Bằng cấp Đính kèm'
  if (drawerCase.value === 'category_b') return 'Minh chứng & Đính kèm'
  return 'Tài liệu Minh chứng Đính kèm (Bổ trợ)'
})

const hasEvidenceAttachments = computed(
  () => pendingEvidenceFiles.value.length > 0 || pendingEvidenceUrls.value.length > 0,
)
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
const rejectedReasonNote = computed(() => {
  if (Number(props.item?.statusCode ?? 0) !== 406) return ''
  return String(props.item?.updateReason ?? props.item?.feedbackComment ?? '').trim()
})

/** Live ratio result computed across all plan/actual rows (average mode only) */
const averageRatioResult = computed<string | undefined>(() => {
  if (drawerFormMode.value !== 'average') return undefined
  const calcTypeCode = props.item?.calculationTypeCode ?? null
  const values = generalPlanActualRows.value
    .map(r => computeRatioPreview(r.plan, r.actual, calcTypeCode))
    .filter(Boolean)
    .map(r => parseNumericFromField(r as string))
    .filter((n): n is number => n != null)
  if (!values.length) return undefined
  const avg = values.reduce((sum, x) => sum + x, 0) / values.length
  return `${avg.toFixed(1)}%`
})

// Scoring rules from item's targetDescription (GM-created KPIs with DSL rules)
const scoringRulesFromItem = computed(() => {
  const target = props.item?.targetDescription ?? props.item?.target ?? ''
  return parseRulesFromTargetDescription(target)
})

const scoringRawInput = computed(() => {
  const target = props.item?.targetDescription ?? props.item?.target ?? ''
  return extractRawInputFromApiTargetDescription(target)
})

const autoScoreMetric = computed((): number | null => {
  if (drawerFormMode.value === 'comment') {
    const actual = String(commentActualDraft.value ?? '').trim()
    if (!actual) return null
    const v = Number.parseFloat(actual)
    return Number.isFinite(v) ? v : null
  }
  if (drawerFormMode.value === 'average') {
    const calcTypeCode = props.item?.calculationTypeCode ?? null
    const values = generalPlanActualRows.value
      .map(r => computeRatioPreview(r.plan, r.actual, calcTypeCode))
      .filter(Boolean)
      .map(r => parseNumericFromField(r as string))
      .filter((n): n is number => n != null)
    if (!values.length) return null
    return values.reduce((sum, x) => sum + x, 0) / values.length
  }
  return null
})

const maxMetricAllowedByRules = computed(() =>
  computeFiniteMaxMetricFromRules(scoringRulesFromItem.value),
)

const exceedsMaxMetricRule = computed(() => {
  const metric = autoScoreMetric.value
  const maxAllowed = maxMetricAllowedByRules.value
  if (metric == null || maxAllowed == null) return false
  return metric > maxAllowed
})

// Auto-computed score from metric + scoring rules (comment/average mode)
const computedEvalScore = computed((): number | null => {
  const metric = autoScoreMetric.value
  if (metric == null) return null
  const rules = scoringRulesFromItem.value
  if (!rules.length) return null
  return resolveScoringScoreForMetric(metric, rules)
})

// ── Form initialization ───────────────────────────────────────────────────────
function initForm() {
  if (!props.item) return
  const it = props.item
  const jsonSource = it.evidencesJson || it.evidences || '{}'

  evidenceUploadHint.value = ''
  evidenceUrlHint.value = ''
  evidenceUrlDraft.value = ''
  contentDraft.value = ''
  pendingEvidenceFiles.value = []

  detailSelfScore.value = it.endSelfScore ?? it.selfScore ?? null
  evidenceNoteDraft.value = it.evidenceNote || ''
  certificateOutcomeDraft.value = it.certificateOutcomeNote || ''

  try {
    const parsed = JSON.parse(jsonSource)

    if (parsed.planActualRecords?.length) {
      generalPlanActualRows.value = parsed.planActualRecords.map((r: any, i: number) => ({
        id: `p-${i}`,
        comment: r.comment || '',
        plan: r.plan || '',
        actual: r.actual || '',
      }))
    } else {
      generalPlanActualRows.value = [{ id: 'p-0', comment: '', plan: '', actual: '' }]
    }

    if (parsed.waTimeRecords?.length) {
      waTimeRows.value = parsed.waTimeRecords.map((r: any, i: number) => ({
        id: `w-${i}`,
        month: String(r.month),
        spent: String(r.spent),
        standard: String(r.standard),
      }))
    } else {
      waTimeRows.value = [{ id: 'w-0', month: '1', spent: '', standard: '' }]
    }

    if (parsed.content) contentDraft.value = parsed.content
    commentActualDraft.value = String(parsed.actual ?? '')
    leaderFeedbackDraft.value = String(it.feedbackComment ?? parsed.leaderFeedback ?? '')
    gmCommentDraft.value = String(parsed.gmComment ?? '')

    const files = parsed.files || parsed.evd || []
    pendingEvidenceUrls.value = files
      .map((f: any, i: number) => {
        const url = String(f.url ?? '').trim()
        return url ? { id: `u-${i}`, url, name: f.name || '' } : null
      })
      .filter(Boolean)
  } catch {
    generalPlanActualRows.value = [{ id: 'p-0', comment: '', plan: '', actual: '' }]
    waTimeRows.value = [{ id: 'w-0', month: '1', spent: '', standard: '' }]
    pendingEvidenceUrls.value = []
    contentDraft.value = ''
    commentActualDraft.value = ''
    leaderFeedbackDraft.value = ''
    gmCommentDraft.value = ''
  }
}

watch(
  () => props.open,
  isOpen => {
    if (isOpen) {
      initForm()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
)

// ── File handling ─────────────────────────────────────────────────────────────
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'])
const allowedMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
])

function isFileAllowed(file: File): boolean {
  const ext = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : ''
  return (ext && allowedExtensions.has(ext)) || (!!file.type && allowedMimes.has(file.type))
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
    if (slot <= 0) { truncated = true; break }
    if (!isFileAllowed(file)) { rejected.push(file.name); continue }
    pendingEvidenceFiles.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
    })
    slot--
  }

  const parts: string[] = []
  if (rejected.length) parts.push(`Loại file không hỗ trợ: ${rejected.join(', ')}`)
  if (truncated) parts.push(`Tối đa ${EVIDENCE_MAX_FILES} file; một số bị bỏ qua.`)
  if (parts.length) evidenceUploadHint.value = parts.join(' | ')
}

function removePendingEvidenceFile(id: string) {
  pendingEvidenceFiles.value = pendingEvidenceFiles.value.filter(f => f.id !== id)
  if (pendingEvidenceFiles.value.length < EVIDENCE_MAX_FILES) evidenceUploadHint.value = ''
}

// ── URL handling ──────────────────────────────────────────────────────────────
function normalizeUrl(raw: string): string {
  const t = raw.trim()
  return !t ? '' : /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function addPendingEvidenceUrl() {
  evidenceUrlHint.value = ''
  const normalized = normalizeUrl(evidenceUrlDraft.value)
  if (!normalized) { evidenceUrlHint.value = 'Vui lòng nhập URL hợp lệ.'; return }
  if (!isValidUrl(normalized)) { evidenceUrlHint.value = 'URL không hợp lệ. Ví dụ: https://drive.google.com/...'; return }
  if (pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS) { evidenceUrlHint.value = `Tối đa ${EVIDENCE_MAX_URLS} URL.`; return }
  if (pendingEvidenceUrls.value.some(x => x.url === normalized)) { evidenceUrlHint.value = 'URL này đã tồn tại.'; return }
  pendingEvidenceUrls.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: normalized,
  })
  evidenceUrlDraft.value = ''
}

function removePendingEvidenceUrl(id: string) {
  pendingEvidenceUrls.value = pendingEvidenceUrls.value.filter(u => u.id !== id)
  if (pendingEvidenceUrls.value.length < EVIDENCE_MAX_URLS) evidenceUrlHint.value = ''
}

function onUrlKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); addPendingEvidenceUrl() }
}

// ── Plan/Actual row management ────────────────────────────────────────────────
function addPlanRow() {
  const hasIncomplete = generalPlanActualRows.value.some(r =>
    [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length > 0)
    && [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length === 0),
  )
  if (hasIncomplete) {
    toast.warning('Vui lòng nhập đủ Comment, Plan và Actual trước khi thêm dòng mới.')
    return
  }
  generalPlanActualRows.value.push({ id: Date.now().toString(), comment: '', plan: '', actual: '' })
}

function removePlanRow(id: string) {
  if (generalPlanActualRows.value.length > 1)
    generalPlanActualRows.value = generalPlanActualRows.value.filter(r => r.id !== id)
}

function addWaRow() {
  waTimeRows.value.push({ id: Date.now().toString(), month: '1', spent: '', standard: '' })
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function handleSave() {
  if (!props.item || !canSaveEvidence.value) return
  if (isFeedbackMode.value) {
    emit('save', {
      feedbackMode: true,
      feedbackComment: String(leaderFeedbackDraft.value ?? '').trim(),
    })
    return
  }
  if (exceedsMaxMetricRule.value) {
    toast.warning('Giá trị Actual/Kết quả tính vượt mức tối đa trong Quy tắc chấm điểm.')
    return
  }
  if (drawerFormMode.value === 'average') {
    const hasIncomplete = generalPlanActualRows.value.some(r =>
      [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length > 0)
      && [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length === 0),
    )
    if (hasIncomplete) {
      toast.warning('Mỗi dòng phải nhập đủ 3 trường: Comment, Plan và Actual.')
      return
    }
  }
  saving.value = true

  try {
    // Compute actualResult to display in the Actual Result column of the table
    let actualResult: string | null = null
    if (averageRatioResult.value) {
      actualResult = averageRatioResult.value
    } else if (drawerCase.value === 'monthly') {
      const totalSpent = waTimeRows.value.reduce((sum, r) => sum + (parseFloat(r.spent) || 0), 0)
      if (totalSpent > 0) actualResult = `${totalSpent}h`
    } else if (evidenceNoteDraft.value.trim()) {
      const note = evidenceNoteDraft.value.trim()
      actualResult = note.length > 40 ? note.slice(0, 40) + '…' : note
    } else if (contentDraft.value.trim()) {
      const content = contentDraft.value.trim()
      actualResult = content.length > 40 ? content.slice(0, 40) + '…' : content
    }

    const feedbackOnly = Number(props.item?.statusCode ?? 0) === 404
    // Prefer auto-computed score (CALC_RULE 803 with scoring rules) over manual
    const autoScore = computedEvalScore.value
    const effectiveScore = feedbackOnly ? null : (autoScore !== null ? autoScore : detailSelfScore.value)

    // For comment mode with actual value, use it as actualResult too
    const actualValTrimmed = String(commentActualDraft.value ?? '').trim()
    if (!actualResult && actualValTrimmed) actualResult = actualValTrimmed

    const evidencesObj: Record<string, unknown> = {
      note: evidenceNoteDraft.value,
      gmComment: gmCommentDraft.value,
      content: contentDraft.value,
      files: pendingEvidenceUrls.value.map(u => ({ url: u.url, name: u.name })),
      planActualRecords: generalPlanActualRows.value.filter(r => r.plan || r.actual || r.comment),
      waTimeRecords: waTimeRows.value.filter(r => r.spent || r.standard),
    }
    if (actualValTrimmed) {
      evidencesObj.actual = actualValTrimmed
      evidencesObj.result = actualValTrimmed
    }

    const payload = {
      selfScore: effectiveScore,
      evidenceNote: evidenceNoteDraft.value,
      gmComment: gmCommentDraft.value,
      certificateOutcomeNote: certificateOutcomeDraft.value,
      pendingEvidenceFiles: pendingEvidenceFiles.value,
      actualResult,
      evidencesJson: JSON.stringify(evidencesObj),
    }
    emit('save', payload)
  } finally {
    saving.value = false
  }
}

</script>

<template>
  <Teleport to="body">
    <Transition name="evidence-drawer">
      <div
        v-if="open && item"
        class="fixed inset-0 z-[100] flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
      >
        <div
          class="evidence-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          @click="$emit('close')"
        />
        <aside
          class="evidence-drawer-panel relative flex h-full max-h-[100dvh] w-full max-w-[700px] min-h-0 flex-col overflow-hidden bg-slate-50 shadow-2xl"
        >
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <h2
                id="evidence-drawer-title"
                class="flex items-center text-lg font-bold text-slate-800"
              >
                <i class="fas fa-clipboard-check mr-2 text-indigo-600" />
                Chi tiết Evidence
              </h2>
              <p class="mt-0.5 text-xs text-slate-500">
                Khai báo số liệu và đính kèm - bản nháp lưu trên trình duyệt; gửi server khi bạn
                bấm <span class="font-semibold text-slate-700">Submit Đánh Giá</span>.
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
              @click="$emit('close')"
            >
              <i class="fas fa-times text-lg" />
            </button>
          </div>

          <!-- Read-only banner -->
          <div
            v-if="isReadOnly"
            class="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-semibold leading-snug text-amber-950"
          >
            <i class="fas fa-eye mr-2 shrink-0 text-amber-600" />
            Chế độ chỉ xem - KPI đã nộp hoặc đang chờ duyệt; bạn vẫn xem được minh chứng, không
            lưu chỉnh sửa.
          </div>

          <div
            v-if="rejectedReasonNote"
            class="shrink-0 border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-xs leading-snug text-rose-900"
          >
            <p class="font-semibold">
              <i class="fas fa-triangle-exclamation mr-2 text-rose-600" />
              KPI đã bị từ chối - vui lòng chỉnh sửa và submit lại.
            </p>
            <p class="mt-1.5 whitespace-pre-wrap text-rose-800">
              {{ rejectedReasonNote }}
            </p>
          </div>

          <!-- KPI info banner -->
          <div class="relative shrink-0 overflow-hidden bg-slate-800 p-5 text-white">
            <div class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03]">
              <i class="fas fa-bullseye text-[10rem]" />
            </div>
            <div class="relative z-10">
              <div class="mb-1.5 flex items-center">
                <span
                  class=""
                >
                  {{ item.kpiCode || '' }}
                </span>
              </div>
              <h3 class="mb-1 text-xl font-bold">{{ item.kpiName || item.name }}</h3>
              <span
                  v-if="item.weight"
                  class="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Weight: {{ item.weight }}
                </span>
            </div>
          </div>

          <!-- Scrollable body -->
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 custom-scrollbar">
              <div class="flex flex-col gap-6">

                <!-- Category B: Language certificate block -->
                <div
                  v-if="!isFeedbackMode && drawerCase === 'category_b'"
                  class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm"
                >
                  <div class="flex items-start gap-3">
                    <i class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600" />
                    <div class="min-w-0">
                      <p class="font-bold text-indigo-950">Mục tiêu giao & chỉ tiêu chuẩn</p>
                      <p class="mt-1 text-xs text-slate-600">{{ item.targetDescription || '-' }}</p>
                    </div>
                  </div>
                  <p class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600">
                    Nếu kết quả thực tế <strong>khác</strong> mục tiêu trên - hãy ghi rõ chứng chỉ /
                    điểm số thực tế ở ô bên dưới và đính kèm bản scan hoặc link tra cứu.
                  </p>
                  <div>
                    <label class="mb-1 block text-xs font-bold text-slate-700">
                      Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                    </label>
                    <textarea
                      v-model="certificateOutcomeDraft"
                      rows="2"
                      placeholder="Ví dụ: JLPT N2 (12/2025) - đính kèm scan kết quả; mục tiêu TOEIC 700 chưa đạt."
                      :readonly="isReadOnly"
                      class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50 read-only:text-slate-700"
                    />
                  </div>
                </div>

                <!-- Non category_b: general / monthly forms -->
                <div v-if="!isFeedbackMode && drawerCase !== 'category_b'" class="flex flex-col gap-6">

                  <!-- Monthly: Work Amount table -->
                  <div
                    v-if="drawerCase === 'monthly'"
                    class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div class="flex items-center border-b border-blue-100 bg-blue-50/50 px-4 py-3">
                      <h4 class="flex items-center text-sm font-bold text-blue-800">
                        <i class="fas fa-calculator mr-2 text-blue-600" />
                        Khai báo Work Amount (A.2)
                      </h4>
                    </div>
                    <div class="p-4 overflow-x-auto">
                      <table class="w-full text-left text-sm">
                        <thead>
                          <tr class="text-xs uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
                            <th class="px-3 py-2">Tháng</th>
                            <th class="px-3 py-2">Spent (h)</th>
                            <th class="px-3 py-2">Std (h)</th>
                            <th class="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in waTimeRows" :key="row.id" class="border-b border-slate-100">
                            <td class="px-3 py-2">
                              <select
                                v-model="row.month"
                                :disabled="isReadOnly"
                                class="rounded border border-slate-300 p-1 text-sm"
                              >
                                <option v-for="m in WA_MONTH_OPTIONS" :key="m.value" :value="m.value">
                                  {{ m.label }}
                                </option>
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <input
                                v-model="row.spent"
                                :readonly="isReadOnly"
                                type="number"
                                class="w-20 rounded border border-slate-300 p-1 text-sm"
                              />
                            </td>
                            <td class="px-3 py-2">
                              <input
                                v-model="row.standard"
                                :readonly="isReadOnly"
                                type="number"
                                class="w-20 rounded border border-slate-300 p-1 text-sm"
                              />
                            </td>
                            <td class="px-3 py-2">
                              <button
                                v-if="!isReadOnly && waTimeRows.length > 1"
                                type="button"
                                class="rounded p-1 text-rose-500 hover:bg-rose-50"
                                @click="waTimeRows.splice(waTimeRows.indexOf(row), 1)"
                              >
                                <i class="fas fa-trash-alt text-xs" />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <button
                        v-if="!isReadOnly"
                        type="button"
                        class="mt-3 text-xs font-bold text-blue-600 hover:underline"
                        @click="addWaRow"
                      >
                        + Thêm tháng
                      </button>
                    </div>
                  </div>

                  <!-- General: Plan/Actual records - ONLY for average mode (calculationRuleCode = 802) -->
                  <div
                    v-else-if="drawerFormMode === 'average'"
                    class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div class="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-4 py-3">
                      <h4 class="flex items-center text-sm font-bold text-blue-800">
                        <i class="fas fa-calculator mr-2 text-blue-600" />
                        Khai báo Số liệu (Auto tính tỉ lệ)
                      </h4>
                      <span
                        v-if="item"
                        class="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                      >
                        {{ ratioLabels(item.calculationTypeCode).formula }}
                      </span>
                    </div>

                    <div class="p-4">
                      <div v-if="scoringRawInput" class="mt-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy tắc chấm điểm:</p>
                          <pre class="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{{ scoringRawInput }}</pre>
                      </div>
                      <div class="space-y-4 rounded-lg border border-blue-100 bg-blue-50/20 p-4 mt-4">
                        <div
                          v-for="row in generalPlanActualRows"
                          :key="row.id"
                          class="border-b border-blue-100/80 bg-transparent pb-3 last:border-b-0 last:pb-0"
                        >
                          <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">Comment</label>
                              <input
                                v-model="row.comment"
                                type="text"
                                :readonly="isReadOnly"
                                placeholder="Ghi chú thêm..."
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">
                                {{ ratioLabels(item?.calculationTypeCode).plan }}
                              </label>
                              <input
                                v-model="row.plan"
                                type="text"
                                inputmode="decimal"
                                placeholder="0"
                                :readonly="isReadOnly"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">
                                {{ ratioLabels(item?.calculationTypeCode).actual }}
                              </label>
                              <input
                                v-model="row.actual"
                                type="text"
                                inputmode="decimal"
                                placeholder="0"
                                :readonly="isReadOnly"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div class="flex items-end justify-end md:pb-[2px]">
                              <button
                                v-if="generalPlanActualRows.length > 1 && !isReadOnly"
                                type="button"
                                class="rounded p-2 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa dòng"
                                @click="removePlanRow(row.id)"
                              >
                                <i class="fas fa-trash-alt" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div v-if="!isReadOnly" class="flex items-center justify-between">
                          <div v-if="averageRatioResult" class="flex items-center gap-2">
                            <span class="text-[10px] font-semibold text-slate-500">Kết quả tính:</span>
                            <span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                              {{ averageRatioResult }}
                            </span>
                          </div>
                          <div v-else />
                          <button
                            type="button"
                            class="flex items-center rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                            @click="addPlanRow"
                          >
                            <i class="fas fa-plus mr-1" /> Thêm Record
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Comment mode (calculationRuleCode = 803): Actual input + content textarea -->
                  <div
                    v-else
                    class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div class="flex items-center border-b border-teal-100 bg-teal-50/50 px-4 py-3">
                      <h4 class="flex items-center text-sm font-bold text-teal-800">
                        <i class="fas fa-align-left mr-2 text-teal-600" />
                        Khai báo Mục tiêu / Kết quả
                      </h4>
                    </div>
                    <div class="flex flex-col gap-4 p-4">
                      <!-- Actual value input (shown when scoring rules are available) -->
                      <div v-if="scoringRulesFromItem.length > 0">
                        <div v-if="scoringRawInput" class="mt-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy tắc chấm điểm:</p>
                          <pre class="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{{ scoringRawInput }}</pre>
                        </div>
                        <label class="mb-1 block text-xs font-bold text-slate-700 mt-4">
                          <i class="fas fa-chart-line mr-1 text-emerald-500" />
                          Giá trị thực tế (Actual)
                        </label>
                        <input
                          v-model="commentActualDraft"
                          type="number"
                          inputmode="decimal"
                          step="any"
                          placeholder="Nhập số liệu thực tế..."
                          :readonly="isReadOnly"
                          class="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 read-only:bg-slate-50"
                        />
                      </div>
                      <!-- Content / description textarea -->
                      <div>
                        <label class="mb-1 block text-xs font-bold text-slate-700">
                          <i class="fas fa-align-left mr-1 text-teal-500" />
                          Nội dung nhận xét / diễn giải (Content)
                        </label>
                        <textarea
                          v-model="contentDraft"
                          rows="5"
                          placeholder="Mô tả chi tiết bối cảnh, kết quả hoặc diễn giải thêm để PM tham chiếu khi cho điểm..."
                          :readonly="isReadOnly"
                          class="w-full resize-none rounded-md border border-teal-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50 read-only:text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Attachment hub -->
                <div v-if="!isFeedbackMode" class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div v-show="isUploadOnlyDrawer" class="absolute left-0 top-0 h-1 w-full bg-pink-500" />
                  <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-paperclip mr-2 text-slate-500" />
                      <span :class="isUploadOnlyDrawer ? 'text-pink-600' : 'text-slate-700'">
                        {{ attachmentHubTitle }}
                      </span>
                    </h4>
                    <span
                      v-show="isUploadOnlyDrawer"
                      class="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-pink-700"
                    >
                      Bắt buộc
                    </span>
                  </div>
                  <div class="space-y-4 p-5">
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <!-- File upload zone -->
                      <label
                        class="group relative block rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-colors"
                        :class="
                          pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES || isReadOnly
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer hover:border-indigo-400 hover:bg-slate-50'
                        "
                      >
                        <input
                          v-if="pendingEvidenceFiles.length < EVIDENCE_MAX_FILES"
                          type="file"
                          multiple
                          :accept="EVIDENCE_ACCEPT_ATTR"
                          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          title="Chọn file (tối đa 5 file)"
                          :disabled="isReadOnly"
                          @change="onEvidenceFilesChange"
                        />
                        <div
                          class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 transition-transform group-hover:scale-110"
                        >
                          <i class="fas fa-cloud-upload-alt text-2xl" />
                        </div>
                        <p class="text-sm font-bold text-slate-700">Tải File Lên (PC)</p>
                        <p class="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                          PDF, Word, Excel, CSV, JPG, PNG - tối đa {{ EVIDENCE_MAX_FILES }} file
                        </p>
                      </label>

                      <!-- URL input -->
                      <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5">
                        <label class="mb-1 block text-sm font-bold text-slate-700">Thêm link URL</label>
                        <p class="mb-3 text-[10px] uppercase tracking-wider text-slate-400">
                          Jira, Confluence, Drive, cổng tra cứu điểm… - tối đa {{ EVIDENCE_MAX_URLS }} link
                        </p>
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                          <div class="relative min-w-0 flex-1">
                            <i
                              class="fas fa-link pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              v-model="evidenceUrlDraft"
                              type="text"
                              inputmode="url"
                              autocomplete="url"
                              placeholder="https://..."
                              class="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:ring-1 focus:ring-indigo-500"
                              :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS || isReadOnly"
                              @keydown="onUrlKeydown"
                            />
                          </div>
                          <button
                            type="button"
                            class="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS || isReadOnly"
                            @click="addPendingEvidenceUrl"
                          >
                            Thêm URL
                          </button>
                        </div>
                        <p v-if="evidenceUrlHint" class="mt-2 text-xs text-amber-700">
                          {{ evidenceUrlHint }}
                        </p>
                      </div>
                    </div>

                    <!-- Attachment stats + lists -->
                    <div class="space-y-4">
                      <div
                        class="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        <span class="inline-flex items-center gap-2">
                          <i class="fas fa-file-alt text-slate-500" aria-hidden="true" />
                          File (máy):
                          <span class="tabular-nums text-slate-900">
                            {{ evidenceFileSectionCount }}/{{ EVIDENCE_MAX_FILES }}
                          </span>
                        </span>
                        <span class="hidden sm:inline text-slate-300" aria-hidden="true">|</span>
                        <span class="inline-flex items-center gap-2">
                          <i class="fas fa-link text-indigo-500" aria-hidden="true" />
                          URL / đường dẫn:
                          <span class="tabular-nums text-slate-900">
                            {{ pendingEvidenceUrls.length }}/{{ EVIDENCE_MAX_URLS }}
                          </span>
                        </span>
                        <span
                          v-if="pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES || pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS"
                          class="ml-auto flex flex-wrap gap-2 text-[11px] font-medium text-amber-700"
                        >
                          <span v-if="pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES">Đủ file máy</span>
                          <span v-if="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS">Đủ ô link</span>
                        </span>
                      </div>
                      <p v-if="evidenceUploadHint" class="text-xs text-amber-700">
                        {{ evidenceUploadHint }}
                      </p>

                      <!-- File attachments list -->
                      <div v-if="hasFileAttachmentsSection">
                        <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          File đính kèm
                        </p>
                        <ul
                          class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <li
                            v-for="row in pendingEvidenceFiles"
                            :key="'f-' + row.id"
                            class="flex items-center gap-3 px-3 py-2.5"
                          >
                            <span
                              class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600"
                            >FILE</span>
                            <i class="fas fa-file-alt shrink-0 text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-sm font-medium text-slate-800" :title="row.file.name">
                                {{ row.file.name }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa file"
                              @click="removePendingEvidenceFile(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                          <li
                            v-for="row in pendingEvidenceNamedRows"
                            :key="'evname-' + row.id"
                            class="flex items-center gap-3 px-3 py-2.5"
                          >
                            <span
                              class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600"
                            >FILE</span>
                            <i class="fas fa-file-alt shrink-0 text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <p
                                class="truncate text-sm font-medium text-slate-800"
                                :title="(row.name ?? '').trim()"
                              >
                                {{ (row.name ?? '').trim() }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa minh chứng"
                              @click="removePendingEvidenceUrl(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                        </ul>
                      </div>

                      <!-- URL list -->
                      <div v-if="hasEvidenceUrlList">
                        <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          URL đường dẫn minh chứng
                        </p>
                        <ul
                          class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-indigo-100 bg-white"
                        >
                          <li
                            v-for="row in pendingEvidenceUrls"
                            :key="'u-' + row.id"
                            class="flex items-center gap-2 px-3 py-2.5"
                          >
                            <span
                              class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600"
                            >URL</span>
                            <i class="fas fa-external-link-alt shrink-0 text-xs text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <a
                                :href="row.url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="block truncate text-sm font-medium text-indigo-700 hover:underline"
                                :title="row.url"
                              >
                                {{ row.url }}
                              </a>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa URL"
                              @click="removePendingEvidenceUrl(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                        </ul>
                      </div>

                      <p
                        v-if="!hasEvidenceAttachments"
                        class="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500"
                      >
                        Chưa có file hoặc URL - thêm ở hai ô phía trên
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Note / comment for PM -->
                <div v-if="!isFeedbackMode" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-comment-alt mr-2 text-slate-500" />
                      Ghi chú (Comment cho PM)
                    </h4>
                  </div>
                  <div class="p-4">
                    <textarea
                      v-model="evidenceNoteDraft"
                      rows="3"
                      placeholder="Nhập diễn giải thêm về bằng chứng của bạn..."
                      :readonly="isReadOnly"
                      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50"
                    />
                  </div>
                </div>

                <!-- target_setup feedback + GM comment -->
                <div v-if="isFeedbackMode" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-message mr-2 text-slate-500" />
                      Feedback & GM Comment
                    </h4>
                  </div>
                  <div class="space-y-4 p-4">
                    <div>
                      <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Feedback của Leader (target setup)
                      </label>
                      <textarea
                        v-model="leaderFeedbackDraft"
                        rows="2"
                        placeholder="Ví dụ: KPI này cần điều chỉnh target hoặc timeline"
                        :readonly="isReadOnly"
                        class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50"
                      />
                    </div>
                    <div v-if="(gmCommentDraft || '').trim()">
                      <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        GM Comment
                      </label>
                      <textarea
                        v-model="gmCommentDraft"
                        rows="2"
                        placeholder="Ghi chú từ GM cho KPI này"
                        readonly
                        class="w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                      />
                    </div>
                  </div>
                </div>

                <!-- GM comment in detail mode -->
                <div
                  v-else-if="(gmCommentDraft || '').trim()"
                  class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-user-tie mr-2 text-slate-500" />
                      GM Comment
                    </h4>
                  </div>
                  <div class="p-4">
                    <textarea
                      v-model="gmCommentDraft"
                      rows="2"
                      readonly
                      class="w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Drawer footer -->
          <div
            class="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            <div v-if="!isFeedbackMode" class="flex flex-col">
              <!-- Auto-computed score (comment/average mode + scoring rules) -->
              <template
                v-if="
                  (drawerFormMode === 'comment' || drawerFormMode === 'average')
                  && scoringRulesFromItem.length > 0
                "
              >
                <label class="mb-1 text-xs font-semibold text-slate-600">Điểm (tự tính)</label>
                <div class="flex items-center gap-2 h-10">
                  <span
                    class="inline-flex min-w-[2.75rem] items-center justify-center rounded-md border px-3 py-2 text-sm font-bold"
                    :class="computedEvalScore !== null
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-400'"
                  >
                    {{ computedEvalScore !== null ? computedEvalScore : '—' }}
                  </span>
                  <span class="text-xs text-slate-500">/ 5</span>
                  <span v-if="computedEvalScore === null" class="text-xs text-slate-400">
                    {{ drawerFormMode === 'average' ? 'Nhập đủ số liệu để tính' : 'Nhập Actual để tính' }}
                  </span>
                </div>
                <p
                  v-if="exceedsMaxMetricRule"
                  class="mt-1 text-xs font-medium text-rose-600"
                >
                  Giá trị Actual/Kết quả tính đang vượt mức tối đa của Quy tắc chấm điểm.
                </p>
              </template>
              <!-- Manual score dropdown for average mode or KPIs without scoring rules -->
              <template v-else>
                <label class="mb-1 text-xs font-semibold text-slate-600">Evaluation</label>
                <select
                  class="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-1 focus:ring-sky-500 disabled:cursor-default disabled:bg-slate-50"
                  :disabled="isReadOnly"
                  :value="detailSelfScore ?? ''"
                  @change="
                    detailSelfScore =
                      ($event.target as HTMLSelectElement).value === ''
                        ? null
                        : parseInt(($event.target as HTMLSelectElement).value, 10)
                  "
                >
                  <option value="" disabled>- Chưa chọn -</option>
                  <option v-for="n in 5" :key="'ds-' + n" :value="n">{{ n }}</option>
                </select>
              </template>
            </div>
            <div v-else class="text-sm font-semibold text-violet-700">
              Gửi feedback cho KPI này
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                @click="$emit('close')"
              >
                Hủy bỏ
              </button>

              <button
                v-if="!isReadOnly"
                type="button"
                class="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="!canSaveEvidence || saving"
                :title="!canSaveEvidence
                  ? (isFeedbackMode
                    ? 'Vui lòng nhập feedback trước khi gửi'
                    : 'Vui lòng chọn điểm tự đánh giá (1–5) trước khi lưu')
                  : undefined"
                @click="handleSave"
              >
                <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'" class="text-xs" />
                {{ saving ? 'Đang lưu...' : (isFeedbackMode ? 'Gửi Feedback' : 'Lưu Evidence') }}
              </button>
              <span
                v-else
                class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500"
              >
                Chỉ xem - không lưu chỉnh sửa
              </span>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
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

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
</style>
