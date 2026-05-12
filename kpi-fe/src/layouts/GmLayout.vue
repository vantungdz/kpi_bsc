<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide, reactive, TransitionGroup, nextTick } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import GmDepartmentInvestigation from '@/components/gm/GmDepartmentInvestigation.vue'
import GmProcessTimeline from '@/components/gm/GmProcessTimeline.vue'
import GmKpiDiagnosticsTable from '@/components/gm/GmKpiDiagnosticsTable.vue'
import GmPmEvaluationWorkspace from '@/components/gm/GmPmEvaluationWorkspace.vue'
import GmGmPersonalKpiPanel from '@/components/gm/GmGmPersonalKpiPanel.vue'
import GmApprovedKpiPanel from '@/components/gm/GmApprovedKpiPanel.vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'
import GmCreateStrategicKpiModal from '@/components/gm/GmCreateStrategicKpiModal.vue'
import { mapGmDepartmentApiRowToWorkspaceMock } from '@/utils/gm-department-from-api'
import { EMPTY_GM_WORKSPACE_CYCLE_SNAPSHOT } from '@/utils/gm-workspace-empty-snapshot'
import type {
  GmHierarchyKpi,
  GmHierarchyMember,
  GmInvestigationMember,
  GmMemberKpiDrawerProfile,
  GmModalKpiItemMock,
  GmPersonalKpiRowMock,
} from '@/types/gm-workspace'
import {
  buildHierarchyKpiFromStrategicCreatePayload,
  buildDeptKpiFromStrategicCreatePayload,
  hierarchyInactiveKpiToDeptKpiMock,
} from '@/utils/gm-strategic-create-preview'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { GmProcessTimelineApiResponse } from '@/services/modules/kpi-gm.service'
import { leaderKpiService } from '@/services/modules/kpi-leader.service'
import type { LeaderKpiAssignment, LeaderKpiInformationResponse } from '@/types/kpi'
import type { GmKpiCycleOption } from '@/types/gm-kpi-cycle'
import { mapGmApprovedKpiQueueItemsToHierarchyRows } from '@/utils/mapGmApprovedKpiQueueToHierarchy'
import { mapGmDiagnosticsApiKpisToHierarchyRows } from '@/utils/mapGmDiagnosticsApiToHierarchy'
import { mapStrategicKpiCreatePayloadToApi } from '@/utils/mapStrategicKpiCreatePayloadToApi'
import { getApiErrorMessage } from '@/utils/apiErrorMessage'
import { mergeLeaderKpiInfoResponsesToGmPersonalRows } from '@/utils/mapLeaderPersonalKpiToGmPersonalRows'
import {
  clearAllGmNotifications,
  dismissGmNotification,
  pushGmNotification,
  useGmNotificationItems,
  type GmNotificationVariant,
} from '@/composables/useGmNotifications'
import { KPI_STATUS } from '@/config/constants'
import { kpiCycleService } from '@/services/shared/kpi-cycle.service'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'

/** Gọi `openFeedbackDrawerByAssignmentId` từ `GmKpiDiagnosticsTable` (tab Strategic KPIs). */
const gmDiagnosticsTableRef = ref<{
  openFeedbackDrawerByAssignmentId?: (assignmentId: string) => boolean
} | null>(null)

const route = useRoute()
const { user, logout } = useAuth()

const navItems = [
  { name: 'KPI Overview', icon: 'fas fa-chart-line', to: '/gm/dashboard' },
  { name: 'Reports', icon: 'fas fa-chart-pie', to: '/gm/reports' },
]

const settingsNavItems = [
  { name: 'Tổ chức & Nhân sự', icon: 'fas fa-sitemap', to: '/gm/settings/organization' },
  { name: 'KPI Template', icon: 'fas fa-layer-group', to: '/gm/settings/kpi-template' },
]

/** Trang Organization đăng ký `open` — nút header «Thêm phòng ban mới» (route gm-organization). */
const gmOrgSectionDrawer = reactive<{ open: () => void }>({ open: () => { } })
provide('gmOrgSectionDrawer', gmOrgSectionDrawer)

/** Trang KPI Template — trang gán `openCreate` để header gọi mở drawer tạo bộ mẫu. */
const gmKpiTemplateLibrary = reactive<{ openCreate: () => void }>({ openCreate: () => { } })
provide('gmKpiTemplateLibrary', gmKpiTemplateLibrary)

/** Tab Đánh giá / Approved KPI / KPI cá nhân — sidebar Overview active khi `?tab=pm`, `?tab=approved`, `?tab=personal`. */
function isNavItemActive(to: string): boolean {
  const [path] = to.split('?')
  return route.path.startsWith(path)
}

const isGmEvaluationRoute = computed(() => route.name === 'gm-employee-evaluation')
const isGmCreateDepartmentRoute = computed(() => route.name === 'gm-organization')
const isGmKpiTemplateRoute = computed(() => route.name === 'gm-kpi-template')
const isGmReportsRoute = computed(() => route.name === 'gm-reports')
const isGmSettingsRoute = computed(() =>
  isGmCreateDepartmentRoute.value || isGmKpiTemplateRoute.value || isGmReportsRoute.value,
)
const isGmDashboardRoute = computed(() => route.name === 'gm-dashboard')

const router = useRouter()

/** Tab vùng làm việc dưới timeline (chỉ dashboard). `?tab=pm` | `?tab=approved` | `?tab=personal` đồng bộ URL. */
type GmDashboardWorkspaceTab = 'diagnostics' | 'pm-eval' | 'approved-kpi' | 'personal'
const dashboardWorkspaceTab = ref<GmDashboardWorkspaceTab>('diagnostics')

function readDashboardTabFromRoute(): GmDashboardWorkspaceTab {
  const t = route.query.tab
  if (t === 'pm' || t === 'pm-eval') return 'pm-eval'
  if (t === 'approved' || t === 'approved-kpi') return 'approved-kpi'
  if (t === 'personal' || t === 'my-kpi') return 'personal'
  return 'diagnostics'
}

watch(
  () => [route.name, route.query.tab] as const,
  () => {
    if (route.name === 'gm-dashboard') {
      dashboardWorkspaceTab.value = readDashboardTabFromRoute()
    }
  },
  { immediate: true },
)

function setDashboardWorkspaceTab(tab: GmDashboardWorkspaceTab) {
  dashboardWorkspaceTab.value = tab
  if (route.name !== 'gm-dashboard') return
  const nextQuery: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'tab') continue
    if (typeof v === 'string' && v) nextQuery[k] = v
    else if (Array.isArray(v) && typeof v[0] === 'string' && v[0]) nextQuery[k] = v[0]
  }
  if (tab === 'pm-eval') nextQuery.tab = 'pm'
  else if (tab === 'approved-kpi') nextQuery.tab = 'approved'
  else if (tab === 'personal') nextQuery.tab = 'personal'
  void router.replace({ name: 'gm-dashboard', query: nextQuery })
}

const headerConfig = computed(() => {
  if (route.name === 'gm-organization') {
    return { category: 'GM Workspace', title: 'Tổ chức & Nhân sự' }
  }
  if (route.name === 'gm-kpi-template') {
    return { category: 'GM Workspace', title: 'Template Library' }
  }
  if (route.name === 'gm-reports') {
    return { category: 'GM Workspace', title: 'Reports' }
  }
  return { category: 'GM Workspace', title: 'KPI Management' }
})

/** Chu kỳ từ `GET /kpi/gm/kpi-cycles-for-evaluation` (`year` ≥ năm hiện tại). */
const gmHeaderCycleRows = ref<GmKpiCycleOption[]>([])

