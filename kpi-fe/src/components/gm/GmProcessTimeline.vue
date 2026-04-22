<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  gmTimelinePhaseHasOpenIssues,
  type GmIssueTypeId,
  type GmMidYearIssuesData,
  type GmTimelineIssueBucket,
  type GmTimelineIssueType,
} from '@/mocks/gm-kpi.mock'
import GmProcessTimelineTrack from '@/components/gm/GmProcessTimelineTrack.vue'

const props = defineProps<{
  midYearIssues: GmMidYearIssuesData
  /** KPI Setting (Jan–Mar): mock ~80% + View Issues; bỏ qua = giữ UI cũ cột Setting. */
  settingIssues?: GmMidYearIssuesData | null
  yearEndIssues?: GmMidYearIssuesData | null
}>()

type TimelineIssuesPhase = 'setting' | 'mid' | 'yearEnd'

const issuesPopoverPhase = ref<TimelineIssuesPhase | null>(null)
const settingIssuesPopoverRoot = ref<HTMLElement | null>(null)
const midIssuesPopoverRoot = ref<HTMLElement | null>(null)
const yearEndIssuesPopoverRoot = ref<HTMLElement | null>(null)
const drawerOpen = ref(false)
const drawerIssuesPhase = ref<TimelineIssuesPhase | null>(null)
const activeIssueTypeId = ref<GmIssueTypeId | null>(null)

const FALLBACK_ISSUE_TYPES: GmTimelineIssueType[] = [
  { id: 'pending_approval', text: '6 pending approval', dotClass: 'text-amber-600' },
  { id: 'not_submitted', text: '5 chưa submit', dotClass: 'text-amber-600' },
  { id: 'missing_evidence', text: '4 thiếu evidence', dotClass: 'text-rose-500' },
]

const FALLBACK_ISSUE_DETAILS: GmTimelineIssueBucket[] = [
  {
    id: 'pending_approval',
    title: 'KPIs Pending Approval',
    iconClass: 'bg-orange-100 text-orange-600',
    items: [
      {
        kpi: 'Quality Index',
        pm: 'Tran Thi B',
        leader: 'Tran Quoc L3',
        member: 'Vu Thi H',
        bottleneck: 'PM',
        reason: 'Waiting for Final PM Review',
      },
      {
        kpi: 'Delivery Rate',
        pm: 'Thai Van Liem',
        leader: 'Nguyen Van L1',
        member: 'Nguyen Hoang E',
        bottleneck: 'Leader',
        reason: 'Score disputed by Leader',
      },
    ],
  },
  {
    id: 'not_submitted',
    title: 'KPIs Chưa Submit',
    iconClass: 'bg-orange-100 text-orange-600',
    items: [
      {
        kpi: 'Process Compliance',
        pm: 'Thai Van Liem',
        leader: 'Le Thi L2',
        member: 'Tran Van F',
        bottleneck: 'Member',
        reason: 'Missed deadline to submit form',
      },
      {
        kpi: 'Training Hours',
        pm: 'Le Van C',
        leader: 'Dao Quang P',
        member: 'Pham Van M',
        bottleneck: 'Member',
        reason: 'No submission found on system',
      },
    ],
  },
  {
    id: 'missing_evidence',
    title: 'KPIs Thiếu Evidence',
    iconClass: 'bg-rose-100 text-rose-600',
    items: [
      {
        kpi: 'Quality Index',
        pm: 'Tran Thi B',
        leader: 'Tran Quoc L3',
        member: 'Tran Van Phuoc',
        bottleneck: 'Member',
        reason: 'Jira links missing in the report',
      },
      {
        kpi: 'Delivery Rate',
        pm: 'Nguyen Van A',
        leader: 'Le Thi L2',
        member: 'Le Thi D',
        bottleneck: 'Leader',
        reason: 'Leader requested timesheet re-upload',
      },
    ],
  },
]

const FLOW_ROLES = ['Member', 'Leader', 'PM'] as const

