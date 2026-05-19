<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { memberKpiService } from '@/services/modules/kpi-member.service'
import type { MemberSheetSubmitType } from '@/services/modules/kpi-member.service'
import { useMemberKpiDraftStore } from '@/stores/member-kpi-drafts.store'
import type { MemberKpiDashboard, KpiItem } from '@/types/kpi'
import type { MemberKpiEvaluationStatus } from '@/types/kpi'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'
import { useMemberEvidenceDrawer, EVIDENCE_DRAWER_KEY } from '@/composables/useMemberEvidenceDrawer'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import MemberProcessTimeline from '@/components/member/MemberProcessTimeline.vue'
import MemberCreateIndividualKpiDrawer from '@/components/kpi/MemberCreateIndividualKpiDrawer.vue'
import MemberKpiDeadlineBanner from '@/components/member/MemberKpiDeadlineBanner.vue'
import MemberKpiSummaryCards from '@/components/member/MemberKpiSummaryCards.vue'
import MemberKpiPersonalTab from '@/components/member/MemberKpiPersonalTab.vue'
import MemberKpiPromotionTab from '@/components/member/MemberKpiPromotionTab.vue'
import MemberEvidenceDrawer from '@/components/member/MemberEvidenceDrawer.vue'
import { memberItemEvalStatus } from '@/utils/memberKpiHelpers'
import { buildKpiDeadlineBanner, type KpiDeadlineBannerVm } from '@/utils/kpiDeadlineBanner'
import { getSubmitButtonState, shouldCollapseKpiProcessTimelineToYearEndOnly } from '@/utils/common'

// ── Evidence drawer — provide to child components ───────────────────────────
const evidenceCtx = useMemberEvidenceDrawer()
provide(EVIDENCE_DRAWER_KEY, evidenceCtx)

// ── Routing ─────────────────────────────────────────────────────────────────
const route = useRoute()

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = useToast()

// ── State ────────────────────────────────────────────────────────────────────
const loading = ref(true)
const dashboardData = ref<MemberKpiDashboard | null>(null)
const cycleData = ref<KpiCycleResponse | null>(null)
const currentYear = new Date().getFullYear()
const selectedYear = ref(new Date().getFullYear())
const availableYears = ref<{ value: number; label: string }[]>([])
const memberExtraSheetItems = ref<KpiItem[]>([])
const showCreateIndividualKpiDrawer = ref(false)
const editingRejectedSelfCreatedItem = ref<KpiItem | null>(null)
// ── Data loading ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  loading.value = true
  memberExtraSheetItems.value = []
  try {
    const [dashboardRs, cycleRs] = await Promise.allSettled([
      memberKpiService.getDashboard(selectedYear.value),
      kpiCycleService.getKpiCycleByYear(selectedYear.value),
    ])
    if (dashboardRs.status === 'fulfilled') {
      dashboardData.value = dashboardRs.value
      personalEmployeeComment.value = String(dashboardRs.value?.evaluationComments ?? '')
      promotionEmployeeComment.value = String(dashboardRs.value?.evaluationCommentsPromotion ?? '')
      personalSupervisorComment.value = String(dashboardRs.value?.evaluationSupervisorComments ?? '')
      promotionSupervisorComment.value = String(dashboardRs.value?.evaluationSupervisorCommentsPromotion ?? '')
    } else {
      dashboardData.value = null
      personalEmployeeComment.value = ''
      promotionEmployeeComment.value = ''
      personalSupervisorComment.value = ''
      promotionSupervisorComment.value = ''
    }
    cycleData.value = cycleRs.status === 'fulfilled' ? cycleRs.value : null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const qy = Number(route.query.year)
  if (Number.isFinite(qy)) selectedYear.value = qy
  loadAvailableYears().finally(loadDashboard)
})

async function loadAvailableYears() {
  try {
    const rows = await kpiCycleService.getKpiCyclesForDropdown()
    const years = rows
      .map(row => Number(row.year))
      .filter(year => Number.isFinite(year))
      .sort((a, b) => b - a)
      .map(year => ({ value: year, label: `Year: ${year}` }))
    availableYears.value = years
    if (years.length > 0 && !years.some(y => y.value === selectedYear.value)) {
      selectedYear.value = years[0].value
    }
  } catch {
    availableYears.value = [
      { value: 2026, label: 'Year: 2026' },
      { value: 2025, label: 'Year: 2025' },
      { value: 2024, label: 'Year: 2024' },
    ]
  }
}