const gmSelectableCycleOptions = computed(() =>
  gmHeaderCycleRows.value.map((r) => ({
    id: r.id,
    label: String(r.year),
  })),
)

/** `selectedCycleId` = UUID `kpi_cycles.id` (đồng bộ form tạo KPI). */
const selectedCycleId = ref<string>('')

function cycleYearFromCycleId(cycleId: string): number {
  const raw = String(cycleId ?? '').trim()
  if (!raw) return new Date().getFullYear()
  const row = gmHeaderCycleRows.value.find((c) => c.id === raw)
  if (row != null) return row.year
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
}

/** Đồng bộ `GmKpiEvaluationPanel` / template — năm dương lịch suy ra từ chu kỳ đang chọn. */
const gmEvaluationYear = computed(() => cycleYearFromCycleId(selectedCycleId.value))
provide('gmEvaluationYear', gmEvaluationYear)
/** UUID `kpi_cycles.id` — tab Đánh giá gọi API hub theo chu kỳ đang chọn. */
provide('gmSelectedCycleId', selectedCycleId)

/** KPI cá nhân GM: `GET /kpi/leader/kpi-info` ×2 (INDIVIDUAL + PROMOTION), user = JWT. Load khi mở tab «KPI cá nhân» / đổi chu kỳ trong tab đó. */
const gmPersonalKpiRows = ref<GmPersonalKpiRowMock[]>([])
const gmPersonalKpiLoading = ref(false)
/** Cache phản hồi leader — map `assignmentId` → assignment cho drawer minh chứng (tab KPI cá nhân). */
const gmPersonalKpiLeaderIndividual = ref<LeaderKpiInformationResponse | null>(null)
const gmPersonalKpiLeaderPromotion = ref<LeaderKpiInformationResponse | null>(null)

/** KPI Cycle chi tiết cho GmKpiDiagnosticsTable — dùng để tính mid-year progress. */
const gmDiagnosticsCycle = ref<KpiCycleResponse | null>(null)

watch(gmEvaluationYear, async (year) => {
  if (!Number.isFinite(year)) {
    gmDiagnosticsCycle.value = null
    return
  }
  try {
    gmDiagnosticsCycle.value = await kpiCycleService.getKpiCycleByYear(year) ?? null
  } catch {
    gmDiagnosticsCycle.value = null
  }
}, { immediate: true })

const gmPersonalKpiAssignmentsById = computed((): Record<string, LeaderKpiAssignment> => {
  const m: Record<string, LeaderKpiAssignment> = {}
  function ingest(resp: LeaderKpiInformationResponse | null) {
    if (!resp?.categories?.length) return
    for (const cat of resp.categories) {
      for (const a of cat.assignments ?? []) {
        const id = String(a.assignmentId ?? '').trim()
        if (id) m[id] = a
      }
    }
  }
  ingest(gmPersonalKpiLeaderIndividual.value)
  ingest(gmPersonalKpiLeaderPromotion.value)
  return m
})

async function loadGmPersonalKpiRows() {
  const y = gmEvaluationYear.value
  if (!Number.isFinite(y)) {
    gmPersonalKpiRows.value = []
    gmPersonalKpiLeaderIndividual.value = null
    gmPersonalKpiLeaderPromotion.value = null
    gmPersonalKpiLoading.value = false
    return
  }
  gmPersonalKpiLoading.value = true
  gmPersonalKpiLeaderIndividual.value = null
  gmPersonalKpiLeaderPromotion.value = null
  try {
    const settled = await Promise.allSettled([
      leaderKpiService.getKpiInfo(y, 'INDIVIDUAL'),
      leaderKpiService.getKpiInfo(y, 'PROMOTION'),
    ])
    const parts: Parameters<typeof mergeLeaderKpiInfoResponsesToGmPersonalRows>[0] = []
    const errs: string[] = []
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i]!
      const label = i === 0 ? 'INDIVIDUAL' : 'PROMOTION'
      if (s.status === 'fulfilled') {
        if (label === 'INDIVIDUAL') gmPersonalKpiLeaderIndividual.value = s.value
        else gmPersonalKpiLeaderPromotion.value = s.value
        parts.push({
          requestedType: label,
          response: s.value,
        })
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason)
        errs.push(`${label}: ${msg}`)
        parts.push({
          requestedType: label,
          response: null,
        })
      }
    }
    gmPersonalKpiRows.value = mergeLeaderKpiInfoResponsesToGmPersonalRows(parts)
    if (errs.length === 2) {
      pushGmNotification(errs.join(' · '), { variant: 'error', durationMs: 8000 })
      gmPersonalKpiRows.value = []
    } else if (errs.length === 1) {
      pushGmNotification(`Some personal KPI data failed to load — ${errs[0]}`, {
        variant: 'info',
        durationMs: 7000,
      })
    }
  } catch (e: unknown) {
    gmPersonalKpiRows.value = []
    gmPersonalKpiLeaderIndividual.value = null
    gmPersonalKpiLeaderPromotion.value = null
    pushGmNotification(e instanceof Error ? e.message : 'Could not load personal KPIs', {
      variant: 'error',
      durationMs: 8000,
    })
  } finally {
    gmPersonalKpiLoading.value = false
  }
}

/** KPI cá nhân (INDIVIDUAL + PROMOTION): fetch khi vào tab «KPI cá nhân» hoặc đổi chu kỳ trong tab đó — không prefetch khi đang xem Diagnostics. */
watch(
  [dashboardWorkspaceTab, gmEvaluationYear],
  ([tab]) => {
    if (tab !== 'personal') return
    void loadGmPersonalKpiRows()
  },
  { immediate: true },
)

/** Fallback timeline khi API process-timeline lỗi — không dùng mock theo chu kỳ. */
const activeSnapshot = computed(() => EMPTY_GM_WORKSPACE_CYCLE_SNAPSHOT)

const activeCycleLabel = computed(() => {
  const row = gmHeaderCycleRows.value.find((c) => c.id === selectedCycleId.value)
  if (row) return String(row.year)
  return gmSelectableCycleOptions.value.find((c) => c.id === selectedCycleId.value)?.label ?? ''
})

watch(
  gmHeaderCycleRows,
  (rows) => {
    if (!rows.length) return
    if (!rows.some((r) => r.id === selectedCycleId.value)) {
      selectedCycleId.value = rows[0]!.id
    }
  },
  { immediate: true },
)

function onGmEvaluationCyclesLoaded(rows: GmKpiCycleOption[]) {
  gmHeaderCycleRows.value = rows
}

/** Dropdown «Năm» ở header — tải ngay khi vào GM; không phụ thuộc mở drawer tạo KPI. */
async function loadGmHeaderEvaluationCycles() {
  try {
    const rows = await gmKpiService.getKpiCyclesForEvaluation()
    onGmEvaluationCyclesLoaded(Array.isArray(rows) ? rows : [])
  } catch {
    gmHeaderCycleRows.value = []
  }
}

onMounted(() => {
  void loadGmHeaderEvaluationCycles()
})

const investigatingKPI = ref<string | null>(null)
const selectedDept = ref<any>(null)

/** Process Timeline data từ API — null khi chưa load hoặc đang loading. */
const processTimelineData = ref<GmProcessTimelineApiResponse | null>(null)

async function loadProcessTimeline() {
  const cid = selectedCycleId.value
  if (!cid) return
  try {
    processTimelineData.value = await gmKpiService.getProcessTimeline(cid)
  } catch {
    // giữ null — GmProcessTimeline sẽ fallback về trạng thái mặc định (không có issue)
    processTimelineData.value = null
  }
}

