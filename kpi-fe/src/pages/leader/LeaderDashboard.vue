<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CreateIndividualKpiDrawer from '@/components/leader/drawer/CreateIndividualKpiDrawer.vue'
import PromotionKpiTable from '@/components/leader/table/PromotionKpiTable.vue'
import TeamMemberTable from '@/components/leader/table/TeamMemberTable.vue'
import PersonalKpiTable from '@/components/leader/table/PersonalKpiTable.vue'
import MemberKpiDeadlineBanner from '@/components/member/MemberKpiDeadlineBanner.vue'
import ProcessTimeline from '@/components/shared/ProcessTimeline.vue'
import { isReadonlyKpiYear } from '@/utils/kpi-year'
import { leaderKpiService } from '@/services/modules/kpi-leader.service'
import type { LeaderKpiInformationResponse } from '@/types/kpi'
import type { EvalPhase } from '@/types/kpi'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import { buildKpiDeadlineBanner, type KpiDeadlineBannerVm } from '@/utils/kpiDeadlineBanner'

// ── Core state ────────────────────────────────────────────────────────────────
const selectedYear = ref(new Date().getFullYear())
const activeTab = ref<'personal' | 'team' | 'promotion'>('personal')
const isReadonly = computed(() => isReadonlyKpiYear(selectedYear.value))

const currentYear = new Date().getFullYear()
const availableYears = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - 3 + i
  return { value: year, label: `Năm ${year}` }
}).reverse()

// ── Create individual KPI ─────────────────────────────────────────────────────
const showCreateIndividualKpiDrawer = ref(false)
const personalTableKey = ref(0)

const average = ref(0)
const averagePromotion = ref(0)

function onLeaderIndividualKpiSaved() {
  personalTableKey.value += 1
}

// ── Tab helpers ───────────────────────────────────────────────────────────────
type LeaderTab = 'personal' | 'team' | 'promotion'

function tabButtonClass(tab: LeaderTab) {
  const active = activeTab.value === tab
  if (!active) return 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
  return 'border-emerald-600 text-emerald-700'
}

function tabIconClass(tab: LeaderTab) {
  if (activeTab.value !== tab) return 'text-slate-400'
  return 'text-emerald-600'
}

// ── Summary cards data (below ProcessTimeline) ────────────────────────────────
const summaryData = ref<LeaderKpiInformationResponse | null>(null)
const promotionSummaryData = ref<LeaderKpiInformationResponse | null>(null)
const cycleData = ref<KpiCycleResponse | null>(null)

async function loadSummary() {
  const [summaryRs, promotionRs, cycleRs] = await Promise.allSettled([
    leaderKpiService.getKpiInfo(selectedYear.value, 'INDIVIDUAL'),
    leaderKpiService.getKpiInfo(selectedYear.value, 'PROMOTION'),
    kpiCycleService.getKpiCycleByYear(selectedYear.value),
  ])
  summaryData.value = summaryRs.status === 'fulfilled' ? summaryRs.value : null
  promotionSummaryData.value = promotionRs.status === 'fulfilled' ? promotionRs.value : null
  cycleData.value = cycleRs.status === 'fulfilled' ? cycleRs.value : null
}

onMounted(loadSummary)
watch(selectedYear, loadSummary)

const evidenceTotalCount = computed(() => {
  const data = activeTab.value === 'promotion' ? promotionSummaryData.value : summaryData.value
  if (!data?.categories) return 0
  return data.categories.reduce((sum, cat) => sum + cat.assignments.length, 0)
})

const evidenceCount = computed(() => {
  const data = activeTab.value === 'promotion' ? promotionSummaryData.value : summaryData.value
  if (!data?.categories) return 0
  return data.categories.reduce(
    (sum, cat) =>
      sum + cat.assignments.filter(a => a.evidences && a.evidences !== '{}' && a.evidences !== '[]').length,
    0,
  )
})

