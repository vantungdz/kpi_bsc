<script setup lang="ts">
import {computed, nextTick, onUnmounted, ref, watch} from 'vue'
import ProcessTimelineTrack from '@/components/shared/ProcessTimelineTrack.vue'
import dayjs from 'dayjs'
import {kpiCycleService} from "@/services/shared/kpi-cycle.service";

const props = defineProps<{
  year: number
  /** Late entry: two milestones (KPI Setting + Year-End), Mid-Year omitted. */
  yearEndOnly?: boolean
  /** All KPIs finalized (603) — timeline shows all phases / Year-End as complete. */
  evaluationFullyCompleted?: boolean
  /** Phase-level completion flags from assignment statuses. */
  targetSetupCompleted?: boolean
  midYearCompleted?: boolean
  yearEndCompleted?: boolean
  /** Only show KPI Setting as complete after the first submit actually happened. */
  goalSettingSubmitted?: boolean
}>()

const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6

// ==========================================
// 1. MOCK API & STATE LƯU DỮ LIỆU
// ==========================================
const isLoading = ref(true)

const cycleData = ref<{
  activePhase: string | null
  goalSettingStart: string | null
  goalSettingEnd: string | null
  midYearStart: string | null
  midYearEnd: string | null
  endYearStart: string | null
  endYearEnd: string | null
}>({
  activePhase: null,
  goalSettingStart: null,
  goalSettingEnd: null,
  midYearStart: null,
  midYearEnd: null,
  endYearStart: null,
  endYearEnd: null
})

watch(
    () => props.year,
    async (newYear) => {
      isLoading.value = true
      try {
        const responseData = await kpiCycleService.getKpiCycleByYear(newYear)

        cycleData.value = {
          activePhase: responseData.activePhase,
          goalSettingStart: responseData.goalSettingStart,
          goalSettingEnd: responseData.goalSettingEnd,
          midYearStart: responseData.midYearStart,
          midYearEnd: responseData.midYearEnd,
          endYearStart: responseData.endYearStart,
          endYearEnd: responseData.endYearEnd
        }
      } catch (error) {
        console.error('Failed to load cycle data:', error)
        cycleData.value = {
          activePhase: null,
          goalSettingStart: null,
          goalSettingEnd: null,
          midYearStart: null,
          midYearEnd: null,
          endYearStart: null,
          endYearEnd: null
        }
      } finally {
        isLoading.value = false
      }
    },
    {immediate: true}
)

// ==========================================
// 2. LOGIC TÍNH TOÁN CÁC MỐC THỜI GIAN
// ==========================================
type PhaseStatus = 'upcoming' | 'active' | 'complete'

function formatMonthRangeLabel(start: string | null, end: string | null, fallback: string): string {
  if (!start || !end) return fallback
  const a = dayjs(start).format('MMM')
  const b = dayjs(end).format('MMM')
  return a === b ? a : `${a} – ${b}`
}

const dynamicPhases = computed(() => {
  return [
    {
      key: 'setting',
      title: 'KPI Setting',
      sub: formatMonthRangeLabel(
        cycleData.value.goalSettingStart,
        cycleData.value.goalSettingEnd,
        'Jan – Feb',
      ),
      deadline: cycleData.value.goalSettingEnd,
    },
    {
      key: 'mid',
      title: 'Mid-Year Review',
      sub: formatMonthRangeLabel(
        cycleData.value.midYearStart,
        cycleData.value.midYearEnd,
        'Apr – Aug',
      ),
      deadline: cycleData.value.midYearEnd,
    },
    {
      key: 'yearEnd',
      title: 'Year-End Review',
      sub: formatMonthRangeLabel(
        cycleData.value.endYearStart,
        cycleData.value.endYearEnd,
        'Oct – Dec',
      ),
      deadline: cycleData.value.endYearEnd,
    },
  ]
})