watch(
  () => route.name,
  (name) => {
    if (name === 'gm-employee-evaluation' || name === 'gm-organization' || name === 'gm-kpi-template') {
      selectedDept.value = null
      investigatingKPI.value = null
    }
  },
)

const showKpiModal = ref(false)
const showCreateStrategicKpiModal = ref(false)
/** Dòng diagnostics đang sửa — truyền vào drawer tạo/sửa KPI. */
const strategicKpiEditTarget = ref<GmHierarchyKpi | null>(null)
const pendingGmFeedbackEdit = ref<{ assignmentId: string; kpiName: string } | null>(null)
const selectedMember = ref<GmMemberKpiDrawerProfile | null>(null)

// Phòng ban / member — `GET /kpi/gm/departments`; đổi `selectedCycleId` tải lại theo năm chu kỳ.
const departments = ref(structuredClone(EMPTY_GM_WORKSPACE_CYCLE_SNAPSHOT.departments))
const mockMembersDetails = ref(structuredClone(EMPTY_GM_WORKSPACE_CYCLE_SNAPSHOT.membersDetails))
const mockKPIItems = ref<GmModalKpiItemMock[]>([])

const useMockHub = import.meta.env.VITE_USE_MOCK === 'true'

async function loadGmWorkspaceDepartmentsFromApi() {
  const y = cycleYearFromCycleId(selectedCycleId.value)
  if (!Number.isFinite(y)) {
    departments.value = []
    mockMembersDetails.value = []
    return
  }
  try {
    const rows = await gmKpiService.listDepartments(y)
    departments.value = rows.map(mapGmDepartmentApiRowToWorkspaceMock)
    mockMembersDetails.value = departments.value.flatMap((d) => d.staffDetails ?? [])
  } catch {
    departments.value = []
    mockMembersDetails.value = []
  }
}
/** Tab Approved KPI — nguồn API (401/402/403); mock vẫn dùng snapshot `inactivePendingKpis`. */
const approvedKpiQueueApiRows = ref<GmHierarchyKpi[]>([])
const approvedKpiQueueLoading = ref(false)
/** Khóa nút drawer Approved KPI khi đang gọi API hàng loạt. */
const approvedKpiPanelBusy = ref(false)

/** KPI inactive chờ GM duyệt (tab Approved KPI) — mock hub; API dùng `approvedKpiQueueApiRows`. */
const inactivePendingKpisByCycle = ref<Record<string, GmHierarchyKpi[]>>({})

const inactivePendingRowsForSelectedCycle = computed(() => {
  if (!useMockHub) {
    return approvedKpiQueueApiRows.value.filter(
      (row) => Number(row.assignmentStatusCode) !== KPI_STATUS.FEEDBACK_IN_PROGRESS,
    )
  }
  return inactivePendingKpisByCycle.value[selectedCycleId.value] ?? []
})

/** KPI vừa tạo trên UI (mock) — theo `cycleId` trong form; ghép vào bảng diagnostics. */
const extraHierarchyKpisByCycle = ref<Record<string, GmHierarchyKpi[]>>({})

/** ID dòng diagnostics đã xóa trên UI (mock) — gồm `layout-global-kpi-*`, `kpi-created-*`, `dept-*-kpi-*`. */
const removedDiagnosticsKpiIdsByCycle = ref<Record<string, string[]>>({})

function markDiagnosticsKpiRemoved(cycleId: string, kpiId: string) {
  const cur = { ...removedDiagnosticsKpiIdsByCycle.value }
  const list = [...(cur[cycleId] ?? [])]
  if (!list.includes(kpiId)) list.push(kpiId)
  cur[cycleId] = list
  removedDiagnosticsKpiIdsByCycle.value = cur
}

/** Strategic KPIs Tracking & Diagnostics — nguồn `GET /kpi/gm/diagnostics-hierarchy` (+ KPI thêm local). */
const diagnosticsApiRows = ref<GmHierarchyKpi[]>([])
const diagnosticsApiLoading = ref(false)
const diagnosticsApiError = ref<string | null>(null)

async function loadStrategicDiagnosticsFromApi() {
  const y = cycleYearFromCycleId(selectedCycleId.value)
  if (!Number.isFinite(y)) return
  diagnosticsApiLoading.value = true
  diagnosticsApiError.value = null
  try {
    const data = await gmKpiService.getDiagnosticsHierarchy(y)
    diagnosticsApiRows.value = mapGmDiagnosticsApiKpisToHierarchyRows(data.kpis)
  } catch (e: unknown) {
    diagnosticsApiError.value = e instanceof Error ? e.message : 'Could not load strategic KPIs'
    diagnosticsApiRows.value = []
  } finally {
    diagnosticsApiLoading.value = false
  }
}

async function loadApprovedKpiQueueFromApi() {
  if (useMockHub) return
  const cid = String(selectedCycleId.value ?? '').trim()
  if (!cid) {
    approvedKpiQueueApiRows.value = []
    return
  }
  approvedKpiQueueLoading.value = true
  try {
    const items = await gmKpiService.getApprovedKpiQueue(cid)
    approvedKpiQueueApiRows.value = mapGmApprovedKpiQueueItemsToHierarchyRows(items)
  } catch (e: unknown) {
    approvedKpiQueueApiRows.value = []
    showGmToast(
      e instanceof Error ? e.message : 'Không tải danh sách Approved KPI',
      5000,
      'error',
    )
  } finally {
    approvedKpiQueueLoading.value = false
  }
}

/** Trang Organization — sau đổi thành viên / phòng ban, gọi để bảng Strategic KPIs diagnostics đồng bộ không cần F5. */
provide('gmRequestStrategicDiagnosticsReload', () => {
  void loadStrategicDiagnosticsFromApi()
})

const diagnosticsHierarchyRows = computed(() => {
  const id = selectedCycleId.value
  const removed = new Set(removedDiagnosticsKpiIdsByCycle.value[id] ?? [])
  const fromApi = diagnosticsApiRows.value.filter((r) => !removed.has(r.id))
  const extra = (extraHierarchyKpisByCycle.value[id] ?? []).filter((r) => !removed.has(r.id))
  return [...extra, ...fromApi]
})

function memberRowAwaitingGmFeedback(m: GmHierarchyMember): boolean {
  if (m.feedbackAwaitingGm === true) return true
  if (m.feedbackAwaitingGm === false) return false
  return Number(m.assignmentStatusCode) === 407 && String(m.feedbackNote ?? '').trim().length > 0
}

function hasPendingFeedbackInKpiRow(kpi: GmHierarchyKpi): boolean {
  for (const pm of kpi.pmOwners ?? []) {
    for (const m of pm.members ?? []) {
      if (memberRowAwaitingGmFeedback(m)) return true
    }
    for (const leader of pm.leaders ?? []) {
      const own = leader.leaderOwnRow
      if (own && memberRowAwaitingGmFeedback(own)) return true
      for (const m of leader.members ?? []) {
        if (memberRowAwaitingGmFeedback(m)) return true
      }
    }
  }
  return false
}

const gmDiagnosticsPendingFeedbackKpiCount = computed(() => {
  return diagnosticsHierarchyRows.value.filter((kpi) => hasPendingFeedbackInKpiRow(kpi)).length
})

const gmPmEvaluationPendingCount = ref(0)
function onGmPmEvaluationPendingCount(count: number) {
  const safe = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0
  gmPmEvaluationPendingCount.value = safe
}