const leaderActiveEvalPhase = computed<EvalPhase | null>(() => {
  const raw = String(cycleData.value?.activePhase ?? '').trim()
  if (raw === 'target_setup' || raw === 'mid_year' || raw === 'year_end') return raw
  const cycle = cycleData.value
  if (!cycle) return null
  const now = Date.now()
  const ts = (v?: string | null) => (v ? new Date(v).getTime() : null)
  const inRange = (start: number | null, end: number | null) =>
    start != null && end != null && now >= start && now <= end
  const goalStart = ts(cycle.goalSettingStart)
  const goalEnd = ts(cycle.goalSettingEnd)
  const midStart = ts(cycle.midYearStart)
  const midEnd = ts(cycle.midYearEnd)
  const endStart = ts(cycle.endYearStart)
  const endEnd = ts(cycle.endYearEnd)
  if (inRange(goalStart, goalEnd)) return 'target_setup'
  if (inRange(midStart, midEnd)) return 'mid_year'
  if (inRange(endStart, endEnd)) return 'year_end'
  if (goalStart != null && now < goalStart) return 'target_setup'
  if (goalEnd != null && midStart != null && now > goalEnd && now < midStart) return 'mid_year'
  if (midEnd != null && endStart != null && now > midEnd && now < endStart) return 'mid_year'
  if (endEnd != null && now > endEnd) return 'year_end'
  return null
})

function hasPendingActionInSummary(
  data: LeaderKpiInformationResponse | null,
  phase: EvalPhase | null,
): boolean {
  if (!data || !phase) return false
  const statusCodes = data.categories
    .flatMap(c => c.assignments.map(a => Number(a.statusCode)))
    .filter(n => Number.isFinite(n))
  if (!statusCodes.length) return false
  if (phase === 'target_setup') return statusCodes.some(sc => sc === 404 || sc === 407)
  if (phase === 'mid_year') return statusCodes.some(sc => sc === 405)
  if (phase === 'year_end') return statusCodes.some(sc => sc === 405 || sc === 503)
  return false
}

const kpiDeadlineBanner = computed((): KpiDeadlineBannerVm | null => {
  if (activeTab.value === 'team') return null
  const currentSummary = activeTab.value === 'promotion' ? promotionSummaryData.value : summaryData.value
  let phase = leaderActiveEvalPhase.value
  const cycle = cycleData.value
  if (cycle && phase === 'year_end') {
    const now = Date.now()
    const endStart = cycle.endYearStart ? new Date(cycle.endYearStart).getTime() : null
    const midEnd = cycle.midYearEnd ? new Date(cycle.midYearEnd).getTime() : null
    const beforeEndYearWindow = endStart != null && now < endStart
    const afterMidYearDeadline = midEnd != null && now > midEnd
    const hasMidYearPending = (currentSummary?.categories ?? [])
      .flatMap(c => c.assignments ?? [])
      .some(a => Number(a.statusCode) === 405)
    if (beforeEndYearWindow && afterMidYearDeadline && hasMidYearPending) {
      phase = 'mid_year'
    }
  }
  const hasPendingAction = hasPendingActionInSummary(currentSummary, phase)
  const subject = activeTab.value === 'promotion' ? 'KPI thăng tiến' : 'KPI'
  return buildKpiDeadlineBanner({
    cycle,
    phase,
    subjectLabel: subject,
    warningDays: 3,
    hasPendingAction,
  })
})

