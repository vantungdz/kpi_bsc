<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { GmTimelineIssueGroup, GmTimelineKpiGroup } from '@/types/gm-workspace'
import type { GmPromotionProcessTimelineApiResponse } from '@/services/modules/kpi-gm.service'
import GmProcessTimelineTrack from '@/components/gm/GmProcessTimelineTrack.vue'
import GmTimelineDrawerAssigneeTreeItem from '@/components/gm/GmTimelineDrawerAssigneeTreeItem.vue'
import { gmTimelinePhaseHasOpenIssues } from '@/utils/gm-timeline-phase'
import { kpiGroupKey, resolveTimelineKpiGroups } from '@/utils/gm-timeline-breakdown'
import { gmDrawerEmployeeRowKey } from '@/utils/gm-drawer-assignee-keys'
import {
  promoTimelineClusterStatusEn,
  promoTimelineIssueDisplayTitle,
} from '@/utils/promotion-timeline'

const props = defineProps<{
  timelineData: GmPromotionProcessTimelineApiResponse | null
  loading?: boolean
  /** When absent, timeline API is skipped — placeholder only. */
  promotionCycleId?: string | null
}>()

const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6
const TRACK_SPAN_PCT = TRACK_RIGHT_PCT - TRACK_LEFT_PCT

type MilestoneStatus = 'complete' | 'active' | 'upcoming'

const issuesPopoverOpen = ref(false)
const issuesPopoverRoot = ref<HTMLElement | null>(null)
const drawerOpen = ref(false)
const activeIssueGroupId = ref<string | null>(null)
const expandedBreakdownKeys = ref<Set<string>>(new Set())
const expandedEmployeeRowKey = ref<string | null>(null)

const activeSegment = computed(() => props.timelineData?.activeSegment ?? 'NOT_STARTED')

const milestoneStatuses = computed((): [MilestoneStatus, MilestoneStatus] => {
  switch (activeSegment.value) {
    case 'NOT_STARTED':
      return ['upcoming', 'upcoming']
    case 'IN_PROGRESS':
      return ['complete', 'upcoming']
    case 'OVERDUE':
      return ['complete', 'active']
    case 'COMPLETED':
      return ['complete', 'complete']
    default:
      return ['upcoming', 'upcoming']
  }
})

const startStatus = computed(() => milestoneStatuses.value[0])
const endStatus = computed(() => milestoneStatuses.value[1])

function milestoneOuterClass(idx: number): string {
  const s = idx === 0 ? startStatus.value : endStatus.value
  if (s === 'complete') return 'bg-emerald-500 shadow-sm ring-2 ring-white'
  if (s === 'active') return 'bg-white shadow-sm ring-2 ring-white'
  return 'bg-slate-200 shadow-sm ring-2 ring-white'
}

function phaseTitleClass(idx: number): string {
  const s = idx === 0 ? startStatus.value : endStatus.value
  if (s === 'complete') return 'text-emerald-600'
  if (s === 'active') {
    if (idx === 1 && activeSegment.value === 'OVERDUE') return 'text-rose-600'
    return 'text-violet-600'
  }
  return 'text-slate-400'
}

const progressFraction = computed(() => {
  const pct = props.timelineData?.progressPercent
  if (pct == null || !Number.isFinite(pct)) return 0
  return Math.min(1, Math.max(0, pct / 100))
})

const nowMarkerLeftPct = computed(() => TRACK_LEFT_PCT + progressFraction.value * TRACK_SPAN_PCT)

const trackBarStyle = {
  left: `${TRACK_LEFT_PCT}%`,
  width: `${TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}

const progressFillStyle = computed(() => ({
  left: `${TRACK_LEFT_PCT}%`,
  width: `${Math.max(0, progressFraction.value) * TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}))

const nowMarkerPositionStyle = computed(() => ({
  left: `${nowMarkerLeftPct.value}%`,
  top: '50%',
  transform: 'translate(-50%, -50%)',
}))

const milestoneLeftPcts = computed((): [number, number] => [
  TRACK_LEFT_PCT + 0 * TRACK_SPAN_PCT,
  TRACK_LEFT_PCT + 1 * TRACK_SPAN_PCT,
])

const trackMilestones = computed(() => [
  { idx: 0, outerClass: milestoneOuterClass(0), status: startStatus.value },
  { idx: 1, outerClass: milestoneOuterClass(1), status: endStatus.value },
])

const showNowMarker = computed(
  () => activeSegment.value === 'IN_PROGRESS' || activeSegment.value === 'OVERDUE',
)

const startDateLabel = computed(() => {
  const start = props.timelineData?.startDate
  return start ? dayjs(start).format('MMM D, YYYY') : '—'
})