/** Calendar month 1–12 for each review phase (labels match UI: Jan–Mar, Jun–Jul, Nov–Dec). */
const PHASE_WINDOWS = [
  { key: 'setting', monthStart: 1, monthEnd: 3 },
  { key: 'mid', monthStart: 6, monthEnd: 7 },
  { key: 'yearEnd', monthStart: 11, monthEnd: 12 },
] as const

type PhaseStatus = 'upcoming' | 'active' | 'complete'

function phaseStatusForMonth(month: number, start: number, end: number): PhaseStatus {
  if (month < start) return 'upcoming'
  if (month <= end) return 'active'
  return 'complete'
}

const currentMonth = computed(() => new Date().getMonth() + 1)

const phaseStatuses = computed(() =>
  PHASE_WINDOWS.map((p) => phaseStatusForMonth(currentMonth.value, p.monthStart, p.monthEnd)),
)

const settingStatus = computed(() => phaseStatuses.value[0]!)
const midYearStatus = computed(() => phaseStatuses.value[1]!)
const yearEndStatus = computed(() => phaseStatuses.value[2]!)

const showSettingViewIssues = computed(
  () => settingStatus.value !== 'upcoming' && gmTimelinePhaseHasOpenIssues(props.settingIssues),
)

/**
 * Theo lịch Jan–Mar đã qua thì `complete`, nhưng mock ~80% + issues → **không** coi là xong (không tick node).
 */
function effectivePhaseStatus(idx: number): PhaseStatus {
  const s = phaseStatuses.value[idx]!
  if (idx === 0 && s === 'complete' && showSettingViewIssues.value) return 'active'
  return s
}

const showMidViewIssues = computed(
  () => midYearStatus.value !== 'upcoming' && gmTimelinePhaseHasOpenIssues(props.midYearIssues),
)

const showYearEndViewIssues = computed(
  () => yearEndStatus.value !== 'upcoming' && gmTimelinePhaseHasOpenIssues(props.yearEndIssues),
)

const issueTypesForPopover = computed((): GmTimelineIssueType[] => {
  if (issuesPopoverPhase.value === 'yearEnd')
    return props.yearEndIssues?.issueTypes?.length
      ? (props.yearEndIssues.issueTypes as GmTimelineIssueType[])
      : []
  if (issuesPopoverPhase.value === 'setting')
    return props.settingIssues?.issueTypes?.length
      ? (props.settingIssues.issueTypes as GmTimelineIssueType[])
      : []
  return props.midYearIssues.issueTypes ?? FALLBACK_ISSUE_TYPES
})

const popoverTitleForOpen = computed(() => {
  if (issuesPopoverPhase.value === 'yearEnd') return props.yearEndIssues?.popoverTitle ?? ''
  if (issuesPopoverPhase.value === 'setting') return props.settingIssues?.popoverTitle ?? ''
  return props.midYearIssues.popoverTitle
})

watch([issuesPopoverPhase, showSettingViewIssues, showMidViewIssues, showYearEndViewIssues], () => {
  const ph = issuesPopoverPhase.value
  if (ph === 'setting' && !showSettingViewIssues.value) issuesPopoverPhase.value = null
  if (ph === 'mid' && !showMidViewIssues.value) issuesPopoverPhase.value = null
  if (ph === 'yearEnd' && !showYearEndViewIssues.value) issuesPopoverPhase.value = null
})

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
  if (s === 'active') return 'bg-white shadow-sm ring-2 ring-white'
  return 'bg-slate-200 shadow-sm ring-2 ring-white'
}

/** Trục ngang: trùng tâm cột 1 → tâm cột 3 (cùng `left-[16.666%] right-[16.666%]`). */
const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6

/** 0 = đầu năm, 1 = cuối năm (theo thời gian thực). */
const calendarYearProgress = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const t0 = new Date(y, 0, 1).getTime()
  const t1 = new Date(y, 11, 31, 23, 59, 59, 999).getTime()
  if (t1 <= t0) return 0
  return Math.min(1, Math.max(0, (now.getTime() - t0) / (t1 - t0)))
})

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
  return `Vị trí theo thời gian hệ thống: ${d.toLocaleDateString('vi-VN')}`
})

