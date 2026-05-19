<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type {
  GmMidYearIssuesData,
  GmTimelineBreakdownGroup,
  GmTimelineIssueDetail,
  GmTimelineIssueGroup,
  GmTimelineIssueType,
  GmTimelineKpiGroup,
} from '@/types/gm-workspace'
import {
  buildTimelineBreakdownGroupsFromEmployees,
  distinctAssigneeCount,
  kpiGroupKey,
  resolveTimelineKpiGroups,
} from '@/utils/gm-timeline-breakdown'
import { gmTimelinePhaseHasOpenIssues } from '@/utils/gm-timeline-phase'
import { isReadonlyKpiYear } from '@/utils/kpi-year'
import GmProcessTimelineTrack from '@/components/gm/GmProcessTimelineTrack.vue'
import GmTimelineDrawerAssigneeTreeItem from '@/components/gm/GmTimelineDrawerAssigneeTreeItem.vue'
import { gmDrawerEmployeeRowKey } from '@/utils/gm-drawer-assignee-keys'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import dayjs from 'dayjs'

const props = defineProps<{
  midYearIssues: GmMidYearIssuesData
  /** KPI Setting: View Issues khi có issue. */
  settingIssues?: GmMidYearIssuesData | null
  yearEndIssues?: GmMidYearIssuesData | null
  /** Năm dương lịch — dùng để load dates từ kpi_cycles DB. Mặc định là năm hiện tại. */
  year?: number
}>()

// ── Cycle dates từ DB ──────────────────────────────────────────────────────────
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

const cycleLoading = ref(true)

function resolvedTimelineYear(): number {
  return props.year ?? new Date().getFullYear()
}

watch(
  () => resolvedTimelineYear(),
  async (newYear) => {
    const expectedYear = newYear
    cycleLoading.value = true
    try {
      const res = await kpiCycleService.getKpiCycleByYear(expectedYear)
      if (resolvedTimelineYear() !== expectedYear) return
      cycleData.value = {
        activePhase: res.activePhase,
        goalSettingStart: res.goalSettingStart,
        goalSettingEnd: res.goalSettingEnd,
        midYearStart: res.midYearStart,
        midYearEnd: res.midYearEnd,
        endYearStart: res.endYearStart,
        endYearEnd: res.endYearEnd,
      }
    } catch {
      if (resolvedTimelineYear() !== expectedYear) return
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
      if (resolvedTimelineYear() === expectedYear) {
        cycleLoading.value = false
      }
    }
  },
  { immediate: true },
)

/** Format `start – end` thành "MMM" hoặc "MMM - MMM", fallback về giá trị cứng. */
function formatPhaseDuration(start: string | null, end: string | null, fallback: string): string {
  if (!start || !end) return fallback
  const s = dayjs(start).format('MMM')
  const e = dayjs(end).format('MMM')
  return s === e ? s : `${s} - ${e}`
}

/** Label tháng động từ DB. */
const phaseLabels = computed(() => ({
  setting: formatPhaseDuration(cycleData.value.goalSettingStart, cycleData.value.goalSettingEnd, 'Q1'),
  mid: formatPhaseDuration(cycleData.value.midYearStart, cycleData.value.midYearEnd, 'Q2-Q3'),
  yearEnd: formatPhaseDuration(cycleData.value.endYearStart, cycleData.value.endYearEnd, 'Q4'),
}))

type TimelineIssuesPhase = 'setting' | 'mid' | 'yearEnd'

const issuesPopoverPhase = ref<TimelineIssuesPhase | null>(null)
const settingIssuesPopoverRoot = ref<HTMLElement | null>(null)
const midIssuesPopoverRoot = ref<HTMLElement | null>(null)
const yearEndIssuesPopoverRoot = ref<HTMLElement | null>(null)
const drawerOpen = ref(false)
const drawerIssuesPhase = ref<TimelineIssuesPhase | null>(null)
/** Operational issue group id from API (process timeline). */
const activeIssueGroupId = ref<string | null>(null)

function severityDotClass(sev: GmTimelineIssueGroup['severity']): string {
  if (sev === 'critical') return 'text-rose-500'
  if (sev === 'warning') return 'text-amber-600'
  return 'text-slate-400'
}

function issueGroupsForPhase(phase: GmMidYearIssuesData | null | undefined): GmTimelineIssueGroup[] {
  if (!phase) return []
  if (phase.issueGroups?.length) return phase.issueGroups
  if (phase.issueDetails?.length) {
    return phase.issueDetails.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.id === 'missing_evidence' || b.id === 'unassigned_members' ? 'warning' : 'warning',
      blockedRole: 'Member',
      affectedEmployees: distinctAssigneeCount(b.items),
      affectedKpis: new Set(b.items.map((i) => i.kpi).filter(Boolean)).size,
      affectedDepartments: 0,
      iconClass: b.iconClass,
      employees: b.items.map((i) => ({
        ...i,
        leader: i.leader ?? null,
        bottleneck: i.bottleneck as GmTimelineIssueDetail['bottleneck'],
      })),
    }))
  }
  return []
}

