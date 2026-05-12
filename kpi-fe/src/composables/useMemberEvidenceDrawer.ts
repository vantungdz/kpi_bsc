/**
 * Evidence drawer composable — manages all reactive state, actions and form handlers
 * for the KPI evidence panel (slide-in drawer).
 *
 * Usage:
 *   // In parent (MemberDashboard.vue):
 *   const evidenceCtx = useMemberEvidenceDrawer()
 *   provide(EVIDENCE_DRAWER_KEY, evidenceCtx)
 *
 *   // In drawer component (MemberEvidenceDrawer.vue):
 *   const ctx = inject(EVIDENCE_DRAWER_KEY)!
 */
import { ref, computed, watch, onMounted, onUnmounted, type InjectionKey } from 'vue'
import { useToast } from 'vue-toastification'
import type { KpiItem, EvidenceFormCase } from '@/types/kpi'
import type { UrlNamePair } from '@/utils/memberKpiEvidenceDetail'
import { useMemberKpiDraftStore } from '@/stores/member-kpi-drafts.store'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import {
  resolveFormMode,
  computeRatioPreview,
  normalizeDetailSelfScore,
  isMonthlyWorkAmountCase,
  parseNumericFromField,
  WA_MONTH_OPTIONS,
  type EvidenceFormMode,
} from '@/utils/memberKpiHelpers'
import {
  parseRulesFromTargetDescription,
  extractRawInputFromApiTargetDescription,
  resolveScoringScoreForMetric,
} from '@/utils/kpiScoringRulesDsl'

// ── Types ────────────────────────────────────────────────────────────────────
export type PlanActualDraftRow = { id: string; plan: string; actual: string; comment: string }
export type WaTimeDraftRow = { id: string; month: string; spent: string; standard: string }
export type PendingEvidenceFile = { id: string; file: File }
export type PendingEvidenceUrl = { id: string; url: string; name?: string }

// ── Constants ────────────────────────────────────────────────────────────────
export const EVIDENCE_MAX_FILES = 5
export const EVIDENCE_MAX_URLS = 5
export const EVIDENCE_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png'

// ── Provide/inject key ───────────────────────────────────────────────────────
export type EvidenceDrawerContext = ReturnType<typeof useMemberEvidenceDrawer>
export const EVIDENCE_DRAWER_KEY: InjectionKey<EvidenceDrawerContext> = Symbol('memberEvidenceDrawer')

// ── Internal helpers ─────────────────────────────────────────────────────────
function newPlanActualRow(): PlanActualDraftRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    plan: '',
    actual: '',
    comment: '',
  }
}

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

function parseEvidencesJson(jsonSource: string): {
  note: string
  memberFeedback: string
  leaderFeedback: string
  gmComment: string
  content: string
  actual: string
  planActualRecords: Array<{ plan: string; actual: string; comment: string }>
  urlPairs: UrlNamePair[]
} {
  const raw = (jsonSource ?? '').trim()
  const empty = {
    note: '',
    memberFeedback: '',
    leaderFeedback: '',
    gmComment: '',
    content: '',
    actual: '',
    planActualRecords: [],
    urlPairs: [],
  }
  if (!raw || raw === '{}' || raw === 'null') return empty
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const note = String(o.note ?? o.text ?? '').trim()
    const memberFeedback = String(o.memberFeedback ?? '').trim()
    const leaderFeedback = String(o.leaderFeedback ?? '').trim()
    const gmComment = String(o.gmComment ?? '').trim()
    const content = String(o.content ?? '').trim()
    const actual = String(o.actual ?? '').trim()
    const planActualRecords = Array.isArray(o.planActualRecords)
      ? (o.planActualRecords as unknown[])
          .map(x => {
            if (!x || typeof x !== 'object') return null
            const r = x as Record<string, unknown>
            return {
              plan: String(r.plan ?? ''),
              actual: String(r.actual ?? ''),
              comment: String(r.comment ?? ''),
            }
          })
          .filter((r): r is { plan: string; actual: string; comment: string } => r !== null)
      : []
    const rawEvd = Array.isArray(o.evd) ? (o.evd as unknown[]) : []
    const rawFiles = Array.isArray(o.files) ? (o.files as unknown[]) : []
    const urlPairs = [...rawEvd, ...rawFiles]
      .map(x => {
        if (!x || typeof x !== 'object') return null
        const r = x as Record<string, unknown>
        const url = String(r.url ?? '').trim()
        return url ? { url, name: String(r.name ?? '').trim() } : null
      })
      .filter((r): r is UrlNamePair => r !== null)
    return { note, memberFeedback, leaderFeedback, gmComment, content, actual, planActualRecords, urlPairs }
  } catch {
    return empty
  }
}

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

