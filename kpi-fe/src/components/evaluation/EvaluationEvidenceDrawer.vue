<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import type { KpiItem } from '@/types/kpi'
import {
  resolveFormMode,
  ratioLabels,
  computeRatioPreview,
  parsePmPortfolioEvidenceString,
  normalizeDetailSelfScore,
  normalizeCalculationRuleCode,
  CALC_RULE_COMMENT,
  CALC_RULE_AVERAGE,
  parseNumericFromField,
  CALC_TYPE_PLAN_OVER_ACTUAL,
  normalizeEvidenceHref,
  isEvidenceImageUrl,
} from '@/utils/memberKpiHelpers'
import type { EvidenceFormMode } from '@/utils/memberKpiHelpers'
import {
  parseScoringRulesFromTargetDescriptionStored,
  resolveScoringScoreForMetric,
} from '@/utils/kpiScoringRulesDsl'

const props = defineProps<{
  open: boolean
  item: Record<string, unknown> | null
  /**
   * Khi true (vd. tab KPI cá nhân GM): ẩn Self Score trong thân form, hiển thị một dòng ở footer
   * cạnh Hủy/Lưu — chỉ đọc (`disabled`).
   */
  selfScoreFooterReadonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [payload: {
    id: string | undefined
    actualResult: string
    selfScore: number | null
    evidenceNote: string
    files: { id: string; file: File }[]
    urls: { id: string; url: string; name?: string }[]
  }]
}>()

const toast = useToast()

type PlanRow = { id: string; plan: string; actual: string; comment: string }

function newPlanRow(): PlanRow {
  return {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    plan: '',
    actual: '',
    comment: '',
  }
}

const selfScoreDraft = ref<number | null>(null)
const evidenceNoteDraft = ref('')
const contentDraft = ref('')
/** CALC_RULE 803: kết quả thực tế (Actual) — bắt buộc khi lưu. */
const commentActualDraft = ref('')
const planRows = ref<PlanRow[]>([newPlanRow()])
const pendingEvidenceFiles = ref<{ id: string; file: File }[]>([])
const pendingEvidenceUrls = ref<{ id: string; url: string; name?: string }[]>([])
const evidenceUrlDraft = ref('')

const EVIDENCE_MAX_FILES = 5
const EVIDENCE_MAX_URLS = 5
const EVIDENCE_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png'

const itemAsKpi = computed((): KpiItem | null => {
  const it = props.item
  if (!it) return null
  return {
    id: String(it.id ?? ''),
    code: String(it.code ?? ''),
    name: String(it.name ?? ''),
    target: String(it.target ?? ''),
    weight: Number(it.weight ?? 0),
    group: String(it.group ?? ''),
    calculationRuleCode: (() => {
      const r = it.calculationRuleCode
      if (r == null || r === '') return null
      const n = Number(r)
      return Number.isFinite(n) ? Math.trunc(n) : null
    })(),
    calculationTypeCode:
      it.calculationTypeCode != null ? Number(it.calculationTypeCode) : null,
    evidenceStatus: 'missing',
    selfScore: null,
    pmScore: null,
    leaderScore: null,
  }
})

const drawerFormMode = computed<EvidenceFormMode>(() => {
  const k = itemAsKpi.value
  if (!k) return 'comment'
  return resolveFormMode(k)
})

/** Chỉ KPI CALC_RULE = 803 (COMMENT) mới bắt buộc ô Actual riêng ngoài Content. */
const isCommentRule803 = computed(() => {
  const k = itemAsKpi.value
  if (!k) return false
  return normalizeCalculationRuleCode(k.calculationRuleCode) === CALC_RULE_COMMENT
})

const scoringRulesNormalized = computed(() => {
  try {
    return parseScoringRulesFromTargetDescriptionStored(props.item?.targetDescription ?? null)
  } catch {
    return []
  }
})

