<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import type { EvalPhase } from '@/types/kpi'
import GmProcessTimelineTrack from '@/components/gm/GmProcessTimelineTrack.vue'

const props = defineProps<{
  year: number
  /** Theo chu kỳ KPI trên API — ưu tiên hơn cửa sổ tháng trên lịch */
  activePhase?: EvalPhase | null
}>()

/** Cùng lịch giai đoạn với GM — góc nhìn Member: việc cần làm theo từng mốc. */
const PHASE_WINDOWS = [
  { key: 'setting', monthStart: 1, monthEnd: 3, title: 'KPI Setting', sub: 'Jan - Mar' },
  { key: 'mid', monthStart: 6, monthEnd: 7, title: 'Mid-Year Review', sub: 'Jun - Jul' },
  { key: 'yearEnd', monthStart: 11, monthEnd: 12, title: 'Year-End Review', sub: 'Nov - Dec' },
] as const

type PhaseStatus = 'upcoming' | 'active' | 'complete'

function phaseStatusForMonth(month: number, start: number, end: number): PhaseStatus {
  if (month < start) return 'upcoming'
  if (month <= end) return 'active'
  return 'complete'
}

const currentMonth = computed(() => new Date().getMonth() + 1)

const phaseStatuses = computed((): PhaseStatus[] => {
  const yNow = new Date().getFullYear()

  if (props.year < yNow) {
    return PHASE_WINDOWS.map(() => 'complete' as PhaseStatus)
  }
  if (props.year > yNow) {
    return PHASE_WINDOWS.map(() => 'upcoming' as PhaseStatus)
  }

  // Cùng năm hiện tại: đồng bộ với phase chu kỳ (mid_year ≠ “chưa tới” chỉ vì đang tháng 4)
  const ap = props.activePhase
  if (ap === 'target_setup') {
    return ['active', 'upcoming', 'upcoming']
  }
  if (ap === 'mid_year') {
    return ['complete', 'active', 'upcoming']
  }
  if (ap === 'year_end') {
    return ['complete', 'complete', 'active']
  }

  return PHASE_WINDOWS.map(p =>
    phaseStatusForMonth(currentMonth.value, p.monthStart, p.monthEnd),
  )
})

const settingStatus = computed(() => phaseStatuses.value[0]!)
const midYearStatus = computed(() => phaseStatuses.value[1]!)
const yearEndStatus = computed(() => phaseStatuses.value[2]!)

function phaseTitleClass(idx: number) {
  const s = phaseStatuses.value[idx]!
  if (s === 'complete') return 'text-emerald-600'
  if (s === 'active') return idx === 0 ? 'text-emerald-600' : 'text-blue-600'
  return 'text-slate-400'
}

function phaseSubLabelClass(idx: number) {
  const s = phaseStatuses.value[idx]!
  if (s === 'upcoming') return 'text-slate-400'
  return 'text-slate-500'
}

function milestoneOuterClass(idx: number) {
  const s = phaseStatuses.value[idx]!
  if (s === 'complete') return 'bg-emerald-500 shadow-sm ring-2 ring-white'
  if (s === 'active') return 'bg-white shadow-sm ring-2 ring-white'
  return 'bg-slate-200 shadow-sm ring-2 ring-white'
}

const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6

function calendarYearProgressForYear(y: number): number {
  const now = new Date()
  if (y < now.getFullYear()) return 1
  if (y > now.getFullYear()) return 0
  const t0 = new Date(y, 0, 1).getTime()
  const t1 = new Date(y, 11, 31, 23, 59, 59, 999).getTime()
  if (t1 <= t0) return 0
  return Math.min(1, Math.max(0, (now.getTime() - t0) / (t1 - t0)))
}

const calendarYearProgress = computed(() => calendarYearProgressForYear(props.year))

const TRACK_SPAN_PCT = TRACK_RIGHT_PCT - TRACK_LEFT_PCT

