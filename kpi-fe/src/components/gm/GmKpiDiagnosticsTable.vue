<script setup lang="ts">
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, nextTick } from 'vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import KpiScoringRulesPreviewTooltip from '@/components/kpi/KpiScoringRulesPreviewTooltip.vue'
import type {
  GmBscPerspective,
  GmHierarchyKpi,
  GmHierarchyLeader,
  GmHierarchyMember,
  GmHierarchyPm,
  GmHierarchyStatus,
  GmHierarchyTargetBalance,
  GmKpiSubmissionStatus,
  GmMemberKpiDrawerProfile,
  GmModalKpiItemMock,
  GmPmKpiRolloutPayload,
} from '@/types/gm-workspace'
import { GM_BSC_LABELS, GM_BSC_ORDER, normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import KpiCreatorRowLegend from '@/components/shared/KpiCreatorRowLegend.vue'
import { kpiCreatorRowBgClass } from '@/utils/kpiCreatorRowBg'
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'
import {
  CALC_RULE_AVERAGE,
  CALC_RULE_COMMENT,
  CALC_RULE_SUM,
  formatPmPortfolioActualCell,
  parseNumericFromField,
  normalizeCalculationRuleCode,
  parsePmPortfolioEvidenceString,
} from '@/utils/memberKpiHelpers'
import { evidenceTableFromEvidencesJson } from '@/utils/mapGmEvaluationHubApiToPmBranches'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'
import { KPI_STATUS } from '@/config/constants'

const props = withDefaults(
  defineProps<{
    /** Dữ liệu từ API diagnostics — mặc định rỗng. */
    rows?: GmHierarchyKpi[]
    /** KPI Cycle info để xác định phase mid-year (tính tiến độ điều chỉnh cho CALC_RULE 803). */
    kpiCycle?: KpiCycleResponse | null
    /** Năm chu kỳ đã khóa (năm < năm hiện tại) — không cho sửa/xóa KPI chiến lược. */
    readonly?: boolean
  }>(),
  { rows: () => [], kpiCycle: null, readonly: false },
)

const emit = defineEmits<{
  'edit-kpi': [kpi: GmHierarchyKpi]
  'delete-kpi': [kpi: GmHierarchyKpi]
  'resolve-feedback': [payload: { assignmentId: string; approve: boolean; kpi?: GmHierarchyKpi }]
}>()

function onEditKpiClick(kpi: GmHierarchyKpi) {
  if (props.readonly) return
  emit('edit-kpi', kpi)
}

function onDeleteKpiClick(kpi: GmHierarchyKpi) {
  if (props.readonly) return
  emit('delete-kpi', kpi)
}

const FEEDBACK_IN_PROGRESS_STATUS = 407

type GmPendingFeedbackItem = {
  assignmentId: string
  memberName: string
  roleLabel: string
  note: string
}

const feedbackDrawerOpen = ref(false)
const feedbackDrawerKpi = shallowRef<GmHierarchyKpi | null>(null)
const feedbackDrawerFocusAssignmentId = ref<string | null>(null)

function isMemberFeedbackPendingForGm(member: GmHierarchyMember): boolean {
  if (member.feedbackAwaitingGm === true) {
    return typeof member.assignmentId === 'string' && member.assignmentId.trim().length > 0
  }
  if (member.feedbackAwaitingGm === false) {
    return false
  }
  const note = String(member.feedbackNote ?? '').trim()
  return (
    Number(member.assignmentStatusCode) === FEEDBACK_IN_PROGRESS_STATUS &&
    typeof member.assignmentId === 'string' &&
    member.assignmentId.trim().length > 0 &&
    note.length > 0
  )
}

function isPmFeedbackPendingForGm(pm: GmHierarchyPm): boolean {
  if (pm.feedbackAwaitingGm === true) {
    return typeof pm.assignmentId === 'string' && pm.assignmentId.trim().length > 0
  }
  if (pm.feedbackAwaitingGm === false) {
    return false
  }
  const note = String(pm.feedbackNote ?? '').trim()
  return (
    Number(pm.assignmentStatusCode) === FEEDBACK_IN_PROGRESS_STATUS &&
    typeof pm.assignmentId === 'string' &&
    pm.assignmentId.trim().length > 0 &&
    note.length > 0
  )
}

function collectPendingFeedbackItems(kpi: GmHierarchyKpi): GmPendingFeedbackItem[] {
  const out: GmPendingFeedbackItem[] = []
  const seen = new Set<string>()
  for (const pm of kpi.pmOwners) {
    if (isPmFeedbackPendingForGm(pm)) {
      const assignmentId = String(pm.assignmentId ?? '').trim()
      if (assignmentId && !seen.has(assignmentId)) {
        seen.add(assignmentId)
        out.push({
          assignmentId,
          memberName: pmManagedSectionLabel(pm) || String(pm.name ?? '').trim() || 'PM',
          roleLabel: String(pm.ownerRoleCode ?? '').trim().toUpperCase() || 'PM',
          note: String(pm.feedbackNote ?? '').trim() || 'No feedback content.',
        })
      }
    }
    for (const member of allMembersUnderPm(pm)) {
      if (!isMemberFeedbackPendingForGm(member)) continue
      const assignmentId = String(member.assignmentId ?? '').trim()
      if (!assignmentId || seen.has(assignmentId)) continue
      seen.add(assignmentId)
      out.push({
        assignmentId,
        memberName: String(member.name ?? '').trim() || 'PM',
        roleLabel: String(member.ownerRoleCode ?? '').trim().toUpperCase() || 'PM',
        note: String(member.feedbackNote ?? '').trim() || 'No feedback content.',
      })
    }
  }
  return out
}

const feedbackDrawerItems = computed(() => {
  if (!feedbackDrawerKpi.value) return []
  const allItems = collectPendingFeedbackItems(feedbackDrawerKpi.value)
  const focusId = String(feedbackDrawerFocusAssignmentId.value ?? '').trim()
  if (!focusId) return allItems
  return allItems.filter((item) => item.assignmentId === focusId)
})

const activeFeedbackItem = computed(() => feedbackDrawerItems.value[0] ?? null)

function openFeedbackDrawerForMember(kpi: GmHierarchyKpi, member: GmHierarchyMember) {
  if (!isMemberFeedbackPendingForGm(member)) return
  feedbackDrawerFocusAssignmentId.value = String(member.assignmentId ?? '').trim()
  feedbackDrawerKpi.value = kpi
  feedbackDrawerOpen.value = true
}

function openFeedbackDrawerForPm(kpi: GmHierarchyKpi, pm: GmHierarchyPm) {
  if (!isPmFeedbackPendingForGm(pm)) return
  feedbackDrawerFocusAssignmentId.value = String(pm.assignmentId ?? '').trim()
  feedbackDrawerKpi.value = kpi
  feedbackDrawerOpen.value = true
}

/** Tìm dòng member trong cây diagnostics theo `assignmentId` (vd. từ tab Approved KPI). */
function findMemberAndKpiForAssignment(assignmentId: string): {
  kpi: GmHierarchyKpi
  member: GmHierarchyMember
} | null {
  const aid = String(assignmentId ?? '').trim()
  if (!aid) return null
  for (const kpi of props.rows ?? []) {
    for (const pm of kpi.pmOwners ?? []) {
      if (String(pm.assignmentId ?? '').trim() === aid && isPmFeedbackPendingForGm(pm)) {
        const syntheticMember = {
          id: String(pm.ownerUserId ?? pm.id),
          assignmentId: pm.assignmentId,
          name: pmManagedSectionLabel(pm) || String(pm.name ?? '').trim() || 'PM',
          ownerRoleCode: pm.ownerRoleCode ?? 'PM',
          target: pm.target,
          actual: pm.actual,
          status: pm.status,
          blocker: pm.blockerSummary,
          assignmentStatusCode: pm.assignmentStatusCode ?? undefined,
          feedbackNote: pm.feedbackNote ?? undefined,
          feedbackAwaitingGm: pm.feedbackAwaitingGm,
        } as GmHierarchyMember
        return { kpi, member: syntheticMember }
      }
      for (const member of allMembersUnderPm(pm)) {
        if (String(member.assignmentId ?? '').trim() !== aid) continue
        if (!isMemberFeedbackPendingForGm(member)) continue
        return { kpi, member }
      }
    }
  }
  return null
}

/**
 * Mở drawer xử lý feedback cho assignment đã cho.
 * @returns true nếu đã mở drawer (tìm thấy KPI + member đang chờ GM).
 */
function openFeedbackDrawerByAssignmentId(assignmentId: string): boolean {
  const hit = findMemberAndKpiForAssignment(assignmentId)
  if (!hit) return false
  openFeedbackDrawerForMember(hit.kpi, hit.member)
  return true
}

defineExpose({ openFeedbackDrawerByAssignmentId })

watch(
  activeFeedbackItem,
  (item) => {
    if (!item) return
  },
  { immediate: true },
)

function closeFeedbackDrawer() {
  feedbackDrawerOpen.value = false
  feedbackDrawerKpi.value = null
  feedbackDrawerFocusAssignmentId.value = null
}

function resolvePendingFeedback(assignmentId: string, approve: boolean) {
  const aid = String(assignmentId ?? '').trim()
  if (!aid) return
  emit('resolve-feedback', {
    assignmentId: aid,
    approve,
    kpi: feedbackDrawerKpi.value ?? undefined,
  })
  closeFeedbackDrawer()
}

/** Trạng thái KPI đã chọn (rỗng = tất cả). */
const filterStatuses = ref<number[]>([])
/** `''` = tất cả; `yes` = chỉ KPI quan trọng; `no` = không gắn sao. */
const filterImportant = ref<'' | 'yes' | 'no'>('')
/** Nhãn khối (`pmManagedSectionLabel`) — KPI có ít nhất một PM thuộc một trong các khối đã chọn. */
const filterSections = ref<string[]>([])
/** Tên thành viên — KPI có ít nhất một member (dưới bất kỳ PM) trùng một trong các tên đã chọn. */
const filterMembers = ref<string[]>([])
/** Bản nháp trong popover — chỉ ghi vào bộ lọc thật khi bấm «Áp dụng». */
const draftSections = ref<string[]>([])
const draftMembers = ref<string[]>([])
const draftImportant = ref<'' | 'yes' | 'no'>('')
const draftStatuses = ref<number[]>([])

const FILTER_PANEL_WIDTH = 320
const FILTER_PANEL_GAP = 8

const filterPopoverOpen = ref(false)
const filterPopoverWrapRef = ref<HTMLElement | null>(null)
const filterPopoverPanelRef = ref<HTMLElement | null>(null)
/** Panel Teleport `body` + `fixed` — không bị cắt bởi overflow card / scroll cha. */
const filterPanelFixedStyle = ref<Record<string, string>>({})

function updateFilterPanelPosition() {
  const wrap = filterPopoverWrapRef.value
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  const vw = window.innerWidth
  const w = Math.min(FILTER_PANEL_WIDTH, vw - 16)
  let left = r.right - w
  left = Math.max(8, Math.min(left, vw - w - 8))
  const top = r.bottom + FILTER_PANEL_GAP
  filterPanelFixedStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${w}px`,
  }
}

function repositionFilterPanelIfOpen() {
  if (filterPopoverOpen.value) updateFilterPanelPosition()
}

function syncDraftFromApplied() {
  draftSections.value = [...filterSections.value]
  draftMembers.value = [...filterMembers.value]
  draftImportant.value = filterImportant.value
  draftStatuses.value = [...filterStatuses.value]
}

async function toggleFilterPopover() {
  if (filterPopoverOpen.value) {
    syncDraftFromApplied()
    filterPopoverOpen.value = false
  } else {
    syncDraftFromApplied()
    filterPopoverOpen.value = true
    await nextTick()
    updateFilterPanelPosition()
  }
}

function applyPopoverFilters() {
  filterSections.value = [...draftSections.value]
  filterMembers.value = [...draftMembers.value]
  filterImportant.value = draftImportant.value
  filterStatuses.value = [...draftStatuses.value]
  filterPopoverOpen.value = false
}

function cancelFilterPopover() {
  syncDraftFromApplied()
  filterPopoverOpen.value = false
}

function resetAllDiagnosticFilters() {
  draftSections.value = []
  draftMembers.value = []
  draftImportant.value = ''
  draftStatuses.value = []
  filterSections.value = []
  filterMembers.value = []
  filterImportant.value = ''
  filterStatuses.value = []
  filterPopoverOpen.value = false
  expandedKpis.value = new Set()
  expandedPms.value = new Set()
}

const appliedFilterCount = computed(() => {
  let n = 0
  if (filterSections.value.length > 0) n++
  if (filterMembers.value.length > 0) n++
  if (filterImportant.value) n++
  if (filterStatuses.value.length > 0) n++
  return n
})

/** Nhãn đèn giao thông chung (lọc + rollup KPI/PM/Leader), cùng từ vựng bảng MID/END. */
function kpiStatusLabel(status: GmHierarchyStatus) {
  if (status === 'success') return 'Ahead of plan / Exceeding'
  if (status === 'warning') return 'On track / Nearly there'
  return 'Behind plan / Not met'
}

function normalizeAsmStatusCode(code: unknown): number | null {
  const n = typeof code === 'number' ? code : Number(code)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function minAsmStatusCode(codes: Array<number | null | undefined>): number | null {
  const valid = codes
    .map(normalizeAsmStatusCode)
    .filter((n): n is number => n != null)
  if (valid.includes(KPI_STATUS.FEEDBACK_IN_PROGRESS)) {
    return KPI_STATUS.FEEDBACK_IN_PROGRESS
  }
  return valid.length > 0 ? Math.min(...valid) : null
}

function memberAsmStatusCode(member: GmHierarchyMember | null | undefined): number | null {
  return normalizeAsmStatusCode(member?.assignmentStatusCode)
}

/** Department đã có target GM giao (không phải placeholder). */
function departmentHasMeaningfulTarget(pm: GmHierarchyPm): boolean {
  const t = String(pm.target ?? '').trim()
  return t !== '' && t !== '—' && t !== '-'
}

/**
 * ASM status dòng department (khối phòng).
 * Team KPI: GM đã giao slice PM nhưng assignment gốc bị ẩn khỏi cây member → fallback 404.
 * Sau khi PM cascade: rollup min(status) trên member như cũ (407 vẫn ưu tiên trong minAsmStatusCode).
 */
function pmAsmStatusCode(
  pm: GmHierarchyPm | null | undefined,
  kpi?: GmHierarchyKpi | null,
): number | null {
  if (!pm) return null
  if (isUnassignedPmNode(pm)) return null
  if (isPmFeedbackPendingForGm(pm)) return KPI_STATUS.FEEDBACK_IN_PROGRESS

  const childCodes = allMembersUnderPm(pm).map(memberAsmStatusCode)
  if (childCodes.some((c) => normalizeAsmStatusCode(c) != null)) {
    return minAsmStatusCode(childCodes)
  }

  if (kpi?.kpiType === 'cascading' && departmentHasMeaningfulTarget(pm)) {
    return KPI_STATUS.PENDING_ACCEPTANCE
  }

  return null
}

function kpiAsmStatusCode(kpi: GmHierarchyKpi | null | undefined): number | null {
  return minAsmStatusCode((kpi?.pmOwners ?? []).map((pm) => pmAsmStatusCode(pm, kpi)))
}

function isPendingAssignmentDepartment(
  pm: GmHierarchyPm | null | undefined,
  kpi?: GmHierarchyKpi | null,
): boolean {
  if (!pm || isUnassignedPmNode(pm)) return false
  return (
    normalizeAsmStatusCode(pmAsmStatusCode(pm, kpi)) === KPI_STATUS.PENDING_ACCEPTANCE
    && kpi?.kpiType === 'cascading'
    && !pmHasRollout(pm)
    && departmentHasMeaningfulTarget(pm)
  )
}

function kpiHasRealPendingAcceptanceDepartment(kpi: GmHierarchyKpi | null | undefined): boolean {
  if (!kpi) return false
  return assignedPmOwners(kpi).some((pm) => (
    normalizeAsmStatusCode(pmAsmStatusCode(pm, kpi)) === KPI_STATUS.PENDING_ACCEPTANCE
    && !isPendingAssignmentDepartment(pm, kpi)
  ))
}

function kpiHasPendingAssignmentDepartment(kpi: GmHierarchyKpi | null | undefined): boolean {
  if (!kpi) return false
  return assignedPmOwners(kpi).some((pm) => isPendingAssignmentDepartment(pm, kpi))
}

function kpiIsPendingAssignmentRollup(
  kpi: GmHierarchyKpi | null | undefined,
  code: number | null | undefined = kpiAsmStatusCode(kpi),
): boolean {
  return (
    normalizeAsmStatusCode(code) === KPI_STATUS.PENDING_ACCEPTANCE
    && kpiHasPendingAssignmentDepartment(kpi)
    && !kpiHasRealPendingAcceptanceDepartment(kpi)
  )
}

function asmStatusLabelForKpi(kpi: GmHierarchyKpi | null | undefined): string {
  const code = kpiAsmStatusCode(kpi)
  if (kpiIsPendingAssignmentRollup(kpi, code)) return 'Pending Assignment'
  return asmStatusLabel(code)
}

/** Nhãn ASM trên dòng department — trước cascade Team KPI dùng copy riêng thay vì «Chờ Member bấm Accept». */
function asmStatusLabelForDepartment(
  pm: GmHierarchyPm,
  code: number | null | undefined,
  kpi?: GmHierarchyKpi | null,
): string {
  if (isPendingAssignmentDepartment(pm, kpi)) {
    return 'Pending Assignment'
  }
  return asmStatusLabel(code)
}

function asmStatusLabel(code: number | null | undefined): string {
  switch (normalizeAsmStatusCode(code)) {
    case KPI_STATUS.INACTIVE:
      return 'New KPI'
    case KPI_STATUS.WAITING_PM_APPROVAL:
      return 'Pending PM Approval'
    case KPI_STATUS.WAITING_GM_APPROVAL:
      return 'Pending GM Approval'
    case KPI_STATUS.PENDING_ACCEPTANCE:
      return 'Pending Acceptance'
    case KPI_STATUS.ACCEPTED:
      return 'In progress'
    case KPI_STATUS.REJECTED:
      return 'Rejected'
    case KPI_STATUS.FEEDBACK_IN_PROGRESS:
      return 'Processing Feedback'
    case KPI_STATUS.FIRST_WAITING_PM_APPROVAL:
      return 'Pending PM Evaluation (Mid-Year)'
    case KPI_STATUS.FIRST_WAITING_GM_APPROVAL:
      return 'Pending GM Evaluation (Mid-Year)'
    case KPI_STATUS.FIRST_COMPLETED:
      return 'Completed (Mid-Year)'
    case KPI_STATUS.SECOND_WAITING_PM_APPROVAL:
      return 'Pending PM Evaluation (Final)'
    case KPI_STATUS.SECOND_WAITING_GM_APPROVAL:
      return 'Pending GM Evaluation (Final)'
    case KPI_STATUS.COMPLETED:
      return 'Completed'
    default:
      return 'Not assigned'
  }
}

function asmStatusPillClass(code: number | null | undefined): string {
  switch (normalizeAsmStatusCode(code)) {
    case KPI_STATUS.INACTIVE:
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case KPI_STATUS.REJECTED:
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case KPI_STATUS.FEEDBACK_IN_PROGRESS:
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case KPI_STATUS.ACCEPTED:
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case KPI_STATUS.FIRST_COMPLETED:
    case KPI_STATUS.COMPLETED:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case KPI_STATUS.WAITING_PM_APPROVAL:
    case KPI_STATUS.WAITING_GM_APPROVAL:
    case KPI_STATUS.PENDING_ACCEPTANCE:
    case KPI_STATUS.FIRST_WAITING_PM_APPROVAL:
    case KPI_STATUS.FIRST_WAITING_GM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_PM_APPROVAL:
    case KPI_STATUS.SECOND_WAITING_GM_APPROVAL:
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500'
  }
}

function asmStatusTitle(code: number | null | undefined): string {
  const normalized = normalizeAsmStatusCode(code)
  if (normalized == null) return 'No assignment'
  return asmStatusLabel(normalized)
}

function asmStatusTitleForKpi(kpi: GmHierarchyKpi | null | undefined): string {
  const code = kpiAsmStatusCode(kpi)
  if (kpiIsPendingAssignmentRollup(kpi, code)) return 'Pending Assignment'
  return asmStatusTitle(code)
}

function asmStatusTitleForDepartment(
  pm: GmHierarchyPm,
  code: number | null | undefined,
  kpi?: GmHierarchyKpi | null,
): string {
  if (isPendingAssignmentDepartment(pm, kpi)) return 'Pending Assignment'
  return asmStatusTitle(code)
}

type DiagnosticChipKey = 'section' | 'member' | 'important' | 'status'

const activeFilterChips = computed(() => {
  const chips: { key: DiagnosticChipKey; label: string }[] = []
  if (filterSections.value.length > 0) {
    chips.push({ key: 'section', label: `Section: ${filterSections.value.join(', ')}` })
  }
  if (filterMembers.value.length > 0) {
    chips.push({ key: 'member', label: `Member: ${filterMembers.value.join(', ')}` })
  }
  if (filterImportant.value === 'yes') {
    chips.push({ key: 'important', label: 'Important KPI' })
  } else if (filterImportant.value === 'no') {
    chips.push({ key: 'important', label: 'Not starred' })
  }
  if (filterStatuses.value.length > 0) {
    const st = filterStatuses.value.map((s) => asmStatusLabel(s)).join(', ')
    chips.push({ key: 'status', label: `Status: ${st}` })
  }
  return chips
})

function removeAppliedFilterChip(key: DiagnosticChipKey) {
  if (key === 'section') filterSections.value = []
  else if (key === 'member') filterMembers.value = []
  else if (key === 'important') filterImportant.value = ''
  else filterStatuses.value = []
  if (filterPopoverOpen.value) syncDraftFromApplied()
}

function onDocumentClickCloseFilter(e: MouseEvent) {
  const wrap = filterPopoverWrapRef.value
  const panel = filterPopoverPanelRef.value
  if (!filterPopoverOpen.value || !wrap) return
  const t = e.target
  if (!(t instanceof Node)) return
  if (wrap.contains(t) || panel?.contains(t)) return
  syncDraftFromApplied()
  filterPopoverOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClickCloseFilter)
  window.addEventListener('resize', repositionFilterPanelIfOpen)
  window.addEventListener('scroll', repositionFilterPanelIfOpen, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClickCloseFilter)
  window.removeEventListener('resize', repositionFilterPanelIfOpen)
  window.removeEventListener('scroll', repositionFilterPanelIfOpen, true)
})

watch(filterPopoverOpen, (open) => {
  if (open) {
    void nextTick().then(() => updateFilterPanelPosition())
  }
})

/** Mặc định thu gọn — user mở KPI và từng khối phòng khi cần. */
const expandedKpis = ref(new Set<string>())
const expandedPms = ref(new Set<string>())

function allMembersUnderPm(pm: GmHierarchyPm): GmHierarchyMember[] {
  const fromLeaders =
    pm.leaders?.flatMap((l) => [...(l.leaderOwnRow ? [l.leaderOwnRow] : []), ...l.members]) ?? []
  const all = [...pm.members, ...fromLeaders]
  // Dedup theo member ID để tránh PM tự assign xuất hiện 2 lần
  const seen = new Set<string>()
  return all.filter((m) => {
    const id = String(m.id ?? '').trim()
    if (!id) return true // không có ID thì giữ lại (edge case)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function pmHasRollout(pm: GmHierarchyPm): boolean {
  return allMembersUnderPm(pm).length > 0
}

function assignedPmOwners(kpi: GmHierarchyKpi): GmHierarchyPm[] {
  return (kpi.pmOwners ?? []).filter((pm) => !isUnassignedPmNode(pm))
}

function kpiHasAssignments(kpi: GmHierarchyKpi): boolean {
  return assignedPmOwners(kpi).length > 0
}

function normalizeRankCodeForTag(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '-' || raw === '—' || raw.toUpperCase() === 'N/A') return ''
  const compact = raw.toUpperCase().replace(/\s+/g, '')
  const exact = compact.match(/^R\d+[A-Z]?$/)
  if (exact) return exact[0]
  const embedded = raw.match(/\bR\s*(\d+[A-Z]?)\b/i)
  return embedded ? `R${embedded[1].toUpperCase()}` : ''
}

function compareRankCodes(a: string, b: string): number {
  const na = Number(a.match(/^R(\d+)/i)?.[1] ?? Number.NaN)
  const nb = Number(b.match(/^R(\d+)/i)?.[1] ?? Number.NaN)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
}

function kpiAssignedRankTag(kpi: GmHierarchyKpi): string {
  if (kpi.kpiType !== 'individual') return ''
  const ranks = new Set<string>()
  for (const pm of assignedPmOwners(kpi)) {
    for (const member of allMembersUnderPm(pm)) {
      const code = normalizeRankCodeForTag(member.rankCode) || normalizeRankCodeForTag(member.rank)
      if (code) ranks.add(code)
    }
  }
  return [...ranks].sort(compareRankCodes).join(',')
}

function toggleSet(setRef: typeof expandedKpis, id: string) {
  const s = new Set(setRef.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  setRef.value = s
}

function toggleKpi(id: string) {
  toggleSet(expandedKpis, id)
}
function togglePm(id: string) {
  toggleSet(expandedPms, id)
}

function parseNumPct(s: string) {
  const raw = String(s ?? '').trim()
  if (!raw) return 0
  const fromHelper = parseNumericFromField(raw)
  if (fromHelper != null && Number.isFinite(fromHelper)) return fromHelper
  const fallback = Number.parseFloat(raw.replace(/[^0-9.,-]/g, '').replace(',', '.'))
  return Number.isFinite(fallback) ? fallback : 0
}

/** Ô Target / Score / placeholder trên bảng: chỉ dùng gạch ngắn (-), không dùng em dash (—). */
function diagnosticsTableCellText(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s || s === '—' || s === '–') return '-'
  return s.includes('—') ? s.replace(/\u2014/g, '-') : s
}

/**
 * Cột Score: điểm đánh giá (BE map `submissionActual`/`actual` từ mid_self_score hoặc điểm cuối kỳ GM→PM→self).
 * Không dùng (submissionActual/submissionTarget)×100 — chỉ tiêu năm và điểm có thể khác đơn vị (vd. cert vs điểm).
 */
function memberTableScoreDisplay(member: GmHierarchyMember): string {
  const raw = member.submissionActual
  if (raw != null && Number.isFinite(Number(raw))) {
    const n = Number(raw)
    const scaled = Math.round(n * 10) / 10
    return scaled.toFixed(1)
  }
  return diagnosticsTableCellText(member.actual)
}

/** Tooltip cột Score: nhận xét supervisor từ `user_kpi_summaries.evaluation_supervisor_comments`. */
function memberDiagnosticsScoreTooltip(member: GmHierarchyMember): string | undefined {
  const t = String(member.evaluationSupervisorComments ?? '').trim()
  return t || undefined
}

// function memberDiagnosticsStatusLabel(member: GmHierarchyMember): string {
//   const pl = member.performanceLabel?.trim()
//   if (pl) return pl
//   /** Không có nhãn BE → cùng từ vựng đèn GM (không dùng Fail/Warning/Done tiếng Anh). */
//   return kpiStatusLabel(memberStatusForUi(member))
// }

function memberStatusForUi(member: GmHierarchyMember | null | undefined): GmHierarchyStatus {
  if (!member) return 'warning'
  const pl = String(member.performanceLabel ?? '').trim().toLowerCase()
  const normalizedLabel = pl.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd')
  if (normalizedLabel.includes('chua cau hinh muc tieu') || pl.includes('target not configured')) return 'warning'
  return member.status
}

/** Target trên bảng (dòng member): chỉ tiêu KPI được giao (nhãn từ BE), không ép 100% để khớp cột Score. */
function memberTableTargetDisplay(member: GmHierarchyMember): string {
  return diagnosticsTableCellText(member.target)
}

function diagnosticsTargetWithUnit(kpi: GmHierarchyKpi, rawTarget?: string | null | undefined): string {
  const raw = rawTarget !== undefined ? rawTarget : kpi.target
  return formatKpiTargetWithUnit(diagnosticsTableCellText(raw), kpi.unitCode)
}

function memberTableTargetDisplayWithUnit(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  return formatKpiTargetWithUnit(memberTableTargetDisplay(member), kpi.unitCode)
}

function formatActualNumber(n: number): string {
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n - Math.trunc(n)) < 0.000001) return String(Math.trunc(n))
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function diagnosticsActualWithUnit(kpi: GmHierarchyKpi, rawActual?: string | null | undefined): string {
  return formatKpiTargetWithUnit(diagnosticsTableCellText(rawActual), kpi.unitCode)
}

function memberActualDisplayRaw(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  const rule = normalizeCalculationRuleCode(kpi.calculationRuleCode)
  const mode = rule === CALC_RULE_SUM
    ? 'sum'
    : rule === CALC_RULE_AVERAGE || rule === CALC_RULE_COMMENT
      ? 'mean'
      : 'list'
  const fromEvidence = formatPmPortfolioActualCell(member.evidences, kpi.calculationTypeCode, mode).trim()
  if (fromEvidence) return diagnosticsTableCellText(fromEvidence)
  return diagnosticsTableCellText(member.actual)
}

function memberActualNumericForProgress(member: GmHierarchyMember, kpi: GmHierarchyKpi): number | null {
  const fromDisplay = parseNumericFromField(memberActualDisplayRaw(member, kpi))
  if (fromDisplay != null && Number.isFinite(fromDisplay)) return fromDisplay
  const fallback = parseNumericFromField(String(member.actual ?? ''))
  return fallback != null && Number.isFinite(fallback) ? fallback : null
}

function memberTargetNumericForProgress(member: GmHierarchyMember): number | null {
  const target = parseNumericFromField(String(member.target ?? ''))
  return target != null && Number.isFinite(target) ? target : null
}

/** Roll-up Actual ở node cha (PM / KPI): 803 → tổng assignee; 801 → tổng (đồng bộ rule Tổng Plan/Actual). */
function diagnosticsRollupActualIsSum(kpi: GmHierarchyKpi): boolean {
  const rule = normalizeCalculationRuleCode(kpi.calculationRuleCode)
  return rule === CALC_RULE_SUM
}

function sumNumericOrNull(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0)
}

function averageNumericOrNull(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function formatAverageNumber(n: number): string {
  return formatActualNumber(Math.round(n * 10) / 10)
}

function pmNonCascadingAverageTargetRaw(pm: GmHierarchyPm): string {
  const targets = allMembersUnderPm(pm)
    .map(memberTargetNumericForProgress)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const avg = averageNumericOrNull(targets)
  return avg == null ? diagnosticsTableCellText(pm.target) : formatAverageNumber(avg)
}

function pmNonCascadingAverageActualRaw(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const actuals = allMembersUnderPm(pm)
    .map((m) => memberActualNumericForProgress(m, kpi))
    .filter((v): v is number => v != null && Number.isFinite(v))
  const avg = averageNumericOrNull(actuals)
  return avg == null ? diagnosticsTableCellText(pm.actual) : formatAverageNumber(avg)
}

function pmTargetDisplayRaw(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  return kpi.kpiType === 'cascading'
    ? diagnosticsTableCellText(pm.target)
    : pmNonCascadingAverageTargetRaw(pm)
}

function pmTargetWithUnit(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  return diagnosticsTargetWithUnit(kpi, pmTargetDisplayRaw(pm, kpi))
}

/** CALC_RULE 803: Actual khối phòng = tổng Actual các assignee hiển thị (một tầng, gồm PM nếu tự assign). */
function computePmDirectTotalActualNumeric(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number | null {
  const nums: number[] = []
  for (const member of allMembersUnderPm(pm)) {
    const v = memberActualNumericForProgress(member, kpi)
    if (v != null && Number.isFinite(v)) nums.push(v)
  }
  return sumNumericOrNull(nums)
}

function pmActualDisplayRaw(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  if (diagnosticsRollupActualIsSum(kpi)) {
    const total = computePmDirectTotalActualNumeric(pm, kpi)
    if (total != null) return formatActualNumber(total)
    return diagnosticsTableCellText(pm.actual)
  }
  return pmNonCascadingAverageActualRaw(pm, kpi)
}

function pmActualNumericForProgress(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number | null {
  if (diagnosticsRollupActualIsSum(kpi)) {
    const total = computePmDirectTotalActualNumeric(pm, kpi)
    if (total != null) return total
  }
  const n = parseNumericFromField(pmActualDisplayRaw(pm, kpi))
  return n != null && Number.isFinite(n) ? n : null
}

function kpiActualDisplayRaw(kpi: GmHierarchyKpi): string {
  const directPmActuals = kpi.pmOwners
    .map((pm) => pmActualNumericForProgress(pm, kpi))
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (diagnosticsRollupActualIsSum(kpi)) {
    const total = sumNumericOrNull(directPmActuals)
    if (total != null) return formatActualNumber(total)
    return diagnosticsTableCellText(kpi.actual)
  }
  /** CALC_RULE 802 (và rule khác): Actual node KPI = TB Actual các node department (con trực tiếp). */
  const avg = averageNumericOrNull(directPmActuals)
  if (avg != null) return formatAverageNumber(avg)
  return diagnosticsTableCellText(kpi.actual)
}

function kpiActualNumericForProgress(kpi: GmHierarchyKpi): number | null {
  const directPmActuals = kpi.pmOwners
    .map((pm) => pmActualNumericForProgress(pm, kpi))
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (diagnosticsRollupActualIsSum(kpi)) {
    const total = sumNumericOrNull(directPmActuals)
    if (total != null) return total
  } else {
    const avg = averageNumericOrNull(directPmActuals)
    if (avg != null) return avg
  }
  const fallback = parseNumericFromField(kpiActualDisplayRaw(kpi))
  return fallback != null && Number.isFinite(fallback) ? fallback : null
}

/** (Actual / Target) × 100, clamp 0–100 để hiển thị tiến độ tối đa 100%. */
function completionPctFromActualTarget(actual: number | null, target: number | null): number {
  if (actual == null || target == null || target <= 0) return 0
  const pct = (actual * 100) / target
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, pct))
}

/**
 * Đang trong giai đoạn Mid-Year không? So sánh now với midYearStart và midYearEnd.
 * Dùng để áp dụng công thức target/2 cho KPI 803.
 */
const isMidYearPhase = computed(() => {
  const cycle = props.kpiCycle
  if (!cycle) return false
  const now = Date.now()
  const start = cycle.midYearStart ? new Date(cycle.midYearStart).getTime() : null
  const end = cycle.midYearEnd ? new Date(cycle.midYearEnd).getTime() : null
  if (start == null || end == null) return false
  return now >= start && now <= end
})

function memberActualWithUnit(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  return diagnosticsActualWithUnit(kpi, memberActualDisplayRaw(member, kpi))
}

function pmActualWithUnit(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  return diagnosticsActualWithUnit(kpi, pmActualDisplayRaw(pm, kpi))
}

function memberScoreNumeric(member: GmHierarchyMember): number | null {
  const raw = memberTableScoreDisplay(member)
  const n = Number(String(raw).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function averageScoreDisplay(members: GmHierarchyMember[]): string {
  const nums = members
    .map(memberScoreNumeric)
    .filter((n): n is number => n != null && Number.isFinite(n))
  if (!nums.length) return '-'
  const avg = nums.reduce((sum, n) => sum + n, 0) / nums.length
  return (Math.round(avg * 10) / 10).toFixed(1)
}

function pmSectionScoreDisplayForKpi(pm: GmHierarchyPm, _kpi: GmHierarchyKpi): string {
  return averageScoreDisplay(allMembersUnderPm(pm))
}

function pmSectionScoreClassForKpi(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  return pmSectionScoreDisplayForKpi(pm, kpi) === '-' ? 'text-slate-400' : 'text-slate-700'
}

function kpiScoreDisplay(kpi: GmHierarchyKpi): string {
  return averageScoreDisplay(kpi.pmOwners.flatMap((pm) => allMembersUnderPm(pm)))
}

function kpiScoreClass(kpi: GmHierarchyKpi): string {
  return kpiScoreDisplay(kpi) === '-' ? 'text-slate-400' : 'text-slate-700'
}

function kpiActualWithUnit(kpi: GmHierarchyKpi): string {
  return diagnosticsActualWithUnit(kpi, kpiActualDisplayRaw(kpi))
}

/**
 * % tiến độ trong drawer rollout (Chi tiết theo PM): **khớp Actual/Target đang hiển thị**
 * (`memberActualNumericForProgress` / evidences), cùng mid-year 803 như bảng.
 * Không ưu tiên submissionActual/submissionTarget trước — đó là điểm/chỉ tiêu năm,
 * dễ lệch với cột Actual portfolio (vd. Actual 4 vs Target 2 nhưng % = 50% từ điểm/annual).
 */
function memberDrawerActualProgressPct(member: GmHierarchyMember, kpi: GmHierarchyKpi): string | null {
  const targetFull = memberTargetNumericForProgress(member)
  const actual = memberActualNumericForProgress(member, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  const effectiveTarget =
    targetFull != null && targetFull > 0
      ? isMidYear803
        ? targetFull / 2
        : targetFull
      : null

  if (effectiveTarget != null && effectiveTarget > 0 && actual != null && Number.isFinite(actual)) {
    const rawPct = (100 * actual) / effectiveTarget
    if (Number.isFinite(rawPct) && rawPct >= 0) {
      return `${Math.round(Math.min(rawPct, 100))}%`
    }
  }

  if (
    member.submissionTarget != null &&
    member.submissionTarget > 0 &&
    member.submissionActual != null
  ) {
    const subTarget = Number(member.submissionTarget)
    const subEff =
      isMidYear803 && subTarget > 0 ? subTarget / 2 : subTarget
    if (subEff > 0) {
      const rawPct = (100 * Number(member.submissionActual)) / subEff
      if (Number.isFinite(rawPct) && rawPct >= 0) {
        return `${Math.round(Math.min(rawPct, 100))}%`
      }
    }
  }

  return null
}

function actualBelowTarget(actual: string, target: string) {
  return parseNumPct(actual) < parseNumPct(target)
}

function diagnosticsActualTextClass(actual: string, target: string): string {
  const actualNum = parseNumericFromField(String(actual ?? ''))
  const targetNum = parseNumericFromField(String(target ?? ''))
  if (actualNum == null || !Number.isFinite(actualNum) || targetNum == null || !Number.isFinite(targetNum) || targetNum <= 0) {
    return 'text-slate-400'
  }
  return actualNum < targetNum ? 'text-red-600' : 'text-green-600'
}

/**
 * Xanh/đỏ cột Actual khi đã có actual & target số (node KPI / Department).
 * Mid-year + CALC_RULE 803: ngưỡng = target/2 — đồng bộ với member và cột % tiến độ.
 */
function diagnosticsActualColorClassFromNumeric(
  actualNum: number | null,
  targetFull: number | null,
  kpi: GmHierarchyKpi,
): string | null {
  if (actualNum == null || !Number.isFinite(actualNum)) return null
  if (targetFull == null || !Number.isFinite(targetFull) || targetFull <= 0) return null
  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull > 0
  const threshold = isMidYear803 ? targetFull / 2 : targetFull
  return actualNum < threshold ? 'text-red-600' : 'text-green-600'
}

function kpiRowDiagnosticsActualColorClass(kpi: GmHierarchyKpi): string {
  const fromNum = diagnosticsActualColorClassFromNumeric(
    kpiActualNumericForProgress(kpi),
    kpiTargetNumericForProgress(kpi),
    kpi,
  )
  if (fromNum != null) return fromNum
  return diagnosticsActualTextClass(kpiActualDisplayRaw(kpi), kpi.target)
}

function pmRowDiagnosticsActualColorClass(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const targetFull =
    kpi.kpiType === 'cascading'
      ? pmTargetNumericForProgress(pm)
      : parseNumericFromField(pmTargetDisplayRaw(pm, kpi))
  const fromNum = diagnosticsActualColorClassFromNumeric(
    pmActualNumericForProgress(pm, kpi),
    targetFull,
    kpi,
  )
  if (fromNum != null) return fromNum
  return diagnosticsActualTextClass(pmActualDisplayRaw(pm, kpi), pmTargetDisplayRaw(pm, kpi))
}

/**
 * Màu cột Actual cho một member — có tính đến mid-year 803.
 * Trả về class CSS: 'text-red-600' hoặc 'text-green-600'.
 * Với CALC_RULE 803 ở giai đoạn Mid-Year: actual >= target/2 → xanh.
 */
function memberActualColorClass(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  const targetFull = memberTargetNumericForProgress(member)
  const actualNum = memberActualNumericForProgress(member, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803) {
    // Đúng/vượt tiến độ khi actual >= target/2
    return actualNum != null && actualNum >= targetFull / 2 ? 'text-green-600' : 'text-red-600'
  }
  return actualBelowTarget(memberActualDisplayRaw(member, kpi), member.target)
    ? 'text-red-600'
    : 'text-green-600'
}

/**
 * Đèn trạng thái theo cùng logic ngưỡng với cột "Tiến độ hoàn thành" (`completionPctTextClass`).
 * Dùng khi đã có chỉ tiêu số — tránh lệch với BE (score / performanceLabel có thể khác đơn vị mục tiêu KPI).
 */
function memberStatusFromDiagnosticsProgress(
  member: GmHierarchyMember,
  kpi: GmHierarchyKpi,
): GmHierarchyStatus | null {
  const targetFull = memberTargetNumericForProgress(member)
  if (targetFull == null || targetFull <= 0) return null
  const pct = memberCompletionPct(member, kpi)
  if (pct >= 80) return 'success'
  if (pct >= 60) return 'warning'
  return 'danger'
}

/**
 * Status UI cho member trên diagnostics: ưu tiên theo % tiến độ (Actual / Target hiệu dụng, gồm mid-year 803).
 * Chỉ fallback sang `member.status` + override 803 cũ khi không tính được % từ chỉ tiêu KPI trên bảng.
 */
function memberStatusForUiMidYear(member: GmHierarchyMember, kpi: GmHierarchyKpi): GmHierarchyStatus {
  const fromProgress = memberStatusFromDiagnosticsProgress(member, kpi)
  if (fromProgress != null) return fromProgress

  const base = memberStatusForUi(member)
  const targetFull = memberTargetNumericForProgress(member)
  const actualNum = memberActualNumericForProgress(member, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803 && base === 'danger') {
    if (actualNum != null && actualNum >= targetFull / 2) return 'success'
    if (actualNum != null && actualNum >= targetFull * 0.3) return 'warning'
  }

  return base
}

/**
 * Label trạng thái cho member — đồng bộ với `memberStatusForUiMidYear`.
 * Chỉ dùng `performanceLabel` từ BE khi không có chỉ tiêu số để suy ra % tiến độ trên bảng.
 */
function memberDiagnosticsStatusLabelMidYear(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  const targetFull = memberTargetNumericForProgress(member)
  const canUseProgress = targetFull != null && targetFull > 0
  if (!canUseProgress) {
    const pl = member.performanceLabel?.trim()
    const isMidYear803 =
      isMidYearPhase.value &&
      Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT
    if (!isMidYear803 && pl) return pl
  }
  return kpiStatusLabel(memberStatusForUiMidYear(member, kpi))
}

/** Tóm tắt số member đạt đối với KPI individual/promotion ở level PM. */
function pmNonCascadingSummary(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const members = allMembersUnderPm(pm)
  if (!members.length) return '—'
  const successCount = members.filter(m => memberStatusForUiMidYear(m, kpi) === 'success').length
  return `✓ ${successCount}/${members.length} met`
}

/** Tóm tắt số member đạt đối với KPI individual/promotion ở level toàn KPI. */
function kpiNonCascadingSummary(kpi: GmHierarchyKpi): string {
  const members = kpi.pmOwners.flatMap(pm => allMembersUnderPm(pm))
  if (!members.length) return '—'
  const uniqueMembers = Array.from(new Map(members.map(m => [m.id, m])).values())
  const successCount = uniqueMembers.filter(m => memberStatusForUiMidYear(m, kpi) === 'success').length
  return `✓ ${successCount}/${uniqueMembers.length} met`
}


/** Tiến độ member: tính trực tiếp theo Actual/Target.
 * Với KPI CALC_RULE 803 ở giai đoạn Mid-Year, dùng target/2 làm mục tiêu kỳ vọng.
 */
function memberCompletionPct(member: GmHierarchyMember, kpi: GmHierarchyKpi): number {
  const actual = memberActualNumericForProgress(member, kpi)
  const targetFull = memberTargetNumericForProgress(member)

  // Áp dụng target/2 khi: đang mid-year phase VÀ calcRule = 803 VÀ target là số hợp lệ
  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  const effectiveTarget = isMidYear803 ? targetFull / 2 : targetFull
  return completionPctFromActualTarget(actual, effectiveTarget)
}

/** Individual/Promotion: còn member có chỉ tiêu số để roll-up % tiến độ trên node KPI. */
function kpiHasNonCascadingRollupMembers(kpi: GmHierarchyKpi): boolean {
  if (kpi.kpiType === 'cascading') return false
  const ownTarget = kpiTargetNumericForProgress(kpi)
  if (ownTarget != null && ownTarget > 0) return true
  return kpi.pmOwners.some((pm) =>
    allMembersUnderPm(pm).some((m) => {
      const t = memberTargetNumericForProgress(m)
      return t != null && t > 0
    }),
  )
}

/** Individual/Promotion: member dưới PM có target số — hiển thị % tiến độ trên node PM (khối). */
function pmHasNonCascadingRollupMembers(pm: GmHierarchyPm, kpi: GmHierarchyKpi): boolean {
  if (kpi.kpiType === 'cascading') return false
  const ownTarget = parseNumericFromField(pmTargetDisplayRaw(pm, kpi))
  if (ownTarget != null && ownTarget > 0) return true
  return allMembersUnderPm(pm).some((m) => {
    const t = memberTargetNumericForProgress(m)
    return t != null && t > 0
  })
}

/**
 * TB % hoàn thành theo từng member (memberCompletionPct, gồm mid-year 803) —
 * chỉ các dòng có target số; dùng cho node KPI / PM khi KPI individual hoặc promotion.
 */
function kpiNonCascadingRollupCompletionPct(kpi: GmHierarchyKpi): number {
  const parts: number[] = []
  for (const pm of kpi.pmOwners) {
    for (const m of allMembersUnderPm(pm)) {
      const t = memberTargetNumericForProgress(m)
      if (t != null && t > 0) parts.push(memberCompletionPct(m, kpi))
    }
  }
  if (!parts.length) {
    return completionPctFromActualTarget(kpiActualNumericForProgress(kpi), kpiTargetNumericForProgress(kpi))
  }
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

function pmNonCascadingRollupCompletionPct(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number {
  const parts: number[] = []
  for (const m of allMembersUnderPm(pm)) {
    const t = memberTargetNumericForProgress(m)
    if (t != null && t > 0) parts.push(memberCompletionPct(m, kpi))
  }
  if (!parts.length) {
    const target = parseNumericFromField(pmTargetDisplayRaw(pm, kpi))
    return completionPctFromActualTarget(pmActualNumericForProgress(pm, kpi), target)
  }
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

/** TB tiến độ (Individual/Promotion) trong cả nhóm section — node department/BSC. */
function groupNonCascadingRollupCompletionPct(rows: GmHierarchyKpi[]): number | null {
  const parts: number[] = []
  for (const kpi of rows) {
    if (kpi.kpiType === 'cascading') continue
    for (const pm of kpi.pmOwners) {
      for (const m of allMembersUnderPm(pm)) {
        const t = memberTargetNumericForProgress(m)
        if (t != null && t > 0) parts.push(memberCompletionPct(m, kpi))
      }
    }
  }
  if (!parts.length) return null
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

/**
 * Tiến độ khối phòng: (Actual / Target) × 100 — Actual roll-up theo CALC_RULE (803 = tổng assignee).
 * Mid-year + CALC_RULE 803: cùng target/2 như member.
 */
function pmCompletionPct(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number {
  const actual = pmActualNumericForProgress(pm, kpi)
  const targetFull = kpi.kpiType === 'cascading'
    ? pmTargetNumericForProgress(pm)
    : parseNumericFromField(pmTargetDisplayRaw(pm, kpi))
  if (targetFull == null || targetFull <= 0) {
    const t = parseNumericFromField(String(pm.target ?? ''))
    return completionPctFromActualTarget(actual, t)
  }
  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull > 0
  const effectiveTarget = isMidYear803 ? targetFull / 2 : targetFull
  return completionPctFromActualTarget(actual, effectiveTarget)
}

/**
 * Tiến độ KPI (cascading): aggregate actual / KPI target.
 * Mid-year + CALC_RULE 803: cùng target/2 như `memberCompletionPct` — khớp cột % với đèn trạng thái node KPI.
 */
function kpiCompletionPct(kpi: GmHierarchyKpi): number {
  const actual = kpiActualNumericForProgress(kpi)
  const targetFull = kpiTargetNumericForProgress(kpi)
  if (targetFull == null || targetFull <= 0) {
    const t = parseNumericFromField(String(kpi.target ?? ''))
    return completionPctFromActualTarget(actual, t)
  }
  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull > 0
  const effectiveTarget = isMidYear803 ? targetFull / 2 : targetFull
  return completionPctFromActualTarget(actual, effectiveTarget)
}

function kpiTargetNumericForProgress(kpi: GmHierarchyKpi): number | null {
  const t = parseNumericFromField(String(kpi.target ?? ''))
  return t != null && Number.isFinite(t) ? t : null
}

/**
 * Đèn KPI: cascading = % aggregate KPI; individual/promotion = TB % member (cùng cột tiến độ).
 */
function kpiStatusFromDiagnosticsProgress(kpi: GmHierarchyKpi): GmHierarchyStatus | null {
  if (kpi.kpiType === 'cascading') {
    const targetFull = kpiTargetNumericForProgress(kpi)
    if (targetFull == null || targetFull <= 0) return null
    const pct = kpiCompletionPct(kpi)
    if (pct >= 80) return 'success'
    if (pct >= 60) return 'warning'
    return 'danger'
  }
  if (kpi.kpiType !== 'individual' && kpi.kpiType !== 'promotion') return null
  if (!kpiHasNonCascadingRollupMembers(kpi)) return null
  const pct = kpiNonCascadingRollupCompletionPct(kpi)
  if (pct >= 80) return 'success'
  if (pct >= 60) return 'warning'
  return 'danger'
}

function kpiStatusForUi(kpi: GmHierarchyKpi): GmHierarchyStatus {
  return kpi.status
}

/**
 * Trạng thái hiển thị node KPI (cascading): giống `memberStatusForUiMidYear` —
 * ưu tiên % tiến độ (đã gồm mid-year 803), rồi fallback + nới đèn 803 khi không suy được %.
 */
function kpiStatusForUiMidYear(kpi: GmHierarchyKpi): GmHierarchyStatus {
  const fromProgress = kpiStatusFromDiagnosticsProgress(kpi)
  if (fromProgress != null) return fromProgress

  const base = kpiStatusForUi(kpi)
  const targetFull = kpiTargetNumericForProgress(kpi)
  const actualNum = kpiActualNumericForProgress(kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803 && base === 'danger') {
    if (actualNum != null && actualNum >= targetFull / 2) return 'success'
    if (actualNum != null && actualNum >= targetFull * 0.3) return 'warning'
  }

  return base
}

function pmTargetNumericForProgress(pm: GmHierarchyPm): number | null {
  const t = parseNumericFromField(String(pm.target ?? ''))
  return t != null && Number.isFinite(t) ? t : null
}

/**
 * Đèn dòng PM: cascading = `pmCompletionPct`; individual/promotion = TB % member dưới PM.
 */
function pmStatusFromDiagnosticsProgress(pm: GmHierarchyPm, kpi: GmHierarchyKpi): GmHierarchyStatus | null {
  if (kpi.kpiType === 'cascading') {
    const targetFull = pmTargetNumericForProgress(pm)
    if (targetFull == null || targetFull <= 0) return null
    const pct = pmCompletionPct(pm, kpi)
    if (pct >= 80) return 'success'
    if (pct >= 60) return 'warning'
    return 'danger'
  }
  if (kpi.kpiType !== 'individual' && kpi.kpiType !== 'promotion') return null
  if (!pmHasNonCascadingRollupMembers(pm, kpi)) return null
  const pct = pmNonCascadingRollupCompletionPct(pm, kpi)
  if (pct >= 80) return 'success'
  if (pct >= 60) return 'warning'
  return 'danger'
}

function pmStatusForUiMidYear(pm: GmHierarchyPm, kpi: GmHierarchyKpi): GmHierarchyStatus {
  const fromProgress = pmStatusFromDiagnosticsProgress(pm, kpi)
  if (fromProgress != null) return fromProgress

  const base = pm.status
  const targetFull =
    kpi.kpiType === 'cascading'
      ? pmTargetNumericForProgress(pm)
      : parseNumericFromField(pmTargetDisplayRaw(pm, kpi)) ?? pmTargetNumericForProgress(pm)
  const actualNum = pmActualNumericForProgress(pm, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803 && base === 'danger') {
    if (actualNum != null && actualNum >= targetFull / 2) return 'success'
    if (actualNum != null && actualNum >= targetFull * 0.3) return 'warning'
  }

  return base
}

/** Format số % (làm tròn) thành chuỗi hiển thị. */
function formatCompletionPct(pct: number): string {
  return `${Math.round(pct)}%`
}

/**
 * Màu chữ cho cột tiến độ (4 mức; % đã clamp tối đa 100):
 * - 100%: Xanh đậm (hoàn thành chỉ tiêu)
 * - 80–99%: Xanh lá (đúng tiến độ)
 * - 60–79%: Vàng (gần đạt)
 * - < 60%: Đỏ (chưa đạt)
 */
function completionPctTextClass(pct: number): string {
  if (pct >= 100) return 'text-green-700'
  if (pct >= 80) return 'text-green-500'
  if (pct >= 60) return 'text-amber-500'
  return 'text-red-600'
}

/** Dòng member: 0% chưa nộp, 100% đã nộp-duyệt. */
function diagnosticsMemberProgressPct(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  return formatCompletionPct(memberCompletionPct(member, kpi))
}

function diagnosticsMemberProgressTextClass(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  return completionPctTextClass(memberCompletionPct(member, kpi))
}

/** Sort important KPIs first, then alphabetically by KPI name. */
function sortImportantKpisFirst(list: GmHierarchyKpi[]): GmHierarchyKpi[] {
  return [...list].sort((a, b) => {
    const pa = a.isImportant === true ? 1 : 0
    const pb = b.isImportant === true ? 1 : 0
    const byPriority = pb - pa
    if (byPriority !== 0) return byPriority
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'en', {
      sensitivity: 'base',
      numeric: true,
    })
  })
}

/** Bỏ phần trước dấu «·» trên `unitLine` (nhãn vai trò từ DB + tên phòng). */
function stripRollupUnitLinePrefix(line: string | null | undefined): string {
  const s = String(line ?? '').trim()
  const idx = s.indexOf('·')
  if (idx < 0) return s
  return s.slice(idx + 1).trim()
}

/** Nhãn khối / line quản lý (ưu tiên `unitLine`, bỏ prefix vai trò) — dùng cả filter và cột bảng. */
function pmManagedSectionLabel(pm: GmHierarchyPm): string {
  const fromLine = stripRollupUnitLinePrefix(pm.unitLine)
  if (fromLine) return fromLine
  return 'Managed section'
}

/** Viền tag theo `roles.code` (màu gợi ý); nhãn tag = code (không dùng `roles.name` trên UI). */
function badgeClassForRoleCode(code: string | null | undefined): string {
  const c = String(code ?? '').trim().toUpperCase()
  switch (c) {
    case 'TEAM':
      return 'border-emerald-200/80 bg-white text-emerald-800'
    case 'LEADER':
      return 'border-violet-200/80 bg-white text-violet-800'
    case 'GM':
      return 'border-amber-200/80 bg-white text-amber-900'
    case 'MEMBER':
      return 'border-slate-200/80 bg-white text-slate-700'
    case 'PM':
      return 'border-indigo-200/80 bg-white text-indigo-700'
    default:
      return 'border-slate-200/80 bg-white text-slate-600'
  }
}

/** Tag vai trò: chỉ hiển thị `roles.code` (API), không dùng full name. */
function rollupRoleBadgeFromCode(code: string | null | undefined): {
  label: string
  badgeClass: string
} | null {
  const raw = String(code ?? '').trim()
  if (!raw) return null
  const u = raw.toUpperCase()
  const label = u.length > 14 ? `${u.slice(0, 14)}…` : u
  return { label, badgeClass: badgeClassForRoleCode(raw) }
}

function pmRollupRoleBadge(pm: GmHierarchyPm): { label: string; badgeClass: string } | null {
  if (isUnassignedPmNode(pm)) {
    return null
  }
  const fromCode = rollupRoleBadgeFromCode(pm.ownerRoleCode)
  if (fromCode) return fromCode
  const ul = pm.unitLine?.trim() ?? ''
  const beforeDot = /^([^·]+)\s*·/.exec(ul)?.[1]?.trim()
  if (beforeDot) return { label: beforeDot.toUpperCase(), badgeClass: badgeClassForRoleCode(beforeDot) }
  return null
}

function pmRollupShortRoleForLabel(pm: GmHierarchyPm): string {
  const c = pm.ownerRoleCode?.trim()
  if (c) return c.toUpperCase()
  return pmRollupRoleBadge(pm)?.label ?? '-'
}

function pmRollupOwnerSubtitle(pm: GmHierarchyPm): string {
  if (isUnassignedPmNode(pm)) return ''
  const ct = String(pm.ownerRoleCode ?? '').toUpperCase()
  if (ct === 'TEAM') return 'Team assignment'
  if (ct) return `${ct} owner`
  return 'Section manager'
}

function pmRollupOwnerSrOnly(pm: GmHierarchyPm): string {
  if (isUnassignedPmNode(pm)) return 'Unassigned status'
  const ct = String(pm.ownerRoleCode ?? '').toUpperCase()
  if (ct === 'TEAM') return 'Team KPI row — assignees listed below'
  if (ct) return `${ct} group owner`
  return 'Section manager for group'
}

function isUnassignedPmNode(pm: GmHierarchyPm | null | undefined): boolean {
  return String(pm?.id ?? '').includes('diag-pm-unassigned')
}

function leaderRollupRoleBadge(leader: GmHierarchyLeader): { label: string; badgeClass: string } | null {
  return rollupRoleBadgeFromCode(leader.ownerRoleCode)
}

function memberRollupRoleBadge(member: GmHierarchyMember): { label: string; badgeClass: string } | null {
  return rollupRoleBadgeFromCode(member.ownerRoleCode)
}

const diagnosticsSectionOptions = computed(() => {
  const set = new Set<string>()
  for (const k of props.rows) {
    for (const pm of k.pmOwners) {
      set.add(pmManagedSectionLabel(pm))
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'))
})

const diagnosticsMemberOptions = computed(() => {
  const set = new Set<string>()
  for (const k of props.rows) {
    for (const pm of k.pmOwners) {
      for (const m of allMembersUnderPm(pm)) {
        const n = String(m.name ?? '').trim()
        if (n) set.add(n)
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'))
})

const STATUS_FILTER_OPTIONS: number[] = [
  KPI_STATUS.INACTIVE,
  KPI_STATUS.WAITING_PM_APPROVAL,
  KPI_STATUS.WAITING_GM_APPROVAL,
  KPI_STATUS.PENDING_ACCEPTANCE,
  KPI_STATUS.ACCEPTED,
  KPI_STATUS.REJECTED,
  KPI_STATUS.FEEDBACK_IN_PROGRESS,
  KPI_STATUS.FIRST_WAITING_PM_APPROVAL,
  KPI_STATUS.FIRST_WAITING_GM_APPROVAL,
  KPI_STATUS.FIRST_COMPLETED,
  KPI_STATUS.SECOND_WAITING_PM_APPROVAL,
  KPI_STATUS.SECOND_WAITING_GM_APPROVAL,
  KPI_STATUS.COMPLETED,
]

function toggleDraftSection(section: string) {
  const cur = draftSections.value
  const i = cur.indexOf(section)
  draftSections.value = i === -1 ? [...cur, section] : cur.filter((s) => s !== section)
}

function toggleDraftMember(name: string) {
  const cur = draftMembers.value
  const i = cur.indexOf(name)
  draftMembers.value = i === -1 ? [...cur, name] : cur.filter((s) => s !== name)
}

function toggleDraftStatus(st: number) {
  const cur = draftStatuses.value
  const i = cur.indexOf(st)
  draftStatuses.value = i === -1 ? [...cur, st] : cur.filter((s) => s !== st)
}

function kpiMatchesToolbarFilters(kpi: GmHierarchyKpi): boolean {
  if (filterImportant.value === 'yes' && kpi.isImportant !== true) return false
  if (filterImportant.value === 'no' && kpi.isImportant === true) return false
  if (filterStatuses.value.length > 0) {
    const code = kpiAsmStatusCode(kpi)
    if (code == null || !filterStatuses.value.includes(code)) return false
  }
  if (filterSections.value.length > 0) {
    const secSet = new Set(filterSections.value.map((s) => s.trim()).filter(Boolean))
    const ok = kpi.pmOwners.some((pm) => secSet.has(pmManagedSectionLabel(pm)))
    if (!ok) return false
  }
  if (filterMembers.value.length > 0) {
    const memSet = new Set(filterMembers.value.map((s) => s.trim()).filter(Boolean))
    const ok = kpi.pmOwners.some((pm) =>
      allMembersUnderPm(pm).some((m) => memSet.has(String(m.name ?? '').trim())),
    )
    if (!ok) return false
  }
  return true
}

const fullFilteredRows = computed(() => {
  let list = sortImportantKpisFirst(props.rows).filter(kpiMatchesToolbarFilters)
  return sortImportantKpisFirst(list)
})

/**
 * Lọc theo khối: chỉ còn dòng PM thuộc khối đó (và toàn bộ member dưới PM).
 * Lọc theo thành viên: chỉ còn PM có member đó, và **chỉ** dòng member đó.
 */
function projectKpiRowForToolbarFilters(kpi: GmHierarchyKpi): GmHierarchyKpi {
  const secSet = new Set(filterSections.value.map((s) => s.trim()).filter(Boolean))
  const memSet = new Set(filterMembers.value.map((s) => s.trim()).filter(Boolean))
  if (secSet.size === 0 && memSet.size === 0) return kpi

  let pms = kpi.pmOwners
  if (secSet.size > 0) {
    pms = pms.filter((pm) => secSet.has(pmManagedSectionLabel(pm)))
  }
  if (memSet.size > 0) {
    pms = pms
      .map((pm) => {
        const hit = (name: string | null | undefined) => memSet.has(String(name ?? '').trim())
        const members = pm.members.filter((m) => hit(m.name))
        const hadLeaders = Boolean(pm.leaders && pm.leaders.length > 0)
        let leaders = pm.leaders
        if (hadLeaders && pm.leaders) {
          const mapped = pm.leaders.map((ldr) => ({
            ...ldr,
            members: ldr.members.filter((m) => hit(m.name)),
            leaderOwnRow:
              ldr.leaderOwnRow != null && hit(ldr.leaderOwnRow.name) ? ldr.leaderOwnRow : undefined,
          }))
          const filtered = mapped.filter((ldr) => ldr.members.length > 0 || ldr.leaderOwnRow != null)
          leaders = filtered.length > 0 ? filtered : undefined
        }
        const hasRollout =
          members.length > 0 || Boolean(leaders && leaders.length > 0)
        if (!hasRollout) return null
        const result: GmHierarchyPm = { ...pm, members }
        if (hadLeaders) {
          result.leaders = leaders
        }
        return result
      })
      .filter((pm): pm is GmHierarchyPm => pm != null)
  }
  return { ...kpi, pmOwners: pms }
}

const prunedFilteredRows = computed(() => {
  if (filterSections.value.length === 0 && filterMembers.value.length === 0) {
    return fullFilteredRows.value
  }
  return fullFilteredRows.value.map(projectKpiRowForToolbarFilters)
})

type DiagnosticsTableGroup = { key: string; label: string; rows: GmHierarchyKpi[] }

/** Nhóm theo `kpi_categories` khi có `categoryId`; không thì nhóm theo `diagnosticsFallbackGroup` (mock). */
function buildDisplayGroups(list: GmHierarchyKpi[]): DiagnosticsTableGroup[] {
  const useCategory = list.some((k) => Boolean(k.categoryId?.trim()))
  if (useCategory) {
    const meta = new Map<string, { label: string; rows: GmHierarchyKpi[] }>()
    for (const k of list) {
      const id = k.categoryId?.trim() || 'uncategorized'
      const label = k.categoryName?.trim() || 'Uncategorized'
      if (!meta.has(id)) meta.set(id, { label, rows: [] })
      meta.get(id)!.rows.push(k)
    }
    return [...meta.entries()]
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'en'))
      .map(([key, v]) => ({ key, label: v.label, rows: sortImportantKpisFirst(v.rows) }))
  }
  const m = new Map<GmBscPerspective, GmHierarchyKpi[]>()
  for (const id of GM_BSC_ORDER) m.set(id, [])
  for (const k of list) m.get(normalizeGmBscPerspective(k.diagnosticsFallbackGroup))!.push(k)
  return GM_BSC_ORDER.map((perspective) => ({
    key: perspective,
    label: GM_BSC_LABELS[perspective],
    rows: sortImportantKpisFirst(m.get(perspective)!),
  })).filter((g) => g.rows.length > 0)
}

const visibleRowGroups = computed(() => buildDisplayGroups(prunedFilteredRows.value))

const expandedSectionKeys = ref<Set<string>>(new Set())

watch(
  visibleRowGroups,
  (groups) => {
    expandedSectionKeys.value = new Set(groups.map((g) => g.key))
  },
  { immediate: true },
)

function sectionDomId(key: string): string {
  return `gm-diag-sec-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function toggleSection(sectionKey: string) {
  const s = new Set(expandedSectionKeys.value)
  if (s.has(sectionKey)) s.delete(sectionKey)
  else s.add(sectionKey)
  expandedSectionKeys.value = s
}

watch([filterStatuses, filterImportant, filterSections, filterMembers], () => {
  const memSet = new Set(filterMembers.value.map((s) => s.trim()).filter(Boolean))
  const secSet = new Set(filterSections.value.map((s) => s.trim()).filter(Boolean))
  if (memSet.size === 0 && secSet.size === 0) {
    return
  }
  const kpiIds = new Set<string>()
  const pmIds = new Set<string>()
  for (const k of props.rows) {
    if (!kpiMatchesToolbarFilters(k)) continue
    for (const pm of k.pmOwners) {
      if (secSet.size > 0 && !secSet.has(pmManagedSectionLabel(pm))) continue
      if (memSet.size > 0 && !allMembersUnderPm(pm).some((m) => memSet.has(String(m.name ?? '').trim())))
        continue
      kpiIds.add(k.id)
      if (pmHasRollout(pm)) pmIds.add(pm.id)
    }
  }
  expandedKpis.value = kpiIds
  expandedPms.value = pmIds
})

function badgeClass(status: GmHierarchyStatus) {
  switch (status) {
    case 'success':
      return 'border-green-200 bg-green-100 text-green-700'
    case 'warning':
      return 'border-yellow-200 bg-yellow-100 text-yellow-700'
    case 'danger':
      return 'border-red-200 bg-red-100 text-red-700'
  }
}

/** Tooltip trên badge trạng thái — chỉ lý do / tồn đọng (không lặp nhãn trạng thái). */
function diagnosticsReasonTooltip(text: unknown): string | undefined {
  const t = String(text ?? '').trim()
  if (!t || t === '-' || t === '—' || t === '–') return undefined
  return t.includes('—') ? t.replace(/\u2014/g, '-') : t
}

function kpiIconWrapClass(status: GmHierarchyStatus) {
  if (status === 'danger') return 'bg-red-100 text-red-600'
  if (status === 'warning') return 'bg-yellow-100 text-yellow-600'
  return 'bg-green-100 text-green-600'
}

const showMemberDrawer = ref(false)
const drawerMember = shallowRef<GmMemberKpiDrawerProfile | null>(null)
const drawerKpiItems = shallowRef<GmModalKpiItemMock[]>([])
const drawerPmKpiRollout = shallowRef<GmPmKpiRolloutPayload | null>(null)

function memberDrawerDepartmentLabel(pm: GmHierarchyPm, _kpi: GmHierarchyKpi) {
  const fromLine = stripRollupUnitLinePrefix(pm.unitLine)
  if (fromLine) return fromLine.toUpperCase()
  return undefined
}

function rolloutMembersForDrawer(pm: GmHierarchyPm, kpi: GmHierarchyKpi): GmHierarchyMember[] {
  return allMembersUnderPm(pm)
}

function parseWeightPct(weight: string): number {
  const n = parseInt(String(weight).replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/** Cột trọng số diagnostics — hiển thị số, không kèm ký tự %. */
function diagnosticsWeightDisplay(w: string | null | undefined): string {
  const s = String(w ?? '').trim()
  if (!s || s === '—' || s === '-' || s === '–') return '-'
  const withoutPct = s.replace(/\s*%+\s*$/, '').trim()
  return withoutPct || '-'
}

/** Trọng số department: nếu chưa có thì fallback lấy trọng số của KPI (đặc biệt khi chưa assign). */
function pmWeightDisplayRaw(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const w = String(pm.weight ?? '').trim()
  if (!w || w === '—' || w === '-' || w === '–') {
    return diagnosticsWeightDisplay(kpi.weight)
  }
  return diagnosticsWeightDisplay(pm.weight)
}

/**
 * Pill cột Target — đổi màu theo `targetBalance` (so tổng target con vs target cha).
 * Dùng cho node KPI (`kpi.targetBalance`) và node department (`pm.targetBalance`).
 * Dòng assignee (MEMBER / PM / LEADER) dưới department: `diagnosticsAssigneeTargetPillClass()`.
 */
function diagnosticsTargetPillClass(balance: GmHierarchyTargetBalance | null | undefined): string {
  const base =
    'inline-block max-w-full min-w-[2.25rem] rounded-md px-1.5 py-1 text-xs font-semibold tabular-nums leading-tight'
  if (balance === 'short') return `${base} border border-rose-200 bg-rose-50 text-rose-800`
  if (balance === 'excess') return `${base} border border-amber-200 bg-amber-50 text-amber-900`
  if (balance === 'ok') return `${base} border border-emerald-200 bg-emerald-50 text-emerald-800`
  /* Giống pill Trọng số (xám), không viền */
  return `${base} bg-slate-100 text-slate-700`
}

function diagnosticsTargetTitle(balance: GmHierarchyTargetBalance | null | undefined): string | undefined {
  if (balance === 'short') return 'Allocated targets sum below the parent target (short).'
  if (balance === 'excess') return 'Allocated targets sum above the parent target (excess).'
  if (balance === 'ok') return 'Allocated targets match the parent target (balanced).'
  return undefined
}

/** Cột Target trên dòng assignee: pill xám — không short/excess/ok (Member và PM giống nhau). */
function diagnosticsAssigneeTargetPillClass(): string {
  return diagnosticsTargetPillClass(undefined)
}

function submissionFromMemberStatus(s: GmHierarchyStatus): GmKpiSubmissionStatus {
  if (s === 'danger') return 'missing_data'
  if (s === 'warning') return 'submitted'
  return 'submitted_with_file'
}

/** Một dòng KPI trong drawer — đúng KPI đang xem trên bảng, không phải toàn bộ KPI của member. */
function memberRowToModalItem(member: GmHierarchyMember, kpi: GmHierarchyKpi): GmModalKpiItemMock {
  const rawBlocker = String(member.blocker ?? '').trim()
  const parsedEv = parsePmPortfolioEvidenceString(member.evidences)
  const rolloutEvidence = evidenceTableFromEvidencesJson(
    member.evidences,
    kpi.calculationRuleCode,
  )
  const drawerTarget =
    member.submissionTarget != null
      ? String(member.submissionTarget)
      : formatKpiTargetWithUnit(diagnosticsTableCellText(member.target), kpi.unitCode)
  // Drawer rollout phải dùng actual thực tế (evidences/actual), không dùng score submissionActual.
  const drawerActual = memberActualDisplayRaw(member, kpi)
  return {
    code: member.id,
    obj: kpi.name,
    weight: parseWeightPct(kpi.weight),
    target: drawerTarget,
    actual: drawerActual,
    calcRuleCode: normalizeCalculationRuleCode(kpi.calculationRuleCode),
    isFail: memberStatusForUiMidYear(member, kpi) === 'danger',
    rootCause:
      rawBlocker && rawBlocker !== '-' && rawBlocker !== '—' && rawBlocker !== '–'
        ? diagnosticsTableCellText(member.blocker)
        : '',
    score: memberTableScoreDisplay(member),
    kpiType: kpi.kpiType,
    submissionStatus: submissionFromMemberStatus(memberStatusForUiMidYear(member, kpi)),
    assignmentStatusCode: member.assignmentStatusCode ?? null,
    targetSummary: `Contribution in KPI «${kpi.name}»`,
    actualProgressPct: memberDrawerActualProgressPct(member, kpi),
    evidenceAttachmentUrl: member.evidenceAttachmentUrl ?? null,
    rolloutEvidence,
    evidenceData: parsedEv.rows,
    evidenceContent: parsedEv.content || parsedEv.note || parsedEv.legacyPlain || '',
    evidenceAttachments: parsedEv.attachments ?? [],
  }
}

function openPmKpiDrawer(pm: GmHierarchyPm, kpi: GmHierarchyKpi) {
  const rolloutMembers = rolloutMembersForDrawer(pm, kpi)
  if (!rolloutMembers.length) return
  drawerPmKpiRollout.value = {
    pmName: pm.name,
    rollupRoleLabel: pmRollupShortRoleForLabel(pm),
    pmUnitLine: pm.unitLine,
    kpiName: kpi.name,
    kpiTarget: diagnosticsTargetWithUnit(kpi, kpi.target),
    rows: rolloutMembers.map((m) => ({
      profile: {
        name: m.name,
        rank: m.rank,
        leader: m.leader,
        departmentLabel: memberDrawerDepartmentLabel(pm, kpi),
      },
      item: memberRowToModalItem(m, kpi),
    })),
  }
  drawerMember.value = null
  drawerKpiItems.value = []
  showMemberDrawer.value = true
}

function closeMemberDrawer() {
  showMemberDrawer.value = false
  drawerKpiItems.value = []
  drawerMember.value = null
  drawerPmKpiRollout.value = null
}
</script>

<script lang="ts">
export default {
  name: 'GmKpiDiagnosticsTable',
}
</script>

<template>
  <div>
    <div id="diagnostics-section"
      class="w-auto animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white pb-4 shadow-sm">
      <!-- Header + nút Bộ lọc (popover theo Documents/index.html) -->
      <div class="flex flex-col gap-3 border-b border-slate-200 bg-white p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <h3
              class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 sm:text-sm">
              <i class="fas fa-layer-group text-[11px] text-blue-600 sm:text-xs" />
              Strategic KPIs Tracking & Diagnostics
            </h3>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 self-start lg:self-auto">
            <button v-if="appliedFilterCount > 0" type="button"
              class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50/80 hover:text-rose-800"
              aria-label="Reset all filters" @click.stop="resetAllDiagnosticFilters">
              <i class="fas fa-rotate-left text-[11px] text-slate-500" aria-hidden="true" />
              Reset filters
            </button>
            <div ref="filterPopoverWrapRef" class="relative">
              <button type="button"
                class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                aria-haspopup="dialog" :aria-expanded="filterPopoverOpen" @click.stop="toggleFilterPopover">
                <i class="fas fa-sliders-h text-sm text-slate-500" aria-hidden="true" />
                Filters
                <span v-if="appliedFilterCount > 0"
                  class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-blue-700">{{
                  appliedFilterCount }}</span>
              </button>
            </div>
          </div>
        </div>

        <Teleport to="body">
          <Transition name="gm-diag-filter-pop">
            <div v-if="filterPopoverOpen" ref="filterPopoverPanelRef"
              class="fixed z-[200] flex max-h-[min(24rem,calc(100vh-1rem))] origin-top-right flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              :style="filterPanelFixedStyle" role="dialog" aria-label="Customize filters" @click.stop>
              <div class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Customize display
                </h4>
                <button type="button" class="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  @click="resetAllDiagnosticFilters">
                  Reset filters
                </button>
              </div>

              <div class="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Section
                  </label>
                  <div v-if="diagnosticsSectionOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    No sections in the current data.
                  </div>
                  <div v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group" aria-label="Select sections">
                    <label v-for="s in diagnosticsSectionOptions" :key="s"
                      class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <input type="checkbox"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftSections.includes(s)" @change="toggleDraftSection(s)" />
                      <span class="min-w-0 leading-snug">{{ s }}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Members
                  </label>
                  <div v-if="diagnosticsMemberOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    No members in the current data.
                  </div>
                  <div v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group" aria-label="Select members">
                    <label v-for="n in diagnosticsMemberOptions" :key="n"
                      class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <input type="checkbox"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftMembers.includes(n)" @change="toggleDraftMember(n)" />
                      <span class="min-w-0 leading-snug">{{ n }}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500" for="diag-draft-important">
                    Importance
                  </label>
                  <div class="relative">
                    <select id="diag-draft-important" v-model="draftImportant"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-amber-500">
                      <option value="">All</option>
                      <option value="yes">Important KPIs only (⭐)</option>
                      <option value="no">Regular KPIs (not starred)</option>
                    </select>
                    <i class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    KPI status
                  </label>
                  <div class="space-y-1 rounded-lg border border-slate-200 bg-white p-2" role="group"
                    aria-label="Select KPI statuses">
                    <label v-for="st in STATUS_FILTER_OPTIONS" :key="st"
                      class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <input type="checkbox"
                        class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftStatuses.includes(st)" @change="toggleDraftStatus(st)" />
                      <span>{{ asmStatusLabel(st) }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <button type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200/60"
                  @click="cancelFilterPopover">
                  Cancel
                </button>
                <button type="button"
                  class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                  @click="applyPopoverFilters">
                  Apply / Filter
                </button>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Chip bộ lọc đang áp dụng (index.html #active-filters-container) -->
        <div v-if="activeFilterChips.length > 0"
          class="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
          <span class="mt-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Filtering by:
          </span>
          <div class="flex flex-wrap gap-2">
            <span v-for="chip in activeFilterChips" :key="chip.key + chip.label"
              class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
              {{ chip.label }}
              <button type="button"
                class="ml-0.5 rounded p-0.5 text-blue-400 hover:text-blue-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                :aria-label="`Remove filter ${chip.label}`" @click="removeAppliedFilterChip(chip.key)">
                <i class="fas fa-times text-[10px]" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <KpiCreatorRowLegend />

      <div class="overflow-x-auto">
        <div class="min-w-[1080px] divide-y divide-slate-200">
          <!-- 4+1+2+2+1+2+2+1 - Thêm cột Actual nằm giữa Target và Tiến độ -->
          <div
            class="sticky top-0 z-10 grid grid-cols-15 gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 sm:gap-3">
            <div class="col-span-4 pl-6">KPI target &amp; Department / Member</div>
            <div class="col-span-1 text-center">Weight</div>
            <div class="col-span-2 text-center">Target</div>
            <div class="col-span-2 text-center">Actual</div>
            <div class="col-span-1 text-center leading-tight" title="Completion progress.">
              Completion
            </div>
            <div class="col-span-2 text-center">Score</div>
            <div class="col-span-2 text-center">Status</div>
            <div class="col-span-1 text-center">Actions</div>
          </div>

          <template v-for="group in visibleRowGroups" :key="'sec-' + group.key">
            <div class="border-b border-slate-200 bg-slate-50">
              <button type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
                :aria-expanded="expandedSectionKeys.has(group.key)" :aria-controls="sectionDomId(group.key)"
                @click="toggleSection(group.key)">
                <i class="fas fa-chevron-right w-3 shrink-0 text-center text-[10px] text-slate-500 transition-transform duration-200 motion-reduce:transition-none"
                  :class="expandedSectionKeys.has(group.key) ? 'rotate-90' : ''" aria-hidden="true" />
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-800">{{ group.label }}</span>
                <span
                  class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">{{
                    group.rows.length }} KPI</span>
              </button>
            </div>
            <div :id="sectionDomId(group.key)"
              class="grid overflow-hidden border-b border-slate-200 transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
              :class="expandedSectionKeys.has(group.key) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
              <div class="min-h-0 divide-y divide-slate-200">
                <template v-for="kpi in group.rows" :key="kpi.id">
                  <!-- Dòng KPI -->
                  <div class="flex flex-col">
                    <div
                      class="grid cursor-pointer grid-cols-15 items-center gap-2 px-3 py-2.5 transition-colors sm:gap-3"
                      :class="kpiCreatorRowBgClass(kpi.creatorRoleCode, expandedKpis.has(kpi.id))"
                      @click="toggleKpi(kpi.id)">
                      <div class="col-span-4 flex items-center">
                        <button type="button" class="mr-1 p-0.5 text-slate-500 hover:text-slate-800"
                          aria-label="Expand KPI" :aria-expanded="expandedKpis.has(kpi.id)"
                          @click.stop="toggleKpi(kpi.id)">
                          <i class="fas fa-chevron-right text-xs transition-transform duration-300 ease-out motion-reduce:transition-none"
                            :class="expandedKpis.has(kpi.id) ? 'rotate-90' : 'rotate-0'" />
                        </button>
                        <div class="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm"
                          :class="kpiIconWrapClass(kpiStatusForUiMidYear(kpi))">
                          <i class="fas fa-bullseye text-[11px]" />
                        </div>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <span class="text-sm font-bold leading-snug text-slate-800">{{ kpi.name }}</span>
                            <GmStrategicKpiTypeTag :type="kpi.kpiType" size="sm" class="shrink-0" />
                            <template v-for="rankTag in [kpiAssignedRankTag(kpi)]" :key="`rank-tag-${kpi.id}`">
                              <span
                                v-if="rankTag"
                                class="shrink-0 rounded border border-sky-200 bg-sky-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-sky-700"
                                :title="`Assigned ranks: ${rankTag}`"
                              >
                                {{ rankTag }}
                              </span>
                            </template>
                            <i v-if="kpi.isImportant" class="fas fa-star shrink-0 text-[11px] text-amber-500"
                              title="Important KPI" aria-label="Important KPI" />
                          </div>
                        </div>
                      </div>
                      <div class="col-span-1 text-center">
                        <span
                          class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                          diagnosticsWeightDisplay(kpi.weight) }}</span>
                      </div>
                      <div class="col-span-2 grid grid-cols-[1fr_auto_1fr] items-center text-center">
                        <span
                          class="col-start-2"
                          :class="diagnosticsTargetPillClass(kpi.targetBalance)"
                          :title="diagnosticsTargetTitle(kpi.targetBalance)">{{ diagnosticsTargetWithUnit(kpi, kpi.target) }}</span>
                        <span class="col-start-3 ml-1.5 inline-flex justify-self-start">
                          <KpiScoringRulesPreviewTooltip :target-description="kpi.scoringRulesText" />
                        </span>
                      </div>
                      <div class="col-span-2 text-center text-sm font-bold tabular-nums"
                        :class="kpiRowDiagnosticsActualColorClass(kpi)">
                        {{ kpiActualWithUnit(kpi) }}
                      </div>
                      <div
                        class="col-span-1 text-center text-xs font-bold tabular-nums"
                        :class="
                          kpi.kpiType === 'cascading'
                            ? completionPctTextClass(kpiCompletionPct(kpi))
                            : kpiHasNonCascadingRollupMembers(kpi)
                              ? completionPctTextClass(kpiNonCascadingRollupCompletionPct(kpi))
                              : 'text-slate-400'
                        "
                        :title="
                          kpi.kpiType === 'cascading'
                            ? 'Completion: (Actual / Target) x 100, capped at 100%.'
                            : kpiHasNonCascadingRollupMembers(kpi)
                              ? 'Individual/Promotion: average completion % for members with a numeric target (max 100% per person).'
                              : undefined
                        ">
                        {{
                          kpi.kpiType === 'cascading'
                            ? formatCompletionPct(kpiCompletionPct(kpi))
                            : kpiHasNonCascadingRollupMembers(kpi)
                              ? formatCompletionPct(kpiNonCascadingRollupCompletionPct(kpi))
                              : '-'
                        }}
                      </div>
                      <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="kpiScoreClass(kpi)">
                        {{ kpiScoreDisplay(kpi) }}
                      </div>
                      <div class="col-span-2 flex justify-center">
                        <span
                          class="inline-flex max-w-full cursor-default items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                          :class="asmStatusPillClass(kpiAsmStatusCode(kpi))"
                          :title="asmStatusTitleForKpi(kpi)">
                          <span class="truncate">{{ asmStatusLabelForKpi(kpi) }}</span>
                        </span>
                      </div>
                      <div class="col-span-1 flex flex-wrap items-center justify-center gap-1" @click.stop>
                        <button type="button"
                          class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm transition-colors"
                          :class="
                            readonly
                              ? 'cursor-not-allowed text-slate-400 opacity-50'
                              : 'text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800'
                          "
                          :disabled="readonly"
                          :title="readonly ? 'Read-only mode - the cycle year is locked' : 'Edit KPI'"
                          aria-label="Edit KPI"
                          @click="onEditKpiClick(kpi)">
                          <i class="fas fa-pen text-[9px]" aria-hidden="true" />
                        </button>
                        <button type="button"
                          class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm transition-colors"
                          :class="
                            readonly
                              ? 'cursor-not-allowed text-slate-400 opacity-50'
                              : 'text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800'
                          "
                          :disabled="readonly"
                          :title="readonly ? 'Read-only mode - the cycle year is locked' : 'Delete KPI'"
                          aria-label="Delete KPI"
                          @click="onDeleteKpiClick(kpi)">
                          <i class="fas fa-trash text-[9px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <!-- Team / Individual / Promotion: KPI → department (khối) → assignee. -->
                    <div v-if="kpi.pmOwners.length > 0 || expandedKpis.has(kpi.id)"
                      class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                      :class="expandedKpis.has(kpi.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                      <div class="min-h-0">
                        <div class="border-t border-slate-100 bg-white pb-2">
                          <div
                            v-if="!kpiHasAssignments(kpi)"
                            class="border-b border-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-400"
                          >
                            No Assignment
                          </div>
                          <template v-for="pm in assignedPmOwners(kpi)" :key="pm.id">
                            <div class="flex flex-col">
                              <div
                                class="grid grid-cols-15 items-center gap-2 border-b border-slate-50 px-3 py-2 sm:gap-3"
                                :class="pmHasRollout(pm) ? 'cursor-pointer hover:bg-slate-50' : ''"
                                @click="pmHasRollout(pm) && togglePm(pm.id)">
                                <div class="col-span-4 flex min-w-0 items-center pl-6">
                                  <button type="button"
                                    class="mr-1 flex h-6 w-6 shrink-0 items-center justify-center text-slate-400"
                                    :disabled="!pmHasRollout(pm)"
                                    :aria-expanded="pmHasRollout(pm) ? expandedPms.has(pm.id) : undefined"
                                    @click.stop="pmHasRollout(pm) && togglePm(pm.id)">
                                    <i v-if="pmHasRollout(pm)"
                                      class="fas fa-chevron-right text-[10px] transition-transform duration-300 ease-out motion-reduce:transition-none"
                                      :class="expandedPms.has(pm.id) ? 'rotate-90' : 'rotate-0'" />
                                  </button>
                                  <i v-if="kpi.kpiType === 'cascading'"
                                    class="fas fa-sitemap mr-2 shrink-0 text-[11px] text-indigo-500" aria-hidden="true" />
                                  <i v-else class="fas fa-building mr-2 shrink-0 text-[11px] text-slate-500"
                                    aria-hidden="true" />
                                  <div class="min-w-0">
                                    <div class="truncate text-xs font-bold text-slate-800">
                                      {{ pmManagedSectionLabel(pm) }}
                                    </div>
                                    <div v-if="kpi.kpiType === 'cascading' && !pmHasRollout(pm) && !isUnassignedPmNode(pm)"
                                      class="mt-0.5 truncate text-xs font-medium text-slate-500">
                                      {{ pmRollupOwnerSubtitle(pm) }}: {{ pm.name }}
                                    </div>
                                  </div>
                                </div>
                                <div class="col-span-1 text-center">
                                  <span
                                    class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                      pmWeightDisplayRaw(pm, kpi)
                                    }}</span>
                                </div>
                                <div class="col-span-2 flex justify-center text-center">
                                  <span
                                    :class="diagnosticsTargetPillClass(pm.targetBalance)"
                                    :title="diagnosticsTargetTitle(pm.targetBalance)">{{ pmTargetWithUnit(pm, kpi) }}</span>
                                </div>
                                <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                  :class="pmRowDiagnosticsActualColorClass(pm, kpi)">
                                  {{ pmActualWithUnit(pm, kpi) }}
                                </div>
                                <div
                                  class="col-span-1 text-center text-xs font-bold tabular-nums"
                                  :class="
                                    kpi.kpiType === 'cascading'
                                      ? completionPctTextClass(pmCompletionPct(pm, kpi))
                                      : pmHasNonCascadingRollupMembers(pm, kpi)
                                        ? completionPctTextClass(pmNonCascadingRollupCompletionPct(pm, kpi))
                                        : 'text-slate-400'
                                  "
                                  :title="
                                    kpi.kpiType === 'cascading'
                                      ? 'Completion: (Actual / Target) x 100, capped at 100%.'
                                      : pmHasNonCascadingRollupMembers(pm, kpi)
                                        ? 'Individual/Promotion: average completion % for members with a numeric target under this PM (max 100% per person).'
                                        : undefined
                                  ">
                                  {{
                                    kpi.kpiType === 'cascading'
                                      ? formatCompletionPct(pmCompletionPct(pm, kpi))
                                      : pmHasNonCascadingRollupMembers(pm, kpi)
                                        ? formatCompletionPct(pmNonCascadingRollupCompletionPct(pm, kpi))
                                        : '-'
                                  }}
                                </div>
                                <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                  :class="pmSectionScoreClassForKpi(pm, kpi)">
                                  {{ pmSectionScoreDisplayForKpi(pm, kpi) }}
                                </div>
                                <div class="col-span-2 flex justify-center">
                                  <span
                                    class="inline-flex max-w-full cursor-default items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                                    :class="asmStatusPillClass(pmAsmStatusCode(pm, kpi))"
                                    :title="asmStatusTitleForDepartment(pm, pmAsmStatusCode(pm, kpi), kpi)">
                                    <span class="truncate">{{ asmStatusLabelForDepartment(pm, pmAsmStatusCode(pm, kpi), kpi) }}</span>
                                  </span>
                                </div>
                                <div class="col-span-1 flex flex-wrap items-center justify-center gap-1 pr-0.5">
                                  <button
                                    v-if="isPmFeedbackPendingForGm(pm)"
                                    type="button"
                                    class="inline-flex h-7 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100"
                                    title="Feedback"
                                    aria-label="Feedback"
                                    @click.stop="openFeedbackDrawerForPm(kpi, pm)"
                                  >
                                    <i class="fas fa-message text-[10px]" />
                                  </button>
                                  <button v-if="pmHasRollout(pm)" type="button"
                                    class="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold leading-tight text-indigo-700 transition-colors hover:bg-indigo-100 sm:px-2.5 sm:text-xs"
                                    @click.stop="openPmKpiDrawer(pm, kpi)">
                                      <i class="far fa-eye text-[10px]" />
                                  </button>
                                </div>
                              </div>

                              <div v-if="pmHasRollout(pm)"
                                class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                :class="expandedPms.has(pm.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                                <div class="min-h-0">
                                  <div class="border-y border-slate-100 bg-slate-50/50 py-1">
                                    <div v-for="member in allMembersUnderPm(pm)" :key="`${pm.id}::${String(member.id ?? '').trim() || member.name}`"
                                      class="grid grid-cols-15 items-center gap-2 border-l-2 border-slate-200/70 px-3 py-1.5 transition-colors hover:bg-white sm:gap-3">
                                      <div class="col-span-4 flex items-center pl-14">
                                        <div
                                          class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                                          <i class="fas fa-user text-[10px] text-slate-400" />
                                        </div>
                                        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                          <span class="text-xs font-semibold text-slate-700">{{ member.name }}</span>
                                          <template v-for="mb in [memberRollupRoleBadge(member)]"
                                            :key="`mbr-diag-${pm.id}-${member.id}`">
                                            <span v-if="mb"
                                              class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                              :class="mb.badgeClass">{{ mb.label }}</span>
                                          </template>
                                        </div>
                                      </div>
                                      <div class="col-span-1 text-center">
                                        <span
                                          class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                            diagnosticsWeightDisplay(member.weight)
                                          }}</span>
                                      </div>
                                      <div class="col-span-2 flex justify-center text-center">
                                        <span :class="diagnosticsAssigneeTargetPillClass()">{{
                                          memberTableTargetDisplayWithUnit(member, kpi)
                                        }}</span>
                                      </div>
                                      <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                        :class="memberActualColorClass(member, kpi)">
                                        {{ memberActualWithUnit(member, kpi) }}
                                      </div>
                                      <div
                                        class="col-span-1 text-center text-xs font-bold tabular-nums"
                                        :class="diagnosticsMemberProgressTextClass(member, kpi)"
                                        title="Completion: (Actual / Target) x 100, capped at 100%.">
                                        {{ diagnosticsMemberProgressPct(member, kpi) }}
                                      </div>
                                      <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="memberStatusForUiMidYear(member, kpi) === 'danger'
                                          ? 'text-red-600'
                                          : memberStatusForUiMidYear(member, kpi) === 'warning'
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                        " :title="memberDiagnosticsScoreTooltip(member)">
                                        {{ memberTableScoreDisplay(member) }}
                                      </div>
                                      <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                        <span
                                          class="inline-flex max-w-full cursor-default items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                                          :class="asmStatusPillClass(memberAsmStatusCode(member))"
                                          :title="asmStatusTitle(memberAsmStatusCode(member))">
                                          <span class="truncate">{{ asmStatusLabel(memberAsmStatusCode(member)) }}</span>
                                        </span>
                                      </div>
                                      <div class="col-span-1 flex justify-center">
                                        <button
                                          v-if="isMemberFeedbackPendingForGm(member)"
                                          type="button"
                                          class="inline-flex h-7 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100"
                                          title="Feedback"
                                          aria-label="Feedback"
                                          @click.stop="openFeedbackDrawerForMember(kpi, member)">
                                          <i class="fas fa-message text-[10px]" />
                                        </button>
                                        <span v-else class="text-xs text-slate-200">-</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <div v-if="prunedFilteredRows.length === 0" class="p-8 text-center text-xs font-medium text-slate-500">
            <p>No KPIs match the current filters.</p>
            <button v-if="appliedFilterCount > 0" type="button"
              class="mt-3 text-xs font-bold text-blue-600 hover:underline" @click="resetAllDiagnosticFilters">
              Clear filters
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="gm-diag-feedback-drawer">
        <div
          v-if="feedbackDrawerOpen && feedbackDrawerKpi"
          class="relative fixed inset-0 z-[220] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-diag-feedback-title"
        >
          <div class="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" @click="closeFeedbackDrawer" />
          <aside
            class="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header class="border-b border-slate-200 bg-white px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 id="gm-diag-feedback-title" class="truncate text-[28px] font-bold leading-tight text-slate-900">
                      {{ feedbackDrawerKpi.name }}
                    </h3>
                    <GmStrategicKpiTypeTag :type="feedbackDrawerKpi.kpiType" size="sm" />
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-slate-700">
                    <p>
                      Target:
                      <span class="font-bold text-slate-900">
                        {{ diagnosticsTargetWithUnit(feedbackDrawerKpi, feedbackDrawerKpi.target) }}
                      </span>
                    </p>
                    <p>
                      Weight:
                      <span class="font-bold text-slate-900">{{ diagnosticsWeightDisplay(feedbackDrawerKpi.weight) }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close feedback drawer"
                  @click="closeFeedbackDrawer">
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Adjustment request
                </h4>
                <div v-if="!activeFeedbackItem" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p class="text-xs font-medium text-slate-600">No pending feedback to review.</p>
                </div>
                <div v-else class="space-y-4">
                  <div>
                    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Full message
                    </label>
                    <div
                      class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                      {{ activeFeedbackItem.note }}
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      class="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                      @click="resolvePendingFeedback(activeFeedbackItem.assignmentId, false)"
                    >
                      Reject feedback
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                      @click="resolvePendingFeedback(activeFeedbackItem.assignmentId, true)">
                      <i class="fas fa-sliders-h text-xs" />
                      Approve feedback
                    </button>
                  </div>
                </div>
              </section>

            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <GmMemberKpiDrawer :open="showMemberDrawer" :member="drawerMember" :items="drawerKpiItems"
      :pm-kpi-rollout="drawerPmKpiRollout" @close="closeMemberDrawer" />
  </div>
</template>

<style scoped>
.gm-diag-filter-pop-enter-active,
.gm-diag-filter-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.gm-diag-filter-pop-enter-from,
.gm-diag-filter-pop-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.gm-diag-filter-pop-enter-to,
.gm-diag-filter-pop-leave-from {
  opacity: 1;
  transform: scale(1);
}

.gm-diag-feedback-drawer-enter-active,
.gm-diag-feedback-drawer-leave-active {
  transition: opacity 0.24s ease;
}

.gm-diag-feedback-drawer-enter-from,
.gm-diag-feedback-drawer-leave-to {
  opacity: 0;
}

.gm-diag-feedback-drawer-enter-active aside,
.gm-diag-feedback-drawer-leave-active aside {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.gm-diag-feedback-drawer-enter-from aside,
.gm-diag-feedback-drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