const endDateLabel = computed(() => {
  const end = props.timelineData?.endDate
  return end ? dayjs(end).format('MMM D, YYYY') : '—'
})

const operational = computed(() => props.timelineData?.operational ?? null)

const showViewIssues = computed(
  () =>
    activeSegment.value !== 'NOT_STARTED' &&
    gmTimelinePhaseHasOpenIssues(operational.value),
)

const issueGroups = computed((): GmTimelineIssueGroup[] => operational.value?.issueGroups ?? [])

type IssuePopoverRow = { id: string; title: string; subline: string; dotClass: string }

function severityDotClass(sev: GmTimelineIssueGroup['severity']): string {
  if (sev === 'critical') return 'text-rose-500'
  if (sev === 'warning') return 'text-amber-600'
  return 'text-slate-400'
}

function buildIssueSubline(g: GmTimelineIssueGroup): string {
  if (g.affectedEmployees <= 0) return ''
  return `${g.affectedEmployees} employee${g.affectedEmployees === 1 ? '' : 's'} · ${g.affectedKpis} KPI${g.affectedKpis === 1 ? '' : 's'}`
}

const issuePopoverRows = computed((): IssuePopoverRow[] =>
  issueGroups.value.map((g) => ({
    id: g.id,
    title: promoTimelineIssueDisplayTitle(g.id, g.title),
    subline: buildIssueSubline(g),
    dotClass: severityDotClass(g.severity),
  })),
)

const popoverTitle = computed(() => operational.value?.popoverTitle ?? 'Issues')

const activeIssueGroup = computed(() => {
  if (!activeIssueGroupId.value) return null
  return issueGroups.value.find((g) => g.id === activeIssueGroupId.value) ?? null
})

const activeKpiGroups = computed((): GmTimelineKpiGroup[] => {
  const g = activeIssueGroup.value
  if (!g) return []
  return resolveTimelineKpiGroups(g)
})

const drawerDisplayTitle = computed(() => {
  const g = activeIssueGroup.value
  if (!g) return ''
  return promoTimelineIssueDisplayTitle(g.id, g.title)
})

const drawerClusterStatusLine = computed(() =>
  promoTimelineClusterStatusEn(activeIssueGroup.value?.id ?? ''),
)

const drawerSeverityTheme = computed(() => {
  const s = activeIssueGroup.value?.severity ?? 'info'
  if (s === 'critical') {
    return { headerCard: 'bg-gradient-to-br from-rose-50/95 via-white to-rose-50/25' }
  }
  if (s === 'warning') {
    return { headerCard: 'bg-gradient-to-br from-amber-50/95 via-white to-amber-50/25' }
  }
  return { headerCard: 'bg-gradient-to-br from-sky-50/95 via-white to-sky-50/25' }
})

function toggleIssuesPopover() {
  if (!showViewIssues.value) return
  issuesPopoverOpen.value = !issuesPopoverOpen.value
}

function openIssueDrawer(groupId: string) {
  activeIssueGroupId.value = groupId
  issuesPopoverOpen.value = false
  drawerOpen.value = true
}

function closeIssueDrawer() {
  drawerOpen.value = false
  activeIssueGroupId.value = null
}

function isBreakdownExpanded(key: string): boolean {
  return expandedBreakdownKeys.value.has(key)
}

function toggleBreakdownGroup(key: string) {
  const next = new Set(expandedBreakdownKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedBreakdownKeys.value = next
}

function toggleEmployeeRow(key: string) {
  expandedEmployeeRowKey.value = expandedEmployeeRowKey.value === key ? null : key
}

function onIssuesDocPointerDown(ev: MouseEvent) {
  if (!issuesPopoverOpen.value) return
  const root = issuesPopoverRoot.value
  if (root && !root.contains(ev.target as Node)) {
    issuesPopoverOpen.value = false
  }
}

watch(issuesPopoverOpen, (open) => {
  if (open) {
    nextTick(() => document.addEventListener('mousedown', onIssuesDocPointerDown))
  } else {
    document.removeEventListener('mousedown', onIssuesDocPointerDown)
  }
})

watch(showViewIssues, (ok) => {
  if (!ok) issuesPopoverOpen.value = false
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onIssuesDocPointerDown)
})

const missingCyclePlaceholder = computed(
  () => !props.promotionCycleId?.trim() && !props.loading,
)

const viewIssuesButtonClass = computed(() => {
  if (activeSegment.value === 'OVERDUE') {
    return 'border-rose-700/40 text-rose-900/90 hover:bg-rose-50'
  }
  if (activeSegment.value === 'COMPLETED') {
    return 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
  }
  return 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
})
</script>