const phaseStatuses = computed((): PhaseStatus[] => {
  const yNow = new Date().getFullYear()

  if (props.year < yNow) return ['complete', 'complete', 'complete']
  if (props.year > yNow) return ['upcoming', 'upcoming', 'upcoming']

  if (props.evaluationFullyCompleted) {
    return ['complete', 'complete', 'complete']
  }

  // Ưu tiên cờ activePhase cứng từ API (nếu có)
  const ap = cycleData.value.activePhase === 'end_year' ? 'year_end' : cycleData.value.activePhase
  if (ap === 'target_setup') return ['active', 'upcoming', 'upcoming']
  if (ap === 'mid_year') {
    const midStart = cycleData.value.midYearStart
    if (midStart && dayjs().isBefore(dayjs(midStart))) {
      return ['complete', 'upcoming', 'upcoming']
    }
    return ['complete', 'active', 'upcoming']
  }
  if (ap === 'year_end') {
    const endStart = cycleData.value.endYearStart
    if (endStart && dayjs().isBefore(dayjs(endStart))) {
      return ['complete', 'complete', 'upcoming']
    }
    return ['complete', 'complete', 'active']
  }

  // Tính toán linh hoạt dựa trên deadline
  const now = dayjs()
  const statuses: PhaseStatus[] = []

  dynamicPhases.value.forEach((phase, index) => {
    if (!phase.deadline) {
      statuses.push('upcoming')
      return
    }

    const deadlineDate = dayjs(phase.deadline)

    if (now.isAfter(deadlineDate)) {
      statuses.push('complete')
    } else {
      if (index === 0 || statuses[index - 1] === 'complete') {
        statuses.push('active')
      } else {
        statuses.push('upcoming')
      }
    }
  })

  return statuses
})

const TRACK_SPAN_PCT = TRACK_RIGHT_PCT - TRACK_LEFT_PCT

const settingStatus = computed(() => effectivePhaseStatus(0))
const midYearStatus = computed(() => effectivePhaseStatus(1))
const yearEndStatus = computed(() => effectivePhaseStatus(2))

function isPhaseCompleted(idx: number): boolean {
  if (props.evaluationFullyCompleted) return true
  if (idx === 0) return props.targetSetupCompleted ?? props.goalSettingSubmitted ?? false
  if (idx === 1) return props.midYearCompleted ?? false
  return props.yearEndCompleted ?? false
}

function effectivePhaseStatus(idx: number): PhaseStatus {
  const status = phaseStatuses.value[idx]!
  if (isPhaseCompleted(idx)) return 'complete'
  if (status === 'upcoming') return 'upcoming'
  return 'active'
}

function phaseStatusText(idx: number): string {
  const status = effectivePhaseStatus(idx)
  if (status === 'complete') return 'Done'
  if (status === 'active') return 'In Progress'
  if (idx === 1) return 'Mid-Year not started'
  if (idx === 2) return 'Year-End not started'
  return 'KPI Setting not started'
}

function phaseStatusClass(idx: number): string {
  const status = effectivePhaseStatus(idx)
  if (status === 'complete') return 'text-emerald-700'
  if (status === 'active') return idx === 0 ? 'text-emerald-800' : 'text-blue-800'
  return 'text-slate-400'
}

function phaseTitleClass(idx: number) {
  const s = effectivePhaseStatus(idx)
  if (s === 'complete') return 'text-emerald-600'
  if (s === 'active') return idx === 0 ? 'text-emerald-600' : 'text-blue-600'
  return 'text-slate-400'
}

function phaseSubLabelClass(idx: number) {
  const s = effectivePhaseStatus(idx)
  if (s === 'upcoming') return 'text-slate-400'
  return 'text-slate-500'
}

function milestoneOuterClass(idx: number) {
  const s = effectivePhaseStatus(idx)
  if (s === 'complete') return 'bg-emerald-500 shadow-sm ring-2 ring-white'
  if (s === 'active') return 'bg-transparent shadow-none ring-0'
  return 'bg-slate-200 shadow-sm ring-2 ring-white'
}