function averageMetric802FromPlanRows(
  rows: PlanRow[],
  calculationTypeCode: number | null | undefined,
): number | null {
  const ratios: number[] = []
  for (const row of rows) {
    const plan = parseNumericFromField(row.plan)
    const actual = parseNumericFromField(row.actual)
    if (plan == null || actual == null) continue
    if (calculationTypeCode === CALC_TYPE_PLAN_OVER_ACTUAL) {
      if (actual === 0) continue
      ratios.push((plan / actual) * 100)
    } else {
      if (plan === 0) continue
      ratios.push((actual / plan) * 100)
    }
  }
  if (ratios.length === 0) return null
  return ratios.reduce((a, b) => a + b, 0) / ratios.length
}

/** Điểm 1–5 theo quy tắc GM + Actual / Plan–Actual đang nhập (đồng bộ BE khi Lưu). */
const previewResolvedScore = computed((): number | null => {
  const rules = scoringRulesNormalized.value
  if (!rules.length) return null
  const k = itemAsKpi.value
  if (!k) return null
  const rule = normalizeCalculationRuleCode(k.calculationRuleCode)
  let metric: number | null = null
  if (rule === CALC_RULE_COMMENT && isCommentRule803.value) {
    metric = parseNumericFromField(commentActualDraft.value)
  } else if (rule === CALC_RULE_AVERAGE) {
    metric = averageMetric802FromPlanRows(planRows.value, k.calculationTypeCode)
  }
  return resolveScoringScoreForMetric(metric, rules)
})

const footerSelfScoreDisplayed = computed(() => {
  const p = previewResolvedScore.value
  if (p != null) return p
  return selfScoreDraft.value
})

/** Chuỗi JSON evidences: ưu tiên `evidences`, fallback `actualResult`; object (axios đã parse JSON) → stringify. */
function evidenceJsonRawFromItem(it: Record<string, unknown>): string {
  const ev = it.evidences
  const ar = it.actualResult
  let pick: unknown = null
  if (typeof ev === 'string' && ev.trim() !== '') pick = ev.trim()
  else if (ev != null && typeof ev === 'object') pick = ev
  else if (typeof ar === 'string' && ar.trim() !== '') pick = ar.trim()
  else if (ar != null && typeof ar === 'object') pick = ar

  if (pick == null) return ''
  if (typeof pick === 'string') return pick
  try {
    return JSON.stringify(pick)
  } catch {
    return ''
  }
}

function hydrateFromItem() {
  const it = props.item
  if (!it) return
  commentActualDraft.value = ''
  selfScoreDraft.value = normalizeDetailSelfScore(it.selfScore)
  const rawEvidence = evidenceJsonRawFromItem(it)
  const parsed = parsePmPortfolioEvidenceString(rawEvidence)
  evidenceNoteDraft.value = parsed.note

  const rule803 = normalizeCalculationRuleCode(it.calculationRuleCode) === CALC_RULE_COMMENT
  if (rule803 && rawEvidence.trim().startsWith('{')) {
    try {
      const o = JSON.parse(rawEvidence.trim()) as Record<string, unknown>
      if (typeof o.actual === 'string') commentActualDraft.value = o.actual
    } catch {
      /* ignore */
    }
  }

  if (drawerFormMode.value === 'comment') {
    const fromRows = parsed.rows.length
      ? parsed.rows
          .map((r) =>
            [r.plan, r.actual, r.comment].filter((x) => String(x).trim()).join('\n'),
          )
          .filter(Boolean)
          .join('\n\n')
      : ''
    contentDraft.value = parsed.content.trim()
      ? parsed.content
      : fromRows || parsed.legacyPlain || ''
    planRows.value = [newPlanRow()]
  } else {
    contentDraft.value = parsed.content
    if (parsed.rows.length > 0) {
      planRows.value = parsed.rows.map((r, i) => ({
        id: `r-${i}-${Math.random().toString(36).slice(2, 7)}`,
        plan: r.plan,
        actual: r.actual,
        comment: r.comment,
      }))
    } else if (parsed.legacyPlain) {
      planRows.value = [{ ...newPlanRow(), actual: parsed.legacyPlain }]
    } else {
      planRows.value = [newPlanRow()]
    }
  }

  pendingEvidenceFiles.value = []
  pendingEvidenceUrls.value = []
  evidenceUrlDraft.value = ''

  const trimmed = rawEvidence.trim()
  if (trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>
      const buckets = [o.urls, o.files, o.evd].filter(Array.isArray) as unknown[][]
      const merged: { id: string; url: string; name?: string }[] = []
      for (const arr of buckets) {
        for (const entry of arr) {
          if (entry == null) continue
          if (typeof entry === 'string') {
            const u = entry.trim()
            if (u) merged.push({ id: Math.random().toString(), url: u })
            continue
          }
          if (typeof entry === 'object' && 'url' in (entry as object)) {
            const r = entry as { url?: unknown; name?: unknown }
            const url = String(r.url ?? '').trim()
            if (!url) continue
            const name = String(r.name ?? '').trim()
            merged.push({
              id: Math.random().toString(),
              url,
              ...(name ? { name } : {}),
            })
          }
        }
      }
      pendingEvidenceUrls.value = merged
    } catch {
      /* ignore */
    }
  }
}

