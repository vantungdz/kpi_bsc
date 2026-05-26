<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject, provide } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth.store'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import type { PmMemberKpiApprovalItem } from '@/services/modules/kpi-pm.service'
import { strategicKpiKindFromTypeCode } from '@/utils/strategicKpiTypeCodes'
import type { GmKpiCycleOption } from '@/types/gm-kpi-cycle'
import type {
  GmMidYearIssuesData,
  GmPmKpiRolloutPayload,
  GmModalKpiItemMock,
  GmStrategicKpiKind,
} from '@/types/gm-workspace'
import type { PmDashboardInitResponse } from '@/types/kpi'
import type { GmProcessTimelineApiResponse, GmPromotionProcessTimelineApiResponse } from '@/services/modules/kpi-gm.service'
import { collectPromotionCycleIdFromKpiRows } from '@/utils/promotion-timeline'
import {
  pmHeaderShowsPromotionCycleKey,
  pmSelectedPromotionCycleIdKey,
  pmTeamReviewScopeKey,
  pmDepartmentSubTabKey,
  type PmTeamReviewScope,
  type PmDepartmentSubTab,
} from '@/utils/pmLayoutPromotionCycle'
import {
  formatPmPortfolioActualCell,
  parsePmPortfolioEvidenceString,
  pmPortfolioActualDisplayMode,
} from '@/utils/memberKpiHelpers'
import { formatKpiTargetWithUnit, kpiUnitCodeToFormUnit } from '@/utils/kpiUnitCodes'
import { extractRawInputFromApiTargetDescription } from '@/utils/kpiScoringRulesDsl'
import { countPmEvaluationSubjectsInHierarchy } from '@/utils/pmEvaluationSubject'
import { canSupervisorViewMemberSelfEvaluation } from '@/utils/memberEvaluationVisibility'
import PmPersonalKpiTab from '@/components/pm/tabs/PmPersonalKpiTab.vue'
import PmTeamMembersTab from '@/components/pm/tabs/PmTeamMembersTab.vue'
import PmRequestsTab from '@/components/pm/tabs/PmRequestsTab.vue'
import PmAssignKpiDrawer from '@/components/pm/drawers/PmAssignKpiDrawer.vue'
import PmMemberDetailDrawer from '@/components/pm/drawers/PmMemberDetailDrawer.vue'
import PmRequestDetailDrawer from '@/components/pm/drawers/PmRequestDetailDrawer.vue'
import GmProcessTimeline from '@/components/gm/GmProcessTimeline.vue'
import PromotionProcessTimeline from '@/components/gm/PromotionProcessTimeline.vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'
import { shouldCollapseKpiProcessTimelineToYearEndOnly } from '@/utils/common'

const toast = useToast()
const route = useRoute()
const activeTab = ref('department')
const activePersonalPromoSubTab = ref<'personal' | 'promotion'>('personal')
const pmFeedbackPendingByScope = ref<{ portfolio: number; promotion: number }>({
  portfolio: 0,
  promotion: 0,
})

function onPmFeedbackPendingCount(payload: {
  scope: 'portfolio' | 'promotion' | 'department'
  count: number
}) {
  const scope = payload?.scope
  if (scope !== 'portfolio' && scope !== 'promotion') return
  const count = Number.isFinite(Number(payload?.count)) ? Math.max(0, Number(payload.count)) : 0
  pmFeedbackPendingByScope.value = {
    ...pmFeedbackPendingByScope.value,
    [scope]: count,
  }
}

type PmSupervisorDraft = { main: string; promo: string }

const memberComments = ref<Record<string, PmSupervisorDraft>>({})
const memberKpisCache = ref<Record<string, any[]>>({})

// Control refresh of PM Portfolio tab after actions in drawers
const personalKpiKey = ref(0)
const selectedYear = ref(new Date().getFullYear())
const cycleOptions = ref<GmKpiCycleOption[]>([])
const approvalYear = computed(() => selectedYear.value)
const selectedYearReadonly = computed(() => {
  const cycle = cycleOptions.value.find((row) => Number(row.year) === Number(selectedYear.value))
  if (cycle) return Number(cycle.statusCode) !== 201
  return selectedYear.value !== new Date().getFullYear()
})
/** Tăng để Team Review refetch hierarchy sau khi gửi đánh giá (không reload trang). */
const teamReviewReloadNonce = ref(0)

function syncYearFromRoute() {
  const n = Number(route.query.year)
  selectedYear.value = Number.isFinite(n) && n > 0 ? n : new Date().getFullYear()
}

async function refreshPmDashboardForYear() {
  memberComments.value = {}
  memberKpisCache.value = {}
  approvalRawItems.value = []
  processTimelineData.value = null
  pmPortfolioInit.value = null
  rightPanelVisible.value = false
  rightPanelMode.value = 'none'
  activeItem.value = null
  pmFeedbackPendingByScope.value = { portfolio: 0, promotion: 0 }
  personalKpiKey.value += 1
  teamReviewReloadNonce.value += 1
  await Promise.all([
    loadPmPortfolioTimelineContext(),
    loadProcessTimeline(),
    loadApprovalRequests(),
    loadTeamReviewPendingCount(),
  ])
}