export function averageRatioResult(
  rows: Array<{ plan: string; actual: string }>,
  calcTypeCode: number | null | undefined,
): string | undefined {
  const values = rows
    .map(r => computeRatioPreview(r.plan, r.actual, calcTypeCode))
    .filter(Boolean)
    .map(r => parseNumericFromField(r as string))
    .filter((n): n is number => n != null)

  if (!values.length) return undefined
  const avg = values.reduce((sum, x) => sum + x, 0) / values.length
  return `${avg.toFixed(1)}%`
}

function normalizeEvidenceUrlInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

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

function isValidEvidenceReference(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (t.startsWith('/')) return true
  return isValidEvidenceHttpUrl(t)
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

const allowedEvidenceExtensions = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png',
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

function resolveEvidenceCase(item: KpiItem): EvidenceFormCase {
  if (item.group === 'B') return 'category_b'
  if (item.evidenceFormCase === 'upload_only') return 'upload_only'
  if (isMonthlyWorkAmountCase(item)) return 'monthly'
  return 'general'
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useMemberEvidenceDrawer() {
  const toast = useToast()
  const memberKpiDraftStore = useMemberKpiDraftStore()

  // Reactive state
  const evidencePanelOpen = ref(false)
  const panelMode = ref<'detail' | 'feedback'>('detail')
  const selectedDrawerItem = ref<KpiItem | null>(null)
  const evidenceNoteDraft = ref('')
  const memberFeedbackDraft = ref('')
  const leaderFeedbackDraft = ref('')
  const gmCommentDraft = ref('')
  const certificateOutcomeDraft = ref('')
  const pendingEvidenceFiles = ref<PendingEvidenceFile[]>([])
  const pendingEvidenceUrls = ref<PendingEvidenceUrl[]>([])
  const evidenceUrlDraft = ref('')
  const evidenceUploadHint = ref('')
  const evidenceUrlHint = ref('')
  const detailSelfScore = ref<number | null>(null)
  const generalPlanActualRows = ref<PlanActualDraftRow[]>([newPlanActualRow()])
  const contentDraft = ref('')
  const commentActualDraft = ref('')  // actual value input for CALC_RULE 803
  const waTimeRows = ref<WaTimeDraftRow[]>([newWaTimeRow()])
  const waFormError = ref('')
  const saving = ref(false)

  // Computed
  const drawerCase = computed<EvidenceFormCase>(() => {
    if (!selectedDrawerItem.value) return 'general'
    return resolveEvidenceCase(selectedDrawerItem.value)
  })

  const isUploadOnlyDrawer = computed(() => drawerCase.value === 'upload_only')

  const drawerFormMode = computed<EvidenceFormMode>(() => {
    if (!selectedDrawerItem.value) return 'comment'
    return resolveFormMode(selectedDrawerItem.value)
  })

  // Scoring rules from item.target (only available for GM-created KPIs with DSL rules)
  const scoringRulesFromItem = computed(() => {
    const item = selectedDrawerItem.value as (KpiItem & { targetDescription?: string | null }) | null
    if (!item) return []
    const candidates = [
      item.targetDescription ?? '',
      item.target,
      item.description ?? '',
    ]
    for (const c of candidates) {
      const rules = parseRulesFromTargetDescription(c)
      if (rules.length) return rules
    }
    return []
  })

  // Raw DSL input string for display as a hint in the drawer
  const scoringRawInput = computed(() => {
    const item = selectedDrawerItem.value as (KpiItem & { targetDescription?: string | null }) | null
    if (!item) return ''
    const candidates = [
      item.targetDescription ?? '',
      item.target,
      item.description ?? '',
    ]
    for (const c of candidates) {
      const raw = extractRawInputFromApiTargetDescription(c)
      if ((raw ?? '').trim()) return raw
    }
    return ''
  })

  // Auto-computed score from commentActualDraft + scoringRulesFromItem (comment mode only)
  const computedEvalScore = computed((): number | null => {
    const metric = autoScoreMetric.value
    if (metric == null) return null
    const rules = scoringRulesFromItem.value
    if (!rules.length) return null
    return resolveScoringScoreForMetric(metric, rules)
  })

  // Metric used to map score from DSL rules
  const autoScoreMetric = computed((): number | null => {
    if (drawerFormMode.value === 'comment') {
      const actual = String(commentActualDraft.value ?? '').trim()
      if (!actual) return null
      const v = Number.parseFloat(actual)
      return Number.isFinite(v) ? v : null
    }
    if (drawerFormMode.value === 'average') {
      const item = selectedDrawerItem.value
      if (!item) return null
      const values = generalPlanActualRows.value
        .map(r => computeRatioPreview(r.plan, r.actual, item.calculationTypeCode))
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

  const hasDslScoringRules = computed(() =>
    (drawerFormMode.value === 'comment' || drawerFormMode.value === 'average')
    && scoringRulesFromItem.value.length > 0,
  )

  const metricOutOfDslRule = computed(() => {
    if (!hasDslScoringRules.value) return false
    if (autoScoreMetric.value == null) return false
    return computedEvalScore.value == null || exceedsMaxMetricRule.value
  })

  const canSaveEvidence = computed(() => {
    const item = selectedDrawerItem.value
    if (!item) return false
    if (panelMode.value === 'feedback') {
      return String(memberFeedbackDraft.value ?? '').trim().length > 0
    }
    if (Number(item.statusCode) === 407) return false
    const isFeedbackOnly = Number(item.statusCode) === 404 && item.canEditEvidence !== true
    const hasEvidenceDraft =
      evidenceNoteDraft.value.trim().length > 0
      || contentDraft.value.trim().length > 0
      || String(commentActualDraft.value ?? '').trim().length > 0
      || memberFeedbackDraft.value.trim().length > 0
      || leaderFeedbackDraft.value.trim().length > 0
      || certificateOutcomeDraft.value.trim().length > 0
      || pendingEvidenceUrls.value.length > 0
      || pendingEvidenceFiles.value.length > 0
      || generalPlanActualRows.value.some(r =>
        !!r.plan.trim() || !!r.actual.trim() || !!r.comment.trim(),
      )
      || waTimeRows.value.some(r =>
        !!r.spent.trim() || !!r.standard.trim(),
      )
    if (isFeedbackOnly) return memberFeedbackDraft.value.trim().length > 0
    if (item.canEditEvidence !== true) return false
    if (metricOutOfDslRule.value) return false
    const s = detailSelfScore.value
    const hasValidSelfScore = s !== null && Number.isFinite(Number(s)) && Number(s) >= 1 && Number(s) <= 5
    return computedEvalScore.value !== null || hasValidSelfScore || hasEvidenceDraft
  })

  const canAddEvidenceRecords = computed(
    () => selectedDrawerItem.value?.canEditEvidence === true,
  )

  const evidenceDrawerReadOnly = computed(
    () => {
      if (!selectedDrawerItem.value) return true
      if (panelMode.value === 'feedback') {
        const status = Number(selectedDrawerItem.value.statusCode)
        return status !== 404
      }
      if (Number(selectedDrawerItem.value.statusCode) === 404) return true
      if (Number(selectedDrawerItem.value.statusCode) === 407) return true
      return selectedDrawerItem.value.canEditEvidence !== true
    },
  )

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

  const canAddMoreWaRows = computed(() => {
    if (waTimeRows.value.length >= 12) return false
    const used = new Set(waTimeRows.value.map(r => r.month))
    return WA_MONTH_OPTIONS.some(m => !used.has(m.value))
  })

  const waTimeTotalsRatio = computed((): string | undefined => {
    const sumSpent = sumWaNumeric(waTimeRows.value, 'spent')
    const sumStd = sumWaNumeric(waTimeRows.value, 'standard')
    if (sumStd === 0) return undefined
    return ((sumSpent / sumStd) * 100).toFixed(1) + '%'
  })

  // Watchers
  watch(waTimeRows, () => { waFormError.value = '' }, { deep: true })

  watch(evidencePanelOpen, open => {
    document.body.style.overflow = open ? 'hidden' : ''
  })

  function onEscapeClose(e: KeyboardEvent) {
    if (e.key === 'Escape' && evidencePanelOpen.value) closeEvidencePanel()
  }

  onMounted(() => {
    window.addEventListener('keydown', onEscapeClose)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onEscapeClose)
    document.body.style.overflow = ''
  })

  // ── Form handlers ────────────────────────────────────────────────────────
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

  function addGeneralPlanActualRow() {
    const hasIncomplete = generalPlanActualRows.value.some(r =>
      [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length > 0)
      && [r.comment, r.plan, r.actual].some(v => String(v ?? '').trim().length === 0),
    )
    if (hasIncomplete) {
      toast.warning('Vui lòng nhập đủ Comment, Plan và Actual trước khi thêm dòng mới.')
      return
    }
    generalPlanActualRows.value.push(newPlanActualRow())
  }

  function removeGeneralPlanActualRow(id: string) {
    if (generalPlanActualRows.value.length <= 1) return
    generalPlanActualRows.value = generalPlanActualRows.value.filter(r => r.id !== id)
  }

  function getWaMonthOptionsForRow(row: WaTimeDraftRow) {
    const usedElsewhere = new Set(
      waTimeRows.value.filter(r => r.id !== row.id).map(r => r.month),
    )
    return WA_MONTH_OPTIONS.filter(m => !usedElsewhere.has(m.value) || m.value === row.month)
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

  // ── Panel open / close ───────────────────────────────────────────────────
  function openEvidencePanel(item: KpiItem, mode: 'detail' | 'feedback' = 'detail') {
    if (item.canViewEvidence !== true && Number(item.statusCode ?? 0) < 404) return
    panelMode.value = mode
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

    const p = parseEvidencesJson(jsonSource)
    evidenceNoteDraft.value = p.note || item.evidenceNote || ''
    memberFeedbackDraft.value = p.memberFeedback || item.feedbackComment || item.memberFeedback || ''
    leaderFeedbackDraft.value = p.leaderFeedback || item.leaderFeedback || ''
    gmCommentDraft.value = p.gmComment || item.gmComment || ''
    contentDraft.value = p.content
    commentActualDraft.value = p.actual || ''

    const persistedRows =
      p.planActualRecords.length ? p.planActualRecords
      : item.planActualRecords?.length
        ? item.planActualRecords.map(r => ({
            plan: r.plan,
            actual: r.actual,
            comment: (r as Record<string, unknown>).comment
              ? String((r as Record<string, unknown>).comment)
              : '',
          }))
        : null

    generalPlanActualRows.value = persistedRows?.length
      ? persistedRows.map((r, i) => ({
          id: `${item.id}-p-${i}`,
          plan: r.plan,
          actual: r.actual,
          comment: r.comment ?? '',
        }))
      : [newPlanActualRow()]

    pendingEvidenceUrls.value = urlPairsToPendingUrls(p.urlPairs, `${item.id}-u`)
    evidencePanelOpen.value = true
  }

  function openFeedbackPanel(item: KpiItem) {
    openEvidencePanel(item, 'feedback')
  }

  function closeEvidencePanel() {
    evidencePanelOpen.value = false
    panelMode.value = 'detail'
    selectedDrawerItem.value = null
    certificateOutcomeDraft.value = ''
    memberFeedbackDraft.value = ''
    leaderFeedbackDraft.value = ''
    gmCommentDraft.value = ''
    contentDraft.value = ''
    commentActualDraft.value = ''
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

  // ── Build payload ────────────────────────────────────────────────────────
  function buildDrawerEvidencesPayload(item: KpiItem): Record<string, unknown> {
    const mode = resolveFormMode(item)
    const calcTypeCode = item.calculationTypeCode

    if (item.group === 'B') {
      const out: Record<string, unknown> = {}
      const noteTrim = evidenceNoteDraft.value.trim()
      if (noteTrim) out.note = noteTrim
    const gmComment = gmCommentDraft.value.trim()
    if (gmComment) out.gmComment = gmComment
      const filePairs = pendingEvidenceUrls.value
        .map(u => ({ url: u.url, name: (u.name ?? '').trim() }))
        .filter(r => r.url)
      if (filePairs.length) out.files = filePairs
      const cert = certificateOutcomeDraft.value.trim()
      if (cert) out.certificateOutcomeNote = cert
      return out
    }

    const rows = generalPlanActualRows.value
      .map(({ plan, actual, comment }) => ({
        plan: plan.trim(),
        actual: actual.trim(),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }))
      .filter(r => r.plan || r.actual)

    const out: Record<string, unknown> = {}
    if (rows.length) out.planActualRecords = rows

    if (mode === 'average') {
      const results = rows
        .map(r => computeRatioPreview(r.plan, r.actual, calcTypeCode) ?? r.actual)
        .filter(Boolean)
      if (results.length) out.result = averageRatioResult(rows, calcTypeCode)
    } else {
      const actuals = rows.map(r => r.actual).filter(Boolean)
      if (actuals.length) out.result = actuals.join('')
    }

    const note = evidenceNoteDraft.value.trim()
    if (note) out.note = note
    const gmComment = gmCommentDraft.value.trim()
    if (gmComment) out.gmComment = gmComment

    if (mode === 'comment') {
      const content = contentDraft.value.trim()
      if (content) out.content = content
      // Persist the actual value entered for CALC_RULE 803
      const actualVal = String(commentActualDraft.value ?? '').trim()
      if (actualVal) {
        out.actual = actualVal
        out.result = actualVal  // surface in the Actual Result column
      }
    }

    const filePairs = pendingEvidenceUrls.value
      .map(u => ({ url: u.url, name: (u.name ?? '').trim() }))
      .filter(r => r.url)
    if (filePairs.length) out.files = filePairs

    const cert = certificateOutcomeDraft.value.trim()
    if (cert) out.certificateOutcomeNote = cert

    return out
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function saveEvidenceDetail() {
    if (!selectedDrawerItem.value || !canSaveEvidence.value) return
    const item = selectedDrawerItem.value

    if (panelMode.value === 'feedback') {
      const feedbackComment = String(memberFeedbackDraft.value ?? '').trim()
      if (!feedbackComment) return
      saving.value = true
      try {
        const rs = await memberKpiService.submitFeedback(item.id, feedbackComment)
        item.statusCode = 407
        item.feedbackTargetRoleCode = rs?.feedbackTargetRoleCode ?? null
        item.assignmentStatusName =
          rs?.assignmentStatusName ??
          (String(rs?.feedbackTargetRoleCode ?? '').toUpperCase() === 'GM'
            ? 'Chờ GM kiểm tra feedback'
            : 'Chờ PM kiểm tra feedback')
        item.feedbackComment = feedbackComment
        item.memberFeedback = feedbackComment
        closeEvidencePanel()
      } catch (error) {
        console.error('Failed to submit member feedback', error)
        toast.error('Gửi feedback thất bại')
      } finally {
        saving.value = false
      }
      return
    }

    waFormError.value = ''

    const isFeedbackOnly = Number(item.statusCode) === 404 && item.canEditEvidence !== true
    const normalizedScore =
      detailSelfScore.value == null || !Number.isFinite(Number(detailSelfScore.value))
        ? null
        : Math.min(5, Math.max(1, Math.round(Number(detailSelfScore.value))))
    // Prefer auto-computed score (from scoring rules + actual value) over manual selection
    const autoScore = computedEvalScore.value
    const score = isFeedbackOnly
      ? normalizeDetailSelfScore(item.selfScore)
      : (autoScore !== null ? autoScore : normalizedScore)
    if (!isFeedbackOnly && metricOutOfDslRule.value) {
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
      const hasAnyCompleteRow = generalPlanActualRows.value.some(r =>
        [r.comment, r.plan, r.actual].every(v => String(v ?? '').trim().length > 0),
      )
      if (!hasAnyCompleteRow) {
        toast.warning('Vui lòng nhập đủ Comment, Plan và Actual cho ít nhất 1 dòng trước khi lưu.')
        return
      }
    }
    saving.value = true
    try {
      const payloadObj = buildDrawerEvidencesPayload(item)
      const evidencesJson = JSON.stringify(payloadObj)
      memberKpiDraftStore.setDraft(item.id, {
        evidencesJson,
        selfScore: score ?? normalizeDetailSelfScore(item.selfScore),
      })
      try {
        await memberKpiService.updateSheetItem(item.id, {
          selfScore: score ?? undefined,
          evidences: evidencesJson,
        })
      } catch (error) {
        console.error('Failed to save member evidence', error)
        toast.error('Lưu evidence thất bại')
        return
      }

      if (score != null) item.selfScore = score
      item.evidencesJson = evidencesJson
      const noteTrim = evidenceNoteDraft.value.trim()
      item.evidenceNote = noteTrim || undefined
      item.memberFeedback = memberFeedbackDraft.value.trim() || undefined
      item.leaderFeedback = leaderFeedbackDraft.value.trim() || undefined
      item.gmComment = gmCommentDraft.value.trim() || undefined
      item.certificateOutcomeNote = certificateOutcomeDraft.value.trim() || undefined

      const rows = generalPlanActualRows.value.map(({ plan, actual, comment }) => ({
        plan,
        actual,
        comment,
      }))
      item.planActualRecords = rows
      if (item.group === 'B') {
        item.result = noteTrim || undefined
      } else {
        const calcTypeCode = item.calculationTypeCode
        if (resolveFormMode(item) === 'average') {
          item.result = averageRatioResult(rows, calcTypeCode)
        } else {
          item.result = rows.map(r => r.actual).filter(Boolean).join(' | ') || undefined
        }
      }
      item.actual = undefined

      if (item.evidenceStatus === 'missing') item.evidenceStatus = 'submitted'
      closeEvidencePanel()
    } finally {
      saving.value = false
    }
  }

  return {
    // State
    evidencePanelOpen,
    panelMode,
    selectedDrawerItem,
    evidenceNoteDraft,
    memberFeedbackDraft,
    leaderFeedbackDraft,
    gmCommentDraft,
    certificateOutcomeDraft,
    pendingEvidenceFiles,
    pendingEvidenceUrls,
    evidenceUrlDraft,
    evidenceUploadHint,
    evidenceUrlHint,
    detailSelfScore,
    generalPlanActualRows,
    contentDraft,
    commentActualDraft,
    waTimeRows,
    waFormError,
    saving,
    // Computed
    drawerCase,
    isUploadOnlyDrawer,
    drawerFormMode,
    scoringRulesFromItem,
    scoringRawInput,
    computedEvalScore,
    autoScoreMetric,
    maxMetricAllowedByRules,
    exceedsMaxMetricRule,
    metricOutOfDslRule,
    canSaveEvidence,
    canAddEvidenceRecords,
    evidenceDrawerReadOnly,
    attachmentHubTitle,
    hasEvidenceAttachments,
    pendingEvidenceNamedRows,
    evidenceFileSectionCount,
    hasFileAttachmentsSection,
    hasEvidenceUrlList,
    canAddMoreWaRows,
    waTimeTotalsRatio,
    // Constants (needed in template)
    EVIDENCE_MAX_FILES,
    EVIDENCE_MAX_URLS,
    EVIDENCE_ACCEPT_ATTR,
    WA_MONTH_OPTIONS,
    // Actions
    openEvidencePanel,
    openFeedbackPanel,
    closeEvidencePanel,
    saveEvidenceDetail,
    // Form handlers
    onEvidenceFilesChange,
    removePendingEvidenceFile,
    addPendingEvidenceUrl,
    removePendingEvidenceUrl,
    onEvidenceUrlDraftKeydown,
    addGeneralPlanActualRow,
    removeGeneralPlanActualRow,
    getWaMonthOptionsForRow,
    addWaTimeRow,
    removeWaTimeRow,
  }
}