const drawerIssueDetails = computed((): GmTimelineIssueBucket[] => {
  if (drawerIssuesPhase.value === 'yearEnd')
    return props.yearEndIssues?.issueDetails ?? FALLBACK_ISSUE_DETAILS
  if (drawerIssuesPhase.value === 'setting')
    return props.settingIssues?.issueDetails ?? FALLBACK_ISSUE_DETAILS
  return props.midYearIssues.issueDetails ?? FALLBACK_ISSUE_DETAILS
})

const activeIssueBucket = computed(() => {
  if (!activeIssueTypeId.value) return null
  return drawerIssueDetails.value.find((b) => b.id === activeIssueTypeId.value) ?? null
})

function onIssuesDocPointerDown(e: MouseEvent) {
  const phase = issuesPopoverPhase.value
  if (!phase) return
  const root =
    phase === 'setting'
      ? settingIssuesPopoverRoot.value
      : phase === 'mid'
        ? midIssuesPopoverRoot.value
        : yearEndIssuesPopoverRoot.value
  if (!root) return
  if (!root.contains(e.target as Node)) issuesPopoverPhase.value = null
}

watch(issuesPopoverPhase, (phase) => {
  document.removeEventListener('mousedown', onIssuesDocPointerDown)
  if (phase) nextTick(() => document.addEventListener('mousedown', onIssuesDocPointerDown))
})

watch(
  () => [props.midYearIssues, props.yearEndIssues, props.settingIssues] as const,
  () => {
    issuesPopoverPhase.value = null
    closeIssueDrawer()
  },
)

function toggleIssuesPhase(phase: TimelineIssuesPhase) {
  if (phase === 'setting' && !showSettingViewIssues.value) return
  if (phase === 'mid' && !showMidViewIssues.value) return
  if (phase === 'yearEnd' && !showYearEndViewIssues.value) return
  issuesPopoverPhase.value = issuesPopoverPhase.value === phase ? null : phase
}

function openIssueDrawer(id: GmIssueTypeId) {
  const ph = issuesPopoverPhase.value
  if (!ph) return
  drawerIssuesPhase.value = ph
  activeIssueTypeId.value = id
  issuesPopoverPhase.value = null
  drawerOpen.value = true
}

function closeIssueDrawer() {
  drawerOpen.value = false
  activeIssueTypeId.value = null
  drawerIssuesPhase.value = null
}

function statusOf(role: 'Member' | 'Leader' | 'PM', bottleneck: 'PM' | 'Leader' | 'Member') {
  const order: Array<'Member' | 'Leader' | 'PM'> = ['Member', 'Leader', 'PM']
  const roleIdx = order.indexOf(role)
  const blockIdx = order.indexOf(bottleneck)
  if (roleIdx < blockIdx) return 'done'
  if (roleIdx === blockIdx) return 'blocked'
  return 'pending'
}

function nodeClass(status: 'done' | 'blocked' | 'pending') {
  if (status === 'done') return 'bg-emerald-500 border-emerald-600'
  if (status === 'blocked') return 'bg-rose-500 border-rose-600 ring-4 ring-rose-100 shadow-sm'
  return 'bg-slate-50 border-slate-200'
}

function labelClass(status: 'done' | 'blocked' | 'pending') {
  if (status === 'done') return 'text-emerald-700'
  if (status === 'blocked') return 'text-rose-600 font-extrabold'
  return 'text-slate-400'
}

const trackMilestones = computed(() =>
  [0, 1, 2].map((idx) => ({
    idx,
    outerClass: milestoneOuterClass(idx),
    status: effectivePhaseStatus(idx) as 'complete' | 'active' | 'upcoming',
  })),
)

const timelineCardClass = computed(() =>
  timelineCollapsed.value ? 'py-2' : 'pb-6 pt-4',
)