async function loadCycleOptions() {
  try {
    const rows = await pmKpiService.getKpiCyclesForHeader()
    cycleOptions.value = Array.isArray(rows) ? rows : []
  } catch (error) {
    console.error('Failed to load PM KPI cycles', error)
    cycleOptions.value = []
  }
}

/** Số member đang chờ PM đánh giá (501 / 601) — badge tab Team Review + đồng bộ khi mở tab. */
const teamPmEvaluationPendingCount = ref(0)

async function loadTeamReviewPendingCount() {
  try {
    const response = await pmKpiService.getTeamHierarchy(String(approvalYear.value))
    const roots = Array.isArray(response) ? response : []
    teamPmEvaluationPendingCount.value = countPmEvaluationSubjectsInHierarchy(roots)
  } catch {
    teamPmEvaluationPendingCount.value = 0
  }
}

function onTeamPendingPmEvaluationCount(count: number) {
  const n = Number(count)
  teamPmEvaluationPendingCount.value = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

const approvalLoading = ref(false)
const approvalSubmitting = ref(false)

/** Fallback khi API timeline chưa load hoặc lỗi — khớp prop bắt buộc của GmProcessTimeline. */
const EMPTY_PM_PROCESS_TIMELINE_MID: GmMidYearIssuesData = {
  hasOpenIssues: false,
  pendingKpisLine: '',
  popoverTitle: '',
  issueGroups: [],
}

const processTimelineData = ref<GmProcessTimelineApiResponse | null>(null)
const promotionProcessTimelineData = ref<GmPromotionProcessTimelineApiResponse | null>(null)
const promotionTimelineLoading = ref(false)

const pmHeaderShowsPromotionCycle = inject<Ref<boolean>>(
  pmHeaderShowsPromotionCycleKey,
  ref(false),
)
const selectedPromotionCycleId = inject<Ref<string>>(
  pmSelectedPromotionCycleIdKey,
  ref(''),
)
const pmPromotionCycleId = computed(() => {
  const id = String(selectedPromotionCycleId.value ?? '').trim()
  return id || null
})

/** Sub-tab KPI Personal / KPI Promotion trong Team Hierarchy & Performance. */
const pmTeamReviewScope = ref<PmTeamReviewScope>('portfolio')
provide(pmTeamReviewScopeKey, pmTeamReviewScope)

/** Sub-tab Individual / Promotion trong KPI Department (`PmPersonalKpiTab`). */
const pmDepartmentSubTab = ref<PmDepartmentSubTab>('individual')
provide(pmDepartmentSubTabKey, pmDepartmentSubTab)

const showPmPromotionTimeline = computed(
  () =>
    (activeTab.value === 'personal_promotion' &&
      activePersonalPromoSubTab.value === 'promotion') ||
    (activeTab.value === 'team' && pmTeamReviewScope.value === 'promotion') ||
    (activeTab.value === 'department' && pmDepartmentSubTab.value === 'promotion'),
)

/** Portfolio + Promotion KPI của PM (khớp Leader: ẩn timeline khi chưa có KPI). */
const pmPortfolioInit = ref<{
  accountCreatedAt: string | null
  kpiCount: number
  midYearStart: string | null
} | null>(null)

async function loadPmPortfolioTimelineContext() {
  try {
    const data: PmDashboardInitResponse = await pmKpiService.getInitialization(String(approvalYear.value))
    const rows = Array.isArray(data?.kpis) ? data.kpis : []
    pmPortfolioInit.value = {
      accountCreatedAt: data?.accountCreatedAt ?? null,
      kpiCount: rows.length,
      midYearStart: data?.kpiCycle?.midYearStart ?? null,
    }
  } catch (e) {
    console.error(e)
    pmPortfolioInit.value = null
  }
}

const hasAnyPmKpi = computed(() => (pmPortfolioInit.value?.kpiCount ?? 0) > 0)

/** Onboard từ mid_year_start → timeline 2 mốc (KPI Setting + Year-End). */
const pmTimelineYearEndOnly = computed(() =>
  shouldCollapseKpiProcessTimelineToYearEndOnly(
    pmPortfolioInit.value?.accountCreatedAt,
    pmPortfolioInit.value?.midYearStart,
  ),
)

/** Gợi ý cycle mặc định từ KPI promotion đã gán (khi header chưa chọn). */
async function syncDefaultPromotionCycleFromPortfolio() {
  if (String(selectedPromotionCycleId.value ?? '').trim()) return
  try {
    const data: PmDashboardInitResponse = await pmKpiService.getInitialization(
      String(approvalYear.value),
      'promotion',
    )
    const fromRows = collectPromotionCycleIdFromKpiRows(data.kpis)
    if (fromRows) selectedPromotionCycleId.value = fromRows
  } catch (e) {
    console.error(e)
  }
}

async function loadPromotionProcessTimeline() {
  const id = pmPromotionCycleId.value
  if (!id) {
    promotionProcessTimelineData.value = null
    return
  }
  const expected = id
  promotionTimelineLoading.value = true
  try {
    const data = await pmKpiService.getPromotionProcessTimeline(expected)
    if (pmPromotionCycleId.value !== expected) return
    promotionProcessTimelineData.value = data
  } catch (e) {
    console.error(e)
    if (pmPromotionCycleId.value !== expected) return
    promotionProcessTimelineData.value = null
  } finally {
    if (pmPromotionCycleId.value === expected) {
      promotionTimelineLoading.value = false
    }
  }
}

async function loadProcessTimeline() {
  try {
    processTimelineData.value = await pmKpiService.getProcessTimeline(approvalYear.value)
  } catch (e) {
    console.error(e)
    processTimelineData.value = null
  }
}

function refreshPmProcessTimeline() {
  void loadPmPortfolioTimelineContext()
  void loadProcessTimeline()
  if (showPmPromotionTimeline.value) {
    void syncDefaultPromotionCycleFromPortfolio().then(() => loadPromotionProcessTimeline())
  }
}

type PmRequestUiRow = {
  id: string
  userId: string
  user: string
  avatar: string
  type: string
  kpiType: GmStrategicKpiKind
  kpiName: string
  oldValue: string | null
  newValue: string
  reason: string
  status: string
  date: string
  memberTarget: string
  bscAspect: string
  weightLabel: string
  unitLabel: string
  calculationMethodLabel: string
  scoringRuleText: string
  creatorRoleCode?: string
  assignmentTargetValue?: number | null
  baselineTargetValue?: number | null
  baselineScoringDescription?: string | null
  unitCode?: number | null
  targetChanged?: boolean
  scoringChanged?: boolean
  assigneeHasEdits?: boolean
}

/** Dữ liệu gốc từ API — nhóm theo member ở tab Request Approval. */
const approvalRawItems = ref<PmMemberKpiApprovalItem[]>([])

type PmApprovalMemberSummary = {
  userId: string
  userFullName: string
  avatar: string
  pendingCount: number
  latestDateLabel: string
  /** roles.code (uppercase), đã tách và bỏ trùng. */
  roleCodes: string[]
}

/** BE trả user_role_codes nối bằng |||. */
function parseUserRoleCodes(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return []
  const parts = String(raw)
    .split('|||')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

function roleCodesFromApprovalItems(items: PmMemberKpiApprovalItem[]): string[] {
  for (const it of items) {
    const parsed = parseUserRoleCodes(it.userRoleCodes)
    if (parsed.length) return parsed
  }
  return []
}

function maxRequestedAtIso(items: PmMemberKpiApprovalItem[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const i of items) {
    const t = i.requestedAt
    if (t == null || String(t).trim() === '') continue
    const s = String(t)
    const ms = Date.parse(s)
    if (!Number.isFinite(ms)) continue
    if (ms >= bestMs) {
      bestMs = ms
      best = s
    }
  }
  return best
}

const approvalMemberSummaries = computed<PmApprovalMemberSummary[]>(() => {
  const map = new Map<string, { userId: string; userFullName: string; items: PmMemberKpiApprovalItem[] }>()
  for (const r of approvalRawItems.value) {
    const uid = String(r.userId ?? '').trim()
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, userFullName: r.userFullName ?? '—', items: [] })
    }
    map.get(uid)!.items.push(r)
  }
  const rows: PmApprovalMemberSummary[] = []
  for (const m of map.values()) {
    rows.push({
      userId: m.userId,
      userFullName: m.userFullName,
      avatar: initialsFromName(m.userFullName),
      pendingCount: m.items.length,
      latestDateLabel: formatRequestedAt(maxRequestedAtIso(m.items)),
      roleCodes: roleCodesFromApprovalItems(m.items),
    })
  }
  rows.sort((a, b) => b.pendingCount - a.pendingCount || a.userFullName.localeCompare(b.userFullName, 'vi'))
  return rows
})