// ── Computed ─────────────────────────────────────────────────────────────────
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

const isCurrentYear = computed(() => selectedYear.value === currentYear)

function labelFromActionType(actionType: 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED'): string {
  if (actionType === 'GOAL_SETTING') return 'Submit KPI Goals (Goal Setting)'
  if (actionType === 'MID_YEAR') return 'Submit Mid-Year KPI (Mid-Year)'
  if (actionType === 'END_YEAR') return 'Submit Year-End KPI (End-Year)'
  return 'Submit KPI Evaluation'
}

function promotionLabelFromActionType(actionType: 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED'): string {
  if (actionType === 'GOAL_SETTING') return 'Submit Promotion KPI'
  if (actionType === 'MID_YEAR') return 'Submit Mid-Year Promotion KPI'
  if (actionType === 'END_YEAR') return 'Submit Year-End Promotion KPI'
  return 'Submit Promotion KPI'
}

// Tách state submit riêng cho từng loại KPI
const submittingPersonal = ref(false)
const submittingPromotion = ref(false)
const personalEmployeeComment = ref('')
const promotionEmployeeComment = ref('')
const personalSupervisorComment = ref('')
const promotionSupervisorComment = ref('')
const showDeleteConfirmModal = ref(false)
const pendingDeleteItem = ref<KpiItem | null>(null)

const personalItemsFlat = computed(() => sheet.value?.items.filter(i => i.group !== 'P') ?? [])
const promotionItemsFlat = computed(() => sheet.value?.items.filter(i => i.group === 'P') ?? [])
const personalAssignmentIds = computed(() => personalItemsFlat.value.map(i => i.id))
const promotionAssignmentIds = computed(() => promotionItemsFlat.value.map(i => i.id))
const hasAnyKpiItems = computed(() => (sheet.value?.items?.length ?? 0) > 0)

/** Ẩn mốc đầu năm / giữa năm chỉ khi thật sự onboard sau giữa kỳ (không dùng mỗi điều kiện > mid_year_end). */
const timelineYearEndOnly = computed(() => {
  return shouldCollapseKpiProcessTimelineToYearEndOnly(
    dashboardData.value?.accountCreatedAt,
    cycleData.value?.midYearEnd,
  )
})

/** Mọi KPI trên sheet đã chốt 603 — timeline hiển thị đã hoàn thành (không còn «Đang trong kỳ» Year-End). */
const memberEvaluationFullyComplete = computed(() => {
  const items = sheet.value?.items ?? []
  if (!items.length) return false
  return items.every(i => Number(i.statusCode ?? 0) === 603)
})

function minStatusCode(items: KpiItem[]): number {
  const statusCodes = items
    .map(i => Number(i.statusCode))
    .filter(n => Number.isFinite(n) && n >= 401)
  if (!statusCodes.length) return 401
  return Math.min(...statusCodes)
}

const personalButtonState = computed(() => {
  if (!cycleData.value || !personalItemsFlat.value.length) {
    return { show: false, disabled: true, text: '', actionType: 'COMPLETED' as const }
  }
  const hasRejected = personalItemsFlat.value.some(i => Number(i.statusCode ?? 0) === 406)
  if (hasRejected) {
    return { show: true, disabled: false, text: 'Resubmit KPI', actionType: 'GOAL_SETTING' as const }
  }
  const skipMid = shouldCollapseKpiProcessTimelineToYearEndOnly(
    dashboardData.value?.accountCreatedAt,
    cycleData.value.midYearEnd,
  )
  return getSubmitButtonState(cycleData.value, minStatusCode(personalItemsFlat.value), new Date(), {
    treatMidYearAsSkipped: skipMid,
  })
})
const hasRejectedPersonal = computed(() =>
  personalItemsFlat.value.some(i => Number(i.statusCode ?? 0) === 406),
)