const nowMarkerLeftPct = computed(
  () => TRACK_LEFT_PCT + calendarYearProgress.value * TRACK_SPAN_PCT,
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
  width: `${Math.max(0, calendarYearProgress.value) * TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}))

const nowMarkerLabel = computed(() => {
  const d = new Date()
  return `Tiến độ năm ${props.year} (theo lịch): ${d.toLocaleDateString('vi-VN')}`
})

const trackMilestones = computed(() =>
  [0, 1, 2].map((idx) => ({
    idx,
    outerClass: milestoneOuterClass(idx),
    status: phaseStatuses.value[idx] as 'complete' | 'active' | 'upcoming',
  })),
)

const timelineCardClass = computed(() => (timelineCollapsed.value ? 'py-2' : 'pb-6 pt-4'))
const timelineHeaderClass = computed(() =>
  timelineCollapsed.value ? 'mb-0 min-h-[2.75rem]' : 'mb-3 min-h-[2.5rem]',
)

const timelineCollapsed = ref(true)
const showExpandedTimeline = ref(false)
const showCollapsedTrack = ref(true)
const TIMELINE_SWAP_MS = 180
let timelineSwapTimer: ReturnType<typeof setTimeout> | null = null

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

      <h3
        class="relative z-10 shrink-0 bg-white py-0.5 pr-3 text-xs font-bold uppercase tracking-wider text-slate-700"
      >
        Process Timeline (Member)
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
            <span class="text-xs font-bold" :class="phaseTitleClass(0)">{{ PHASE_WINDOWS[0].title }}</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(0)">{{ PHASE_WINDOWS[0].sub }}</p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(1)">{{ PHASE_WINDOWS[1].title }}</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(1)">{{ PHASE_WINDOWS[1].sub }}</p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(2)">{{ PHASE_WINDOWS[2].title }}</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(2)">{{ PHASE_WINDOWS[2].sub }}</p>
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
              <span class="text-[11px] text-slate-400">Chuẩn bị mục tiêu khi tới tháng 1.</span>
            </template>
            <template v-else-if="settingStatus === 'active'">
              <span class="font-semibold text-emerald-800">Đang trong kỳ</span>
              <span class="text-[11px]">Xác nhận KPI, đính kèm bằng chứng &amp; tự đánh giá theo hướng dẫn PM/Leader.</span>
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
              <span class="text-[11px] text-slate-400">Giữ Actual cập nhật để tới tháng 6 không bị dồn việc.</span>
            </template>
            <template v-else-if="midYearStatus === 'active'">
              <span class="font-semibold text-blue-800">Đang trong kỳ</span>
              <span class="text-[11px]">Nhập đủ Actual / Plan, Self Score và nộp trước deadline nội bộ.</span>
            </template>
            <template v-else>
              <span class="font-semibold text-emerald-700">Đã qua mốc</span>
              <span class="text-[11px]">Theo dõi phản hồi PM; chỉnh sửa nếu cần làm lại.</span>
            </template>
          </div>

          <div class="flex flex-col items-center gap-1 px-0.5 text-slate-600">
            <template v-if="yearEndStatus === 'upcoming'">
              <span class="font-semibold text-slate-400">Chưa tới mốc</span>
              <span class="text-[11px] text-slate-400">Tiếp tục cập nhật KPI trong các tháng giữa năm.</span>
            </template>
            <template v-else-if="yearEndStatus === 'active'">
              <span class="font-semibold text-blue-800">Đang trong kỳ</span>
              <span class="text-[11px]">Tổng hợp kết quả cả năm, kiểm tra minh chứng trước khi đóng đánh giá.</span>
            </template>
            <template v-else>
              <span class="font-semibold text-emerald-700">Đã qua mốc</span>
              <span class="text-[11px]">Kỳ Year-End đã kết thúc theo lịch — xem trạng thái từng KPI bên dưới.</span>
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