/** Số member có ít nhất một KPI chờ duyệt (402) — badge tab Request Approval. */
const pendingRequestsCount = computed(() => approvalMemberSummaries.value.length)

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRequestedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function calcMethodLabel(ruleCode: number | null | undefined, typeCode: number | null | undefined): string {
  const r = Number(ruleCode)
  const t = Number(typeCode)
  if (r === 801) return 'Total Plan/Actual'
  if (r === 802 && t === 701) return 'Average Actual / Plan'
  if (r === 802 && t === 702) return 'Average Plan / Actual'
  if (r === 802) return 'Average Plan/Actual (%)'
  if (r === 803) return 'Manual input by comment'
  return '—'
}

function scoringRulesText(targetDescription: string | null | undefined): string {
  const fromApi = extractRawInputFromApiTargetDescription(targetDescription ?? '')
  if (fromApi.trim()) return fromApi.trim()
  const raw = String(targetDescription ?? '').trim()
  return raw || '—'
}

function mapApprovalToUi(r: PmMemberKpiApprovalItem): PmRequestUiRow {
  const w = r.weight != null ? Number(r.weight) : null
  const weightLabel = w != null && Number.isFinite(w) ? `${w}% weight` : '—'
  const newValueParts = [weightLabel]
  if (r.categoryName) newValueParts.push(r.categoryName)
  const just = (r.justification && r.justification.trim()) || ''
  const target = (r.targetDescription && r.targetDescription.trim()) || ''
  const name = r.userFullName ?? '—'
  const unitLabel = r.unitCode != null ? kpiUnitCodeToFormUnit(r.unitCode) : '—'
  const memberTarget = formatKpiTargetWithUnit(
    r.targetValue != null ? String(r.targetValue) : '-',
    r.unitCode ?? undefined,
  )
  return {
    id: r.assignmentId,
    userId: String(r.userId ?? ''),
    user: name,
    avatar: initialsFromName(name),
    type: 'CREATE_KPI',
    kpiType: strategicKpiKindFromTypeCode(r.typeCode),
    kpiName: r.kpiName ?? '—',
    oldValue: null,
    newValue: newValueParts.join(' · '),
    reason: just || target || '—',
    status: 'PENDING',
    date: formatRequestedAt(r.requestedAt),
    memberTarget,
    bscAspect: r.categoryName?.trim() || '—',
    weightLabel,
    unitLabel,
    calculationMethodLabel: calcMethodLabel(r.calculationRuleCode, r.calculationTypeCode),
    scoringRuleText: scoringRulesText(r.targetDescription),
    creatorRoleCode:
      r.creatorRoleCode != null && String(r.creatorRoleCode).trim() !== ''
        ? String(r.creatorRoleCode).trim().toUpperCase()
        : undefined,
    assignmentTargetValue: r.targetValue ?? undefined,
    baselineTargetValue: r.baselineTargetValue ?? undefined,
    baselineScoringDescription: r.baselineScoringDescription ?? undefined,
    targetChanged: r.targetChanged === true,
    scoringChanged: r.scoringChanged === true,
    assigneeHasEdits: r.assigneeHasEdits === true,
    unitCode: r.unitCode ?? undefined,
  }
}