const promotionButtonState = computed(() => {
  if (!cycleData.value || !promotionItemsFlat.value.length) {
    return { show: false, disabled: true, text: '', actionType: 'COMPLETED' as const }
  }
  const hasRejected = promotionItemsFlat.value.some(i => Number(i.statusCode ?? 0) === 406)
  if (hasRejected) {
    return { show: true, disabled: false, text: 'Resubmit KPI', actionType: 'GOAL_SETTING' as const }
  }
  const skipMid = shouldCollapseKpiProcessTimelineToYearEndOnly(
    dashboardData.value?.accountCreatedAt,
    cycleData.value.midYearEnd,
  )
  return getSubmitButtonState(cycleData.value, minStatusCode(promotionItemsFlat.value), new Date(), {
    treatMidYearAsSkipped: skipMid,
  })
})
const hasRejectedPromotion = computed(() =>
  promotionItemsFlat.value.some(i => Number(i.statusCode ?? 0) === 406),
)

const memberSheetSubmitLabel = computed(() => labelFromActionType(personalButtonState.value.actionType))
const promotionSubmitLabel = computed(() => promotionLabelFromActionType(promotionButtonState.value.actionType))
const hasSubmittedPersonalTargetSetup = computed(() => {
  const submittedStatuses = new Set([402, 403, 405, 501, 502, 503, 601, 602, 603])
  return personalItemsFlat.value.some(i => submittedStatuses.has(Number(i.statusCode ?? 0)))
})
const canCreatePersonalKpi = computed(
  () =>
    isCurrentYear.value
    && memberKpiMainTab.value === 'personal'
    && !hasSubmittedPersonalTargetSetup.value,
)

const hasMissingPersonalMidYearSelfScore = computed(() => {
  if (personalButtonState.value.actionType !== 'MID_YEAR') return false
  return personalItemsFlat.value.some(it => it.selfScore == null)
})

const hasMissingPersonalEndYearSelfScore = computed(() => {
  if (personalButtonState.value.actionType !== 'END_YEAR') return false
  return personalItemsFlat.value.some(it => it.selfScore == null)
})

const hasMissingPromotionMidYearSelfScore = computed(() => {
  if (promotionButtonState.value.actionType !== 'MID_YEAR') return false
  return promotionItemsFlat.value.some(it => it.selfScore == null)
})

const hasMissingPromotionEndYearSelfScore = computed(() => {
  if (promotionButtonState.value.actionType !== 'END_YEAR') return false
  return promotionItemsFlat.value.some(it => it.selfScore == null)
})

type SubmitActionType = 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED'
function phaseFromActionType(actionType: SubmitActionType): 'target_setup' | 'mid_year' | 'year_end' | null {
  if (actionType === 'GOAL_SETTING') return 'target_setup'
  if (actionType === 'MID_YEAR') return 'mid_year'
  if (actionType === 'END_YEAR') return 'year_end'
  return null
}

function hasPendingActionByType(items: KpiItem[], actionType: SubmitActionType): boolean {
  if (!items.length) return false
  const p = phaseFromActionType(actionType)
  const statusCodes = items
    .map(i => Number(i.statusCode))
    .filter(n => Number.isFinite(n))
  if (!statusCodes.length) return false
  if (p === 'target_setup') return statusCodes.some(sc => sc === 404 || sc === 407)
  if (p === 'mid_year') return statusCodes.some(sc => sc === 405)
  if (p === 'year_end') return statusCodes.some(sc => sc === 405 || sc === 503)
  return false
}

function hasSubmitBlockingStatus(items: KpiItem[]): boolean {
  if (!items.length) return false
  return items.some(i => {
    const status = Number(i.statusCode)
    if (!Number.isFinite(status)) return false
    // 407: feedback in progress | <404: newly created/proposed and not yet approved by PM
    return status === 407 || (status > 0 && status < 404)
  })
}

function hasPendingApprovalStatus(items: KpiItem[]): boolean {
  if (!items.length) return false
  const pendingStatuses = new Set([402, 403, 501, 502, 601, 602])
  return items.some(i => pendingStatuses.has(Number(i.statusCode ?? 0)))
}

function hasCompletedEvaluationStatus(items: KpiItem[]): boolean {
  if (!items.length) return false
  return items.every(i => Number(i.statusCode ?? 0) === 603)
}