function gmApprovedKpiMemberKey(k: GmHierarchyKpi): string {
  const uid = String(k.assigneeUserId ?? '').trim()
  if (uid) return `u:${uid}`
  return `n:${String(k.assigneeDisplayName ?? '').trim() || k.id}`
}

/** Badge tab Approved KPI: số member có KPI chờ GM (giống logic nhóm PM Request Approval). */
const gmApprovedKpiPendingCount = computed(() => {
  const rows = inactivePendingRowsForSelectedCycle.value
  return new Set(rows.map(gmApprovedKpiMemberKey)).size
})

const gmNotifications = useGmNotificationItems()

/** Thông báo dạng card góc phải (thay toast giữa màn hình). */
function showGmToast(msg: string, durationMs = 4000, variant: GmNotificationVariant = 'success') {
  pushGmNotification(msg, { durationMs, variant })
}

function gmNotifyShellClass(variant: GmNotificationVariant): string {
  const base =
    'pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border px-4 py-3 pr-10 shadow-lg backdrop-blur-sm'
  if (variant === 'error') return `${base} border-rose-200 bg-rose-50/95 text-rose-950`
  if (variant === 'info') return `${base} border-amber-200 bg-amber-50/95 text-amber-950`
  return `${base} border-emerald-200 bg-emerald-50/95 text-emerald-950`
}

function gmNotifyIconClass(variant: GmNotificationVariant): string {
  if (variant === 'error') {
    return 'fas fa-circle-exclamation mt-0.5 shrink-0 text-base text-rose-600'
  }
  if (variant === 'info') {
    return 'fas fa-circle-info mt-0.5 shrink-0 text-base text-amber-600'
  }
  return 'fas fa-circle-check mt-0.5 shrink-0 text-base text-emerald-600'
}

function applyOneStrategicKpiCreate(
  payload: Record<string, unknown>,
  opts?: { skipCreateToast?: boolean },
) {
  const cycleId = String(payload.cycleId ?? selectedCycleId.value)
  const editingId = String(payload.editingKpiId ?? '').trim()
  const prevInv = String(payload.previousInvestigateKpiName ?? '').trim()
  const title = String(payload.kpiName ?? '').trim() || 'KPI'
  const d0 = departments.value[0]

  if (editingId) {
    if (editingId.startsWith('kpi-created-')) {
      const row = buildHierarchyKpiFromStrategicCreatePayload(payload)
      if (d0) {
        row.investigateDeptId = d0.id
        row.investigateKpiName = title
      }
      const next = { ...extraHierarchyKpisByCycle.value }
      const list = [...(next[cycleId] ?? [])]
      const ix = list.findIndex((r) => r.id === editingId)
      if (ix >= 0) list[ix] = row
      next[cycleId] = list
      extraHierarchyKpisByCycle.value = next
      if (d0 && prevInv) {
        const j = d0.kpis.findIndex((k) => k.name.trim() === prevInv)
        if (j >= 0) {
          const patch = buildDeptKpiFromStrategicCreatePayload(payload)
          const cur = d0.kpis[j]!
          d0.kpis[j] = { ...cur, ...patch, name: title }
        }
      }
    } else if (editingId.startsWith('layout-global-kpi-') && d0 && prevInv) {
      const idx = d0.kpis.findIndex((k) => k.name.trim() === prevInv)
      if (idx >= 0) {
        const patch = buildDeptKpiFromStrategicCreatePayload(payload)
        for (const dept of departments.value) {
          const cur = dept.kpis[idx]
          if (!cur) continue
          dept.kpis[idx] = { ...cur, ...patch }
        }
      }
    } else if (editingId.startsWith('dept-')) {
      const deptId = String(payload.editingDeptId ?? '').trim()
      const dept = departments.value.find((d) => d.id === deptId)
      if (dept && prevInv) {
        const j = dept.kpis.findIndex((k) => k.name.trim() === prevInv)
        if (j >= 0) {
          const patch = buildDeptKpiFromStrategicCreatePayload(payload)
          const cur = dept.kpis[j]!
          dept.kpis[j] = { ...cur, ...patch }
        }
      }
    }
    if (!opts?.skipCreateToast) {
      showGmToast(`Đã cập nhật KPI «${title}».`, 4500)
    }
    return
  }

  const row = buildHierarchyKpiFromStrategicCreatePayload(payload)
  if (d0) {
    row.investigateDeptId = d0.id
    row.investigateKpiName = String(row.name ?? '').trim() || 'Strategic KPI'
  }
  const next = { ...extraHierarchyKpisByCycle.value }
  const list = next[cycleId] ? [...next[cycleId]] : []
  next[cycleId] = [row, ...list]
  extraHierarchyKpisByCycle.value = next

  if (cycleId === selectedCycleId.value && d0) {
    const dk = buildDeptKpiFromStrategicCreatePayload(payload)
    d0.kpis = [...d0.kpis, dk]
  }

  if (!opts?.skipCreateToast) {
    const yLabel = cycleYearFromCycleId(cycleId)
    showGmToast(`Đã tạo KPI «${title}» — năm ${yLabel}.`, 4500)
  }
}

async function onStrategicKpiSaved(payload: Record<string, unknown> | Record<string, unknown>[]) {
  const feedbackEdit = pendingGmFeedbackEdit.value
  const items = Array.isArray(payload) ? payload : [payload]
  if (items.length === 0) return

  const edits = items.filter((p) => String(p.editingKpiId ?? '').trim())
  const creates = items.filter((p) => !String(p.editingKpiId ?? '').trim())

  const mockEdits = edits.filter((p) => !String(p.editingKpiId).trim().startsWith('diag-kpi-'))
  const serverEdits = edits.filter((p) => String(p.editingKpiId).trim().startsWith('diag-kpi-'))

  for (const p of mockEdits) {
    applyOneStrategicKpiCreate(p, { skipCreateToast: mockEdits.length > 1 })
  }

  const editErrors: string[] = []
  for (const p of serverEdits) {
    const tid = String(p.editingKpiId).trim().replace(/^diag-kpi-/, '').trim()
    if (!tid) {
      editErrors.push('«KPI» không có id hợp lệ để cập nhật.')
      continue
    }
    try {
      const body = mapStrategicKpiCreatePayloadToApi(p)
      const res = await gmKpiService.updateStrategicKpi(tid, body)
      if (!res.success) {
        editErrors.push(String(res.message ?? `«${String(p.kpiName ?? 'KPI')}»`))
      }
    } catch (e: unknown) {
      editErrors.push(getApiErrorMessage(e, 'Lỗi không xác định'))
    }
  }

  const createErrors: string[] = []
  for (const p of creates) {
    try {
      const body = mapStrategicKpiCreatePayloadToApi(p)
      const res = await gmKpiService.createStrategicKpi(body)
      if (!res.success) {
        createErrors.push(String(res.message ?? `«${String(p.kpiName ?? 'KPI')}»`))
      }
    } catch (e: unknown) {
      createErrors.push(getApiErrorMessage(e, 'Lỗi không xác định'))
    }
  }

  try {
    await loadStrategicDiagnosticsFromApi()
  } catch {
    /* bảng vẫn có thể lệch */
  }
  if (dashboardWorkspaceTab.value === 'personal') {
    void loadGmPersonalKpiRows()
  }

  const allErr = [...editErrors, ...createErrors]
  if (allErr.length > 0) {
    showGmToast(allErr.slice(0, 2).join(' — ') + (allErr.length > 2 ? '…' : ''), 8000, 'error')
    return
  }

  if (feedbackEdit?.assignmentId && serverEdits.length > 0) {
    try {
      await gmKpiService.decideApprovedKpiQueue({
        cycleId: selectedCycleId.value,
        assignmentId: feedbackEdit.assignmentId,
        approve: true,
      })
      pendingGmFeedbackEdit.value = null
      await loadStrategicDiagnosticsFromApi()
      await loadApprovedKpiQueueFromApi()
      void loadProcessTimeline()
      showGmToast(`Đã duyệt Feedback «${feedbackEdit.kpiName}».`, 5000)
      return
    } catch (e: unknown) {
      showGmToast(getApiErrorMessage(e, 'Đã lưu KPI nhưng chưa đóng được feedback'), 8000, 'error')
      return
    }
  }

  if (mockEdits.length > 1 && serverEdits.length === 0 && creates.length === 0) {
    showGmToast(`Đã cập nhật ${mockEdits.length} KPI (chỉ trên bản xem trước).`, 5000, 'info')
    return
  }

  const okParts: string[] = []
  if (serverEdits.length > 0) {
    okParts.push(serverEdits.length === 1 ? 'Đã cập nhật KPI trên máy chủ' : `Đã cập nhật ${serverEdits.length} KPI`)
  }
  if (creates.length === 1) {
    const title = String(creates[0]!.kpiName ?? '').trim() || 'KPI'
    const yLabel = cycleYearFromCycleId(String(creates[0]!.cycleId ?? selectedCycleId.value))
    okParts.push(`Đã tạo «${title}» — năm ${yLabel}`)
  } else if (creates.length > 1) {
    const years = [
      ...new Set(creates.map((p) => String(cycleYearFromCycleId(String(p.cycleId ?? selectedCycleId.value))))),
    ]
    okParts.push(`Đã tạo ${creates.length} KPI${years.length ? ` — năm ${years.join(', ')}` : ''}`)
  }
  if (okParts.length > 0) {
    showGmToast(okParts.join(' · '), 5000)
    void loadProcessTimeline()
  }
}