async function loadApprovalRequests() {
  approvalLoading.value = true
  try {
    const rows = await pmKpiService.listMemberKpiApprovals(approvalYear.value)
    approvalRawItems.value = rows

    const openMemberApproval =
      rightPanelVisible.value &&
      rightPanelMode.value === 'request_detail' &&
      activeItem.value &&
      activeItem.value._approvalMember === true &&
      activeItem.value.userId != null

    if (openMemberApproval) {
      const uid = String(activeItem.value.userId)
      const kpis = rows.filter((r) => String(r.userId) === uid).map(mapApprovalToUi)
      if (kpis.length === 0) {
        closePanel()
      } else {
        const snap = activeItem.value
        activeItem.value = {
          ...snap,
          kpis,
          userFullName: rows.find((r) => String(r.userId) === uid)?.userFullName ?? snap.userFullName,
          avatar: initialsFromName(
            rows.find((r) => String(r.userId) === uid)?.userFullName ?? snap.userFullName ?? '',
          ),
        }
      }
    }
  } catch (e) {
    console.error(e)
    toast.error('Could not load KPI proposal list')
    approvalRawItems.value = []
  } finally {
    approvalLoading.value = false
  }
}

function apiErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const ax = err as { response?: { data?: { message?: string | null } } }
    const m = ax.response?.data?.message
    if (m != null && String(m).trim() !== '') return String(m)
  }
  if (err instanceof Error) return err.message
  return 'Action failed'
}

async function submitApprovalDecision(
  req: PmRequestUiRow,
  approve: boolean,
  rejectReason?: string,
  options?: { resetDrawerSiblingsToPendingAcceptance?: boolean },
) {
  if (selectedYearReadonly.value) return
  if (approvalSubmitting.value) return
  approvalSubmitting.value = true
  try {
    await pmKpiService.decideMemberKpiApproval({
      year: approvalYear.value,
      assignmentId: req.id,
      approve,
      rejectReason: approve ? undefined : (rejectReason ?? ''),
      resetDrawerSiblingsToPendingAcceptance:
        !approve && options?.resetDrawerSiblingsToPendingAcceptance === true,
    })
    toast.success(
      approve
        ? 'Approved - KPI moved to pending GM.'
        : options?.resetDrawerSiblingsToPendingAcceptance
          ? 'KPI rejected. Other pending KPIs for this member returned to pending acceptance.'
          : 'KPI proposal rejected.',
    )
    await loadApprovalRequests()
    refreshPmProcessTimeline()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err))
  } finally {
    approvalSubmitting.value = false
  }
}