const canSubmitPersonal = computed(
  () => isCurrentYear.value && personalItemsFlat.value.length > 0 && personalButtonState.value.show,
)
const canSubmitPromotion = computed(
  () => isCurrentYear.value && promotionItemsFlat.value.length > 0 && promotionButtonState.value.show,
)

const isPersonalSubmitDisabled = computed(
  () =>
    submittingPersonal.value
    || (!hasRejectedPersonal.value && hasMissingPersonalMidYearSelfScore.value)
    || (!hasRejectedPersonal.value && hasMissingPersonalEndYearSelfScore.value)
    || (!hasRejectedPersonal.value && hasSubmitBlockingStatus(personalItemsFlat.value)),
)
const isPromotionSubmitDisabled = computed(
  () =>
    submittingPromotion.value
    || (!hasRejectedPromotion.value && hasMissingPromotionMidYearSelfScore.value)
    || (!hasRejectedPromotion.value && hasMissingPromotionEndYearSelfScore.value)
    || (!hasRejectedPromotion.value && hasSubmitBlockingStatus(promotionItemsFlat.value)),
)

// ── KPI grouping ──────────────────────────────────────────────────────────────
const legacySheetGroupLabels: Record<string, string> = {
  A: '(A) Performance, Improvement, Professional Competency (Operational)',
  B: '(B) Training, Knowledge Sharing & Self-Development Goals',
  C: '(C) Management-Level Goals (Management)',
  P: '(P) Promotion Direction - Promotion KPI (Direct Assignment)',
  I: '(I) Individual KPI (Self-created)',
}

type KpiCategorySection = { key: string; headerLabel: string; items: KpiItem[] }

function groupKpiItemsByCategory(items: KpiItem[]): KpiCategorySection[] {
  const map = new Map<string, { headerLabel: string; items: KpiItem[] }>()
  for (const item of items) {
    const key = item.categoryId?.trim() || `sheet-group-${item.group}`
    const headerLabel =
      (item.categoryName && item.categoryName.trim()) ||
      legacySheetGroupLabels[item.group] ||
      `Group ${item.group}`
    const cur = map.get(key)
    if (!cur) map.set(key, { headerLabel, items: [item] })
    else cur.items.push(item)
  }
  return [...map.entries()].map(([key, v]) => ({ key, headerLabel: v.headerLabel, items: v.items }))
}

const personalGroupedSections = computed((): KpiCategorySection[] => {
  if (!sheet.value) return []
  return groupKpiItemsByCategory(sheet.value.items.filter(i => i.group !== 'P'))
})

const promotionGroupedSections = computed((): KpiCategorySection[] => {
  if (!sheet.value) return []
  return groupKpiItemsByCategory(sheet.value.items.filter(i => i.group === 'P'))
})

const promotionWeightSum = computed(() =>
  promotionItemsFlat.value.reduce((s, i) => s + i.weight, 0),
)

function hasEvidence(item: KpiItem): boolean {
  const raw = String(item.evidencesJson ?? '').trim()
  if (raw && raw !== '{}' && raw !== '[]' && raw !== 'null') return true
  return item.evidenceStatus === 'submitted'
}

const promotionSelfWeightedAvg = computed((): number | null => {
  const rows = promotionItemsFlat.value.filter(i => i.selfScore !== null)
  if (!rows.length) return null
  let num = 0, den = 0
  for (const i of rows) { num += (i.selfScore ?? 0) * i.weight; den += i.weight }
  return den ? num / den : null
})

const promotionPmWeightedAvg = computed((): number | null => {
  const rows = promotionItemsFlat.value.filter(i => i.pmScore != null)
  if (!rows.length) return null
  let num = 0, den = 0
  for (const i of rows) { num += (i.pmScore ?? 0) * i.weight; den += i.weight }
  return den ? num / den : null
})

const personalPmWeightedAvg = computed((): number | null => {
  const rows = personalItemsFlat.value.filter(i => i.pmScore != null)
  if (!rows.length) return null
  let num = 0, den = 0
  for (const i of rows) { num += (i.pmScore ?? 0) * i.weight; den += i.weight }
  return den ? num / den : null
})