function scrollToLeaderKpiSection() {
  document.getElementById('leader-kpi-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <div class="p-6 max-w-[1500px] mx-auto space-y-6 animate-fade-in">

    <!-- Readonly banner -->
    <div
      v-if="isReadonly"
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-sm"
    >
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-slate-200 text-slate-600">
          <i class="fas fa-lock text-lg" />
        </div>
        <div class="min-w-0">
          <p class="font-bold text-sm text-slate-800">Chế độ chỉ xem (năm {{ selectedYear }})</p>
          <p class="text-sm mt-1 leading-snug text-slate-600">
            Bảng KPI cá nhân và drawer hiện đang bị khóa — không thể chỉnh sửa hay lưu dữ liệu.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 shrink-0 justify-end">
        <span class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200/70 text-slate-500 border border-slate-300/50 cursor-not-allowed flex items-center gap-1.5">
          <i class="fas fa-eye text-xs" /> Chỉ xem
        </span>
      </div>
    </div>

    <!-- Deadline banner (from cycle in DB) -->
    <MemberKpiDeadlineBanner
      v-if="kpiDeadlineBanner"
      :banner="kpiDeadlineBanner"
      @cta-click="scrollToLeaderKpiSection"
    />

    <!-- Top action bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Leader Dashboard</h2>
        <p class="text-slate-500 text-sm mt-1">Tổng quan team và KPI cá nhân của Leader.</p>
      </div>
      <div class="flex gap-3">
        <select
          v-model="selectedYear"
          class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-emerald-100"
        >
          <option v-for="y in availableYears" :key="y.value" :value="y.value">{{ y.label }}</option>
        </select>
      </div>
    </div>

    <!-- Process Timeline -->
    <ProcessTimeline :year="selectedYear" />

    <!-- Summary cards (Tình trạng bằng chứng + Avg Self Score) -->
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <!-- Evidence status -->
      <div class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-emerald-50" />
        <div class="z-10 rounded-xl bg-emerald-100 p-3.5 text-emerald-600">
          <i class="fa-solid fa-file-export text-xl" />
        </div>
        <div class="z-10 min-w-0">
          <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Tình trạng bằng chứng ({{ activeTab === 'promotion' ? 'Promotion' : 'Personal' }})
          </p>
          <p class="text-2xl font-bold text-slate-800">
            {{ evidenceCount }}
            <span class="text-sm font-bold text-slate-400">/ {{ evidenceTotalCount }}</span>
            <span
              v-if="evidenceCount < evidenceTotalCount && evidenceTotalCount > 0"
              class="mt-0.5 text-[11px] font-semibold text-orange-500"
            >
              ( Cần bổ sung {{ evidenceTotalCount - evidenceCount }} mục )
            </span>
          </p>
        </div>
      </div>

      <!-- Avg Self Score -->
      <div class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-violet-50" />
        <div class="z-10 rounded-xl bg-violet-100 p-3 text-violet-600">
          <i class="fa-solid fa-chart-column text-xl" />
        </div>
        <div class="z-10 min-w-0">
          <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Avg Self Score (Personal, có trọng số)
          </p>
          <div class="flex items-baseline gap-2">
            <p class="text-2xl font-bold text-violet-700">
              {{ (activeTab === 'promotion' ? averagePromotion : average ?? 0).toFixed(2) }}
            </p>
            <p class="text-[10px] font-semibold text-violet-500">/ 5.0</p>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI section -->
    <div id="leader-kpi-section" class="scroll-mt-24">

      <!-- Tab bar (matching MemberDashboard style) -->
      <div class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
        <nav class="flex flex-wrap gap-1" aria-label="Leader KPI tabs">
          <button
            type="button"
            class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
            :class="tabButtonClass('personal')"
            @click="activeTab = 'personal'"
          >
            <i class="fas fa-bullseye text-base" :class="tabIconClass('personal')" />
            Personal KPI
          </button>
          <button
            type="button"
            class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
            :class="tabButtonClass('team')"
            @click="activeTab = 'team'"
          >
            <i class="fas fa-sitemap text-base" :class="tabIconClass('team')" />
            Team Members
          </button>
          <button
            type="button"
            class="relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors"
            :class="tabButtonClass('promotion')"
            @click="activeTab = 'promotion'"
          >
            <i class="fas fa-arrow-trend-up text-base" :class="tabIconClass('promotion')" />
            Promotion KPI
          </button>
        </nav>

        <button
          v-if="!isReadonly && activeTab === 'personal'"
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
        :cycle-year="String(selectedYear)"
        @saved="onLeaderIndividualKpiSaved"
      />

      <!-- Tab content -->
      <div class="mt-4">

        <!-- Personal KPI -->
        <div v-show="activeTab === 'personal'">
          <PersonalKpiTable :key="personalTableKey" :year="selectedYear" :is-readonly="isReadonly" @updateAverage="average = $event"/>
        </div>

        <!-- Team Members -->
        <div v-show="activeTab === 'team'" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-users text-emerald-600" /> Team Performance Overview
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Nhấn vào thành viên để xem chi tiết KPI và phê duyệt.</p>
            </div>
          </div>
          <TeamMemberTable :year="selectedYear" />
        </div>

        <!-- Promotion KPI -->
        <div v-show="activeTab === 'promotion'">
          <PromotionKpiTable :year="selectedYear" :is-readonly="isReadonly" @updateAverage="averagePromotion = $event"/>
        </div>

      </div>
    </div>

  </div>
</template>