async function submitApprovalDecisionBatch(
  rows: PmRequestUiRow[],
  approve: boolean,
  rejectReason?: string,
) {
  if (selectedYearReadonly.value) return
  const targets = rows.filter((r) => r.status === 'PENDING')
  if (!targets.length || approvalSubmitting.value) return
  approvalSubmitting.value = true
  let ok = 0
  try {
    for (const req of targets) {
      try {
        await pmKpiService.decideMemberKpiApproval({
          year: approvalYear.value,
          assignmentId: req.id,
          approve,
          rejectReason: approve ? undefined : (rejectReason ?? ''),
        })
        ok += 1
      } catch (e) {
        console.error(e)
      }
    }
    if (ok > 0) {
      toast.success(
        approve
          ? `Approved ${ok} KPIs - moved to pending GM.`
          : `Rejected ${ok} KPIs.`,
      )
    }
    if (ok < targets.length) {
      toast.warning(`${targets.length - ok} KPIs could not be updated. Please try again.`)
    }
    await loadApprovalRequests()
    refreshPmProcessTimeline()
  } catch (err: unknown) {
    toast.error(apiErrorMessage(err))
  } finally {
    approvalSubmitting.value = false
  }
}

watch(activeTab, (t) => {
  if (t === 'requests') loadApprovalRequests()
})

watch(
  [activeTab, activePersonalPromoSubTab, pmTeamReviewScope, pmDepartmentSubTab],
  ([tab, subTab, teamScope, deptSubTab]) => {
    const showPromo =
      (tab === 'personal_promotion' && subTab === 'promotion') ||
      (tab === 'team' && teamScope === 'promotion') ||
      (tab === 'department' && deptSubTab === 'promotion')
    pmHeaderShowsPromotionCycle.value = showPromo
    if (showPromo) {
      void syncDefaultPromotionCycleFromPortfolio().then(() =>
        loadPromotionProcessTimeline(),
      )
    }
  },
  { immediate: true },
)

watch(pmPromotionCycleId, (id, prev) => {
  if (id === prev) return
  if (showPmPromotionTimeline.value) {
    void loadPromotionProcessTimeline()
  }
})

watch(
  () => route.query.year,
  async () => {
    syncYearFromRoute()
    await refreshPmDashboardForYear()
  },
)

watch(teamReviewReloadNonce, () => {
  void loadTeamReviewPendingCount()
})

const clearPmEvaluationStorage = () => {
  localStorage.removeItem('pm_eval_comments')
  localStorage.removeItem('pm_eval_kpis')
}

onMounted(() => {
  syncYearFromRoute()
  clearPmEvaluationStorage()
  void loadCycleOptions()
  void loadPmPortfolioTimelineContext()
  refreshPmProcessTimeline()
  void loadApprovalRequests()
  void loadTeamReviewPendingCount()
  window.addEventListener('pm-kpi-created', handleRefresh)
})

onUnmounted(() => {
  window.removeEventListener('pm-kpi-created', handleRefresh)
})

function onDrawerApproveRequest(req: PmRequestUiRow) {
  if (req) submitApprovalDecision(req, true)
}

function onDrawerRejectRequest(payload: any) {
  if (payload?.req) {
    submitApprovalDecision(payload.req as PmRequestUiRow, false, String(payload.reason ?? ''), {
      resetDrawerSiblingsToPendingAcceptance: true,
    })
  }
}

function onDrawerApproveAll(rows: PmRequestUiRow[]) {
  void submitApprovalDecisionBatch(rows, true)
}

function onDrawerRejectAll(payload: { rows: PmRequestUiRow[]; reason: string }) {
  void submitApprovalDecisionBatch(payload.rows, false, payload.reason)
}

function pendingApprovalRowsForUserIds(userIds: string[]): PmRequestUiRow[] {
  const set = new Set(userIds.map((id) => String(id).trim()).filter(Boolean))
  return approvalRawItems.value
    .filter((r) => set.has(String(r.userId ?? '').trim()))
    .map(mapApprovalToUi)
    .filter((r) => r.status === 'PENDING')
}

function onApproveSelectedMembers(userIds: string[]) {
  void submitApprovalDecisionBatch(pendingApprovalRowsForUserIds(userIds), true)
}

function onRejectSelectedMembers(payload: { userIds: string[]; reason: string }) {
  void submitApprovalDecisionBatch(
    pendingApprovalRowsForUserIds(payload.userIds),
    false,
    payload.reason,
  )
}

/** KPI của member thay đổi (vd xóa KPI) — bỏ draft localStorage tránh nhầm Supervisor Comment. */
function discardMemberEvalDraft(memberId: string) {
  if (!memberId) return
  const nextComments = { ...memberComments.value }
  delete nextComments[memberId]
  memberComments.value = nextComments
  const nextKpis = { ...memberKpisCache.value }
  delete nextKpis[memberId]
  memberKpisCache.value = nextKpis
  clearPmEvaluationStorage()
}