const personalSelfWeightedAvg = computed((): number | null => {
  const items = sheet.value?.items.filter(i => i.group !== 'P') ?? []
  const rows = items.filter(i => i.selfScore !== null)
  if (!rows.length) return null
  let num = 0, den = 0
  for (const i of rows) { num += (i.selfScore ?? 0) * i.weight; den += i.weight }
  return den ? num / den : null
})

const personalSummaryWeightedAvg = computed(
  () => personalPmWeightedAvg.value ?? personalSelfWeightedAvg.value,
)
const promotionSummaryWeightedAvg = computed(
  () => promotionPmWeightedAvg.value ?? promotionSelfWeightedAvg.value,
)

const personalEvidenceTotalCount = computed(() => personalItemsFlat.value.length)
const promotionEvidenceTotalCount = computed(() => promotionItemsFlat.value.length)
const personalEvidenceCount = computed(() => personalItemsFlat.value.filter(hasEvidence).length)
const promotionEvidenceCount = computed(() => promotionItemsFlat.value.filter(hasEvidence).length)

const activeEvidenceCount = computed(() =>
  memberKpiMainTab.value === 'promotion' ? promotionEvidenceCount.value : personalEvidenceCount.value,
)

const activeEvidenceTotalCount = computed(() =>
  memberKpiMainTab.value === 'promotion'
    ? promotionEvidenceTotalCount.value
    : personalEvidenceTotalCount.value,
)

const memberKpiStatusCounts = computed(() => {
  const items = sheet.value?.items ?? []
  const c: Record<MemberKpiEvaluationStatus, number> = {
    not_started: 0,
    overdue: 0,
    revision: 0,
    pending_approval: 0,
    approved: 0,
    feedback: 0,
  }
  for (const i of items) c[memberItemEvalStatus(i)]++
  return c
})

// ── Tabs ──────────────────────────────────────────────────────────────────────
type MemberKpiMainTab = 'personal' | 'promotion'
const memberKpiMainTab = ref<MemberKpiMainTab>('personal')

const TARGET_SETUP_DONE_STATUSES = new Set([405, 501, 502, 503, 601, 602, 603])
const MID_YEAR_DONE_STATUSES = new Set([503, 601, 602, 603])
const YEAR_END_DONE_STATUSES = new Set([603])

function memberPhaseCompletedByStatuses(allowedStatuses: ReadonlySet<number>): boolean {
  const allItems = sheet.value?.items ?? []
  const statusCodes = allItems
    .map(i => Number(i.statusCode ?? 0))
    .filter(code => Number.isFinite(code))
  if (!statusCodes.length) return false
  return statusCodes.every(code => allowedStatuses.has(code))
}

const memberTimelineTargetSetupCompleted = computed(() =>
  memberPhaseCompletedByStatuses(TARGET_SETUP_DONE_STATUSES),
)

const memberTimelineMidYearCompleted = computed(() => {
  return memberPhaseCompletedByStatuses(MID_YEAR_DONE_STATUSES)
})

const memberTimelineYearEndCompleted = computed(() => {
  return memberPhaseCompletedByStatuses(YEAR_END_DONE_STATUSES)
})

const activeMemberSheetItemsForComments = computed(() =>
  memberKpiMainTab.value === 'promotion' ? promotionItemsFlat.value : personalItemsFlat.value,
)

const isEmployeeCommentReadonly = computed(
  () =>
    !isCurrentYear.value
    || hasPendingApprovalStatus(activeMemberSheetItemsForComments.value)
    || hasCompletedEvaluationStatus(activeMemberSheetItemsForComments.value),
)

function memberKpiTabButtonClass(tab: MemberKpiMainTab) {
  const active = memberKpiMainTab.value === tab
  return active
    ? 'border-blue-600 text-blue-600'
    : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
}

function memberKpiTabIconClass(tab: MemberKpiMainTab) {
  return memberKpiMainTab.value === tab ? 'text-blue-600' : 'text-slate-400'
}

// ── Deadline banner (from cycle in DB) ────────────────────────────────────────
type MemberBannerTarget = MemberKpiMainTab | null
type MemberBannerPickResult = { banner: KpiDeadlineBannerVm | null; targetTab: MemberBannerTarget }

