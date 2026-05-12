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
const selectedYear = ref(new Date().getFullYear())
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
      employeeComment.value = String(dashboardRs.value?.evaluationComments ?? '')
      supervisorComment.value = String(dashboardRs.value?.evaluationSupervisorComments ?? '')
    } else {
      dashboardData.value = null
      employeeComment.value = ''
      supervisorComment.value = ''
    }
    cycleData.value = cycleRs.status === 'fulfilled' ? cycleRs.value : null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const qy = Number(route.query.year)
  if (Number.isFinite(qy)) selectedYear.value = qy
  loadDashboard()
})

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

const isCurrentYear = computed(() => selectedYear.value === new Date().getFullYear())

function labelFromActionType(actionType: 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED'): string {
  if (actionType === 'GOAL_SETTING') return 'Nộp mục tiêu KPI (Goal Setting)'
  if (actionType === 'MID_YEAR') return 'Nộp KPI giữa năm (Mid-Year)'
  if (actionType === 'END_YEAR') return 'Nộp KPI cuối năm (End-Year)'
  return 'Nộp đánh giá KPI'
}

function promotionLabelFromActionType(actionType: 'GOAL_SETTING' | 'MID_YEAR' | 'END_YEAR' | 'COMPLETED'): string {
  if (actionType === 'GOAL_SETTING') return 'Nộp KPI Đề Xuất Thăng Tiến'
  if (actionType === 'MID_YEAR') return 'Nộp KPI Thăng Tiến Giữa Năm'
  if (actionType === 'END_YEAR') return 'Nộp KPI Thăng Tiến Cuối Năm'
  return 'Nộp KPI Thăng Tiến'
}

// Tách state submit riêng cho từng loại KPI
const submittingPersonal = ref(false)
const submittingPromotion = ref(false)
const employeeComment = ref('')
const supervisorComment = ref('')
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
  A: '(A) Hiệu suất, Cải tiến, Năng lực chuyên môn (Operational)',
  B: '(B) Mục tiêu đào tạo, chia sẻ & nâng cấp bản thân',
  C: '(C) Mục tiêu cấp quản lý (Management)',
  P: '(P) Định hướng thăng tiến - Promotion KPI (Direct Assignment)',
  I: '(I) Individual KPI (tự tạo)',
}

type KpiCategorySection = { key: string; headerLabel: string; items: KpiItem[] }

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
  const rows = promotionItemsFlat.value.filter(i => i.pmScore !== null)
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

const activeMemberSheetItemsForComments = computed(() =>
  memberKpiMainTab.value === 'promotion' ? promotionItemsFlat.value : personalItemsFlat.value,
)

const isEmployeeCommentReadonly = computed(
  () =>
    !isCurrentYear.value
    || hasPendingApprovalStatus(activeMemberSheetItemsForComments.value),
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
const kpiDeadlineBanner = computed((): KpiDeadlineBannerVm | null => {
  const activeActionType = memberKpiMainTab.value === 'promotion'
    ? promotionButtonState.value.actionType
    : personalButtonState.value.actionType
  const phase = phaseFromActionType(activeActionType)
  const activeItems = memberKpiMainTab.value === 'promotion'
    ? promotionItemsFlat.value
    : personalItemsFlat.value
  const hasPendingAction = hasPendingActionByType(activeItems, activeActionType)
  const subject = memberKpiMainTab.value === 'promotion' ? 'KPI thăng tiến' : 'KPI'
  return buildKpiDeadlineBanner({
    cycle: cycleData.value,
    phase,
    subjectLabel: subject,
    warningDays: 3,
    hasPendingAction,
  })
})

function scrollToKpiSelfEvalSection() {
  document.getElementById('member-kpi-self-eval-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
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
  return 'Cập nhật KPI thất bại, vui lòng thử lại'
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
    await memberKpiService.submit(selectedYear.value, 'INDIVIDUAL', employeeComment.value)
    await loadDashboard()
    toast.success('Personal KPI đã được nộp thành công')
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
    await memberKpiService.submit(selectedYear.value, 'PROMOTION', employeeComment.value)
    await loadDashboard()
    toast.success('Promotion KPI đã được nộp thành công')
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
    toast.success('Đã xóa KPI tự tạo')
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
      <span class="text-slate-500 font-medium">Đang tải dữ liệu KPI...</span>
    </div>

    <template v-else-if="dashboardData && sheet">

      <!-- Deadline banner (MOCK) -->
      <MemberKpiDeadlineBanner
        v-if="kpiDeadlineBanner"
        :banner="kpiDeadlineBanner"
        @cta-click="scrollToKpiSelfEvalSection"
      />

      <!-- Top action bar -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Member Dashboard</h2>
          <p class="text-slate-500 text-sm mt-1">
            Theo dõi mục tiêu cá nhân, cập nhật bằng chứng và đánh giá hiệu suất.
          </p>
        </div>
        <div class="flex gap-3">
          <select
            v-model="selectedYear"
            class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-100"
            @change="loadDashboard"
          >
            <option :value="2024">Năm: 2024</option>
            <option :value="2025">Năm: 2025</option>
            <option :value="2026">Năm: 2026</option>
          </select>
        </div>
      </div>

      <MemberProcessTimeline
        v-if="hasAnyKpiItems"
        :year="selectedYear"
        :year-end-only="timelineYearEndOnly"
        :evaluation-fully-completed="memberEvaluationFullyComplete"
      />

      <!-- Summary cards -->
      <MemberKpiSummaryCards
        :status-counts="memberKpiStatusCounts"
        :evidence-count="activeEvidenceCount"
        :evidence-total-count="activeEvidenceTotalCount"
        :personal-self-weighted-avg="personalSelfWeightedAvg"
        :personal-self-promotion-avg="promotionSelfWeightedAvg"
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
            Tạo KPI
          </button>
        </div>

        <MemberCreateIndividualKpiDrawer
          v-model="showCreateIndividualKpiDrawer"
          :cycle-id="String(selectedYear)"
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
              :employee-comment="employeeComment"
              :supervisor-comment="supervisorComment"
              :employee-comment-readonly="isEmployeeCommentReadonly"
              :submitting="submittingPersonal"
              :can-submit="canSubmitPersonal"
              :is-submit-disabled="isPersonalSubmitDisabled"
              :submit-label="memberSheetSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-edit-self-created="openRejectedSelfCreatedEditor"
              @open-feedback="evidenceCtx.openFeedbackPanel"
              @delete-self-created="handleDeleteSelfCreatedKpi"
              @update-employee-comment="employeeComment = $event"
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
              :employee-comment="employeeComment"
              :supervisor-comment="supervisorComment"
              :employee-comment-readonly="isEmployeeCommentReadonly"
              :submitting="submittingPromotion"
              :can-submit="canSubmitPromotion"
              :is-submit-disabled="isPromotionSubmitDisabled"
              :submit-label="promotionSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-edit-self-created="openRejectedSelfCreatedEditor"
              @open-feedback="evidenceCtx.openFeedbackPanel"
              @delete-self-created="handleDeleteSelfCreatedKpi"
              @update-employee-comment="employeeComment = $event"
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
            <h3 class="text-base font-bold text-slate-800">Xác nhận xóa KPI</h3>
            <p class="mt-1 text-xs text-slate-500">
              KPI tự tạo sẽ bị xóa khỏi danh sách hiện tại.
            </p>
          </div>
          <div class="px-5 py-4 text-sm text-slate-700">
            <p>
              Bạn có chắc muốn xóa KPI:
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
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              @click="confirmDeleteSelfCreatedKpi"
            >
              Xóa KPI
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