const rightPanelVisible = ref(false)
const rightPanelMode = ref<'assign' | 'member_detail' | 'request_detail' | 'none'>('none')
const activeItem = ref<any>(null)
/** Truyền vào PmAssignKpiDrawer khi mở từ «Chấp nhận và phân bổ» (feedback member). */
const pendingAssignDrawerMemberFeedbackAssignmentId = ref<string | undefined>(undefined)

function openAssignDrawer(kpi: any) {
  if (selectedYearReadonly.value) return
  pendingAssignDrawerMemberFeedbackAssignmentId.value = undefined
  activeItem.value = kpi
  rightPanelMode.value = 'assign'
  rightPanelVisible.value = true
}

function openAssignDrawerAfterMemberFeedback(payload: { parentKpi: any; feedbackAssignmentId: string }) {
  if (selectedYearReadonly.value) return
  const id = String(payload?.feedbackAssignmentId ?? '').trim()
  pendingAssignDrawerMemberFeedbackAssignmentId.value = id || undefined
  activeItem.value = payload.parentKpi
  rightPanelMode.value = 'assign'
  rightPanelVisible.value = true
}
const openMemberDrawer = (member: any) => { activeItem.value = member; rightPanelMode.value = 'member_detail'; rightPanelVisible.value = true }

function openMemberApprovalDrawer(summary: PmApprovalMemberSummary) {
  const uid = String(summary.userId ?? '').trim()
  if (!uid) return
  const kpis = approvalRawItems.value.filter((r) => String(r.userId) === uid).map(mapApprovalToUi)
  activeItem.value = {
    _approvalMember: true,
    userId: uid,
    userFullName: summary.userFullName,
    avatar: summary.avatar,
    kpis,
  }
  rightPanelMode.value = 'request_detail'
  rightPanelVisible.value = true
}
const closePanel = () => { rightPanelVisible.value = false; setTimeout(() => { activeItem.value = null; rightPanelMode.value = 'none' }, 300); personalKpiKey.value += 1 }

function onPmAssignDrawerClose() {
  pendingAssignDrawerMemberFeedbackAssignmentId.value = undefined
  closePanel()
}

const handleMemberEvalSubmitted = (payload: {
  kpis: any[]
  comments: { main: string; promo: string }
  memberId?: string
}) => {
  const mid = String(payload.memberId ?? activeItem.value?.id ?? '')
  if (!mid) return
  discardMemberEvalDraft(mid)

  teamReviewReloadNonce.value += 1
  personalKpiKey.value += 1
  refreshPmProcessTimeline()
}

const authStore = useAuthStore()

const isGmDrawerOpen = ref(false)
const gmDrawerMember = ref<any>(null)
const gmDrawerItems = ref<any[]>([])
const gmDrawerPmRollout = ref<GmPmKpiRolloutPayload | null>(null)

function closeGmMemberDrawer() {
  isGmDrawerOpen.value = false
  gmDrawerPmRollout.value = null
  gmDrawerMember.value = null
  gmDrawerItems.value = []
}

const openKpiChildDetail = (payload: { child: any; parent: any }) => {
  const { child, parent } = payload
  const pmName = authStore.user?.fullName?.trim() || authStore.user?.name || '—'
  const pmCanViewMemberEval = canSupervisorViewMemberSelfEvaluation(
    child.statusCode,
    'pm',
  )

  const targetStr =
    child.target != null && String(child.target).trim() !== '' ? String(child.target).trim() : '—'
  const actualFormatted = pmCanViewMemberEval
    ? formatPmPortfolioActualCell(
        child.actualResult,
        parent.calculationTypeCode,
        pmPortfolioActualDisplayMode(parent.calculationRuleCode),
      ) || ''
    : ''
  const actualStr = actualFormatted || '—'

  const rawEvidences = pmCanViewMemberEval
    ? child.actualResult == null
      ? ''
      : typeof child.actualResult === 'string'
        ? child.actualResult.trim()
        : (() => {
            try {
              return JSON.stringify(child.actualResult)
            } catch {
              return ''
            }
          })()
    : ''
  const parsed = parsePmPortfolioEvidenceString(rawEvidences)
  const evidenceNote =
    [parsed.note.trim(), parsed.content.trim()].filter(Boolean).join(' · ') || '—'
  const targetSummary = `Contribution in KPI "${parent.name}" · Evidence / note: ${evidenceNote}`

  const w = parent.weight
  const weightNum = typeof w === 'number' ? w : Number(w)
  const weightSafe = Number.isFinite(weightNum) ? weightNum : 0

  const kpiType = (parent.kpiType as GmStrategicKpiKind) || 'cascading'

  const modalItem: GmModalKpiItemMock = {
    code: String(child.id ?? parent.code ?? ''),
    obj: String(parent.name ?? ''),
    weight: weightSafe,
    target: targetStr,
    actual: actualStr,
    isFail: false,
    rootCause: '',
    score: '',
    kpiType,
    submissionStatus: 'submitted',
    assignmentStatusCode: child.statusCode != null ? Number(child.statusCode) : null,
    targetSummary,
    actualProgressPct: null,
    evidenceAttachmentUrl: null,
    evidenceNoteDisplay: evidenceNote,
    evidenceAttachments: parsed.attachments ?? [],
  }

  gmDrawerPmRollout.value = {
    pmName,
    rollupRoleLabel: 'PM',
    kpiName: String(parent.name ?? ''),
    kpiTarget: parent.target != null ? String(parent.target) : '—',
    rows: [
      {
        profile: {
          name: String(child.name ?? ''),
          rank: child.role != null ? String(child.role) : undefined,
          departmentLabel: 'COMPANY',
        },
        item: modalItem,
      },
    ],
  }
  gmDrawerMember.value = null
  gmDrawerItems.value = []
  isGmDrawerOpen.value = true
}