function pickGlobalDeadlineBanner(
  promotionBanner: KpiDeadlineBannerVm | null,
  personalBanner: KpiDeadlineBannerVm | null,
): MemberBannerPickResult {
  const bothOverdue = promotionBanner?.kind === 'overdue' && personalBanner?.kind === 'overdue'
  if (bothOverdue) {
    return {
      banner: {
        ...promotionBanner,
        title: 'You have KPIs with overdue self-evaluations',
        subtitle: 'Please complete your Personal KPI and Promotion KPI self-evaluations as soon as possible for PM/HR to process.',
      },
      targetTab: 'promotion',
    }
  }
  if (promotionBanner?.kind === 'overdue') return { banner: promotionBanner, targetTab: 'promotion' }
  if (personalBanner?.kind === 'overdue') return { banner: personalBanner, targetTab: 'personal' }
  if (promotionBanner) return { banner: promotionBanner, targetTab: 'promotion' }
  if (personalBanner) return { banner: personalBanner, targetTab: 'personal' }
  return { banner: null, targetTab: null }
}

const kpiDeadlineBanner = computed((): KpiDeadlineBannerVm | null => {
  const personalActionType = personalButtonState.value.actionType
  const promotionActionType = promotionButtonState.value.actionType

  const personalBanner = buildKpiDeadlineBanner({
    cycle: cycleData.value,
    phase: phaseFromActionType(personalActionType),
    subjectLabel: 'KPI',
    warningDays: 3,
    hasPendingAction: hasPendingActionByType(personalItemsFlat.value, personalActionType),
  })

  const promotionBanner = buildKpiDeadlineBanner({
    cycle: cycleData.value,
    phase: phaseFromActionType(promotionActionType),
    subjectLabel: 'Promotion KPI',
    warningDays: 3,
    hasPendingAction: hasPendingActionByType(promotionItemsFlat.value, promotionActionType),
  })

  return pickGlobalDeadlineBanner(promotionBanner, personalBanner).banner
})

const kpiDeadlineBannerTargetTab = computed<MemberBannerTarget>(() => {
  const personalActionType = personalButtonState.value.actionType
  const promotionActionType = promotionButtonState.value.actionType
  const personalBanner = buildKpiDeadlineBanner({
    cycle: cycleData.value,
    phase: phaseFromActionType(personalActionType),
    subjectLabel: 'KPI',
    warningDays: 3,
    hasPendingAction: hasPendingActionByType(personalItemsFlat.value, personalActionType),
  })
  const promotionBanner = buildKpiDeadlineBanner({
    cycle: cycleData.value,
    phase: phaseFromActionType(promotionActionType),
    subjectLabel: 'Promotion KPI',
    warningDays: 3,
    hasPendingAction: hasPendingActionByType(promotionItemsFlat.value, promotionActionType),
  })
  return pickGlobalDeadlineBanner(promotionBanner, personalBanner).targetTab
})

function scrollToKpiSelfEvalSection() {
  document.getElementById('member-kpi-self-eval-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function handleDeadlineBannerCtaClick() {
  const target = kpiDeadlineBannerTargetTab.value
  if (target) memberKpiMainTab.value = target
  scrollToKpiSelfEvalSection()
}

// ── Actions ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onMemberIndividualKpiSaved(_response: unknown) {
  editingRejectedSelfCreatedItem.value = null
  await loadDashboard()
}

function openRejectedSelfCreatedEditor(item: KpiItem) {
  editingRejectedSelfCreatedItem.value = item
  showCreateIndividualKpiDrawer.value = true
}

function openCreateIndividualDrawer() {
  editingRejectedSelfCreatedItem.value = null
  showCreateIndividualKpiDrawer.value = true
}

function apiSubmitErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Failed to update KPI, please try again'
}

const memberKpiDraftStore = useMemberKpiDraftStore()

async function submitByType(_type: MemberSheetSubmitType, assignmentIds: string[]) {
  await memberKpiDraftStore.flushByAssignmentIds(
    assignmentIds,
    (id, body) => memberKpiService.updateSheetItem(id, body),
  )
}