// ==========================================
// 3. LOGIC HIỂN THỊ TRACK (Đường Line ngang)
// ==========================================
/**
 * Piecewise progress fraction (0→1):
 * - Trong phase [start, end] → nằm tại milestone (fraction cố định).
 * - Giữa 2 phase → di chuyển linear từ milestone trước tới milestone tiếp.
 * - Fallback: calendar year nếu thiếu dữ liệu hoặc năm khác.
 */
const cycleProgressFraction = computed((): number => {
  const cd = cycleData.value
  const now = dayjs()
  const yNow = now.year()

  // Năm đã qua → hoàn thành 100%; năm tương lai → 0%
  if (props.year < yNow) return 1
  if (props.year > yNow) return 0
  if (props.evaluationFullyCompleted) return 1

  const gs = cd.goalSettingStart ? dayjs(cd.goalSettingStart) : null
  const ge = cd.goalSettingEnd   ? dayjs(cd.goalSettingEnd)   : null
  const ms = cd.midYearStart     ? dayjs(cd.midYearStart)     : null
  const me = cd.midYearEnd       ? dayjs(cd.midYearEnd)       : null
  const es = cd.endYearStart     ? dayjs(cd.endYearStart)     : null
  const ee = cd.endYearEnd       ? dayjs(cd.endYearEnd)       : null

  if (gs && ge && ms && me && es && ee && ee.isAfter(gs)) {
    // Vị trí cố định của 3 milestone (độc lập với date)
    const F0 = 0    // milestone 0 tại 16.67%
    const F1 = 0.5  // milestone 1 tại 50%
    const F2 = 1.0  // milestone 2 tại 83.33%

    if (now.isBefore(gs)) return 0

    // Phase 0 [goalSettingStart, goalSettingEnd] → đứng tại milestone 0
    if (!now.isAfter(ge)) return F0

    // Giữa phase 0 và phase 1 → đi từ F0 → F1
    if (now.isBefore(ms)) {
      const gapTotal = ms.valueOf() - ge.valueOf()
      const gapElapsed = now.valueOf() - ge.valueOf()
      return F0 + (gapElapsed / gapTotal) * (F1 - F0)
    }

    // Phase 1 [midYearStart, midYearEnd] → đứng tại milestone 1
    if (!now.isAfter(me)) return F1

    // Giữa phase 1 và phase 2 → đi từ F1 → F2
    if (now.isBefore(es)) {
      const gapTotal = es.valueOf() - me.valueOf()
      const gapElapsed = now.valueOf() - me.valueOf()
      return F1 + (gapElapsed / gapTotal) * (F2 - F1)
    }

    // Phase 2 [endYearStart, endYearEnd] → đứng tại milestone 2
    if (!now.isAfter(ee)) return F2

    return 1
  }

  // Fallback: calendar year linear
  const t0 = new Date(props.year, 0, 1).getTime()
  const t1 = new Date(props.year, 11, 31, 23, 59, 59, 999).getTime()
  return Math.min(1, Math.max(0, (now.valueOf() - t0) / (t1 - t0)))
})

/** Vào cuối kỳ: tiến độ & marker «hôm nay» trên đoạn KPI Setting → Year-End (bỏ Mid-Year). */
const cycleProgressFractionYearEndOnly = computed((): number => {
  const cd = cycleData.value
  const now = dayjs()
  const yNow = now.year()
  if (props.year < yNow) return 1
  if (props.year > yNow) return 0
  if (props.evaluationFullyCompleted) return 1

  const ge = cd.goalSettingEnd ? dayjs(cd.goalSettingEnd) : null
  const ee = cd.endYearEnd ? dayjs(cd.endYearEnd) : null
  if (ge && ee && ee.isAfter(ge)) {
    if (now.isBefore(ge)) return 0
    if (!now.isAfter(ee)) {
      return (now.valueOf() - ge.valueOf()) / (ee.valueOf() - ge.valueOf())
    }
    return 1
  }

  const es = cd.endYearStart ? dayjs(cd.endYearStart) : null
  if (es && ee && ee.isAfter(es)) {
    if (now.isBefore(es)) return 0
    if (!now.isAfter(ee)) {
      return (now.valueOf() - es.valueOf()) / (ee.valueOf() - es.valueOf())
    }
    return 1
  }
  return cycleProgressFraction.value
})