const timelineHeaderClass = computed(() =>
  timelineCollapsed.value ? 'mb-0 min-h-[2.75rem]' : 'mb-3 min-h-[2.5rem]',
)

/** Thu gọn: track full width (cùng biên lúc mở rộng) absolute giữa hàng header; title + nút z-10 nền trắng. */
const timelineCollapsed = ref(false)
const showExpandedTimeline = ref(true)
const showCollapsedTrack = ref(false)
const TIMELINE_SWAP_MS = 180
let timelineSwapTimer: ReturnType<typeof setTimeout> | null = null

/** Hai nút Thu gọn / Mở rộng cùng kích thước. */
const timelineToggleBtnClass =
  'inline-flex h-8 min-w-[6.75rem] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800'

watch(timelineCollapsed, (collapsed) => {
  if (collapsed) issuesPopoverPhase.value = null
})

function clearTimelineSwapTimer() {
  if (timelineSwapTimer != null) {
    window.clearTimeout(timelineSwapTimer)
    timelineSwapTimer = null
  }
}

function toggleTimelineCollapsed() {
  clearTimelineSwapTimer()

  if (!timelineCollapsed.value) {
    issuesPopoverPhase.value = null
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
  document.removeEventListener('mousedown', onIssuesDocPointerDown)
})
</script>