<template>
  <div class="relative overflow-visible rounded-xl border border-slate-200 bg-white px-4 shadow-sm pb-6 pt-4 md:px-5">
    <div class="mb-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">
        Promotion Process Timeline
      </h3>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-slate-500">Loading promotion timeline…</div>

    <div
      v-else-if="missingCyclePlaceholder"
      class="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-4 py-6 text-center text-sm text-slate-600"
    >
      <p class="font-medium text-slate-700">Promotion timeline unavailable</p>
      <p class="mt-2 text-xs leading-relaxed text-slate-500">
        Create a Promotion KPI with a promotion cycle, or assign an existing promotion KPI with promotion_cycle_id.
        No promotion cycle id is available in the current workspace data yet.
      </p>
    </div>

    <div v-else class="text-center">
      <div class="relative z-[2] mx-auto min-h-[2.75rem] w-full pb-1 pt-0">
        <div
          class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
          :style="{ left: `${TRACK_LEFT_PCT}%` }"
        >
          <span class="text-xs font-bold" :class="phaseTitleClass(0)">Start</span>
          <p class="mt-0.5 text-[15px] leading-tight text-slate-500">{{ startDateLabel }}</p>
        </div>
        <div
          class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
          :style="{ left: `${TRACK_RIGHT_PCT}%` }"
        >
          <span class="text-xs font-bold" :class="phaseTitleClass(1)">End</span>
          <p class="mt-0.5 text-[15px] leading-tight text-slate-500">{{ endDateLabel }}</p>
        </div>
      </div>

      <div class="relative z-0 mx-auto mt-1 w-full">
        <GmProcessTimelineTrack
          :track-bar-style="trackBarStyle"
          :progress-fill-style="progressFillStyle"
          :now-marker-position-style="nowMarkerPositionStyle"
          now-marker-label="Current date on promotion window"
          :milestones="trackMilestones"
          :milestone-left-pcts="milestoneLeftPcts"
          :show-now-marker="showNowMarker"
        />
      </div>

      <div class="relative z-[2] mx-auto mt-2 min-h-[5rem] w-full pb-0.5">
        <div
          class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
          :style="{ left: `${TRACK_LEFT_PCT}%` }"
        >
          <p v-if="startStatus === 'upcoming'" class="text-[11px] font-medium text-slate-400">Not started</p>
          <p v-else class="text-[11px] font-medium text-emerald-600">Started</p>
        </div>

        <div
          class="absolute top-0 max-w-[min(11rem,40vw)] -translate-x-1/2 text-center"
          :style="{ left: `${TRACK_RIGHT_PCT}%` }"
        >
          <div class="relative z-20 flex flex-col items-center gap-1.5">
            <template v-if="activeSegment === 'NOT_STARTED'">
              <p class="text-[11px] font-medium text-slate-400">Not started</p>
            </template>
            <template v-else-if="activeSegment === 'COMPLETED'">
              <template v-if="showViewIssues && operational">
                <div class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ operational.pendingKpisLine }}</span>
                </div>
              </template>
              <div v-else class="flex items-center justify-center gap-1 text-emerald-600">
                <i class="fas fa-check text-[15px]" aria-hidden="true" />
                <span class="text-[13px] font-semibold">100% Complete</span>
              </div>
            </template>
            <template v-else-if="activeSegment === 'OVERDUE'">
              <template v-if="showViewIssues && operational">
                <div class="flex items-center justify-center gap-1.5 text-rose-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />
                  <span class="text-[13px] font-semibold">{{ operational.pendingKpisLine }}</span>
                </div>
              </template>
              <p v-else class="text-[13px] font-semibold text-rose-700">Overdue</p>
            </template>
            <template v-else>
              <template v-if="showViewIssues && operational">
                <div class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ operational.pendingKpisLine }}</span>
                </div>
              </template>
              <div v-else class="flex items-center justify-center gap-1 text-blue-700">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span class="text-[13px] font-semibold">In progress</span>
              </div>
            </template>

            <div
              v-if="showViewIssues && operational"
              ref="issuesPopoverRoot"
              class="relative inline-flex flex-col items-center gap-1.5"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                :class="viewIssuesButtonClass"
                :aria-expanded="issuesPopoverOpen"
                aria-haspopup="dialog"
                @click.stop="toggleIssuesPopover"
              >
                <i class="fas fa-eye text-[11px]" aria-hidden="true" />
                View Issues
              </button>

              <div
                v-if="issuesPopoverOpen"
                class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                role="dialog"
                aria-modal="true"
                @click.stop
              >
                <div
                  class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50"
                />
                <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 text-left shadow-lg">
                  <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                    <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                    <h4 class="text-xs font-bold leading-snug text-amber-950">
                      {{ popoverTitle }}
                    </h4>
                  </div>
                  <ul
                    class="max-h-72 space-y-1 overflow-y-auto px-2 py-2 text-xs font-medium leading-snug text-amber-950/90"
                  >
                    <li v-for="row in issuePopoverRows" :key="row.id">
                      <button
                        type="button"
                        class="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                        @click="openIssueDrawer(row.id)"
                      >
                        <span class="min-w-0 flex-1">
                          <span class="flex items-start gap-1.5">
                            <span class="mt-0.5 shrink-0 text-[11px]" :class="row.dotClass">●</span>
                            <span>
                              <span class="block font-semibold leading-snug">{{ row.title }}</span>
                              <span
                                v-if="row.subline"
                                class="mt-0.5 block text-[10px] font-normal opacity-80"
                              >{{ row.subline }}</span>
                            </span>
                          </span>
                        </span>
                        <i
                          class="fas fa-chevron-right mt-0.5 shrink-0 text-[10px] text-amber-500 transition-colors group-hover:text-amber-700"
                        />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="gm-issue-drawer">
      <div v-if="drawerOpen && activeIssueGroup" class="fixed inset-0 z-[90]">
        <div class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm" @click="closeIssueDrawer" />
        <div
          class="absolute bottom-0 right-0 top-0 flex min-h-0 w-full max-w-full flex-col border-l border-violet-100/80 bg-gradient-to-b from-slate-50 to-violet-50/30 shadow-lg md:max-w-[min(92vw,880px)] lg:max-w-[900px]"
        >
          <div class="gm-drawer-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-5">
            <div
              class="rounded-xl border p-5 shadow-sm"
              :class="[
                drawerSeverityTheme.headerCard,
                activeIssueGroup.severity === 'critical' ? 'border-rose-100' : '',
                activeIssueGroup.severity === 'warning' ? 'border-amber-100' : '',
              ]"
            >
              <h2 class="text-[17px] font-semibold leading-snug text-zinc-900">{{ drawerDisplayTitle }}</h2>
              <p class="mt-4 text-[12px] font-medium text-zinc-600">
                <span class="font-semibold tabular-nums text-zinc-900">{{ activeIssueGroup.affectedEmployees }}</span>
                assignees
                <span class="mx-1.5 text-zinc-300">·</span>
                <span class="font-semibold tabular-nums text-zinc-900">{{ activeIssueGroup.affectedKpis }}</span>
                KPIs
              </p>
            </div>

            <section class="mt-8">
              <h3 class="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Detailed list</h3>
              <div class="flex flex-col gap-4">
                <article
                  v-for="kg in activeKpiGroups"
                  :key="kpiGroupKey(kg)"
                  class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    class="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-zinc-50/90"
                    @click="toggleBreakdownGroup(kpiGroupKey(kg))"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-zinc-900">{{ kg.kpiName }}</p>
                      <p class="mt-1 text-xs text-zinc-500">
                        {{ kg.affectedEmployees }} assignees · {{ kg.affectedDepartments }} departments
                      </p>
                      <p class="mt-1 text-xs font-medium text-amber-700">{{ drawerClusterStatusLine }}</p>
                    </div>
                    <span class="text-sm text-zinc-400">{{ isBreakdownExpanded(kpiGroupKey(kg)) ? '▲' : '▼' }}</span>
                  </button>
                  <div v-show="isBreakdownExpanded(kpiGroupKey(kg))" class="border-t border-zinc-100 bg-zinc-50/50 p-4">
                    <div
                      v-for="dg in kg.departments"
                      v-show="(dg.employees?.length ?? 0) > 0"
                      :key="`${kpiGroupKey(kg)}|${dg.departmentName ?? '_'}`"
                      class="mb-4 last:mb-0"
                    >
                      <h4 class="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                        {{ dg.departmentName ?? 'No department' }}
                      </h4>
                      <ul class="space-y-2">
                        <GmTimelineDrawerAssigneeTreeItem
                          v-for="(item, idx) in dg.employees"
                          :key="gmDrawerEmployeeRowKey(kg, dg, item, idx)"
                          :item="item"
                          :kg="kg"
                          :dg="dg"
                          :idx="idx"
                          :expanded-employee-row-key="expandedEmployeeRowKey"
                          :kg-blocker-summary="kg.blockerSummary"
                          variant="card"
                          @toggle="toggleEmployeeRow"
                        />
                      </ul>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
          <div class="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 md:px-5">
            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                @click="closeIssueDrawer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gm-issue-drawer-enter-active,
.gm-issue-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.gm-issue-drawer-enter-from,
.gm-issue-drawer-leave-to {
  opacity: 0;
}
</style>