const cycleProgressFractionEffective = computed(() =>
  props.yearEndOnly ? cycleProgressFractionYearEndOnly.value : cycleProgressFraction.value,
)

const nowMarkerLeftPct = computed(
    () => TRACK_LEFT_PCT + cycleProgressFractionEffective.value * TRACK_SPAN_PCT,
)

const nowMarkerPositionStyle = computed(() => ({
  left: `${nowMarkerLeftPct.value}%`,
  top: '50%',
  transform: 'translate(-50%, -50%)',
}))

const trackBarStyle = {
  left: `${TRACK_LEFT_PCT}%`,
  width: `${TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}

const progressFillStyle = computed(() => ({
  left: `${TRACK_LEFT_PCT}%`,
  width: `${Math.max(0, cycleProgressFractionEffective.value) * TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}))

const nowMarkerLabel = computed(() => {
  const d = new Date()
  return `${props.year} progress: ${d.toLocaleDateString('en-US')}`
})

const milestoneLeftPctsYearEndOnly = computed<(number | undefined)[] | undefined>(() => {
  if (!props.yearEndOnly) return undefined
  const L0 = TRACK_LEFT_PCT + 0 * TRACK_SPAN_PCT
  const L2 = TRACK_LEFT_PCT + 1 * TRACK_SPAN_PCT
  return [L0, undefined, L2]
})

const trackMilestones = computed(() => {
  if (props.yearEndOnly) {
    return [
      {
        idx: 0,
        outerClass: milestoneOuterClass(0),
        status: effectivePhaseStatus(0) as 'complete' | 'active' | 'upcoming',
      },
      {
        idx: 2,
        outerClass: milestoneOuterClass(2),
        status: effectivePhaseStatus(2) as 'complete' | 'active' | 'upcoming',
      },
    ]
  }
  return [0, 1, 2].map((idx) => ({
    idx,
    outerClass: milestoneOuterClass(idx),
    status: effectivePhaseStatus(idx) as 'complete' | 'active' | 'upcoming',
  }))
})

const timelineShowNowMarker = computed(
  () => !trackMilestones.value.every((m) => m.status === 'complete'),
)

// ==========================================
// 4. LOGIC FOLD/UNFOLD UI
// ==========================================
const timelineCollapsed = ref(true)
const showExpandedTimeline = ref(false)
const showCollapsedTrack = ref(true)
const TIMELINE_SWAP_MS = 180
let timelineSwapTimer: ReturnType<typeof setTimeout> | null = null

const timelineCardClass = computed(() => (timelineCollapsed.value ? 'py-2' : 'pb-6 pt-4'))
const timelineHeaderClass = computed(() =>
    timelineCollapsed.value ? 'mb-0 min-h-[2.75rem]' : 'mb-3 min-h-[2.5rem]',
)
const timelineToggleBtnClass =
    'inline-flex h-8 min-w-[6.75rem] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800'

function clearTimelineSwapTimer() {
  if (timelineSwapTimer != null) {
    window.clearTimeout(timelineSwapTimer)
    timelineSwapTimer = null
  }
}

function toggleTimelineCollapsed() {
  clearTimelineSwapTimer()

  if (!timelineCollapsed.value) {
    showExpandedTimeline.value = false
    showCollapsedTrack.value = false

    timelineSwapTimer = window.setTimeout(() => {
      timelineCollapsed.value = true
      showCollapsedTrack.value = true
      timelineSwapTimer = null
    }, TIMELINE_SWAP_MS)
    return
  }

  showCollapsedTrack.value = false
  timelineCollapsed.value = false

  void nextTick(() => {
    timelineSwapTimer = window.setTimeout(() => {
      showExpandedTimeline.value = true
      timelineSwapTimer = null
    }, 40)
  })
}

onUnmounted(() => {
  clearTimelineSwapTimer()
})
</script>