<template>
  <div
    class="relative overflow-visible rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-[padding] duration-200 ease-out md:px-5"
    :class="timelineCardClass"
  >
    <div class="relative grid grid-cols-[auto_1fr_auto] items-center gap-3" :class="timelineHeaderClass">
      <Transition name="gm-tl-track-slot">
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
        Process Timeline
      </h3>

      <div class="relative z-10 h-px min-w-0" />

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
      <Transition name="gm-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-phases" class="grid grid-cols-3 gap-1.5">
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(0)">KPI Setting</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(0)">Jan - Mar</p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(1)">Mid-Year Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(1)">Jun - Jul</p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(2)">Year-End Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(2)">Nov - Dec</p>
          </div>
        </div>
      </Transition>

      <Transition name="gm-tl-track-slot">
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

      <Transition name="gm-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-notes" class="mt-3 grid grid-cols-3 gap-1.5">
        <div class="relative z-20 flex flex-col items-center gap-1.5">
          <template v-if="settingStatus === 'upcoming'">
            <div class="flex flex-col items-center gap-0.5 text-slate-400">
              <div class="flex items-center justify-center gap-1">
                <i class="fas fa-calendar-xmark text-[13px] opacity-80" aria-hidden="true" />
                <span class="text-[13px] font-semibold leading-snug">Chưa tới KPI Setting</span>
              </div>
              <span class="text-[11px] font-medium leading-tight">Bắt đầu tháng 1</span>
            </div>
          </template>
          <template v-else>
            <template v-if="settingStatus === 'active'">
              <div
                v-if="showSettingViewIssues && settingIssues"
                class="flex items-center justify-center gap-1.5 text-amber-800/90"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span class="text-[13px] font-semibold">{{ settingIssues.pendingKpisLine }}</span>
              </div>
              <div v-else class="flex items-center justify-center gap-1 text-emerald-700">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span class="text-[13px] font-semibold">Đang thực hiện</span>
              </div>
            </template>
            <template v-else>
              <div
                v-if="showSettingViewIssues && settingIssues"
                class="flex items-center justify-center gap-1.5 text-amber-800/90"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span class="text-[13px] font-semibold">{{ settingIssues.pendingKpisLine }}</span>
              </div>
              <div v-else class="flex items-center justify-center gap-1 text-emerald-600">
                <i class="fas fa-check text-[15px]" />
                <span class="text-[13px] font-semibold">100% Complete</span>
              </div>
            </template>
            <div
              v-if="showSettingViewIssues && settingIssues"
              ref="settingIssuesPopoverRoot"
              class="relative inline-flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                :class="
                  settingStatus === 'active'
                    ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                    : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                "
                :aria-expanded="issuesPopoverPhase === 'setting'"
                aria-controls="issues-popover-setting"
                aria-haspopup="dialog"
                @click.stop="toggleIssuesPhase('setting')"
              >
                <i class="fas fa-eye text-[11px]" />
                View Issues
              </button>

              <div
                v-if="issuesPopoverPhase === 'setting'"
                id="issues-popover-setting"
                class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="issues-popover-title-setting"
                @click.stop
              >
                <div
                  class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50"
                />
                <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                  <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                    <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                    <h4 id="issues-popover-title-setting" class="text-xs font-bold leading-snug text-amber-950">
                      {{ popoverTitleForOpen }}
                    </h4>
                  </div>
                  <ul class="space-y-1 px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                    <li v-for="it in issueTypesForPopover" :key="it.id">
                      <button
                        type="button"
                        class="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                        @click="openIssueDrawer(it.id)"
                      >
                        <span class="flex items-center gap-1.5">
                          <span class="text-[11px]" :class="it.dotClass">●</span>
                          <span>{{ it.text }}</span>
                        </span>
                        <i class="fas fa-chevron-right text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div
          class="relative z-20 flex flex-col items-center gap-1.5"
          :class="midYearStatus === 'upcoming' ? 'opacity-95' : ''"
        >
          <template v-if="midYearStatus === 'upcoming'">
            <div class="flex flex-col items-center gap-0.5 text-slate-400">
              <div class="flex items-center justify-center gap-1">
                <i class="fas fa-calendar-xmark text-[13px] opacity-80" aria-hidden="true" />
                <span class="text-[13px] font-semibold leading-snug">Chưa tới Mid-Year</span>
              </div>
              <span class="text-[11px] font-medium leading-tight">Bắt đầu tháng 6</span>
            </div>
          </template>
          <template v-else>
            <template v-if="midYearStatus === 'active'">
              <div
                v-if="showMidViewIssues"
                class="flex items-center justify-center gap-1.5 text-amber-800/90"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span class="text-[13px] font-semibold">{{ midYearIssues.pendingKpisLine }}</span>
              </div>
              <div v-else class="flex items-center justify-center gap-1 text-blue-700">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span class="text-[13px] font-semibold">Đang thực hiện</span>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center gap-1 text-emerald-700">
                <i class="fas fa-check text-[15px]" />
                <span class="text-[13px] font-semibold leading-snug">Mid-Year đã kết thúc</span>
              </div>
            </template>
            <div
              v-if="showMidViewIssues"
              ref="midIssuesPopoverRoot"
              class="relative inline-flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                :class="
                  midYearStatus === 'active'
                    ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                    : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                "
                :aria-expanded="issuesPopoverPhase === 'mid'"
                aria-controls="issues-popover-mid"
                aria-haspopup="dialog"
                @click.stop="toggleIssuesPhase('mid')"
              >
                <i class="fas fa-eye text-[11px]" />
                View Issues
              </button>

              <div
                v-if="issuesPopoverPhase === 'mid'"
                id="issues-popover-mid"
                class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="issues-popover-title-mid"
                @click.stop
              >
                <div
                  class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50"
                />
                <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                  <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                    <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                    <h4 id="issues-popover-title-mid" class="text-xs font-bold leading-snug text-amber-950">
                      {{ popoverTitleForOpen }}
                    </h4>
                  </div>
                  <ul class="space-y-1 px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                    <li v-for="it in issueTypesForPopover" :key="it.id">
                      <button
                        type="button"
                        class="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                        @click="openIssueDrawer(it.id)"
                      >
                        <span class="flex items-center gap-1.5">
                          <span class="text-[11px]" :class="it.dotClass">●</span>
                          <span>{{ it.text }}</span>
                        </span>
                        <i class="fas fa-chevron-right text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="relative z-20 flex flex-col items-center gap-1.5">
          <template v-if="yearEndStatus === 'upcoming'">
            <div class="flex flex-col items-center gap-0.5 text-slate-400">
              <div class="flex items-center justify-center gap-1">
                <i class="fas fa-calendar-xmark text-[13px] opacity-80" aria-hidden="true" />
                <span class="text-[13px] font-semibold leading-snug">Chưa tới Year-End</span>
              </div>
              <span class="text-[11px] font-medium leading-tight">Bắt đầu tháng 11</span>
            </div>
          </template>
          <template v-else>
            <template v-if="yearEndStatus === 'active'">
              <div
                v-if="showYearEndViewIssues && yearEndIssues"
                class="flex items-center justify-center gap-1.5 text-amber-800/90"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span class="text-[13px] font-semibold">{{ yearEndIssues.pendingKpisLine }}</span>
              </div>
              <div v-else class="flex items-center justify-center gap-1 text-blue-700">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span class="text-[13px] font-semibold">Đang thực hiện</span>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center gap-1 text-emerald-600">
                <i class="fas fa-check text-[15px]" />
                <span class="text-[13px] font-semibold">Hoàn thành</span>
              </div>
            </template>
            <div
              v-if="showYearEndViewIssues"
              ref="yearEndIssuesPopoverRoot"
              class="relative inline-flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                :class="
                  yearEndStatus === 'active'
                    ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                    : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                "
                :aria-expanded="issuesPopoverPhase === 'yearEnd'"
                aria-controls="issues-popover-ye"
                aria-haspopup="dialog"
                @click.stop="toggleIssuesPhase('yearEnd')"
              >
                <i class="fas fa-eye text-[11px]" />
                View Issues
              </button>

              <div
                v-if="issuesPopoverPhase === 'yearEnd'"
                id="issues-popover-ye"
                class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                role="dialog"
                aria-modal="true"
                aria-labelledby="issues-popover-title-ye"
                @click.stop
              >
                <div
                  class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50"
                />
                <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                  <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                    <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                    <h4 id="issues-popover-title-ye" class="text-xs font-bold leading-snug text-amber-950">
                      {{ popoverTitleForOpen }}
                    </h4>
                  </div>
                  <ul class="space-y-1 px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                    <li v-for="it in issueTypesForPopover" :key="it.id">
                      <button
                        type="button"
                        class="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                        @click="openIssueDrawer(it.id)"
                      >
                        <span class="flex items-center gap-1.5">
                          <span class="text-[11px]" :class="it.dotClass">●</span>
                          <span>{{ it.text }}</span>
                        </span>
                        <i class="fas fa-chevron-right text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      </Transition>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="gm-issue-drawer">
      <div v-if="drawerOpen && activeIssueBucket" class="fixed inset-0 z-[90]">
        <div class="gm-issue-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm" @click="closeIssueDrawer" />
        <div class="gm-issue-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[600px]">
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg p-1.5 shadow-sm" :class="activeIssueBucket.iconClass">
                  <i class="fas fa-exclamation-triangle text-sm" />
                </span>
                {{ activeIssueBucket.title }}
              </h2>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Review and resolve process blockers
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Đóng chi tiết issue"
              @click="closeIssueDrawer"
            >
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <div class="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
            <article
              v-for="(item, idx) in activeIssueBucket.items"
              :key="`${activeIssueBucket.id}-${item.kpi}-${idx}`"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300"
            >
              <div class="mb-3">
                <h4 class="text-sm font-bold leading-tight text-slate-800">{{ item.kpi }}</h4>
              </div>

              <div class="relative mb-3 mt-1 flex items-start justify-between px-4">
                <div class="absolute left-8 right-8 top-3.5 z-0 h-0.5 -translate-y-1/2 bg-slate-100" />

                <div v-for="role in FLOW_ROLES" :key="role" class="relative z-10 flex w-1/3 flex-col items-center gap-1.5">
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-full border"
                    :class="nodeClass(statusOf(role, item.bottleneck))"
                  >
                    <i
                      v-if="statusOf(role, item.bottleneck) === 'done'"
                      class="fas fa-check text-[10px] text-white"
                    />
                    <i
                      v-else-if="statusOf(role, item.bottleneck) === 'blocked'"
                      class="fas fa-times text-[10px] text-white"
                    />
                    <span v-else class="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  </div>
                  <span
                    class="mt-0.5 text-[9px] uppercase tracking-wider"
                    :class="labelClass(statusOf(role, item.bottleneck))"
                  >
                    {{ role }}
                  </span>
                  <span class="w-full truncate px-1 text-center text-[10px] font-medium text-slate-600" :title="role === 'Member' ? item.member : role === 'Leader' ? item.leader : item.pm">
                    {{ role === 'Member' ? item.member : role === 'Leader' ? item.leader : item.pm }}
                  </span>
                </div>
              </div>

              <div
                class="mt-2 flex items-start gap-2 rounded-lg border p-2.5 text-xs"
                :class="activeIssueBucket.id === 'missing_evidence' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-orange-200 bg-orange-50 text-orange-700'"
              >
                <i class="fas fa-info-circle mt-0.5 shrink-0 text-sm opacity-80" />
                <div class="leading-relaxed">
                  <span class="font-bold">Blocker at {{ item.bottleneck }}:</span> {{ item.reason }}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Thu / mở: phần tên giai đoạn + hàng ghi chú */