watch(
  () => [props.open, props.item] as const,
  ([isOpen, it]) => {
    if (isOpen && it) {
      hydrateFromItem()
    }
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
  { flush: 'sync' },
)

onUnmounted(() => {
  document.body.style.overflow = ''
})

function buildSerializedActual(): string {
  const mode = drawerFormMode.value
  const note = evidenceNoteDraft.value.trim()
  const content = contentDraft.value.trim()

  if (mode === 'comment') {
    const o: Record<string, unknown> = {}
    const k = itemAsKpi.value
    const rule803 = k && normalizeCalculationRuleCode(k.calculationRuleCode) === CALC_RULE_COMMENT
    if (rule803) {
      const act = String(commentActualDraft.value ?? '').trim()
      if (act) o.actual = act
    }
    if (content) o.content = content
    if (note) o.note = note
    return Object.keys(o).length ? JSON.stringify(o) : ''
  }

  const mapped = planRows.value.map(({ plan, actual, comment }) => ({
    plan: plan.trim(),
    actual: actual.trim(),
    ...(comment.trim() ? { comment: comment.trim() } : {}),
  }))
  const rows = mapped.filter((r) => r.plan || r.actual || ('comment' in r && r.comment))

  const o: Record<string, unknown> = {}
  if (rows.length) o.planActualRecords = rows
  if (note) o.note = note
  return Object.keys(o).length ? JSON.stringify(o) : ''
}

const handleSave = () => {
  if (
    drawerFormMode.value === 'comment' &&
    isCommentRule803.value &&
    !String(commentActualDraft.value ?? '').trim()
  ) {
    toast.warning('Vui lòng nhập Actual (bắt buộc với KPI dạng 803 — nhận xét / văn bản).')
    return
  }
  emit('save', {
    id: props.item?.id != null ? String(props.item.id) : undefined,
    actualResult: buildSerializedActual(),
    selfScore: selfScoreDraft.value,
    evidenceNote: evidenceNoteDraft.value,
    files: pendingEvidenceFiles.value,
    urls: pendingEvidenceUrls.value,
  })
}

function onEvidenceFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    Array.from(input.files).forEach((file) => {
      if (pendingEvidenceFiles.value.length < EVIDENCE_MAX_FILES) {
        pendingEvidenceFiles.value.push({ id: Math.random().toString(), file })
      }
    })
  }
  input.value = ''
}

function removeFile(id: string) {
  pendingEvidenceFiles.value = pendingEvidenceFiles.value.filter((f) => f.id !== id)
}

function addUrl() {
  if (evidenceUrlDraft.value && pendingEvidenceUrls.value.length < EVIDENCE_MAX_URLS) {
    pendingEvidenceUrls.value.push({ id: Math.random().toString(), url: evidenceUrlDraft.value })
    evidenceUrlDraft.value = ''
  }
}

function removeUrl(id: string) {
  pendingEvidenceUrls.value = pendingEvidenceUrls.value.filter((u) => u.id !== id)
}

function addPlanRow() {
  planRows.value.push(newPlanRow())
}

function removePlanRow(id: string) {
  if (planRows.value.length <= 1) return
  planRows.value = planRows.value.filter((r) => r.id !== id)
}

