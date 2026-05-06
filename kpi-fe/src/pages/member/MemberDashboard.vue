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
    } else {
      dashboardData.value = null
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

const memberSheetSubmitLabel = computed(() => {
  const p = dashboardData.value?.phase
  if (p === 'target_setup') return 'Nộp mục tiêu KPI (Goal Setting)'
  if (p === 'mid_year') return 'Nộp KPI giữa năm (Mid-Year)'
  if (p === 'year_end') return 'Nộp KPI cuối năm (End-Year)'
  return 'Nộp đánh giá KPI'
})

const promotionSubmitLabel = computed(() => {
  const p = dashboardData.value?.phase
  if (p === 'target_setup') return 'Nộp KPI Đề Xuất Thăng Tiến'
  if (p === 'mid_year') return 'Nộp KPI Thăng Tiến Giữa Năm'
  if (p === 'year_end') return 'Nộp KPI Thăng Tiến Cuối Năm'
  return 'Nộp KPI Thăng Tiến'
})

// Tách state submit riêng cho từng loại KPI
const submittingPersonal = ref(false)
const submittingPromotion = ref(false)

const personalItemsFlat = computed(() => sheet.value?.items.filter(i => i.group !== 'P') ?? [])
const promotionItemsFlat = computed(() => sheet.value?.items.filter(i => i.group === 'P') ?? [])
const personalAssignmentIds = computed(() => personalItemsFlat.value.map(i => i.id))
const promotionAssignmentIds = computed(() => promotionItemsFlat.value.map(i => i.id))

const hasMissingPersonalMidYearSelfScore = computed(() => {
  if (dashboardData.value?.phase !== 'mid_year') return false
  return personalItemsFlat.value.some(it => it.selfScore == null)
})

const hasMissingPromotionMidYearSelfScore = computed(() => {
  if (dashboardData.value?.phase !== 'mid_year') return false
  return promotionItemsFlat.value.some(it => it.selfScore == null)
})

function canSubmitByType(items: KpiItem[]): boolean {
  if (!isCurrentYear.value || !items.length || !dashboardData.value?.canSubmit) return false
  const p = dashboardData.value?.phase
  const statusCodes = items
    .map(i => Number(i.statusCode))
    .filter(n => Number.isFinite(n))
  if (!statusCodes.length) return false
  if (p === 'target_setup') {
    return statusCodes.some(sc => sc === 404)
  }
  if (p === 'mid_year') {
    return statusCodes.some(sc => sc === 405)
  }
  if (p === 'year_end') {
    return statusCodes.some(sc => sc === 405 || sc === 503)
  }
  return false
}

function hasPendingActionByType(items: KpiItem[]): boolean {
  if (!items.length) return false
  const p = dashboardData.value?.phase
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

const canSubmitPersonal = computed(
  () => canSubmitByType(personalItemsFlat.value),
)
const canSubmitPromotion = computed(
  () => canSubmitByType(promotionItemsFlat.value),
)

const isPersonalSubmitDisabled = computed(
  () =>
    submittingPersonal.value
    || hasMissingPersonalMidYearSelfScore.value
    || hasSubmitBlockingStatus(personalItemsFlat.value),
)
const isPromotionSubmitDisabled = computed(
  () =>
    submittingPromotion.value
    || hasMissingPromotionMidYearSelfScore.value
    || hasSubmitBlockingStatus(promotionItemsFlat.value),
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
  const phase = dashboardData.value?.phase ?? null
  const activeItems = memberKpiMainTab.value === 'promotion'
    ? promotionItemsFlat.value
    : personalItemsFlat.value
  const hasPendingAction = hasPendingActionByType(activeItems)
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
  await loadDashboard()
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
    await memberKpiService.submit(selectedYear.value, 'INDIVIDUAL')
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
    await memberKpiService.submit(selectedYear.value, 'PROMOTION')
    await loadDashboard()
    toast.success('Promotion KPI đã được nộp thành công')
  } catch (e: unknown) {
    toast.error(apiSubmitErrorMessage(e))
  } finally {
    submittingPromotion.value = false
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

      <MemberProcessTimeline :year="selectedYear" :active-phase="dashboardData.phase" />

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
            v-if="memberKpiMainTab === 'personal' && isCurrentYear"
            type="button"
            class="mb-1.5 mr-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            @click="showCreateIndividualKpiDrawer = true"
          >
            <i class="fas fa-plus text-xs" aria-hidden="true" />
            Tạo KPI
          </button>
        </div>

        <MemberCreateIndividualKpiDrawer
          v-model="showCreateIndividualKpiDrawer"
          :cycle-id="String(selectedYear)"
          @saved="onMemberIndividualKpiSaved"
        />

        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <!-- Personal KPI tab -->
          <template v-if="memberKpiMainTab === 'personal'">
            <MemberKpiPersonalTab
              :sections="personalGroupedSections"
              :personal-self-weighted-avg="personalSelfWeightedAvg"
              :is-current-year="isCurrentYear"
              :submitting="submittingPersonal"
              :can-submit="canSubmitPersonal"
              :is-submit-disabled="isPersonalSubmitDisabled"
              :submit-label="memberSheetSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-feedback="evidenceCtx.openFeedbackPanel"
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
              :submitting="submittingPromotion"
              :can-submit="canSubmitPromotion"
              :is-submit-disabled="isPromotionSubmitDisabled"
              :submit-label="promotionSubmitLabel"
              @open-evidence="evidenceCtx.openEvidencePanel"
              @open-feedback="evidenceCtx.openFeedbackPanel"
              @submit="handlePromotionSubmit"
            />
          </template>
        </div>
      </div>

    </template>

    <!-- Evidence drawer -->
    <MemberEvidenceDrawer />

  </div>
</template>