function onDiagnosticsEditKpi(kpi: GmHierarchyKpi) {
  pendingGmFeedbackEdit.value = null
  strategicKpiEditTarget.value = kpi
  showCreateStrategicKpiModal.value = true
}

function openCreateStrategicKpiDrawer() {
  pendingGmFeedbackEdit.value = null
  strategicKpiEditTarget.value = null
  showCreateStrategicKpiModal.value = true
}

const deleteKpiModalOpen = ref(false)
const deleteKpiTarget = ref<GmHierarchyKpi | null>(null)
const deleteKpiSaving = ref(false)

function closeDeleteKpiModal() {
  deleteKpiModalOpen.value = false
  deleteKpiTarget.value = null
  deleteKpiSaving.value = false
}

function onDiagnosticsDeleteKpi(kpi: GmHierarchyKpi) {
  deleteKpiTarget.value = kpi
  deleteKpiModalOpen.value = true
}

async function confirmDeleteKpi() {
  const kpi = deleteKpiTarget.value
  if (!kpi || deleteKpiSaving.value) return
  const name = String(kpi.name ?? '').trim() || 'KPI'
  const cid = selectedCycleId.value
  const kid = String(kpi.id ?? '')

  if (kid.startsWith('diag-kpi-')) {
    const infoId = kid.slice('diag-kpi-'.length).trim()
    if (!infoId) {
      showGmToast('Không xác định được KPI trên máy chủ.', 5000, 'error')
      return
    }
    deleteKpiSaving.value = true
    try {
      const res = await gmKpiService.deleteStrategicKpi(infoId)
      if (!res.success) {
        showGmToast(String(res.message ?? 'Không xóa được KPI trên máy chủ.'), 7000, 'error')
        return
      }
      await loadStrategicDiagnosticsFromApi()
      void loadProcessTimeline()
      closeDeleteKpiModal()
      showGmToast(`Đã xóa KPI «${name}».`, 4500)
    } catch (e: unknown) {
      showGmToast(e instanceof Error ? e.message : 'Không xóa được KPI trên máy chủ.', 7000, 'error')
    } finally {
      deleteKpiSaving.value = false
    }
    return
  }

  if (kid.startsWith('kpi-created-')) {
    const next = { ...extraHierarchyKpisByCycle.value }
    next[cid] = (next[cid] ?? []).filter((r) => r.id !== kpi.id)
    extraHierarchyKpisByCycle.value = next
    const plain = String(kpi.investigateKpiName ?? kpi.name ?? '').trim() || name
    const d0 = departments.value[0]
    if (d0) {
      const kpis = [...d0.kpis]
      for (let i = kpis.length - 1; i >= 0; i--) {
        if (kpis[i]!.name.trim() === plain) {
          kpis.splice(i, 1)
          break
        }
      }
      d0.kpis = kpis
    }
    markDiagnosticsKpiRemoved(cid, kid)
  } else if (kid.startsWith('layout-global-kpi-')) {
    const templateName = String(kpi.investigateKpiName ?? '').trim()
    const d0 = departments.value[0]
    const idx =
      templateName && d0 ? d0.kpis.findIndex((k) => k.name.trim() === templateName) : -1
    if (idx >= 0) {
      for (const dept of departments.value) {
        dept.kpis = dept.kpis.filter((_, i) => i !== idx)
      }
    }
    markDiagnosticsKpiRemoved(cid, kid)
  } else if (kid.startsWith('dept-')) {
    const deptId = kpi.investigateDeptId
    const kn = String(kpi.investigateKpiName ?? '').trim()
    if (deptId && kn) {
      const dept = departments.value.find((d) => d.id === deptId)
      if (dept) dept.kpis = dept.kpis.filter((k) => k.name.trim() !== kn)
    }
    markDiagnosticsKpiRemoved(cid, kid)
  } else {
    markDiagnosticsKpiRemoved(cid, kid)
  }

  closeDeleteKpiModal()
  void loadProcessTimeline()
  showGmToast(`Đã xóa KPI «${name}».`, 4500)
}

watch(showCreateStrategicKpiModal, (v) => {
  if (!v) {
    strategicKpiEditTarget.value = null
    pendingGmFeedbackEdit.value = null
  }
})

onUnmounted(() => {
  clearAllGmNotifications()
})

watch(selectedCycleId, (id) => {
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [id]: [],
  }
  selectedDept.value = null
  investigatingKPI.value = null
  closeDeleteKpiModal()
  removedDiagnosticsKpiIdsByCycle.value = {}
  void loadGmWorkspaceDepartmentsFromApi()
  void loadStrategicDiagnosticsFromApi()
  void loadApprovedKpiQueueFromApi()
  void loadProcessTimeline()
}, { immediate: true })