const calcTypeLabel = computed(() =>
  props.item?.calculationTypeCode != null
    ? ratioLabels(Number(props.item.calculationTypeCode))
    : ratioLabels(undefined),
)

const attachmentSectionTitle = computed(() =>
  drawerFormMode.value === 'comment'
    ? 'Tài liệu Minh chứng Đính kèm (Bổ trợ)'
    : 'Minh chứng Đính kèm',
)

const hasEvidenceAttachments = computed(
  () => pendingEvidenceFiles.value.length > 0 || pendingEvidenceUrls.value.length > 0,
)

const selfScoreInFooter = computed(() => !!props.selfScoreFooterReadonly)
</script>

<template>
  <Teleport to="body">
    <Transition name="evidence-drawer">
      <div
        v-if="open && item"
        class="fixed inset-0 z-[100] flex justify-end"
        role="dialog"
      >
        <div
          class="evidence-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          @click="emit('close')"
        />
        <aside
          class="evidence-drawer-panel relative flex h-full w-full max-w-[700px] flex-col overflow-hidden bg-slate-50 shadow-2xl"
        >
          <div
            class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm"
          >
            <div>
              <h2 class="flex items-center text-lg font-bold text-slate-800">
                <i class="fas fa-clipboard-check mr-2 text-indigo-600" />
                Cập nhật KPI & Minh chứng
              </h2>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              @click="emit('close')"
            >
              <i class="fas fa-times text-lg" />
            </button>
          </div>

          <div class="relative shrink-0 overflow-hidden bg-slate-800 p-5 text-white">
            <div class="relative z-10">
              <span
                class="mb-1.5 inline-block rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm"
                >{{ item.code }}</span
              >
              <h3 class="mb-1 text-xl font-bold">{{ item.name }}</h3>
              <p class="text-sm text-slate-300">Target: {{ item.target }}</p>
            </div>
          </div>

          <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <!-- Average (số liệu + tỉ lệ) -->
            <div
              v-if="drawerFormMode === 'average'"
              class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div
                class="flex items-center justify-between border-b border-blue-100 bg-blue-50/50 px-4 py-3"
              >
                <h4 class="flex items-center text-sm font-bold text-blue-800">
                  <i class="fas fa-calculator mr-2 text-blue-600" />
                  Khai báo số liệu (Auto tỉ lệ)
                </h4>
                <span
                  class="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                  >{{ calcTypeLabel.formula }}</span
                >
              </div>
              <div class="space-y-4 p-4">
                <div
                  v-if="!selfScoreInFooter"
                  class="flex items-center gap-4 border-b border-slate-100 pb-4"
                >
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-600"
                    >Self Score:</label
                  >
                  <select
                    v-model="selfScoreDraft"
                    class="w-32 cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option :value="null">-</option>
                    <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>

                <div
                  v-for="(row, rowIdx) in planRows"
                  :key="row.id"
                  class="rounded-lg border border-blue-100/80 bg-white p-3 shadow-sm"
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-blue-800"
                      >Record {{ rowIdx + 1 }}</span
                    >
                    <button
                      v-if="planRows.length > 1"
                      type="button"
                      class="rounded p-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Xóa dòng"
                      @click="removePlanRow(row.id)"
                    >
                      <i class="fas fa-trash-alt" />
                    </button>
                  </div>
                  <div class="space-y-3">
                    <div>
                      <label class="mb-1 block text-xs font-bold text-slate-600">Comment</label>
                      <textarea
                        v-model="row.comment"
                        rows="2"
                        placeholder="Ghi chú thêm…"
                        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label class="mb-1 block text-xs font-bold text-slate-600">{{
                          calcTypeLabel.plan
                        }}</label>
                        <input
                          v-model="row.plan"
                          type="text"
                          inputmode="decimal"
                          placeholder="0"
                          class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs font-bold text-slate-600">{{
                          calcTypeLabel.actual
                        }}</label>
                        <input
                          v-model="row.actual"
                          type="text"
                          inputmode="decimal"
                          placeholder="0"
                          class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="item.calculationTypeCode != null"
                    class="mt-2 flex items-center gap-2"
                  >
                    <span class="text-[10px] font-semibold text-slate-500">Kết quả tính:</span>
                    <span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                      {{
                        computeRatioPreview(
                          row.plan,
                          row.actual,
                          Number(item.calculationTypeCode),
                        ) ?? '—'
                      }}
                    </span>
                  </div>
                </div>

                <div class="flex justify-end">
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

            <!-- Comment (803): mục tiêu / kết quả — chỉ Content + Self Score, không Record/Plan/Actual -->
            <div
              v-else
              class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div class="flex items-center border-b border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <h4 class="text-sm font-bold text-emerald-900">
                  <i class="fas fa-envelope-open-text mr-2 text-emerald-600" />
                  Khai báo Mục tiêu / Kết quả
                </h4>
              </div>
              <div class="space-y-4 p-4">
                <div
                  v-if="!selfScoreInFooter"
                  class="flex items-center gap-4 border-b border-slate-100 pb-4"
                >
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-600"
                    >Self Score:</label
                  >
                  <select
                    v-model="selfScoreDraft"
                    class="w-32 cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option :value="null">-</option>
                    <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>

                <div v-if="isCommentRule803" class="space-y-2">
                  <label class="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <i class="fas fa-chart-line text-emerald-600" aria-hidden="true" />
                    Actual
                    <span class="font-extrabold text-rose-600">*</span>
                  </label>
                  <input
                    v-model="commentActualDraft"
                    type="text"
                    name="kpi-comment-actual"
                    autocomplete="off"
                    placeholder="Nhập kết quả thực tế / chỉ số Actual (bắt buộc)…"
                    required
                    class="w-full rounded-md border-2 border-emerald-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label class="mb-2 block text-xs font-bold text-slate-700">
                    <i class="fas fa-list-ul mr-1 text-emerald-600" />
                    Nội dung nhận xét / diễn giải (Content)
                  </label>
                  <textarea
                    v-model="contentDraft"
                    rows="8"
                    placeholder="Mô tả chi tiết bối cảnh, kết quả hoặc diễn giải thêm để PM tham chiếu khi cho điểm..."
                    class="w-full resize-y rounded-md border-2 border-emerald-200/90 bg-white px-3 py-3 text-sm leading-relaxed text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>
            </div>

            <div class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 class="text-sm font-bold text-slate-700">
                  <i class="fas fa-paperclip mr-2 text-slate-500" />
                  {{ attachmentSectionTitle }}
                </h4>
              </div>
              <div class="space-y-4 p-5">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label
                    class="group relative block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-colors hover:border-indigo-400 hover:bg-slate-50"
                    :class="
                      pendingEvidenceFiles.length >= EVIDENCE_MAX_FILES
                        ? 'cursor-not-allowed opacity-60'
                        : ''
                    "
                  >
                    <input
                      v-if="pendingEvidenceFiles.length < EVIDENCE_MAX_FILES"
                      type="file"
                      multiple
                      :accept="EVIDENCE_ACCEPT_ATTR"
                      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      title="Chọn file (tối đa 5 file)"
                      @change="onEvidenceFilesChange"
                    />
                    <div
                      class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 transition-transform group-hover:scale-110"
                    >
                      <i class="fas fa-cloud-upload-alt text-2xl" />
                    </div>
                    <p class="text-sm font-bold text-slate-700">Tải File Lên (PC)</p>
                    <p class="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                      PDF, Word, Excel, CSV, JPG, PNG — tối đa {{ EVIDENCE_MAX_FILES }} file
                    </p>
                  </label>

                  <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <label class="mb-1 block text-sm font-bold text-slate-700">Thêm link URL</label>
                    <p class="mb-3 text-[10px] uppercase tracking-wider text-slate-400">
                      Jira, Confluence, Drive… — tối đa {{ EVIDENCE_MAX_URLS }} link
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
                          class="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:ring-1 focus:ring-violet-500"
                          :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS"
                          @keydown.enter.prevent="addUrl"
                        />
                      </div>
                      <button
                        type="button"
                        class="shrink-0 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="pendingEvidenceUrls.length >= EVIDENCE_MAX_URLS"
                        @click="addUrl"
                      >
                        Thêm URL
                      </button>
                    </div>
                  </div>
                </div>

                <div class="space-y-3">
                  <div
                    class="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <span class="inline-flex items-center gap-2">
                      <i class="fas fa-folder-open text-slate-500" aria-hidden="true" />
                      File (máy):
                      <span class="tabular-nums text-slate-900"
                        >{{ pendingEvidenceFiles.length }}/{{ EVIDENCE_MAX_FILES }}</span
                      >
                    </span>
                    <span class="hidden sm:inline text-slate-300" aria-hidden="true">|</span>
                    <span class="inline-flex items-center gap-2">
                      <i class="fas fa-link text-indigo-500" aria-hidden="true" />
                      URL / đường dẫn:
                      <span class="tabular-nums text-slate-900"
                        >{{ pendingEvidenceUrls.length }}/{{ EVIDENCE_MAX_URLS }}</span
                      >
                    </span>
                  </div>

                  <ul
                    v-if="hasEvidenceAttachments"
                    class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <li
                      v-for="row in pendingEvidenceFiles"
                      :key="'f-' + row.id"
                      class="flex items-center gap-3 px-3 py-2.5"
                    >
                      <span
                        class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600"
                        >FILE</span
                      >
                      <p class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {{ row.file.name }}
                      </p>
                      <button
                        type="button"
                        class="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Xóa file"
                        @click="removeFile(row.id)"
                      >
                        <i class="fas fa-times" />
                      </button>
                    </li>
                    <li
                      v-for="row in pendingEvidenceUrls"
                      :key="'u-' + row.id"
                      class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3"
                    >
                      <div class="flex min-w-0 flex-1 items-start gap-2">
                        <span
                          class="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600"
                          >URL</span
                        >
                        <div class="min-w-0 flex-1 space-y-2">
                          <a
                            :href="normalizeEvidenceHref(row.url)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="block truncate text-sm font-medium text-indigo-700 hover:underline"
                            >{{ row.name || row.url }}</a
                          >
                          <div v-if="isEvidenceImageUrl(row.url)" class="max-w-full">
                            <img
                              :src="normalizeEvidenceHref(row.url)"
                              :alt="row.name || 'Evidence'"
                              class="max-h-36 max-w-full rounded border border-slate-200 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="shrink-0 self-end rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:self-start"
                        title="Xóa URL"
                        @click="removeUrl(row.id)"
                      >
                        <i class="fas fa-times" />
                      </button>
                    </li>
                  </ul>

                  <p
                    v-else
                    class="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500"
                  >
                    Chưa có file hoặc URL — thêm ở hai ô phía trên
                  </p>
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h4 class="text-sm font-bold text-slate-700">
                  <i class="fas fa-comment-alt mr-2 text-sky-500" />
                  Ghi chú
                </h4>
              </div>
              <div class="p-4">
                <textarea
                  v-model="evidenceNoteDraft"
                  rows="4"
                  placeholder="Nhập diễn giải thêm về bằng chứng của bạn..."
                  class="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div
            class="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-4"
            :class="selfScoreInFooter ? 'sm:justify-between' : 'sm:justify-end'"
          >
            <div
              v-if="selfScoreInFooter"
              class="flex flex-wrap items-center gap-2 sm:min-w-0"
            >
              <span class="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-600"
                >Self Score</span
              >
              <span
                class="inline-flex min-h-[2.25rem] min-w-[2.5rem] items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-bold tabular-nums text-slate-800"
                aria-label="Self Score (chỉ xem)"
              >
                {{ footerSelfScoreDisplayed != null ? footerSelfScoreDisplayed : '—' }}
              </span>
            </div>
            <div class="flex justify-end gap-3 sm:ml-auto">
              <button
                type="button"
                class="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                @click="emit('close')"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                class="flex items-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white hover:bg-slate-900"
                @click="handleSave"
              >
                <i class="fas fa-save mr-2" />Lưu thay đổi
              </button>
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
</style>