async function handlePersonalSubmit() {
  if (!canSubmitPersonal.value) return
  if (!personalItemsFlat.value.length) return
  if (isPersonalSubmitDisabled.value) return
  submittingPersonal.value = true
  try {
    await submitByType('INDIVIDUAL', personalAssignmentIds.value)
    await memberKpiService.submit(selectedYear.value, 'INDIVIDUAL', personalEmployeeComment.value)
    await loadDashboard()
    toast.success('Personal KPI submitted successfully')
  } catch (e: unknown) {
    toast.error(apiSubmitErrorMessage(e))
  } finally {
    submittingPersonal.value = false
  }
}

async function handlePromotionSubmit() {
  if (!canSubmitPromotion.value) return
  if (!promotionItemsFlat.value.length) return
  if (isPromotionSubmitDisabled.value) return
  submittingPromotion.value = true
  try {
    await submitByType('PROMOTION', promotionAssignmentIds.value)
    await memberKpiService.submit(selectedYear.value, 'PROMOTION', promotionEmployeeComment.value)
    await loadDashboard()
    toast.success('Promotion KPI submitted successfully')
  } catch (e: unknown) {
    toast.error(apiSubmitErrorMessage(e))
  } finally {
    submittingPromotion.value = false
  }
}

async function handleDeleteSelfCreatedKpi(item: KpiItem) {
  if (!item?.id) return
  pendingDeleteItem.value = item
  showDeleteConfirmModal.value = true
}

function cancelDeleteSelfCreatedKpi() {
  showDeleteConfirmModal.value = false
  pendingDeleteItem.value = null
}

async function confirmDeleteSelfCreatedKpi() {
  const item = pendingDeleteItem.value
  if (!item?.id) return
  try {
    await memberKpiService.deleteSelfCreatedKpi(item.id)
    await loadDashboard()
    toast.success('Self-created KPI deleted')
  } catch (e: unknown) {
    toast.error(apiSubmitErrorMessage(e))
  } finally {
    cancelDeleteSelfCreatedKpi()
  }
}
</script>