const handleRefresh = () => {
  personalKpiKey.value += 1
  void loadPmPortfolioTimelineContext()
  refreshPmProcessTimeline()
}
</script>

<template>
  <div class="flex flex-col w-full text-slate-800 font-sans relative pb-10">
    
    <div class="space-y-4 p-3 sm:p-4 lg:p-6">
      <PromotionProcessTimeline
        v-if="showPmPromotionTimeline && hasAnyPmKpi && pmPortfolioInit !== null"
        :timeline-data="promotionProcessTimelineData"
        :loading="promotionTimelineLoading"
        :promotion-cycle-id="pmPromotionCycleId"
      />
      <GmProcessTimeline
        v-else-if="hasAnyPmKpi && pmPortfolioInit !== null"
        :mid-year-issues="processTimelineData?.midYear ?? EMPTY_PM_PROCESS_TIMELINE_MID"
        :setting-issues="processTimelineData?.setting ?? undefined"
        :year-end-issues="processTimelineData?.yearEnd ?? undefined"
        :year="approvalYear"
        :year-end-only="pmTimelineYearEndOnly"
      />
    </div>

    <div class="mx-6 mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
      
      <div class="flex bg-slate-50 border-b border-slate-200 px-4 pt-3 gap-2 overflow-x-auto hide-scrollbar">
        <button 
          @click="activeTab = 'department'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'department' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-users text-base"></i> KPI Department
        </button>

        <button 
          @click="activeTab = 'personal_promotion'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'personal_promotion' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-list-alt text-base"></i> KPI Personal & Promotion
          <span
            v-if="pmFeedbackPendingByScope.portfolio + pmFeedbackPendingByScope.promotion > 0"
            class="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm ml-1">
            {{ pmFeedbackPendingByScope.portfolio + pmFeedbackPendingByScope.promotion }}
          </span>
        </button>
        
        <button 
          @click="activeTab = 'team'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'team' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-sitemap text-base"></i> Team Review
          <span
            v-if="teamPmEvaluationPendingCount > 0"
            class="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ml-1"
          >{{ teamPmEvaluationPendingCount }}</span>
        </button>
        
        <button 
          @click="activeTab = 'requests'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'requests' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-inbox text-base"></i> Request Approval
          <span v-if="pendingRequestsCount > 0" class="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow-sm ml-1">{{ pendingRequestsCount }}</span>
        </button>
      </div>

      <div class="bg-white">
        <div v-show="activeTab === 'personal_promotion'" class="flex flex-col">
          <div class="border-b border-slate-200 bg-white px-5 pt-4 pb-0">
            <h3 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800">
              <i class="fas fa-list-alt text-slate-400" />
              KPI Personal & Promotion
            </h3>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                :class="activePersonalPromoSubTab === 'personal' ? 'border-slate-200 border-b-white bg-white text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'"
                @click="activePersonalPromoSubTab = 'personal'"
              >
                KPI Personal
                <span
                  v-if="pmFeedbackPendingByScope.portfolio > 0"
                  class="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                >
                  {{ pmFeedbackPendingByScope.portfolio }}
                </span>
              </button>
              <button
                type="button"
                class="rounded-t-lg border px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                :class="activePersonalPromoSubTab === 'promotion' ? 'border-slate-200 border-b-white bg-white text-purple-700' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'"
                @click="activePersonalPromoSubTab = 'promotion'"
              >
                KPI Promotion
                <span
                  v-if="pmFeedbackPendingByScope.promotion > 0"
                  class="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                >
                  {{ pmFeedbackPendingByScope.promotion }}
                </span>
              </button>
            </div>
          </div>
          <PmPersonalKpiTab
            v-show="activePersonalPromoSubTab === 'personal'"
            :key="`pf-${personalKpiKey}`"
            portfolio-scope="portfolio"
            :year="approvalYear"
            :readonly-year="selectedYearReadonly"
            @open-assign="openAssignDrawer"
            @open-assign-after-member-feedback="openAssignDrawerAfterMemberFeedback"
            @open-member-detail="openKpiChildDetail"
            @feedback-pending-count="onPmFeedbackPendingCount"
            @timeline-refresh="refreshPmProcessTimeline"
          />
          <PmPersonalKpiTab
            v-show="activePersonalPromoSubTab === 'promotion'"
            :key="`pm-${personalKpiKey}`"
            portfolio-scope="promotion"
            :year="approvalYear"
            :readonly-year="selectedYearReadonly"
            @open-assign="openAssignDrawer"
            @open-assign-after-member-feedback="openAssignDrawerAfterMemberFeedback"
            @open-member-detail="openKpiChildDetail"
            @feedback-pending-count="onPmFeedbackPendingCount"
            @timeline-refresh="refreshPmProcessTimeline"
          />
        </div>
        <PmPersonalKpiTab
          v-if="activeTab === 'department'"
          :key="`dept-${personalKpiKey}`"
          portfolio-scope="department"
          :year="approvalYear"
          :readonly-year="selectedYearReadonly"
          @open-assign="openAssignDrawer"
          @open-assign-after-member-feedback="openAssignDrawerAfterMemberFeedback"
          @open-member-detail="openKpiChildDetail"
          @open-member="openMemberDrawer"
          @timeline-refresh="refreshPmProcessTimeline"
        />
        <PmTeamMembersTab
          v-if="activeTab === 'team'"
          :year="approvalYear"
          :reload-nonce="teamReviewReloadNonce"
          :kpis-cache="memberKpisCache"
          :comments-cache="memberComments"
          @open-member="openMemberDrawer"
          @pending-pm-evaluation-count="onTeamPendingPmEvaluationCount"
        />
        <PmRequestsTab
          v-if="activeTab === 'requests'"
          :members="approvalMemberSummaries"
          :loading="approvalLoading"
          :action-busy="approvalSubmitting || selectedYearReadonly"
          @open-member="openMemberApprovalDrawer"
          @approve-selected="onApproveSelectedMembers"
          @reject-selected="onRejectSelectedMembers"
        />
      </div>
    </div>

    <!-- Always mounted so inner Transition sees open false→true / true→false (v-if on the component skips enter/leave). -->
    <PmAssignKpiDrawer
      :open="rightPanelVisible && rightPanelMode === 'assign'"
      :kpi="rightPanelMode === 'assign' ? activeItem : null"
      :readonly="selectedYearReadonly"
      :pending-member-feedback-assignment-id="pendingAssignDrawerMemberFeedbackAssignmentId"
      @close="onPmAssignDrawerClose"
      @refresh="handleRefresh"
    />
    <PmMemberDetailDrawer
      :open="rightPanelVisible && rightPanelMode === 'member_detail'"
      :member="activeItem"
      :year="approvalYear"
      :readonly-year="selectedYearReadonly"
      :cached-supervisor-comments="
        activeItem?.id
          ? (memberComments[activeItem.id] ?? { main: '', promo: '' })
          : { main: '', promo: '' }
      "
      :cached-kpis="activeItem ? memberKpisCache[activeItem.id] : undefined"
      :initial-tab="activeItem?.reviewInitialTab === 'promotion' ? 'promotion' : 'main'"
      @close="closePanel"
      @save="handleMemberEvalSubmitted"
      @discard-draft="discardMemberEvalDraft"
    />
    <PmRequestDetailDrawer
      v-if="rightPanelVisible && rightPanelMode === 'request_detail'"
      :open="rightPanelVisible && rightPanelMode === 'request_detail'"
      :member-approval="
        activeItem && activeItem._approvalMember
          ? {
              userFullName: activeItem.userFullName,
              avatar: activeItem.avatar,
              kpis: activeItem.kpis ?? [],
            }
          : null
      "
      :action-busy="approvalSubmitting || selectedYearReadonly"
      @close="closePanel"
      @approve="onDrawerApproveRequest"
      @reject="onDrawerRejectRequest"
      @approve-all="onDrawerApproveAll"
      @reject-all="onDrawerRejectAll"
    />
    <!-- Luôn mount (không v-if) để Transition trong drawer chạy enter/leave khi mở Chi tiết thực hiện KPI. -->
    <GmMemberKpiDrawer
      :open="isGmDrawerOpen"
      :member="gmDrawerMember"
      :items="gmDrawerItems"
      :pm-kpi-rollout="gmDrawerPmRollout"
      @close="closeGmMemberDrawer"
    />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Ẩn scrollbar ngang cho thanh Tab */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.slide-panel-enter-active, .slide-panel-leave-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.slide-panel-enter-from, .slide-panel-leave-to { transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.28s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