async function onApproveInactiveKpi(kpi: GmHierarchyKpi) {
  const title = String(kpi.name ?? '').trim() || 'KPI'
  const cid = String(selectedCycleId.value ?? '').trim()
  const aid = String(kpi.assignmentId ?? '').trim()
  const isFeedbackRow = Number(kpi.assignmentStatusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
  if (!useMockHub && aid && isFeedbackRow && isGmDashboardRoute.value) {
    setDashboardWorkspaceTab('diagnostics')
    await nextTick()
    const opened = gmDiagnosticsTableRef.value?.openFeedbackDrawerByAssignmentId?.(aid) === true
    if (opened) return
  }
  if (!useMockHub && aid) {
    try {
      await gmKpiService.decideApprovedKpiQueue({ cycleId: cid, assignmentId: aid, approve: true })
      await loadApprovedKpiQueueFromApi()
      void loadProcessTimeline()
      showGmToast(
        isFeedbackRow
          ? `Đã xử lý feedback và trả KPI về chờ chấp nhận — «${title}».`
          : `Đã duyệt — «${title}».`,
        4500,
      )
    } catch (e: unknown) {
      showGmToast(e instanceof Error ? e.message : 'Không cập nhật được trạng thái', 5000, 'error')
    }
    return
  }
  const cur = inactivePendingKpisByCycle.value[cid] ?? []
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [cid]: cur.filter((r) => r.id !== kpi.id),
  }
  const d0 = departments.value[0]
  if (d0) {
    d0.kpis = [...d0.kpis, hierarchyInactiveKpiToDeptKpiMock(kpi)]
  }
  showGmToast(`Đã duyệt và kích hoạt KPI «${title}».`, 4500)
}

async function onApproveAllGmApprovedQueue(kpis: GmHierarchyKpi[]) {
  const targets = kpis.filter((k) => Number(k.assignmentStatusCode) === 403)
  if (!targets.length || approvedKpiPanelBusy.value) return
  const cid = String(selectedCycleId.value ?? '').trim()
  if (!cid || useMockHub) return
  approvedKpiPanelBusy.value = true
  let ok = 0
  try {
    for (const kpi of targets) {
      const aid = String(kpi.assignmentId ?? '').trim()
      if (!aid) continue
      try {
        await gmKpiService.decideApprovedKpiQueue({ cycleId: cid, assignmentId: aid, approve: true })
        ok += 1
      } catch (e) {
        console.error(e)
      }
    }
    if (ok > 0) {
      await loadApprovedKpiQueueFromApi()
      void loadProcessTimeline()
      showGmToast(
        ok === targets.length
          ? `Đã duyệt ${ok} KPI`
          : `Đã duyệt ${ok}/${targets.length} KPI. Một số dòng có thể đã thay đổi.`,
        5000,
      )
    }
  } finally {
    approvedKpiPanelBusy.value = false
  }
}

async function onRejectAllGmApprovedQueue(payload: { kpis: GmHierarchyKpi[]; reason: string }) {
  const reason = String(payload.reason ?? '').trim()
  const targets = payload.kpis.filter((k) => Number(k.assignmentStatusCode) === 403)
  if (!targets.length || approvedKpiPanelBusy.value) return
  const cid = String(selectedCycleId.value ?? '').trim()
  if (!cid || useMockHub) return
  approvedKpiPanelBusy.value = true
  let ok = 0
  try {
    for (const kpi of targets) {
      const aid = String(kpi.assignmentId ?? '').trim()
      if (!aid) continue
      try {
        await gmKpiService.decideApprovedKpiQueue({
          cycleId: cid,
          assignmentId: aid,
          approve: false,
          rejectReason: reason,
        })
        ok += 1
      } catch (e) {
        console.error(e)
      }
    }
    if (ok > 0) {
      await loadApprovedKpiQueueFromApi()
      void loadProcessTimeline()
      showGmToast(
        ok === targets.length
          ? `Đã từ chối ${ok} KPI (406).`
          : `Đã từ chối ${ok}/${targets.length} KPI.`,
        5000,
        'info',
      )
    }
  } finally {
    approvedKpiPanelBusy.value = false
  }
}

async function onRejectInactiveKpi(payload: { kpi: GmHierarchyKpi; reason: string }) {
  const kpi = payload.kpi
  const rejectReason = String(payload.reason ?? '').trim()
  const title = String(kpi.name ?? '').trim() || 'KPI'
  const cid = String(selectedCycleId.value ?? '').trim()
  const aid = String(kpi.assignmentId ?? '').trim()
  const isFeedbackRow = Number(kpi.assignmentStatusCode) === KPI_STATUS.FEEDBACK_IN_PROGRESS
  if (!useMockHub && aid && isFeedbackRow && isGmDashboardRoute.value) {
    setDashboardWorkspaceTab('diagnostics')
    await nextTick()
    const opened = gmDiagnosticsTableRef.value?.openFeedbackDrawerByAssignmentId?.(aid) === true
    if (opened) return
  }
  if (!useMockHub && aid) {
    try {
      await gmKpiService.decideApprovedKpiQueue({
        cycleId: cid,
        assignmentId: aid,
        approve: false,
        rejectReason,
      })
      await loadApprovedKpiQueueFromApi()
      void loadProcessTimeline()
      showGmToast(
        isFeedbackRow
          ? `Đã đóng feedback và trả KPI về chờ chấp nhận — «${title}».`
          : `Đã từ chối — «${title}».`,
        4500,
        'info',
      )
    } catch (e: unknown) {
      showGmToast(e instanceof Error ? e.message : 'Không cập nhật được trạng thái', 5000, 'error')
    }
    return
  }
  const cur = inactivePendingKpisByCycle.value[cid] ?? []
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [cid]: cur.filter((r) => r.id !== kpi.id),
  }
  showGmToast(`Đã từ chối đề xuất KPI «${title}».`, 4500, 'info')
}

async function onResolveDiagnosticsFeedback(payload: { assignmentId: string; approve: boolean; kpi?: GmHierarchyKpi }) {
  const aid = String(payload.assignmentId ?? '').trim()
  const cid = String(selectedCycleId.value ?? '').trim()
  const approve = payload.approve === true
  if (!aid || !cid) return
  if (approve && payload.kpi) {
    pendingGmFeedbackEdit.value = {
      assignmentId: aid,
      kpiName: String(payload.kpi.name ?? '').trim() || 'KPI',
    }
    strategicKpiEditTarget.value = payload.kpi
    showCreateStrategicKpiModal.value = true
    return
  }
  try {
    await gmKpiService.decideApprovedKpiQueue({ cycleId: cid, assignmentId: aid, approve })
    await loadStrategicDiagnosticsFromApi()
    await loadApprovedKpiQueueFromApi()
    void loadProcessTimeline()
    showGmToast(
      approve
        ? 'Đã duyệt Feedback'
        : 'Đã từ chối Feedback',
      4500,
      approve ? 'success' : 'info',
    )
  } catch (e: unknown) {
    showGmToast(e instanceof Error ? e.message : 'Không xử lý được Feedback', 6000, 'error')
  }
}

// ── Methods ───────────────────────────────────────────────────────────────────
function handleBack() {
  investigatingKPI.value = null
  selectedDept.value = null
  window.scrollTo(0, 0)
}

function openModal(member: GmInvestigationMember) {
  const dept = selectedDept.value as { name?: string } | null
  selectedMember.value = {
    name: member.name,
    rank: member.rank,
    leader: member.leader,
    departmentLabel: dept?.name ? String(dept.name).toUpperCase() : undefined,
  }
  showKpiModal.value = true
}
function closeModal() { showKpiModal.value = false; selectedMember.value = null }

