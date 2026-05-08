<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { EvalPhase } from '@/types/kpi'
import GmProcessTimelineTrack from '@/components/gm/GmProcessTimelineTrack.vue'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import dayjs from 'dayjs'

const props = defineProps<{
  year: number
  activePhase?: EvalPhase | null
}>()

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
  endYearEnd: null,
})

watch(
  () => props.year,
  async (newYear) => {
    isLoading.value = true
    try {
      const response = await kpiCycleService.getKpiCycleByYear(newYear)
      cycleData.value = {
        activePhase: response.activePhase,
        goalSettingStart: response.goalSettingStart,
        goalSettingEnd: response.goalSettingEnd,
        midYearStart: response.midYearStart,
        midYearEnd: response.midYearEnd,
        endYearStart: response.endYearStart,
        endYearEnd: response.endYearEnd,
      }
    } catch {
      cycleData.value = {
        activePhase: null,
        goalSettingStart: null,
        goalSettingEnd: null,
        midYearStart: null,
        midYearEnd: null,
        endYearStart: null,
        endYearEnd: null,
      }
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

function formatPhaseDuration(start: string | null, end: string | null, fallback: string): string {
  if (!start || !end) return fallback
  const startMonth = dayjs(start).format('MMM')
  const endMonth = dayjs(end).format('MMM')
  return startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`
}

const phaseLabels = computed(() => ({
  setting: formatPhaseDuration(cycleData.value.goalSettingStart, cycleData.value.goalSettingEnd, 'Q1'),
  mid: formatPhaseDuration(cycleData.value.midYearStart, cycleData.value.midYearEnd, 'Q2-Q3'),
  yearEnd: formatPhaseDuration(cycleData.value.endYearStart, cycleData.value.endYearEnd, 'Q4'),
}))

type PhaseStatus = 'upcoming' | 'active' | 'complete'

const phaseStatuses = computed((): PhaseStatus[] => {
  const now = dayjs()
  const currentYear = now.year()
  if (props.year < currentYear) return ['complete', 'complete', 'complete']
  if (props.year > currentYear) return ['upcoming', 'upcoming', 'upcoming']

  const activePhase = props.activePhase ?? cycleData.value.activePhase
  if (activePhase === 'target_setup') return ['active', 'upcoming', 'upcoming']
  if (activePhase === 'mid_year') return ['complete', 'active', 'upcoming']
  if (activePhase === 'year_end') return ['complete', 'complete', 'active']

  function calcStatus(start: string | null, end: string | null): PhaseStatus {
    if (!start || !end) return 'upcoming'
    if (now.isBefore(dayjs(start))) return 'upcoming'
    if (now.isAfter(dayjs(end))) return 'complete'
    return 'active'
  }

  return [
    calcStatus(cycleData.value.goalSettingStart, cycleData.value.goalSettingEnd),
    calcStatus(cycleData.value.midYearStart, cycleData.value.midYearEnd),
    calcStatus(cycleData.value.endYearStart, cycleData.value.endYearEnd),
  ]
})

const settingStatus = computed(() => phaseStatuses.value[0]!)
const midYearStatus = computed(() => phaseStatuses.value[1]!)
const yearEndStatus = computed(() => phaseStatuses.value[2]!)

function phaseTitleClass(idx: number) {
  const status = phaseStatuses.value[idx]!
  if (status === 'complete') return 'text-emerald-600'
  if (status === 'active') return idx === 0 ? 'text-emerald-600' : 'text-blue-600'
  return 'text-slate-400'
}

function phaseSubLabelClass(idx: number) {
  const status = phaseStatuses.value[idx]!
  return status === 'upcoming' ? 'text-slate-400' : 'text-slate-500'
}

function milestoneOuterClass(idx: number) {
  const status = phaseStatuses.value[idx]!
  if (status === 'complete') return 'bg-emerald-500 shadow-sm ring-2 ring-white'
  if (status === 'active') return 'bg-white shadow-sm ring-2 ring-white'
  return 'bg-slate-200 shadow-sm ring-2 ring-white'
}

const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6
const TRACK_SPAN_PCT = TRACK_RIGHT_PCT - TRACK_LEFT_PCT

const cycleProgressFraction = computed((): number => {
  const now = dayjs()
  const currentYear = now.year()
  if (props.year < currentYear) return 1
  if (props.year > currentYear) return 0

  const gs = cycleData.value.goalSettingStart ? dayjs(cycleData.value.goalSettingStart) : null
  const ge = cycleData.value.goalSettingEnd ? dayjs(cycleData.value.goalSettingEnd) : null
  const ms = cycleData.value.midYearStart ? dayjs(cycleData.value.midYearStart) : null
  const me = cycleData.value.midYearEnd ? dayjs(cycleData.value.midYearEnd) : null
  const es = cycleData.value.endYearStart ? dayjs(cycleData.value.endYearStart) : null
  const ee = cycleData.value.endYearEnd ? dayjs(cycleData.value.endYearEnd) : null

  if (gs && ge && ms && me && es && ee && ee.isAfter(gs)) {
    const F0 = 0
    const F1 = 0.5
    const F2 = 1.0

    if (now.isBefore(gs)) return 0
    if (!now.isAfter(ge)) return F0

    if (now.isBefore(ms)) {
      const gapTotal = ms.valueOf() - ge.valueOf()
      const gapElapsed = now.valueOf() - ge.valueOf()
      return F0 + (gapElapsed / gapTotal) * (F1 - F0)
    }

    if (!now.isAfter(me)) return F1

    if (now.isBefore(es)) {
      const gapTotal = es.valueOf() - me.valueOf()
      const gapElapsed = now.valueOf() - me.valueOf()
      return F1 + (gapElapsed / gapTotal) * (F2 - F1)
    }

    if (!now.isAfter(ee)) return F2
    return 1
  }

  const t0 = new Date(props.year, 0, 1).getTime()
  const t1 = new Date(props.year, 11, 31, 23, 59, 59, 999).getTime()
  return Math.min(1, Math.max(0, (now.valueOf() - t0) / (t1 - t0)))
})

const nowMarkerLeftPct = computed(() => TRACK_LEFT_PCT + cycleProgressFraction.value * TRACK_SPAN_PCT)
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
  width: `${Math.max(0, cycleProgressFraction.value) * TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}))

const nowMarkerLabel = computed(
  () => `Tiến độ năm ${props.year}: ${new Date().toLocaleDateString('vi-VN')}`,
)

const trackMilestones = computed(() =>
  [0, 1, 2].map((idx) => ({
    idx,
    outerClass: milestoneOuterClass(idx),
    status: phaseStatuses.value[idx] as 'complete' | 'active' | 'upcoming',
  })),
)

const timelineCollapsed = ref(false)
const showExpandedTimeline = ref(true)
const showCollapsedTrack = ref(false)
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
    <div
      v-if="isLoading"
      class="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]"
    >
      <i class="fas fa-spinner fa-spin text-blue-500" />
    </div>

    <div class="relative grid grid-cols-[auto_1fr_auto] items-center gap-3" :class="timelineHeaderClass">
      <Transition name="member-tl-track-slot">
        <div
          v-if="showCollapsedTrack"
          key="track-header-bleed"
          class="pointer-events-none absolute inset-x-0 top-1/2 z-0 w-full -translate-y-1/2"
          aria-hidden="true"
        >
          <GmProcessTimelineTrack
            :track-bar-style="trackBarStyle"
            :progress-fill-style="progressFillStyle"
            :now-marker-position-style="nowMarkerPositionStyle"
            :now-marker-label="nowMarkerLabel"
            :milestones="trackMilestones"
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
        :aria-label="timelineCollapsed ? 'Mở rộng timeline' : 'Thu gọn timeline'"
        @click="toggleTimelineCollapsed"
      >
        <i
          class="fas text-[10px] text-slate-500"
          :class="timelineCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"
          aria-hidden="true"
        />
        {{ timelineCollapsed ? 'Mở rộng' : 'Thu gọn' }}
      </button>
    </div>

    <div class="text-center">
      <Transition name="member-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-phases" class="grid grid-cols-3 gap-1.5">
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(0)">KPI Setting</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(0)">
              <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.setting }}</span>
            </p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(1)">Mid-Year Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(1)">
              <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.mid }}</span>
            </p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(2)">Year-End Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(2)">
              <span v-if="isLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.yearEnd }}</span>
            </p>
          </div>
        </div>
      </Transition>

      <Transition name="member-tl-track-slot">
        <div v-if="showExpandedTimeline" key="track-below" class="mt-4">
          <GmProcessTimelineTrack
            :track-bar-style="trackBarStyle"
            :progress-fill-style="progressFillStyle"
            :now-marker-position-style="nowMarkerPositionStyle"
            :now-marker-label="nowMarkerLabel"
            :milestones="trackMilestones"
          />
        </div>
      </Transition>

      <Transition name="member-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-notes" class="mt-3 grid grid-cols-3 gap-1.5 text-[12px] leading-snug">
          <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
            <template v-if="settingStatus === 'upcoming'">
              <span class="font-semibold text-slate-400">Chưa tới mốc</span>
              <span class="text-[11px] text-slate-400">Chuẩn bị mục tiêu khi tới kỳ.</span>
            </template>
            <template v-else-if="settingStatus === 'active'">
              <span class="font-semibold text-emerald-800">Đang trong kỳ</span>
              <span class="text-[11px]">Xác nhận KPI, đính kèm bằng chứng và tự đánh giá theo hướng dẫn PM/Leader.</span>
            </template>
            <template v-else>
              <span class="font-semibold text-emerald-700">Đã qua mốc</span>
              <span class="text-[11px]">Rà soát lại nếu PM trả KPI về sửa (Revision).</span>
            </template>
          </div>

          <div
            class="flex flex-col items-center gap-1 px-0.5 text-slate-600"
            :class="midYearStatus === 'upcoming' ? 'opacity-95' : ''"
          >
            <template v-if="midYearStatus === 'upcoming'">
              <span class="font-semibold text-slate-400">Chưa tới mốc</span>
              <span class="text-[11px] text-slate-400">Giữ Actual cập nhật để tới tháng đánh giá không bị dồn việc.</span>
            </template>
            <template v-else-if="midYearStatus === 'active'">
              <span class="font-semibold text-blue-800">Đang trong kỳ</span>
              <span class="text-[11px]">Nhập đủ Actual / Plan, Self Score và nộp trước deadline nội bộ.</span>
            </template>
            <template v-else>
              <span class="font-semibold text-emerald-700">Đã qua mốc</span>
              <span class="text-[11px]">Theo dõi phản hồi PM, chỉnh sửa nếu cần làm lại.</span>
            </template>
          </div>

          <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
            <template v-if="yearEndStatus === 'upcoming'">
              <span class="font-semibold text-slate-400">Chưa tới mốc</span>
              <span class="text-[11px] text-slate-400">Tiếp tục cập nhật KPI trong các kỳ giữa năm.</span>
            </template>
            <template v-else-if="yearEndStatus === 'active'">
              <span class="font-semibold text-blue-800">Đang trong kỳ</span>
              <span class="text-[11px]">Tổng hợp kết quả cả năm, kiểm tra minh chứng trước khi đóng đánh giá.</span>
            </template>
            <template v-else>
              <span class="font-semibold text-emerald-700">Đã qua mốc</span>
              <span class="text-[11px]">Kỳ Year-End đã kết thúc theo lịch, xem trạng thái KPI ở bảng bên dưới.</span>
            </template>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.member-timeline-fold-enter-active,
.member-timeline-fold-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.26s ease;
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