<template>
  <div
      class="relative overflow-visible rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-[padding] duration-200 ease-out md:px-5"
      :class="timelineCardClass"
  >
    <div v-if="isLoading"
         class="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
      <i class="fas fa-spinner fa-spin text-blue-500"></i>
    </div>

    <div class="relative grid grid-cols-[auto_1fr_auto] items-center gap-3" :class="timelineHeaderClass">
      <Transition name="member-tl-track-slot">
        <div
            v-if="showCollapsedTrack"
            key="track-header-bleed"
            class="pointer-events-none absolute inset-x-0 top-1/2 z-0 w-full -translate-y-1/2"
            aria-hidden="true"
        >
          <ProcessTimelineTrack
              :track-bar-style="trackBarStyle"
              :progress-fill-style="progressFillStyle"
              :now-marker-position-style="nowMarkerPositionStyle"
              :now-marker-label="nowMarkerLabel"
              :milestones="trackMilestones"
              :milestone-left-pcts="milestoneLeftPctsYearEndOnly"
              :show-now-marker="timelineShowNowMarker"
          />
        </div>
      </Transition>

      <h3 class="relative z-10 shrink-0 bg-white py-0.5 pr-3 text-xs font-bold uppercase tracking-wider text-slate-700">
        Process Timeline
      </h3>

      <button
          type="button"
          :class="[timelineToggleBtnClass, 'relative z-10 justify-self-end bg-white py-0.5 pl-3']"
          :aria-expanded="!timelineCollapsed"
          :aria-label="timelineCollapsed ? 'Expand process timeline' : 'Collapse process timeline'"
          @click="toggleTimelineCollapsed"
      >
        <i
            class="fas text-[10px] text-slate-500"
            :class="timelineCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"
        />
        {{ timelineCollapsed ? 'Expand' : 'Collapse' }}
      </button>
    </div>

    <div class="text-center">
      <p
          v-if="yearEndOnly && showExpandedTimeline"
          class="mb-2 text-center text-[11px] leading-snug text-slate-500"
      >
        KPIs assigned after mid-year — this timeline shows KPI Setting and Year-End only (Mid-Year is omitted).
      </p>

      <Transition name="member-timeline-fold">
        <div
            v-if="showExpandedTimeline && yearEndOnly"
            key="tl-year-end-only-stack"
            class="relative mx-auto w-full max-w-3xl pb-1 pt-0"
        >
          <div class="relative z-[2] min-h-[2.75rem] w-full">
            <div
                class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
                :style="{ left: `${TRACK_LEFT_PCT}%` }"
            >
              <span class="text-xs font-bold" :class="phaseTitleClass(0)">{{ dynamicPhases[0]?.title }}</span>
              <p class="mt-0.5 text-[12px] leading-tight" :class="phaseSubLabelClass(0)">
                <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200"></span>
                <span v-else>{{ dynamicPhases[0]?.sub }}</span>
              </p>
            </div>
            <div
                class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
                :style="{ left: `${TRACK_RIGHT_PCT}%` }"
            >
              <span class="text-xs font-bold" :class="phaseTitleClass(2)">{{ dynamicPhases[2]?.title }}</span>
              <p class="mt-0.5 text-[12px] leading-tight" :class="phaseSubLabelClass(2)">
                <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200"></span>
                <span v-else>{{ dynamicPhases[2]?.sub }}</span>
              </p>
            </div>
          </div>

          <div class="relative z-0 mt-1 w-full">
            <ProcessTimelineTrack
                :track-bar-style="trackBarStyle"
                :progress-fill-style="progressFillStyle"
                :now-marker-position-style="nowMarkerPositionStyle"
                :now-marker-label="nowMarkerLabel"
                :milestones="trackMilestones"
                :milestone-left-pcts="milestoneLeftPctsYearEndOnly"
                :show-now-marker="timelineShowNowMarker"
            />
          </div>

          <div class="relative z-[2] mt-2 min-h-[5rem] w-full pb-0.5">
            <div
                class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
                :style="{ left: `${TRACK_LEFT_PCT}%` }"
            >
              <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
                <span class="font-semibold" :class="phaseStatusClass(0)">{{ phaseStatusText(0) }}</span>
              </div>
            </div>
            <div
                class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
                :style="{ left: `${TRACK_RIGHT_PCT}%` }"
            >
              <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
                <span class="font-semibold" :class="phaseStatusClass(2)">{{ phaseStatusText(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="member-timeline-fold">
        <div
            v-if="showExpandedTimeline && !yearEndOnly"
            key="tl-phases"
            class="grid grid-cols-3 gap-1.5"
        >
            <div class="min-w-0">
              <span class="text-xs font-bold" :class="phaseTitleClass(0)">{{ dynamicPhases[0]?.title }}</span>
              <p class="mt-0.5 text-[12px]" :class="phaseSubLabelClass(0)">
                <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200"></span>
                <span v-else>{{ dynamicPhases[0]?.sub }}</span>
              </p>
            </div>
            <div class="min-w-0">
              <span class="text-xs font-bold" :class="phaseTitleClass(1)">{{ dynamicPhases[1]?.title }}</span>
              <p class="mt-0.5 text-[12px]" :class="phaseSubLabelClass(1)">
                <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200"></span>
                <span v-else>{{ dynamicPhases[1]?.sub }}</span>
              </p>
            </div>
            <div class="min-w-0">
              <span class="text-xs font-bold" :class="phaseTitleClass(2)">{{ dynamicPhases[2]?.title }}</span>
              <p class="mt-0.5 text-[12px]" :class="phaseSubLabelClass(2)">
                <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200"></span>
                <span v-else>{{ dynamicPhases[2]?.sub }}</span>
              </p>
            </div>
        </div>
      </Transition>

      <Transition name="member-tl-track-slot">
        <div v-if="showExpandedTimeline && !yearEndOnly" key="track-below" class="mt-4">
          <ProcessTimelineTrack
              :track-bar-style="trackBarStyle"
              :progress-fill-style="progressFillStyle"
              :now-marker-position-style="nowMarkerPositionStyle"
              :now-marker-label="nowMarkerLabel"
              :milestones="trackMilestones"
              :milestone-left-pcts="milestoneLeftPctsYearEndOnly"
              :show-now-marker="timelineShowNowMarker"
          />
        </div>
      </Transition>

      <Transition name="member-timeline-fold">
        <div
            v-if="showExpandedTimeline && !yearEndOnly"
            key="tl-notes"
            class="mt-3 grid grid-cols-3 gap-1.5 text-[12px] leading-snug"
        >
            <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
              <span class="font-semibold" :class="phaseStatusClass(0)">{{ phaseStatusText(0) }}</span>
            </div>

            <div
                class="flex flex-col items-center gap-1 px-0.5 text-slate-600"
                :class="midYearStatus === 'upcoming' ? 'opacity-95' : ''"
            >
              <span class="font-semibold" :class="phaseStatusClass(1)">{{ phaseStatusText(1) }}</span>
            </div>

            <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
              <span class="font-semibold" :class="phaseStatusClass(2)">{{ phaseStatusText(2) }}</span>
            </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.member-timeline-fold-enter-active,
.member-timeline-fold-leave-active {
  transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.26s ease;
  overflow: hidden;
}

.member-timeline-fold-enter-from,
.member-timeline-fold-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}

.member-timeline-fold-enter-to,
.member-timeline-fold-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 36rem;
}

@media (prefers-reduced-motion: reduce) {
  .member-timeline-fold-enter-active,
  .member-timeline-fold-leave-active {
    transition-duration: 0.01ms !important;
  }
}

.member-tl-track-slot-enter-active,
.member-tl-track-slot-leave-active {
  transition: opacity 0.18s ease;
}

.member-tl-track-slot-enter-from,
.member-tl-track-slot-leave-to {
  opacity: 0;
}

.member-tl-track-slot-enter-to,
.member-tl-track-slot-leave-from {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .member-tl-track-slot-enter-active,
  .member-tl-track-slot-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>