</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-sm">
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <div class="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-1.5 rounded-lg shadow-md mr-3">
          <i class="fas fa-bullseye text-sm" />
        </div>
        <div>
          <span class="text-lg font-bold text-slate-900 tracking-tight">KPI System</span>
          <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider">GM Workspace</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p class="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Navigation</p>
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isNavItemActive(item.to)
            ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isNavItemActive(item.to) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'">
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span v-if="isNavItemActive(item.to)" class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        </RouterLink>

        <p class="px-2 pt-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Settings
        </p>
        <RouterLink v-for="item in settingsNavItems" :key="item.to" :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isNavItemActive(item.to)
            ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isNavItemActive(item.to) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'">
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span v-if="isNavItemActive(item.to)" class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        </RouterLink>
      </nav>

      <!-- Logout -->
      <div class="p-4 border-t border-slate-200">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-medium"
          @click="logout">
          <span class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <i class="fas fa-sign-out-alt text-xs" />
          </span>
          Đăng xuất
        </button>
      </div>
    </aside>

    <!-- Main: anchor để modal/drawer GM chỉ phủ cột nội dung (không xám sidebar) -->
    <main class="flex h-screen min-h-0 min-w-0 flex-1 flex-col">
      <div id="gm-main-modal-anchor" class="relative flex min-h-0 flex-1 flex-col">
        <header
          class="z-10 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2 sm:px-8">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-widest text-blue-600">{{ headerConfig.category }}</p>
            <h2 class="text-xl font-bold text-slate-800">{{ headerConfig.title }}</h2>
            <p v-if="activeCycleLabel && !isGmSettingsRoute" class="mt-0.5 text-xs font-medium text-slate-500">
              Đang xem: <span class="text-slate-700">{{ activeCycleLabel }}</span>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 sm:gap-4">
            <div v-if="!isGmSettingsRoute" class="flex items-center gap-2">
              <label for="gm-year-select" class="whitespace-nowrap text-xs font-bold text-slate-500">Năm</label>
              <div class="relative">
                <select id="gm-year-select" v-model="selectedCycleId"
                  class="min-w-[11rem] cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option v-for="c in gmSelectableCycleOptions" :key="c.id" :value="c.id">
                    {{ c.label }}
                  </option>
                </select>
                <i
                  class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
              </div>
            </div>
            <button v-if="!isGmEvaluationRoute && !isGmSettingsRoute" type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              @click="openCreateStrategicKpiDrawer">
              <i class="fas fa-plus text-xs" />
              Create Strategic KPI
            </button>
            <button v-else-if="isGmCreateDepartmentRoute" type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              @click="gmOrgSectionDrawer.open()">
              <i class="fas fa-plus text-xs" />
              Thêm phòng ban mới
            </button>
            <button v-else-if="isGmKpiTemplateRoute" type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
              @click="gmKpiTemplateLibrary?.openCreate?.()">
              <i class="fas fa-plus text-xs" />
              Tạo Bộ Template
            </button>
            <div class="text-right pl-4 border-l border-slate-200">
              <p class="text-sm font-bold text-slate-800">{{ user?.name ?? '–' }}</p>
              <p class="text-xs text-slate-500">{{ user?.rank ?? user?.role }}</p>
            </div>
          </div>
        </header>

        <!-- CONTENT: đánh giá theo PM (nested route) | workspace chiến lược -->
        <div class="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50/50">
          <RouterView v-if="isGmEvaluationRoute || isGmSettingsRoute" />

          <!-- VIEW 1: OVERVIEW — dưới timeline: tab (dashboard) hoặc chỉ diagnostics -->
          <div v-else-if="!selectedDept" class="space-y-4 p-3 sm:p-4 lg:p-6">
            <GmProcessTimeline :mid-year-issues="processTimelineData?.midYear ?? activeSnapshot.midYearIssues"
              :setting-issues="processTimelineData?.setting ?? activeSnapshot.settingIssues"
              :year-end-issues="processTimelineData?.yearEnd ?? activeSnapshot.yearEndIssues"
              :year="gmEvaluationYear" />

            <template v-if="isGmDashboardRoute">
              <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <!-- Tab kiểu gọn, canh trái + gạch dưới (tham khảo Personal KPI) -->
                <div class="border-b border-slate-200 bg-white px-4 pt-2 sm:px-5" role="tablist"
                  aria-label="GM workspace below timeline">
                  <nav class="flex flex-wrap items-end gap-1 sm:gap-2">
                    <button type="button" role="tab" :aria-selected="dashboardWorkspaceTab === 'diagnostics'"
                      class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                      :class="dashboardWorkspaceTab === 'diagnostics'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                        " @click="setDashboardWorkspaceTab('diagnostics')">
                      <span
                        class="flex max-w-[11rem] items-center gap-2 leading-snug sm:max-w-none sm:whitespace-nowrap">
                        <i class="fas fa-table-list shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                        Strategic KPIs Tracking &amp; Diagnostics
                        <span
                          v-if="gmDiagnosticsPendingFeedbackKpiCount > 0"
                          class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                          {{ gmDiagnosticsPendingFeedbackKpiCount }}
                        </span>
                      </span>
                    </button>
                    <button type="button" role="tab" :aria-selected="dashboardWorkspaceTab === 'pm-eval'"
                      class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                      :class="dashboardWorkspaceTab === 'pm-eval'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                        " @click="setDashboardWorkspaceTab('pm-eval')">
                      <span class="flex items-center gap-2 sm:whitespace-nowrap">
                        <i class="fas fa-user-tie shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                        Evaluation
                        <span
                          v-if="gmPmEvaluationPendingCount > 0"
                          class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                          {{ gmPmEvaluationPendingCount }}
                        </span>
                      </span>
                    </button>
                    <button type="button" role="tab" :aria-selected="dashboardWorkspaceTab === 'approved-kpi'"
                      class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                      :class="dashboardWorkspaceTab === 'approved-kpi'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                        " @click="setDashboardWorkspaceTab('approved-kpi')">
                      <span class="flex items-center gap-2 sm:whitespace-nowrap">
                        <i class="fas fa-clipboard-check shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                        Approved KPI
                        <span
                          v-if="gmApprovedKpiPendingCount > 0"
                          class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                          {{ gmApprovedKpiPendingCount }}
                        </span>
                      </span>
                    </button>
                    <button type="button" role="tab" :aria-selected="dashboardWorkspaceTab === 'personal'"
                      class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                      :class="dashboardWorkspaceTab === 'personal'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                        " @click="setDashboardWorkspaceTab('personal')">
                      <span class="flex items-center gap-2 sm:whitespace-nowrap">
                        <i class="fas fa-bullseye shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                        Personal KPI
                      </span>
                    </button>
                  </nav>
                </div>

                <div class="min-h-0">
                  <div v-show="dashboardWorkspaceTab === 'diagnostics'" class="p-3 sm:p-4 lg:p-5">
                    <p v-if="diagnosticsApiLoading" class="mb-3 text-xs font-medium text-slate-500" role="status">
                      Loading strategic KPIs…
                    </p>
                    <p v-else-if="diagnosticsApiError"
                      class="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
                      role="alert">
                      {{ diagnosticsApiError }}
                    </p>
                    <GmKpiDiagnosticsTable
                      ref="gmDiagnosticsTableRef"
                      :rows="diagnosticsHierarchyRows"
                      :kpi-cycle="gmDiagnosticsCycle"
                      @edit-kpi="onDiagnosticsEditKpi"
                      @delete-kpi="onDiagnosticsDeleteKpi"
                      @resolve-feedback="onResolveDiagnosticsFeedback"
                    />
                  </div>
                  <div v-show="dashboardWorkspaceTab === 'pm-eval'" class="p-3 sm:p-4 lg:p-5">
                    <GmPmEvaluationWorkspace
                      @pending-count="onGmPmEvaluationPendingCount"
                      @timeline-refresh="loadProcessTimeline"
                    />
                  </div>
                  <div v-show="dashboardWorkspaceTab === 'approved-kpi'" class="p-3 sm:p-4 lg:p-5">
                    <p v-if="!useMockHub && approvedKpiQueueLoading" class="mb-3 text-xs font-medium text-slate-500"
                      role="status">
                      Loading approved KPI…
                    </p>
                    <GmApprovedKpiPanel
                      :rows="inactivePendingRowsForSelectedCycle"
                      :action-busy="approvedKpiPanelBusy"
                      @approve-kpi="onApproveInactiveKpi"
                      @reject-kpi="onRejectInactiveKpi"
                      @approve-all-kpis="onApproveAllGmApprovedQueue"
                      @reject-all-kpis="onRejectAllGmApprovedQueue"
                    />
                  </div>
                  <div v-show="dashboardWorkspaceTab === 'personal'" class="p-3 sm:p-4 lg:p-5">
                    <GmGmPersonalKpiPanel :year-id="String(gmEvaluationYear)" :cycle-id="selectedCycleId"
                      :rows="gmPersonalKpiRows" :loading="gmPersonalKpiLoading"
                      :assignments-by-id="gmPersonalKpiAssignmentsById"
                      @sheet-saved="
                        () => {
                          void loadGmPersonalKpiRows()
                          void loadProcessTimeline()
                        }
                      "
                    />
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="p-3 sm:p-4 lg:p-5">
              <p v-if="diagnosticsApiLoading" class="mb-3 text-xs font-medium text-slate-500" role="status">
                Loading strategic KPIs…
              </p>
              <p v-else-if="diagnosticsApiError"
                class="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
                role="alert">
                {{ diagnosticsApiError }}
              </p>
              <GmKpiDiagnosticsTable
                ref="gmDiagnosticsTableRef"
                :rows="diagnosticsHierarchyRows"
                :kpi-cycle="gmDiagnosticsCycle"
                @edit-kpi="onDiagnosticsEditKpi"
                @delete-kpi="onDiagnosticsDeleteKpi"
                @resolve-feedback="onResolveDiagnosticsFeedback"
              />
            </div>
          </div>

          <!-- VIEW 2: chi tiết department / Investigate -->
          <GmDepartmentInvestigation v-else-if="selectedDept" :department="selectedDept"
            :investigating-kpi="investigatingKPI" :members="mockMembersDetails" @back="handleBack"
            @view-kpi="openModal" />

          <GmCreateStrategicKpiModal v-model="showCreateStrategicKpiModal" :cycle-id="selectedCycleId"
            :edit-initial="strategicKpiEditTarget"
            :feedback-assignment-id="pendingGmFeedbackEdit?.assignmentId ?? null"
            :prefetched-evaluation-cycles="gmHeaderCycleRows"
            @evaluation-cycles-loaded="onGmEvaluationCyclesLoaded" @saved="onStrategicKpiSaved" />

          <Teleport to="body">
            <div
              class="pointer-events-none fixed right-4 top-20 z-[320] flex max-h-[calc(100vh-5rem)] w-[min(100vw-2rem,22rem)] flex-col items-end gap-2 overflow-y-auto overflow-x-hidden pb-2 pl-2 pt-1 sm:right-5 sm:top-24"
              aria-live="polite">
              <TransitionGroup name="gm-notify" tag="div" class="relative flex w-full flex-col gap-2">
                <article v-for="n in gmNotifications" :key="n.id" role="status" :class="gmNotifyShellClass(n.variant)">
                  <i :class="gmNotifyIconClass(n.variant)" aria-hidden="true" />
                  <p class="min-w-0 flex-1 text-xs font-semibold leading-snug">{{ n.message }}</p>
                  <button type="button"
                    class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-800"
                    aria-label="Đóng thông báo" @click.stop="dismissGmNotification(n.id)">
                    <i class="fas fa-times text-[11px]" aria-hidden="true" />
                  </button>
                </article>
              </TransitionGroup>
            </div>
          </Teleport>

          <Teleport to="body">
            <Transition name="gm-delete-kpi-modal">
              <div v-if="deleteKpiModalOpen && deleteKpiTarget"
                class="gm-delete-kpi-modal-root fixed inset-0 z-[160] flex items-center justify-center p-4"
                role="dialog" aria-modal="true" aria-labelledby="gm-delete-kpi-title">
                <div
                  class="gm-delete-kpi-modal-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
                  @click="closeDeleteKpiModal" />
                <div
                  class="gm-delete-kpi-modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div class="border-b border-rose-100 bg-rose-50/80 px-5 py-4">
                    <h3 id="gm-delete-kpi-title" class="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <i class="fas fa-triangle-exclamation text-rose-600" aria-hidden="true" />
                      Xóa KPI?
                    </h3>
                    <p class="mt-2 text-xs font-medium leading-relaxed text-slate-600">
                      KPI
                      <span class="font-bold text-slate-800">«{{ deleteKpiTarget.name }}»</span>
                      sẽ bị gỡ khỏi bảng Strategic KPIs Tracking và Diagnostics. Thao tác này không thể hoàn tác.
                    </p>
                  </div>
                  <div class="flex justify-end gap-2 bg-white px-5 py-4">
                    <button type="button"
                      class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                      :disabled="deleteKpiSaving" @click="closeDeleteKpiModal">
                      Hủy
                    </button>
                    <button type="button"
                      class="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
                      :disabled="deleteKpiSaving" @click="confirmDeleteKpi">
                      {{ deleteKpiSaving ? 'Đang xóa…' : 'Xác nhận xóa' }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>

          <GmMemberKpiDrawer :open="showKpiModal && !!selectedMember" :member="selectedMember" :items="mockKPIItems"
            @close="closeModal" />

        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.gm-notify-move,
.gm-notify-enter-active,
.gm-notify-leave-active {
  transition:
    opacity 0.26s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.gm-notify-enter-from,
.gm-notify-leave-to {
  opacity: 0;
  transform: translateX(110%);
}

.gm-notify-leave-active {
  position: absolute;
  right: 0;
  width: 100%;
}

.gm-delete-kpi-modal-enter-active,
.gm-delete-kpi-modal-leave-active {
  transition-duration: 0.26s;
}

.gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-backdrop,
.gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-backdrop {
  transition: opacity 0.26s ease;
}

.gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-panel,
.gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-panel {
  transition:
    opacity 0.26s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.gm-delete-kpi-modal-enter-from .gm-delete-kpi-modal-backdrop,
.gm-delete-kpi-modal-leave-to .gm-delete-kpi-modal-backdrop {
  opacity: 0;
}

.gm-delete-kpi-modal-enter-to .gm-delete-kpi-modal-backdrop,
.gm-delete-kpi-modal-leave-from .gm-delete-kpi-modal-backdrop {
  opacity: 1;
}

.gm-delete-kpi-modal-enter-from .gm-delete-kpi-modal-panel,
.gm-delete-kpi-modal-leave-to .gm-delete-kpi-modal-panel {
  opacity: 0;
  transform: scale(0.94) translateY(14px);
}

.gm-delete-kpi-modal-enter-to .gm-delete-kpi-modal-panel,
.gm-delete-kpi-modal-leave-from .gm-delete-kpi-modal-panel {
  opacity: 1;
  transform: scale(1) translateY(0);
}

@media (prefers-reduced-motion: reduce) {

  .gm-notify-move,
  .gm-notify-enter-active,
  .gm-notify-leave-active,
  .gm-delete-kpi-modal-enter-active,
  .gm-delete-kpi-modal-leave-active,
  .gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-backdrop,
  .gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-backdrop,
  .gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-panel,
  .gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-panel {
    transition-duration: 0.01ms !important;
  }
}

.overflow-x-auto::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}

.overflow-x-auto::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}
</style>