.gm-timeline-fold-enter-active,
.gm-timeline-fold-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    max-height 0.26s ease;
  overflow: hidden;
}
.gm-timeline-fold-enter-from,
.gm-timeline-fold-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}
.gm-timeline-fold-enter-to,
.gm-timeline-fold-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 36rem;
}

@media (prefers-reduced-motion: reduce) {
  .gm-timeline-fold-enter-active,
  .gm-timeline-fold-leave-active {
    transition-duration: 0.01ms !important;
  }
}

/* Chuyển thanh trục giữa hàng header (collapsed) và dưới phases (expanded) */
.gm-tl-track-slot-enter-active,
.gm-tl-track-slot-leave-active {
  transition:
    opacity 0.18s ease;
}
.gm-tl-track-slot-enter-from,
.gm-tl-track-slot-leave-to {
  opacity: 0;
}
.gm-tl-track-slot-enter-to,
.gm-tl-track-slot-leave-from {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .gm-tl-track-slot-enter-active,
  .gm-tl-track-slot-leave-active {
    transition-duration: 0.01ms !important;
  }
}

.gm-issue-drawer-enter-active,
.gm-issue-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-issue-drawer-enter-active .gm-issue-drawer-backdrop,
.gm-issue-drawer-leave-active .gm-issue-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-issue-drawer-enter-active .gm-issue-drawer-panel,
.gm-issue-drawer-leave-active .gm-issue-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-issue-drawer-enter-from .gm-issue-drawer-backdrop,
.gm-issue-drawer-leave-to .gm-issue-drawer-backdrop {
  opacity: 0;
}
.gm-issue-drawer-enter-to .gm-issue-drawer-backdrop,
.gm-issue-drawer-leave-from .gm-issue-drawer-backdrop {
  opacity: 1;
}
.gm-issue-drawer-enter-from .gm-issue-drawer-panel,
.gm-issue-drawer-leave-to .gm-issue-drawer-panel {
  transform: translateX(100%);
}
.gm-issue-drawer-enter-to .gm-issue-drawer-panel,
.gm-issue-drawer-leave-from .gm-issue-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-issue-drawer-enter-active,
  .gm-issue-drawer-leave-active,
  .gm-issue-drawer-enter-active .gm-issue-drawer-backdrop,
  .gm-issue-drawer-leave-active .gm-issue-drawer-backdrop,
  .gm-issue-drawer-enter-active .gm-issue-drawer-panel,
  .gm-issue-drawer-leave-active .gm-issue-drawer-panel {
    transition-duration: 0.01ms !important;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: #e2e8f0;
}
</style>