<template>
  <div class="max-w-[1500px] mx-auto space-y-6 animate-fade-in">

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mr-3" />
      <span class="text-slate-500 font-medium">Loading KPI data...</span>
    </div>

    <template v-else-if="dashboardData && sheet">

      <!-- Deadline banner (MOCK) -->
      <MemberKpiDeadlineBanner
        v-if="kpiDeadlineBanner"
        :banner="kpiDeadlineBanner"
        @cta-click="handleDeadlineBannerCtaClick"
      />

      <!-- Top action bar -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Member Dashboard</h2>
          <p class="text-slate-500 text-sm mt-1">
            Track personal goals, update evidence, and evaluate performance.
          </p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="selectedYear"
            class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-100"
            @change="loadDashboard"
          >
            <option v-for="y in availableYears" :key="y.value" :value="y.value">
              {{ y.label }}
            </option>
          </select>
        </div>
      </div>

      <MemberProcessTimeline
        v-if="hasAnyKpiItems"
        :year="selectedYear"
        :year-end-only="timelineYearEndOnly"
        :evaluation-fully-completed="memberEvaluationFullyComplete"
        :target-setup-completed="memberTimelineTargetSetupCompleted"
        :mid-year-completed="memberTimelineMidYearCompleted"
        :year-end-completed="memberTimelineYearEndCompleted"
      />

      <!-- Summary cards -->
      <MemberKpiSummaryCards
        :status-counts="memberKpiStatusCounts"
        :evidence-count="activeEvidenceCount"
        :evidence-total-count="activeEvidenceTotalCount"
        :personal-self-weighted-avg="personalSummaryWeightedAvg"
        :personal-self-promotion-avg="promotionSummaryWeightedAvg"
        :personal-final-weighted-avg="personalPmWeightedAvg"
        :promotion-final-weighted-avg="promotionPmWeightedAvg"
        :active-tab="memberKpiMainTab"
        @scroll-to-eval="scrollToKpiSelfEvalSection"
      />

      <!-- KPI tabs -->
      <div id="member-kpi-self-eval-section" class="mt-6 scroll-mt-24">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
          <nav class="flex flex-wrap gap-1" aria-label="KPI dashboard tabs">
            <button
              type="button"
              class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
              :class="memberKpiTabButtonClass('personal')"
              @click="memberKpiMainTab = 'personal'"
            >
              <i class="fas fa-bullseye text-base" :class="memberKpiTabIconClass('personal')" />
              Personal KPI
            </button>
            <button
              type="button"
              class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
              :class="memberKpiTabButtonClass('promotion')"
              @click="memberKpiMainTab = 'promotion'"
            >
              <i class="fas fa-arrow-trend-up text-base" :class="memberKpiTabIconClass('promotion')" />
              Promotion KPI
            </button>
          </nav>
          <button
            v-if="canCreatePersonalKpi"
            type="button"
            class="mb-1.5 mr-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 cursor-pointer"
            @click="openCreateIndividualDrawer"
          >
            <i class="fas fa-plus text-xs" aria-hidden="true" />
            Create KPI
          </button>
        </div>

        <MemberCreateIndividualKpiDrawer
          v-model="showCreateIndividualKpiDrawer"
          :cycle-id="String(currentYear)"
          :edit-item="editingRejectedSelfCreatedItem"
          @saved="onMemberIndividualKpiSaved"
        />

        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <!-- Personal KPI tab -->
          <template v-if="memberKpiMainTab === 'personal'">
            <MemberKpiPersonalTab
              :sections="personalGroupedSections"
              :personal-self-weighted-avg="personalSelfWeightedAvg"
              :is-current-year="isCurrentYear"
              :employee-comment="personalEmployeeComment"
              :supervisor-comment="personalSupervisorComment"
              :employee-comment-readonly="isEmployeeCommentReadonly"
              :submitting="submittingPersonal"
              :can-submit="canSubmitPersonal"
              :is-submit-disabled="isPersonalSubmitDisabled"
              :submit-label="memberSheetSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-edit-self-created="openRejectedSelfCreatedEditor"
              @open-feedback="evidenceCtx.openFeedbackPanel"
              @delete-self-created="handleDeleteSelfCreatedKpi"
              @update-employee-comment="personalEmployeeComment = $event"
              @submit="handlePersonalSubmit"
            />
          </template>

          <!-- Promotion KPI tab -->
          <template v-else-if="memberKpiMainTab === 'promotion'">
            <MemberKpiPromotionTab
              :sections="promotionGroupedSections"
              :promotion-items-flat="promotionItemsFlat"
              :promotion-weight-sum="promotionWeightSum"
              :promotion-self-weighted-avg="promotionSelfWeightedAvg"
              :promotion-pm-weighted-avg="promotionPmWeightedAvg"
              :is-current-year="isCurrentYear"
              :employee-comment="promotionEmployeeComment"
              :supervisor-comment="promotionSupervisorComment"
              :employee-comment-readonly="isEmployeeCommentReadonly"
              :submitting="submittingPromotion"
              :can-submit="canSubmitPromotion"
              :is-submit-disabled="isPromotionSubmitDisabled"
              :submit-label="promotionSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-edit-self-created="openRejectedSelfCreatedEditor"
              @open-feedback="evidenceCtx.openFeedbackPanel"
              @delete-self-created="handleDeleteSelfCreatedKpi"
              @update-employee-comment="promotionEmployeeComment = $event"
              @submit="handlePromotionSubmit"
            />
          </template>
        </div>
      </div>

    </template>

    <!-- Evidence drawer -->
    <MemberEvidenceDrawer />

    <Teleport to="body">
      <div
        v-if="showDeleteConfirmModal"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div class="border-b border-slate-100 px-5 py-4">
            <h3 class="text-base font-bold text-slate-800">Confirm KPI Deletion</h3>
            <p class="mt-1 text-xs text-slate-500">
              The self-created KPI will be removed from the current list.
            </p>
          </div>
          <div class="px-5 py-4 text-sm text-slate-700">
            <p>
              Are you sure you want to delete KPI:
              <span class="font-semibold text-slate-900">
                {{ pendingDeleteItem?.code }} {{ pendingDeleteItem?.name }}
              </span>
              ?
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              @click="cancelDeleteSelfCreatedKpi"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              @click="confirmDeleteSelfCreatedKpi"
            >
              Delete KPI
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