type IssuePopoverRow = {
  id: string
  title: string
  subline: string
  dotClass: string
}

type PhaseStatus = 'upcoming' | 'active' | 'complete'

/** Năm chu kỳ đã kết thúc (năm lịch < năm hiện tại) — timeline chỉ xem, không hiện issues vận hành. */
const isHistoricalCycle = computed(() => {
  const y = Number(props.year)
  return Number.isFinite(y) && isReadonlyKpiYear(y)
})

/** Xác định status dựa trên start/end dates từ DB, và activePhase flag từ backend. */
const phaseStatuses = computed((): PhaseStatus[] => {
  if (isHistoricalCycle.value) return ['complete', 'complete', 'complete']

  const now = dayjs()
  const ap = cycleData.value.activePhase === 'end_year' ? 'year_end' : cycleData.value.activePhase

  // Ưu tiên cờ activePhase từ API (backend đã tính theo DB)
  if (ap === 'target_setup') return ['active', 'upcoming', 'upcoming']
  if (ap === 'mid_year') {
    // Chỉ hiện mid là 'active' khi đã tới ngày bắt đầu
    const midStart = cycleData.value.midYearStart
    if (midStart && dayjs().isBefore(dayjs(midStart))) {
      return ['complete', 'upcoming', 'upcoming']
    }
    return ['complete', 'active', 'upcoming']
  }
  if (ap === 'year_end') {
    // Chỉ hiện year-end là 'active' khi đã tới ngày bắt đầu
    const endStart = cycleData.value.endYearStart
    if (endStart && dayjs().isBefore(dayjs(endStart))) {
      return ['complete', 'complete', 'upcoming']
    }
    return ['complete', 'complete', 'active']
  }

  // Fallback: tính theo start/end dates thực từ DB
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

const showSettingViewIssues = computed(
  () =>
    !isHistoricalCycle.value &&
    settingStatus.value !== 'upcoming' &&
    gmTimelinePhaseHasOpenIssues(props.settingIssues),
)

/**
 * Theo lịch Jan–Mar đã qua thì `complete`, nhưng mock ~80% + issues → **không** coi là xong (không tick node).
 */
function effectivePhaseStatus(idx: number): PhaseStatus {
  if (isHistoricalCycle.value) return 'complete'
  const s = phaseStatuses.value[idx]!
  if (s === 'complete') {
    if (idx === 0 && showSettingViewIssues.value) return 'active'
    if (idx === 1 && showMidViewIssues.value) return 'active'
    if (idx === 2 && showYearEndViewIssues.value) return 'active'
  }
  return s
}

const showMidViewIssues = computed(
  () =>
    !isHistoricalCycle.value &&
    midYearStatus.value !== 'upcoming' &&
    gmTimelinePhaseHasOpenIssues(props.midYearIssues),
)

const showYearEndViewIssues = computed(
  () =>
    !isHistoricalCycle.value &&
    yearEndStatus.value !== 'upcoming' &&
    gmTimelinePhaseHasOpenIssues(props.yearEndIssues),
)

const issuePopoverRows = computed((): IssuePopoverRow[] => {
  const getPhaseData = () => {
    if (issuesPopoverPhase.value === 'yearEnd') return props.yearEndIssues
    if (issuesPopoverPhase.value === 'setting') return props.settingIssues
    return props.midYearIssues
  }

  const phase = getPhaseData()
  if (!phase) return []

  if (phase.issueGroups?.length) {
    const groups = issueGroupsForPhase(phase)
    return groups.map((g) => ({
      id: g.id,
      title: g.title,
      subline: buildIssueSubline(g),
      dotClass: severityDotClass(g.severity),
    }))
  }

  if (phase.issueTypes?.length && !phase.issueDetails?.length) {
    return (phase.issueTypes as GmTimelineIssueType[]).map((t) => ({
      id: String(t.id),
      title: t.text,
      subline: '',
      dotClass: t.dotClass,
    }))
  }

  return issueGroupsForPhase(phase).map((g) => ({
    id: g.id,
    title: g.title,
    subline: buildIssueSubline(g),
    dotClass: severityDotClass(g.severity),
  }))
})

/**
 * Subline cho mỗi issue group trong popover.
 * `unassigned_members`: chỉ hiện số employees (không có KPI nên không hiện "· 0 KPIs").
 */
function buildIssueSubline(g: GmTimelineIssueGroup): string {
  if (g.affectedEmployees <= 0) return ''
  if (g.id === 'unassigned_members') {
    return `${g.affectedEmployees} employee${g.affectedEmployees === 1 ? '' : 's'} · 0 KPIs`
  }
  return `${g.affectedEmployees} employee${g.affectedEmployees === 1 ? '' : 's'} · ${g.affectedKpis} KPI${g.affectedKpis === 1 ? '' : 's'}`
}

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

/** Trục ngang: trùng tâm cột 1 → tâm cột 3. */
const TRACK_LEFT_PCT = 100 / 6
const TRACK_RIGHT_PCT = 100 - 100 / 6
const TRACK_SPAN_PCT = TRACK_RIGHT_PCT - TRACK_LEFT_PCT

/**
 * Piecewise progress fraction (0→1) — milestone positions cố định tại 0, 0.5, 1.0:
 * - Trong phase [start, end]: marker NẰM TẠI milestone (fraction cố định).
 * - Giữa 2 phase: di chuyển linear từ milestone trước tới milestone tiếp.
 * - Fallback: calendar year nếu thiếu dữ liệu.
 */
const cycleProgressFraction = computed(() => {
  const cd = cycleData.value
  const now = dayjs()

  const gs = cd.goalSettingStart ? dayjs(cd.goalSettingStart) : null
  const ge = cd.goalSettingEnd   ? dayjs(cd.goalSettingEnd)   : null
  const ms = cd.midYearStart     ? dayjs(cd.midYearStart)     : null
  const me = cd.midYearEnd       ? dayjs(cd.midYearEnd)       : null
  const es = cd.endYearStart     ? dayjs(cd.endYearStart)     : null
  const ee = cd.endYearEnd       ? dayjs(cd.endYearEnd)       : null

  // Vị trí cố định của 3 milestone (độc lập với date)
  const F0 = 0    // milestone 0 tại 16.67% (TRACK_LEFT_PCT)
  const F1 = 0.5  // milestone 1 tại 50%
  const F2 = 1.0  // milestone 2 tại 83.33% (TRACK_RIGHT_PCT)

  if (gs && ge && ms && me && es && ee) {
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
  const y = now.year()
  const t0 = dayjs(`${y}-01-01`).valueOf()
  const t1 = dayjs(`${y}-12-31T23:59:59`).valueOf()
  return Math.min(1, Math.max(0, (now.valueOf() - t0) / (t1 - t0)))
})

/**
 * Vị trí % (0→1) của mỗi milestone — CỐ ĐỊNH tại 0, 0.5, 1.0.
 * Milestone dots luôn ở 16.67%, 50%, 83.33% (khớp với grid-cols-3).
 */
const milestoneFractions = computed(() => [0, 0.5, 1.0])

/** Chuyển fraction (0→1) sang left% tuyệt đối trong container. */
function fractionToLeftPct(fraction: number): number {
  return TRACK_LEFT_PCT + fraction * TRACK_SPAN_PCT
}

const nowMarkerLeftPct = computed(() =>
  fractionToLeftPct(cycleProgressFraction.value),
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
  width: `${Math.max(0, cycleProgressFraction.value) * TRACK_SPAN_PCT}%`,
  top: '50%',
  transform: 'translateY(-50%)',
}))

const nowMarkerLabel = computed(() => {
  const d = new Date()
  return `System date position: ${d.toLocaleDateString('en-US')}`
})

const drawerIssueGroups = computed((): GmTimelineIssueGroup[] => {
  if (drawerIssuesPhase.value === 'yearEnd')
    return issueGroupsForPhase(props.yearEndIssues ?? null)
  if (drawerIssuesPhase.value === 'setting')
    return issueGroupsForPhase(props.settingIssues ?? null)
  return issueGroupsForPhase(props.midYearIssues)
})

const activeIssueGroup = computed(() => {
  if (!activeIssueGroupId.value) return null
  return drawerIssueGroups.value.find((g) => g.id === activeIssueGroupId.value) ?? null
})

/** Drawer: KPI → department → employees (API or derived from flat employees). */
const activeKpiGroups = computed((): GmTimelineKpiGroup[] => {
  const g = activeIssueGroup.value
  if (!g) return []
  return resolveTimelineKpiGroups(g)
})

/** Department-first drawer layout for `unassigned_members` only. */
const isUnassignedMembersIssue = computed(
  () => activeIssueGroup.value?.id === 'unassigned_members',
)

const unassignedDeptGroups = computed((): GmTimelineBreakdownGroup[] => {
  const g = activeIssueGroup.value
  if (!g || g.id !== 'unassigned_members') return []
  return buildTimelineBreakdownGroupsFromEmployees(g.employees)
})

const drawerDisplayTitle = computed(() => activeIssueGroup.value?.title ?? '')

/** KPI cluster subline under title (by issue group id). */
function timelineClusterStatusEn(issueId: string): string {
  switch (issueId) {
    case 'pending_acceptance':
      return 'Awaiting member acceptance'
    case 'pending_pm_review':
      return 'Pending PM review'
    case 'pending_gm_approval':
      return 'Pending GM approval'
    case 'kpi_not_submitted':
      return 'Submission pending'
    case 'missing_evidence':
      return 'Evidence incomplete'
    default:
      return 'In progress'
  }
}

const drawerClusterStatusLine = computed(() => timelineClusterStatusEn(activeIssueGroup.value?.id ?? ''))

function kpiGroupHasEmployeeRows(kg: GmTimelineKpiGroup): boolean {
  return kg.departments.some((d) => (d.employees?.length ?? 0) > 0)
}

function unassignedMemberSubline(item: GmTimelineIssueDetail): string {
  const p = (item.pm ?? '').trim()
  if (p && p !== '—') return `Section head: ${p}`
  return ''
}

function timelineMemberRoleLabel(item: GmTimelineIssueDetail): string {
  const c = (item.roleCode ?? '').trim()
  if (c.length) return c
  return '—'
}

const expandedBreakdownKeys = ref<Record<string, boolean>>({})
const expandedEmployeeRowKey = ref<string | null>(null)

watch(activeIssueGroupId, () => {
  expandedBreakdownKeys.value = {}
  expandedEmployeeRowKey.value = null
})

function isBreakdownExpanded(groupKey: string): boolean {
  return !!expandedBreakdownKeys.value[groupKey]
}

function toggleBreakdownGroup(groupKey: string) {
  expandedBreakdownKeys.value = {
    ...expandedBreakdownKeys.value,
    [groupKey]: !expandedBreakdownKeys.value[groupKey],
  }
}

function toggleEmployeeRow(key: string) {
  expandedEmployeeRowKey.value = expandedEmployeeRowKey.value === key ? null : key
}

const drawerSeverityTheme = computed(() => {
  const s = activeIssueGroup.value?.severity ?? 'info'
  if (s === 'critical') {
    return {
      headerCard:
        'border-rose-200/35 bg-gradient-to-br from-rose-50/70 via-white to-indigo-50/25 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
    }
  }
  if (s === 'warning') {
    return {
      headerCard:
        'border-amber-200/40 bg-gradient-to-br from-amber-50/65 via-white to-sky-50/30 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
    }
  }
  return {
    headerCard:
      'border-sky-200/35 bg-gradient-to-br from-sky-50/55 via-white to-violet-50/25 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  }
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

function openIssueDrawer(id: string) {
  const ph = issuesPopoverPhase.value
  if (!ph) return
  drawerIssuesPhase.value = ph
  activeIssueGroupId.value = id
  expandedBreakdownKeys.value = {}
  expandedEmployeeRowKey.value = null
  issuesPopoverPhase.value = null
  drawerOpen.value = true
}

function closeIssueDrawer() {
  drawerOpen.value = false
  activeIssueGroupId.value = null
  drawerIssuesPhase.value = null
  expandedBreakdownKeys.value = {}
  expandedEmployeeRowKey.value = null
}

/** One-line operational summary for clusters (same issue = same headline). */
function issueBlockerShortLabel(g: GmTimelineIssueGroup): string {
  switch (g.id) {
    case 'pending_acceptance':
      return 'Acceptance pending'
    case 'pending_pm_review':
      return 'PM review pending'
    case 'pending_gm_approval':
      return 'GM approval pending'
    case 'kpi_not_submitted':
      return 'Submission pending'
    case 'missing_evidence':
      return 'Evidence incomplete'
    case 'unassigned_members':
      return 'No KPI assigned'
    default:
      return `${g.blockedRole} action pending`
  }
}

const trackMilestones = computed(() =>
  [0, 1, 2].map((idx) => ({
    idx,
    outerClass: milestoneOuterClass(idx),
    status: effectivePhaseStatus(idx) as 'complete' | 'active' | 'upcoming',
  })),
)

/** Milestone dots dùng grid layout cố định — không cần absolute positioning. */
const milestoneLeftPcts = computed((): number[] | undefined => undefined)

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
    :class="timelineCardClass">
    <div class="relative grid grid-cols-[auto_1fr_auto] items-center gap-3" :class="timelineHeaderClass">
      <Transition name="gm-tl-track-slot">
        <div v-if="showCollapsedTrack" key="track-header-bleed"
          class="pointer-events-none absolute inset-x-0 top-1/2 z-0 w-full -translate-y-1/2" aria-hidden="true">
          <GmProcessTimelineTrack :track-bar-style="trackBarStyle" :progress-fill-style="progressFillStyle"
            :now-marker-position-style="nowMarkerPositionStyle" :now-marker-label="nowMarkerLabel"
            :milestones="trackMilestones" :milestone-left-pcts="milestoneLeftPcts" />
        </div>
      </Transition>

      <h3 class="relative z-10 shrink-0 bg-white py-0.5 pr-3 text-xs font-bold uppercase tracking-wider text-slate-700">
        Process Timeline
      </h3>

      <div class="relative z-10 h-px min-w-0" />

      <button type="button" :class="[timelineToggleBtnClass, 'relative z-10 justify-self-end bg-white py-0.5 pl-3']"
        :aria-expanded="!timelineCollapsed" :aria-label="timelineCollapsed ? 'Expand timeline' : 'Collapse timeline'"
        @click="toggleTimelineCollapsed">
        <i class="fas text-[10px] text-slate-500" :class="timelineCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"
          aria-hidden="true" />
        {{ timelineCollapsed ? 'Expand' : 'Collapse' }}
      </button>
    </div>

    <div class="text-center">
      <Transition name="gm-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-phases" class="grid grid-cols-3 gap-1.5">
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(0)">KPI Setting</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(0)">
              <span v-if="cycleLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.setting }}</span>
            </p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(1)">Mid-Year Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(1)">
              <span v-if="cycleLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.mid }}</span>
            </p>
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold" :class="phaseTitleClass(2)">Year-End Review</span>
            <p class="mt-0.5 text-[15px]" :class="phaseSubLabelClass(2)">
              <span v-if="cycleLoading" class="inline-block h-4 w-16 animate-pulse rounded bg-slate-200" />
              <span v-else>{{ phaseLabels.yearEnd }}</span>
            </p>
          </div>
        </div>
      </Transition>

      <Transition name="gm-tl-track-slot">
        <div v-if="showExpandedTimeline" key="track-below" class="mt-4">
          <GmProcessTimelineTrack :track-bar-style="trackBarStyle" :progress-fill-style="progressFillStyle"
            :now-marker-position-style="nowMarkerPositionStyle" :now-marker-label="nowMarkerLabel"
            :milestones="trackMilestones" :milestone-left-pcts="milestoneLeftPcts" />
        </div>
      </Transition>

      <Transition name="gm-timeline-fold">
        <div v-if="showExpandedTimeline" key="tl-notes" class="mt-3 grid grid-cols-3 gap-1.5">
          <div class="relative z-20 flex flex-col items-center gap-1.5">
            <template v-if="settingStatus === 'upcoming'">
              <div class="flex flex-col items-center gap-0.5 text-slate-400">
                <div class="flex items-center justify-center gap-1">
                  <i class="fas fa-calendar-xmark text-[13px] opacity-80" aria-hidden="true" />
                  <span class="text-[13px] font-semibold leading-snug">KPI Setting not started</span>
                </div>
                <span class="text-[11px] font-medium leading-tight">Starts in January</span>
              </div>
            </template>
            <template v-else>
              <template v-if="settingStatus === 'active'">
                <div v-if="showSettingViewIssues && settingIssues"
                  class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ settingIssues.pendingKpisLine }}</span>
                </div>
                <div v-else class="flex items-center justify-center gap-1 text-emerald-700">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span class="text-[13px] font-semibold">In progress</span>
                </div>
              </template>
              <template v-else>
                <div v-if="showSettingViewIssues && settingIssues"
                  class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ settingIssues.pendingKpisLine }}</span>
                </div>
                <div v-else class="flex items-center justify-center gap-1 text-emerald-600">
                  <i class="fas fa-check text-[15px]" />
                  <span class="text-[13px] font-semibold">100% Complete</span>
                </div>
              </template>
              <div v-if="showSettingViewIssues && settingIssues" ref="settingIssuesPopoverRoot"
                class="relative inline-flex flex-col items-center gap-1.5">
                <button type="button"
                  class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                  :class="settingStatus === 'active'
                      ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                      : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                    " :aria-expanded="issuesPopoverPhase === 'setting'" aria-controls="issues-popover-setting"
                  aria-haspopup="dialog" @click.stop="toggleIssuesPhase('setting')">
                  <i class="fas fa-eye text-[11px]" />
                  View Issues
                </button>

                <div v-if="issuesPopoverPhase === 'setting'" id="issues-popover-setting"
                  class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                  role="dialog" aria-modal="true" aria-labelledby="issues-popover-title-setting" @click.stop>
                  <div
                    class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50" />
                  <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                    <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                      <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                      <h4 id="issues-popover-title-setting" class="text-xs font-bold leading-snug text-amber-950">
                        {{ popoverTitleForOpen }}
                      </h4>
                    </div>
                    <ul class="max-h-72 space-y-1 overflow-y-auto px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                      <li v-for="it in issuePopoverRows" :key="it.id">
                        <button type="button"
                          class="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                          @click="openIssueDrawer(it.id)">
                          <span class="min-w-0 flex-1">
                            <span class="flex items-start gap-1.5">
                              <span class="mt-0.5 shrink-0 text-[11px]" :class="it.dotClass">●</span>
                              <span>
                                <span class="block font-semibold leading-snug">{{ it.title }}</span>
                                <span v-if="it.subline" class="mt-0.5 block text-[10px] font-normal opacity-80">{{ it.subline }}</span>
                              </span>
                            </span>
                          </span>
                          <i
                            class="fas fa-chevron-right mt-0.5 shrink-0 text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="relative z-20 flex flex-col items-center gap-1.5"
            :class="midYearStatus === 'upcoming' ? 'opacity-95' : ''">
            <template v-if="midYearStatus === 'upcoming'">
              <div class="flex flex-col items-center gap-0.5 text-slate-400">
                <div class="flex items-center justify-center gap-1">
                  <i class="fas fa-calendar-xmark text-[13px] opacity-80" aria-hidden="true" />
                  <span class="text-[13px] font-semibold leading-snug">Mid-Year not started</span>
                </div>
                <span class="text-[11px] font-medium leading-tight">Starts in June</span>
              </div>
            </template>
            <template v-else>
              <template v-if="midYearStatus === 'active'">
                <div v-if="showMidViewIssues" class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ midYearIssues.pendingKpisLine }}</span>
                </div>
                <div v-else class="flex items-center justify-center gap-1 text-blue-700">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span class="text-[13px] font-semibold">In progress</span>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-center gap-1 text-emerald-700">
                  <i class="fas fa-check text-[15px]" />
                  <span class="text-[13px] font-semibold leading-snug">100% Complete</span>
                </div>
              </template>
              <div v-if="showMidViewIssues" ref="midIssuesPopoverRoot"
                class="relative inline-flex flex-col items-center gap-1.5">
                <button type="button"
                  class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                  :class="midYearStatus === 'active'
                      ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                      : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                    " :aria-expanded="issuesPopoverPhase === 'mid'" aria-controls="issues-popover-mid"
                  aria-haspopup="dialog" @click.stop="toggleIssuesPhase('mid')">
                  <i class="fas fa-eye text-[11px]" />
                  View Issues
                </button>

                <div v-if="issuesPopoverPhase === 'mid'" id="issues-popover-mid"
                  class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                  role="dialog" aria-modal="true" aria-labelledby="issues-popover-title-mid" @click.stop>
                  <div
                    class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50" />
                  <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                    <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                      <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                      <h4 id="issues-popover-title-mid" class="text-xs font-bold leading-snug text-amber-950">
                        {{ popoverTitleForOpen }}
                      </h4>
                    </div>
                    <ul class="max-h-72 space-y-1 overflow-y-auto px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                      <li v-for="it in issuePopoverRows" :key="it.id">
                        <button type="button"
                          class="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                          @click="openIssueDrawer(it.id)">
                          <span class="min-w-0 flex-1">
                            <span class="flex items-start gap-1.5">
                              <span class="mt-0.5 shrink-0 text-[11px]" :class="it.dotClass">●</span>
                              <span>
                                <span class="block font-semibold leading-snug">{{ it.title }}</span>
                                <span v-if="it.subline" class="mt-0.5 block text-[10px] font-normal opacity-80">{{ it.subline }}</span>
                              </span>
                            </span>
                          </span>
                          <i
                            class="fas fa-chevron-right mt-0.5 shrink-0 text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
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
                  <span class="text-[13px] font-semibold leading-snug">Year-End not started</span>
                </div>
                <span class="text-[11px] font-medium leading-tight">Starts in November</span>
              </div>
            </template>
            <template v-else>
              <template v-if="yearEndStatus === 'active'">
                <div v-if="showYearEndViewIssues && yearEndIssues"
                  class="flex items-center justify-center gap-1.5 text-amber-800/90">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span class="text-[13px] font-semibold">{{ yearEndIssues.pendingKpisLine }}</span>
                </div>
                <div v-else class="flex items-center justify-center gap-1 text-blue-700">
                  <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span class="text-[13px] font-semibold">In progress</span>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-center gap-1 text-emerald-600">
                  <i class="fas fa-check text-[15px]" />
                  <span class="text-[13px] font-semibold">100% Complete</span>
                </div>
              </template>
              <div v-if="showYearEndViewIssues" ref="yearEndIssuesPopoverRoot"
                class="relative inline-flex flex-col items-center gap-1.5">
                <button type="button"
                  class="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold transition-colors"
                  :class="yearEndStatus === 'active'
                      ? 'border-amber-700/40 text-amber-900/90 hover:bg-amber-50'
                      : 'border-emerald-600/35 text-emerald-900/90 hover:bg-emerald-50'
                    " :aria-expanded="issuesPopoverPhase === 'yearEnd'" aria-controls="issues-popover-ye"
                  aria-haspopup="dialog" @click.stop="toggleIssuesPhase('yearEnd')">
                  <i class="fas fa-eye text-[11px]" />
                  View Issues
                </button>

                <div v-if="issuesPopoverPhase === 'yearEnd'" id="issues-popover-ye"
                  class="absolute left-1/2 top-[calc(100%+0.625rem)] z-[70] w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2"
                  role="dialog" aria-modal="true" aria-labelledby="issues-popover-title-ye" @click.stop>
                  <div
                    class="pointer-events-none absolute -top-1.5 left-1/2 z-[1] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-amber-200/95 bg-orange-50" />
                  <div class="relative rounded-lg border border-amber-200/95 bg-orange-50 shadow-lg">
                    <div class="flex items-start gap-2 border-b border-slate-200/80 px-3 pb-2 pt-2.5">
                      <i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-xs text-amber-600" />
                      <h4 id="issues-popover-title-ye" class="text-xs font-bold leading-snug text-amber-950">
                        {{ popoverTitleForOpen }}
                      </h4>
                    </div>
                    <ul class="max-h-72 space-y-1 overflow-y-auto px-2 py-2 text-xs font-medium leading-snug text-amber-950/90">
                      <li v-for="it in issuePopoverRows" :key="it.id">
                        <button type="button"
                          class="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-orange-100/70"
                          @click="openIssueDrawer(it.id)">
                          <span class="min-w-0 flex-1">
                            <span class="flex items-start gap-1.5">
                              <span class="mt-0.5 shrink-0 text-[11px]" :class="it.dotClass">●</span>
                              <span>
                                <span class="block font-semibold leading-snug">{{ it.title }}</span>
                                <span v-if="it.subline" class="mt-0.5 block text-[10px] font-normal opacity-80">{{ it.subline }}</span>
                              </span>
                            </span>
                          </span>
                          <i
                            class="fas fa-chevron-right mt-0.5 shrink-0 text-[10px] text-amber-500 transition-colors group-hover:text-amber-700" />
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
      <div v-if="drawerOpen && activeIssueGroup" class="fixed inset-0 z-[90]">
        <div class="gm-issue-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeIssueDrawer" />
        <div
          class="gm-issue-drawer-panel absolute bottom-0 right-0 top-0 flex min-h-0 w-full max-w-full flex-col border-l border-sky-100/80 bg-gradient-to-b from-slate-50 to-sky-50/40 shadow-[0_0_0_1px_rgba(14,116,144,0.06)] md:max-w-[min(92vw,880px)] lg:max-w-[900px]">
          <!-- Layout 1: unassigned members — by department -->
          <template v-if="isUnassignedMembersIssue">
            <div
              class="gm-drawer-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-50/40 px-4 pb-6 pt-4 md:px-5">
              <div
                class="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/95 via-white to-rose-50/25 p-5 shadow-sm">
                <h2 class="text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 md:text-[18px]">
                  {{ drawerDisplayTitle }}
                </h2>
                <p class="mt-4 text-[12px] font-medium leading-6 text-zinc-600">
                  <span class="font-semibold tabular-nums text-zinc-900">{{ activeIssueGroup.affectedEmployees }}</span>
                  <span class="font-normal text-zinc-500"> assignees</span>
                  <span class="mx-1.5 text-zinc-300">·</span>
                  <span class="font-semibold tabular-nums text-zinc-900">{{ activeIssueGroup.affectedKpis }}</span>
                  <span class="font-normal text-zinc-500"> KPIs</span>
                  <template v-if="activeIssueGroup.affectedDepartments">
                    <span class="mx-1.5 text-zinc-300">·</span>
                    <span class="font-semibold tabular-nums text-zinc-900">{{ activeIssueGroup.affectedDepartments }}</span>
                    <span class="font-normal text-zinc-500"> departments</span>
                  </template>
                </p>
              </div>

              <section class="mt-8">
                <h3 class="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  Detailed list
                </h3>
                <div v-if="!unassignedDeptGroups.length" class="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
                  No member data.
                </div>
                <div v-else class="space-y-4">
                  <article
                    v-for="bg in unassignedDeptGroups"
                    :key="bg.groupKey"
                    class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <button
                      type="button"
                      class="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-zinc-50/90 active:bg-zinc-100/80"
                      :aria-expanded="isBreakdownExpanded(bg.groupKey)"
                      @click="toggleBreakdownGroup(bg.groupKey)">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-zinc-900">{{ bg.groupLabel }}</p>
                        <p class="mt-1 text-xs text-zinc-500">
                          <span class="tabular-nums text-zinc-600">{{ bg.affectedEmployees }}</span>
                          assignees
                        </p>
                        <p class="mt-1 text-xs font-medium text-amber-600">
                          No KPI yet
                        </p>
                      </div>
                      <span class="mt-0.5 shrink-0 select-none text-sm text-zinc-400" aria-hidden="true">
                        {{ isBreakdownExpanded(bg.groupKey) ? '▲' : '▼' }}
                      </span>
                    </button>
                    <div
                      class="gm-drawer-acc-shell border-t border-zinc-100 bg-zinc-50/50"
                      :class="isBreakdownExpanded(bg.groupKey) ? 'gm-drawer-acc-shell--open' : ''">
                      <div class="gm-drawer-acc-shell-inner">
                        <div class="p-4">
                          <ul class="space-y-2">
                            <li v-for="(item, midx) in bg.employees" :key="`${bg.groupKey}-${midx}`">
                              <div
                                class="rounded-lg border border-rose-100 bg-white p-3 transition-colors hover:border-rose-200">
                                <div class="min-w-0">
                                  <div class="flex items-start justify-between gap-2">
                                    <p class="truncate text-sm font-semibold text-zinc-900">{{ item.member }}</p>
                                    <span
                                      class="max-w-[55%] shrink-0 truncate rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                                      :title="timelineMemberRoleLabel(item)">
                                      {{ timelineMemberRoleLabel(item) }}
                                    </span>
                                  </div>
                                  <p v-if="unassignedMemberSubline(item)" class="mt-0.5 truncate text-xs text-zinc-500">
                                    {{ unassignedMemberSubline(item) }}
                                  </p>
                                </div>
                              </div>
                            </li>
                          </ul>
                        </div>
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
                  class="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100/80"
                  @click="closeIssueDrawer">
                  Close
                </button>
              </div>
            </div>
          </template>

          <!-- Layout 2: other issues — KPI → department → member cards -->
          <template v-else>
            <div
              class="gm-drawer-scroll custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-50/40 px-4 pb-6 pt-4 md:px-5">
              <div
                class="rounded-xl border p-5 shadow-sm"
                :class="[
                  drawerSeverityTheme.headerCard,
                  activeIssueGroup.severity === 'critical' ? 'border-rose-100' : '',
                  activeIssueGroup.severity === 'warning' ? 'border-amber-100' : '',
                  activeIssueGroup.severity === 'info' ? 'border-sky-100' : '',
                ]">
                <h2 class="text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 md:text-[18px]">
                  {{ drawerDisplayTitle }}
                </h2>
                <p class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-medium text-zinc-700">
                  <span>
                    <span class="tabular-nums font-semibold text-zinc-900">{{ activeIssueGroup.affectedEmployees }}</span>
                    assignees
                  </span>
                  <span class="text-zinc-300">·</span>
                  <span>
                    <span class="tabular-nums font-semibold text-zinc-900">{{ activeIssueGroup.affectedKpis }}</span>
                    KPIs
                  </span>
                  <template v-if="activeIssueGroup.affectedDepartments">
                    <span class="text-zinc-300">·</span>
                    <span>
                      <span class="tabular-nums font-semibold text-zinc-900">{{ activeIssueGroup.affectedDepartments }}</span>
                      departments
                    </span>
                  </template>
                </p>
              </div>

              <section class="mt-8">
                <h3 class="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  Detailed list
                </h3>
                <div class="flex flex-col gap-4">
                  <article
                    v-for="kg in activeKpiGroups"
                    :key="kpiGroupKey(kg)"
                    class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <button
                      type="button"
                      class="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-zinc-50/90 active:bg-zinc-100/80"
                      :aria-expanded="isBreakdownExpanded(kpiGroupKey(kg))"
                      @click="toggleBreakdownGroup(kpiGroupKey(kg))">
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-zinc-900">{{ kg.kpiName }}</p>
                        <p class="mt-1 text-xs text-zinc-500">
                          <span class="tabular-nums text-zinc-700">{{ kg.affectedEmployees }}</span>
                          assignees
                          <span class="mx-1.5 text-zinc-300">·</span>
                          <span class="tabular-nums text-zinc-700">{{ kg.affectedDepartments }}</span>
                          departments
                        </p>
                        <p class="mt-1 text-xs font-medium text-amber-700">
                          {{ drawerClusterStatusLine }}
                        </p>
                      </div>
                      <span class="mt-0.5 shrink-0 select-none text-sm text-zinc-400" aria-hidden="true">
                        {{ isBreakdownExpanded(kpiGroupKey(kg)) ? '▲' : '▼' }}
                      </span>
                    </button>
                    <div
                      class="gm-drawer-acc-shell border-t border-zinc-100 bg-zinc-50/50"
                      :class="isBreakdownExpanded(kpiGroupKey(kg)) ? 'gm-drawer-acc-shell--open' : ''">
                      <div class="gm-drawer-acc-shell-inner">
                        <div class="p-4">
                          <template v-if="!kpiGroupHasEmployeeRows(kg)">
                            <p class="py-4 text-center text-sm italic text-zinc-500">
                              No member details for this item.
                            </p>
                          </template>
                          <template v-else>
                            <div
                              v-for="dg in kg.departments"
                              v-show="(dg.employees?.length ?? 0) > 0"
                              :key="`${kpiGroupKey(kg)}|${dg.departmentName ?? '_'}`"
                              class="mb-5 last:mb-0">
                              <div class="mb-2 flex flex-wrap items-center gap-2">
                                <h4 class="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                                  {{ dg.departmentName ?? 'No department' }}
                                </h4>
                                <span
                                  class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                  {{ dg.affectedEmployees }} assignees
                                </span>
                              </div>
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
                                  @toggle="toggleEmployeeRow" />
                              </ul>
                            </div>
                          </template>
                        </div>
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
                  class="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100/80"
                  @click="closeIssueDrawer">
                  Close
                </button>
              </div>
            </div>
          </template>
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

/* GM issue drawer: polish only (typography rhythm, hovers, inset detail) */
.gm-drawer-scroll {
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 45%, rgb(238 242 255 / 0.35) 100%);
}

.gm-drawer-insight-row {
  transition: background-color 0.12s ease;
}

.gm-drawer-insight-row + .gm-drawer-insight-row {
  border-top: 1px solid rgb(244 244 245 / 0.95);
}

.gm-drawer-insight-row:hover {
  background-color: rgb(255 255 255 / 0.72);
}

.gm-drawer-cluster-toggle:focus-visible,
.gm-drawer-employee-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(255 255 255), 0 0 0 4px rgb(161 161 170 / 0.45);
}

.gm-drawer-row-detail {
  padding: 0.625rem 0.75rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(228 228 231 / 0.95);
  background-color: rgb(255 255 255 / 0.92);
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.03);
}

/* Issue drawer: accordion body height animation */
.gm-drawer-acc-shell {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.gm-drawer-acc-shell--open {
  grid-template-rows: 1fr;
}

.gm-drawer-acc-shell-inner {
  min-height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .gm-drawer-acc-shell {
    transition-duration: 0.01ms !important;
  }
}
</style>
