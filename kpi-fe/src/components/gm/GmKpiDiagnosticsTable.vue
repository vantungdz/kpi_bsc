<script setup lang="ts">
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, nextTick } from 'vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
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
import { formatKpiTargetWithUnit } from '@/utils/kpiUnitCodes'
import {
  CALC_RULE_AVERAGE,
  CALC_RULE_COMMENT,
  formatPmPortfolioActualCell,
  parseNumericFromField,
} from '@/utils/memberKpiHelpers'
import type { KpiCycleResponse } from '@/types/shared/kpi-cycle.type'

const props = withDefaults(
  defineProps<{
    /** Dữ liệu từ API diagnostics — mặc định rỗng. */
    rows?: GmHierarchyKpi[]
    /** KPI Cycle info để xác định phase mid-year (tính tiến độ điều chỉnh cho CALC_RULE 803). */
    kpiCycle?: KpiCycleResponse | null
  }>(),
  { rows: () => [], kpiCycle: null },
)

const emit = defineEmits<{
  'edit-kpi': [kpi: GmHierarchyKpi]
  'delete-kpi': [kpi: GmHierarchyKpi]
  'resolve-feedback': [payload: { assignmentId: string; approve: boolean; kpi?: GmHierarchyKpi }]
}>()

function onEditKpiClick(kpi: GmHierarchyKpi) {
  emit('edit-kpi', kpi)
}

function onDeleteKpiClick(kpi: GmHierarchyKpi) {
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

function collectPendingFeedbackItems(kpi: GmHierarchyKpi): GmPendingFeedbackItem[] {
  const out: GmPendingFeedbackItem[] = []
  const seen = new Set<string>()
  for (const pm of kpi.pmOwners) {
    for (const member of allMembersUnderPm(pm)) {
      if (!isMemberFeedbackPendingForGm(member)) continue
      const assignmentId = String(member.assignmentId ?? '').trim()
      if (!assignmentId || seen.has(assignmentId)) continue
      seen.add(assignmentId)
      out.push({
        assignmentId,
        memberName: String(member.name ?? '').trim() || 'PM',
        roleLabel: String(member.ownerRoleCode ?? '').trim().toUpperCase() || 'PM',
        note: String(member.feedbackNote ?? '').trim() || 'Không có nội dung feedback.',
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

/** Tìm dòng member trong cây diagnostics theo `assignmentId` (vd. từ tab Approved KPI). */
function findMemberAndKpiForAssignment(assignmentId: string): {
  kpi: GmHierarchyKpi
  member: GmHierarchyMember
} | null {
  const aid = String(assignmentId ?? '').trim()
  if (!aid) return null
  for (const kpi of props.rows ?? []) {
    for (const pm of kpi.pmOwners ?? []) {
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
  emit('resolve-feedback', { assignmentId: aid, approve, kpi: feedbackDrawerKpi.value ?? undefined })
  closeFeedbackDrawer()
}

/** Trạng thái KPI đã chọn (rỗng = tất cả). */
const filterStatuses = ref<GmHierarchyStatus[]>([])
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
const draftStatuses = ref<GmHierarchyStatus[]>([])

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
  expandedLeaders.value = new Set()
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
  if (status === 'success') return 'Vượt tiến độ / Đạt–vượt'
  if (status === 'warning') return 'Đúng tiến độ / Gần đạt'
  return 'Chậm tiến độ / Không đạt'
}

type DiagnosticChipKey = 'section' | 'member' | 'important' | 'status'

const activeFilterChips = computed(() => {
  const chips: { key: DiagnosticChipKey; label: string }[] = []
  if (filterSections.value.length > 0) {
    chips.push({ key: 'section', label: `Khối: ${filterSections.value.join(', ')}` })
  }
  if (filterMembers.value.length > 0) {
    chips.push({ key: 'member', label: `Thành viên: ${filterMembers.value.join(', ')}` })
  }
  if (filterImportant.value === 'yes') {
    chips.push({ key: 'important', label: 'KPI quan trọng' })
  } else if (filterImportant.value === 'no') {
    chips.push({ key: 'important', label: 'Không gắn sao' })
  }
  if (filterStatuses.value.length > 0) {
    const st = filterStatuses.value.map((s) => kpiStatusLabel(s)).join(', ')
    chips.push({ key: 'status', label: `Trạng thái: ${st}` })
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

/** Mặc định thu gọn — user mở KPI / PM / Leader khi cần. */
const expandedKpis = ref(new Set<string>())
const expandedPms = ref(new Set<string>())
const expandedLeaders = ref(new Set<string>())

/** PM có rollout theo supervisor — BE trả `leaders[]`; UI hiển thị phẳng (LEADER rồi MEMBER) dưới PM. */
function pmUsesLeaderTree(pm: GmHierarchyPm): boolean {
  return Array.isArray(pm.leaders) && pm.leaders.length > 0
}

/** Hiển thị phẳng dưới PM: dòng LEADER chỉ khi supervisor được giao KPI (`leaderOwnRow`), sau đó các MEMBER (không lồng expandable). */
type GmPmLeaderFlatRow =
  | { kind: 'leader'; leader: GmHierarchyLeader }
  | { kind: 'member'; leader: GmHierarchyLeader; member: GmHierarchyMember }

function pmLeadersFlattened(pm: GmHierarchyPm): GmPmLeaderFlatRow[] {
  if (!pm.leaders?.length) return []
  const out: GmPmLeaderFlatRow[] = []
  for (const leader of pm.leaders) {
    if (leader.leaderOwnRow) {
      out.push({ kind: 'leader', leader })
    }
    for (const member of leader.members) {
      out.push({ kind: 'member', leader, member })
    }
  }
  return out
}

function pmLeaderFlatRowKey(row: GmPmLeaderFlatRow): string {
  return row.kind === 'leader'
    ? `flat-l-${row.leader.id}`
    : `flat-m-${row.leader.id}-${row.member.id}`
}

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

function pmSelfMember(pm: GmHierarchyPm): GmHierarchyMember | null {
  const ownerUserId = String(pm.ownerUserId ?? '').trim()
  if (!ownerUserId) return null
  return pm.members.find((member) => String(member.id ?? '').trim() === ownerUserId) ?? null
}

function pmDirectReportMembers(pm: GmHierarchyPm): GmHierarchyMember[] {
  const selfMember = pmSelfMember(pm)
  if (!selfMember) return pm.members
  return pm.members.filter((member) => String(member.id ?? '').trim() !== String(selfMember.id ?? '').trim())
}

function pmSelfBranchHasChildren(pm: GmHierarchyPm): boolean {
  return pmDirectReportMembers(pm).length > 0 || (pm.leaders?.length ?? 0) > 0
}

function pmHasRollout(pm: GmHierarchyPm): boolean {
  return allMembersUnderPm(pm).length > 0
}

/** Một assignee là đúng manager phòng — ẩn dải tóm tắt tên+tag lặp lại ngay dưới dòng khối. */
function pmRolloutSelfOnlyRedundantSummaryBand(pm: GmHierarchyPm): boolean {
  if (pmUsesLeaderTree(pm)) return false
  const ou = pm.ownerUserId
  if (!ou || pm.members.length !== 1) return false
  return String(pm.members[0]?.id) === String(ou)
}

function leaderExpandKey(pmId: string, leaderId: string) {
  return `${pmId}::${leaderId}`
}

/** Chỉ dùng cho nhánh PM kiêm assignee (mở danh sách rollout dưới self). */
function togglePmSelfRollout(pmId: string, selfMemberId: string) {
  toggleSet(expandedLeaders, leaderExpandKey(pmId, `self-${selfMemberId}`))
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

function memberDiagnosticsScoreTooltip(member: GmHierarchyMember): string {
  const scoreLine = `Điểm đánh giá: ${memberTableScoreDisplay(member)}`
  if (member.submissionTarget != null && member.submissionTarget > 0) {
    return `${scoreLine} · Chỉ tiêu năm (tham chiếu): ${member.submissionTarget}`
  }
  return scoreLine
}

function memberDiagnosticsStatusLabel(member: GmHierarchyMember): string {
  const pl = member.performanceLabel?.trim()
  if (pl) return pl
  /** Không có nhãn BE → cùng từ vựng đèn GM (không dùng Fail/Warning/Done tiếng Anh). */
  return kpiStatusLabel(memberStatusForUi(member))
}

function memberStatusForUi(member: GmHierarchyMember | null | undefined): GmHierarchyStatus {
  if (!member) return 'warning'
  const pl = String(member.performanceLabel ?? '').trim().toLowerCase()
  if (pl.includes('chưa cấu hình mục tiêu')) return 'warning'
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
  const mode = Number(kpi.calculationRuleCode) === CALC_RULE_AVERAGE ? 'mean' : 'list'
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

function sumNumericOrNull(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0)
}

/** Actual node Leader = tổng actual các node con trực tiếp của leader. */
function computeLeaderDirectTotalActualNumeric(
  leader: GmHierarchyLeader,
  kpi: GmHierarchyKpi,
): number | null {
  const nums: number[] = []
  if (leader.leaderOwnRow) {
    const own = memberActualNumericForProgress(leader.leaderOwnRow, kpi)
    if (own != null && Number.isFinite(own)) nums.push(own)
  }
  for (const member of leader.members) {
    const v = memberActualNumericForProgress(member, kpi)
    if (v != null && Number.isFinite(v)) nums.push(v)
  }
  return sumNumericOrNull(nums)
}

/** Actual node PM = tổng actual các node con trực tiếp của PM. */
function computePmDirectTotalActualNumeric(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number | null {
  const nums: number[] = []
  // Nếu PM có self-row, node PM chỉ cộng các con trực tiếp bên dưới self-row (không cộng lại chính PM).
  const directMembers = pmSelfMember(pm) ? pmDirectReportMembers(pm) : pm.members
  for (const member of directMembers) {
    const v = memberActualNumericForProgress(member, kpi)
    if (v != null && Number.isFinite(v)) nums.push(v)
  }
  for (const leader of pm.leaders ?? []) {
    const v = computeLeaderDirectTotalActualNumeric(leader, kpi)
    if (v != null && Number.isFinite(v)) nums.push(v)
  }
  return sumNumericOrNull(nums)
}

function pmActualDisplayRaw(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  if (kpi.kpiType === 'cascading') {
    const total = computePmDirectTotalActualNumeric(pm, kpi)
    if (total != null) return formatActualNumber(total)
  }
  return diagnosticsTableCellText(pm.actual)
}

function pmActualNumericForProgress(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number | null {
  if (kpi.kpiType === 'cascading') {
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
  const total = sumNumericOrNull(directPmActuals)
  if (total != null) return formatActualNumber(total)
  return diagnosticsTableCellText(kpi.actual)
}

function kpiActualNumericForProgress(kpi: GmHierarchyKpi): number | null {
  const directPmActuals = kpi.pmOwners
    .map((pm) => pmActualNumericForProgress(pm, kpi))
    .filter((v): v is number => v != null && Number.isFinite(v))
  const total = sumNumericOrNull(directPmActuals)
  if (total != null) return total
  const fallback = parseNumericFromField(kpiActualDisplayRaw(kpi))
  return fallback != null && Number.isFinite(fallback) ? fallback : null
}

function completionPctFromActualTarget(actual: number | null, target: number | null): number {
  if (actual == null || target == null || target <= 0) return 0
  const pct = (actual * 100) / target
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, pct)
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

/**
 * Dòng PM self-assignment: với KPI Team thì hiển thị cùng roll-up của node PM
 * để nhất quán với dòng section cha; các KPI khác giữ theo actual cá nhân PM.
 */
function pmSelfRowActualWithUnit(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const self = pmSelfMember(pm)
  if (!self) return '-'
  if (kpi.kpiType === 'cascading') return pmActualWithUnit(pm, kpi)
  return memberActualWithUnit(self, kpi)
}

function pmSelfRowActualBelowTarget(pm: GmHierarchyPm, kpi: GmHierarchyKpi): boolean {
  const self = pmSelfMember(pm)
  if (!self) return false
  if (kpi.kpiType === 'cascading') {
    return actualBelowTarget(pmActualDisplayRaw(pm, kpi), pm.target)
  }
  return actualBelowTarget(memberActualDisplayRaw(self, kpi), self.target)
}

function pmSelfRowCompletionValue(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number | null {
  const self = pmSelfMember(pm)
  if (!self) return null
  if (kpi.kpiType === 'cascading') return pmCompletionPct(pm, kpi)
  return memberCompletionPct(self, kpi)
}

function pmSelfRowProgressPct(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const pct = pmSelfRowCompletionValue(pm, kpi)
  if (pct == null) return '-'
  return formatCompletionPct(pct)
}

function pmSelfRowProgressTextClass(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const pct = pmSelfRowCompletionValue(pm, kpi)
  if (pct == null) return 'text-slate-400'
  return completionPctTextClass(pct)
}

/** Score dòng section (PM): ưu tiên cùng điểm với dòng PM self nếu có. */
function pmSectionScoreDisplay(pm: GmHierarchyPm): string {
  const self = pmSelfMember(pm)
  if (!self) return '-'
  return memberTableScoreDisplay(self)
}

function pmSectionScoreClass(pm: GmHierarchyPm): string {
  const self = pmSelfMember(pm)
  if (!self) return 'text-slate-400'
  const st = memberStatusForUi(self)
  if (st === 'danger') return 'text-red-600'
  if (st === 'warning') return 'text-yellow-600'
  return 'text-green-600'
}

function kpiActualWithUnit(kpi: GmHierarchyKpi): string {
  return diagnosticsActualWithUnit(kpi, kpiActualDisplayRaw(kpi))
}

/** % tiến độ trong drawer — có tính đến mid-year 803 (dùng target/2 làm mục tiêu kỳ vọng). */
function memberDrawerActualProgressPct(member: GmHierarchyMember, kpi: GmHierarchyKpi): string | null {
  const targetFull = memberTargetNumericForProgress(member)
  const actual = memberActualNumericForProgress(member, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  // Ưu tiên submissionTarget/submissionActual từ BE (nếu có)
  if (
    member.submissionTarget != null &&
    member.submissionTarget > 0 &&
    member.submissionActual != null
  ) {
    const effectiveTarget = isMidYear803
      ? Number(member.submissionTarget) / 2
      : Number(member.submissionTarget)
    const rawPct = (100 * Number(member.submissionActual)) / effectiveTarget
    if (Number.isFinite(rawPct) && rawPct >= 0) {
      return `${Math.round(Math.min(rawPct, 100))}%`
    }
    return null
  }

  // Fallback: actual / effectiveTarget
  const effectiveTarget = isMidYear803 ? (targetFull as number) / 2 : targetFull
  if (effectiveTarget != null && effectiveTarget > 0 && actual != null)
    return `${Math.round(Math.min((100 * actual) / effectiveTarget, 100))}%`
  return null
}

function actualBelowTarget(actual: string, target: string) {
  return parseNumPct(actual) < parseNumPct(target)
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
 * Status UI cho member — override về 'success' khi CALC_RULE 803 + mid-year + đúng tiến độ.
 * Tránh hiện "chậm tiến độ" (danger) khi member thực chất đang đúng hướng.
 */
function memberStatusForUiMidYear(member: GmHierarchyMember, kpi: GmHierarchyKpi): GmHierarchyStatus {
  const base = memberStatusForUi(member)

  const targetFull = memberTargetNumericForProgress(member)
  const actualNum = memberActualNumericForProgress(member, kpi)

  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT &&
    targetFull != null &&
    targetFull > 0

  if (isMidYear803 && base === 'danger') {
    // Nếu actual >= target/2 → đúng tiến độ → override 'danger' → 'success'
    if (actualNum != null && actualNum >= targetFull / 2) return 'success'
    // Nếu actual >= target*0.3 (gần đạt theo mid-year) → 'warning'
    if (actualNum != null && actualNum >= targetFull * 0.3) return 'warning'
  }

  return base
}

/**
 * Label trạng thái cho member — dùng cùng memberStatusForUiMidYear để nhất quán màu/chữ.
 */
function memberDiagnosticsStatusLabelMidYear(member: GmHierarchyMember, kpi: GmHierarchyKpi): string {
  const pl = member.performanceLabel?.trim()
  // Với 803 mid-year đang override, bỏ qua performanceLabel từ BE
  const isMidYear803 =
    isMidYearPhase.value &&
    Number(kpi.calculationRuleCode) === CALC_RULE_COMMENT

  if (!isMidYear803 && pl) return pl
  return kpiStatusLabel(memberStatusForUiMidYear(member, kpi))
}

/** Tóm tắt số member đạt đối với KPI individual/promotion ở level PM. */
function pmNonCascadingSummary(pm: GmHierarchyPm, kpi: GmHierarchyKpi): string {
  const members = allMembersUnderPm(pm)
  if (!members.length) return '—'
  const successCount = members.filter(m => memberStatusForUiMidYear(m, kpi) === 'success').length
  return `✓ ${successCount}/${members.length} đạt`
}

/** Tóm tắt số member đạt đối với KPI individual/promotion ở level toàn KPI. */
function kpiNonCascadingSummary(kpi: GmHierarchyKpi): string {
  const members = kpi.pmOwners.flatMap(pm => allMembersUnderPm(pm))
  if (!members.length) return '—'
  const uniqueMembers = Array.from(new Map(members.map(m => [m.id, m])).values())
  const successCount = uniqueMembers.filter(m => memberStatusForUiMidYear(m, kpi) === 'success').length
  return `✓ ${successCount}/${uniqueMembers.length} đạt`
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

/**
 * Tiến độ PM: tính theo Actual/Target của dòng PM.
 * Với Team KPI, Actual PM được tổng hợp từ trung bình actual member.
 */
function pmCompletionPct(pm: GmHierarchyPm, kpi: GmHierarchyKpi): number {
  const target = parseNumericFromField(String(pm.target ?? ''))
  return completionPctFromActualTarget(pmActualNumericForProgress(pm, kpi), target)
}

/** Tiến độ KPI: avg tiến độ các PM con. */
function kpiCompletionPct(kpi: GmHierarchyKpi): number {
  const target = parseNumericFromField(String(kpi.target ?? ''))
  return completionPctFromActualTarget(kpiActualNumericForProgress(kpi), target)
}

/** Format số % (làm tròn) thành chuỗi hiển thị. */
function formatCompletionPct(pct: number): string {
  return `${Math.round(pct)}%`
}

/**
 * Màu chữ cho cột tiến độ (4 mức):
 * - > 100%: Xanh đậm (vượt tiến độ)
 * - 80–100%: Xanh lá (đúng tiến độ)
 * - 60–79%: Vàng (gần đạt)
 * - < 60%: Đỏ (chưa đạt)
 */
function completionPctTextClass(pct: number): string {
  if (pct > 100) return 'text-green-700'
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

/** KPI quan trọng (`isImportant`) luôn đứng trước, thứ tự còn lại giữ nguyên. */
function sortImportantKpisFirst(list: GmHierarchyKpi[]): GmHierarchyKpi[] {
  return [...list].sort((a, b) => {
    const pa = a.isImportant === true ? 1 : 0
    const pb = b.isImportant === true ? 1 : 0
    return pb - pa
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
  return 'Khối phụ trách'
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
  if (String(pm.id ?? '').includes('diag-pm-unassigned')) {
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
  if (String(pm.id ?? '').includes('diag-pm-unassigned')) return 'Chưa giao'
  const ct = String(pm.ownerRoleCode ?? '').toUpperCase()
  if (ct === 'TEAM') return 'Nhóm nhận KPI'
  if (ct) return `${ct} phụ trách`
  return 'Quản lý khối phụ trách'
}

function pmRollupOwnerSrOnly(pm: GmHierarchyPm): string {
  if (String(pm.id ?? '').includes('diag-pm-unassigned')) return 'Trạng thái chưa giao'
  const ct = String(pm.ownerRoleCode ?? '').toUpperCase()
  if (ct === 'TEAM') return 'Dòng KPI team - danh sách người nhận bên dưới'
  if (ct) return `${ct} phụ trách nhóm`
  return 'Quản lý khối phụ trách nhóm'
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

const STATUS_FILTER_OPTIONS: GmHierarchyStatus[] = ['success', 'warning', 'danger']

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

function toggleDraftStatus(st: GmHierarchyStatus) {
  const cur = draftStatuses.value
  const i = cur.indexOf(st)
  draftStatuses.value = i === -1 ? [...cur, st] : cur.filter((s) => s !== st)
}

function kpiMatchesToolbarFilters(kpi: GmHierarchyKpi): boolean {
  if (filterImportant.value === 'yes' && kpi.isImportant !== true) return false
  if (filterImportant.value === 'no' && kpi.isImportant === true) return false
  if (filterStatuses.value.length > 0 && !filterStatuses.value.includes(kpi.status)) return false
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
        if (pmUsesLeaderTree(pm)) {
          const nextLeaders: GmHierarchyLeader[] = pm.leaders!.map((ldr) => ({
            ...ldr,
            members: ldr.members.filter((m) => memSet.has(String(m.name ?? '').trim())),
          }))
          const leaders = nextLeaders.filter(
            (ldr) =>
              ldr.members.length > 0 ||
              (ldr.leaderOwnRow != null &&
                memSet.has(String(ldr.leaderOwnRow.name ?? '').trim())),
          )
          const members = pm.members.filter((m) => memSet.has(String(m.name ?? '').trim()))
          if (leaders.length === 0 && members.length === 0) return null
          return {
            ...pm,
            leaders: leaders.length > 0 ? leaders : undefined,
            members,
          }
        }
        const membersOnly = pm.members.filter((m) => memSet.has(String(m.name ?? '').trim()))
        if (membersOnly.length === 0) return null
        return { ...pm, members: membersOnly }
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
      const label = k.categoryName?.trim() || 'Không phân loại'
      if (!meta.has(id)) meta.set(id, { label, rows: [] })
      meta.get(id)!.rows.push(k)
    }
    return [...meta.entries()]
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'vi'))
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
  const leaderKeys = new Set<string>()
  for (const k of props.rows) {
    if (!kpiMatchesToolbarFilters(k)) continue
    for (const pm of k.pmOwners) {
      if (secSet.size > 0 && !secSet.has(pmManagedSectionLabel(pm))) continue
      if (memSet.size > 0 && !allMembersUnderPm(pm).some((m) => memSet.has(String(m.name ?? '').trim())))
        continue
      kpiIds.add(k.id)
      if (pmHasRollout(pm)) pmIds.add(pm.id)
      if (memSet.size > 0 && pmSelfMember(pm)) {
        const sm = pmSelfMember(pm)!
        const hit = (name: string | null | undefined) => memSet.has(String(name ?? '').trim())
        const underSelf =
          pmDirectReportMembers(pm).some((m) => hit(m.name)) ||
          (pm.leaders?.some(
            (l) =>
              hit(l.name) ||
              l.members.some((mm) => hit(mm.name)) ||
              (l.leaderOwnRow != null && hit(l.leaderOwnRow.name)),
          ) ??
            false)
        if (underSelf) {
          leaderKeys.add(leaderExpandKey(pm.id, `self-${sm.id}`))
        }
      }
    }
  }
  expandedKpis.value = kpiIds
  expandedPms.value = pmIds
  expandedLeaders.value = leaderKeys
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

/** Màu nền dòng KPI theo role người tạo. Khi expanded dùng tông đậm hơn. */
function kpiCreatorRowBgClass(roleCode?: string, expanded = false): string {
  switch (roleCode) {
    case 'GM':     return expanded ? 'bg-indigo-200'  : 'bg-indigo-100 hover:bg-indigo-200'
    case 'PM':     return expanded ? 'bg-sky-200'     : 'bg-sky-100 hover:bg-sky-200'
    case 'LEADER': return expanded ? 'bg-emerald-200' : 'bg-emerald-100 hover:bg-emerald-200'
    case 'MEMBER': return expanded ? 'bg-rose-200'    : 'bg-rose-100 hover:bg-rose-200'
    default:       return expanded ? 'bg-slate-100'   : 'hover:bg-slate-50'
  }
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

function normalizePersonName(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Drawer rollout: tránh lặp PM self khi PM vừa là owner node cha
 * vừa có assignment con cho chính mình.
 */
function rolloutMembersForDrawer(pm: GmHierarchyPm): GmHierarchyMember[] {
  const base = allMembersUnderPm(pm)
  const self = pmSelfMember(pm)
  if (!self) return base

  const selfId = String(self.id ?? '').trim()
  const selfName = normalizePersonName(self.name)
  const pmName = normalizePersonName(pm.name)
  let keptSelf = false

  return base.filter((member) => {
    const memberId = String(member.id ?? '').trim()
    const memberName = normalizePersonName(member.name)
    const isSameSelfById = !!selfId && memberId === selfId
    const isSameSelfByName = !!selfName && memberName === selfName
    const isSamePmName = !!pmName && memberName === pmName
    const sameSelf = isSameSelfById || isSameSelfByName || isSamePmName
    if (!sameSelf) return true
    if (keptSelf) return false
    keptSelf = true
    return true
  })
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

/**
 * Pill cột Target — đổi màu theo `targetBalance` (so tổng target con vs target cha).
 * Dòng LEADER (supervisor) không dùng quy tắc «tổng member» → gọi với `undefined` để pill xám trung tính.
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
  if (balance === 'short') return 'Tổng target đã giao thấp hơn mục tiêu (thiếu).'
  if (balance === 'excess') return 'Tổng target đã giao vượt mục tiêu (thừa).'
  if (balance === 'ok') return 'Tổng target đã giao khớp mục tiêu (đủ).'
  return undefined
}

function submissionFromMemberStatus(s: GmHierarchyStatus): GmKpiSubmissionStatus {
  if (s === 'danger') return 'missing_data'
  if (s === 'warning') return 'submitted'
  return 'submitted_with_file'
}

/** Một dòng KPI trong drawer — đúng KPI đang xem trên bảng, không phải toàn bộ KPI của member. */
function memberRowToModalItem(member: GmHierarchyMember, kpi: GmHierarchyKpi): GmModalKpiItemMock {
  const rawBlocker = String(member.blocker ?? '').trim()
  const evidenceNote =
    rawBlocker && rawBlocker !== '-' && rawBlocker !== '—' && rawBlocker !== '–'
      ? diagnosticsTableCellText(rawBlocker)
      : '-'
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
    isFail: memberStatusForUiMidYear(member, kpi) === 'danger',
    rootCause:
      rawBlocker && rawBlocker !== '-' && rawBlocker !== '—' && rawBlocker !== '–'
        ? diagnosticsTableCellText(member.blocker)
        : '',
    score: memberTableScoreDisplay(member),
    kpiType: kpi.kpiType,
    submissionStatus: submissionFromMemberStatus(memberStatusForUiMidYear(member, kpi)),
    assignmentStatusCode: member.assignmentStatusCode ?? null,
    targetSummary: `Đóng góp trong KPI «${kpi.name}» · Minh chứng / ghi chú: ${evidenceNote}`,
    actualProgressPct: memberDrawerActualProgressPct(member, kpi),
    evidenceAttachmentUrl: member.evidenceAttachmentUrl ?? null,
  }
}

function openPmKpiDrawer(pm: GmHierarchyPm, kpi: GmHierarchyKpi) {
  const rolloutMembers = rolloutMembersForDrawer(pm)
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
              aria-label="Đặt lại tất cả bộ lọc" @click.stop="resetAllDiagnosticFilters">
              <i class="fas fa-rotate-left text-[11px] text-slate-500" aria-hidden="true" />
              Đặt lại bộ lọc
            </button>
            <div ref="filterPopoverWrapRef" class="relative">
              <button type="button"
                class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                aria-haspopup="dialog" :aria-expanded="filterPopoverOpen" @click.stop="toggleFilterPopover">
                <i class="fas fa-sliders-h text-sm text-slate-500" aria-hidden="true" />
                Bộ lọc
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
              :style="filterPanelFixedStyle" role="dialog" aria-label="Tùy chỉnh bộ lọc" @click.stop>
              <div class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Tùy chỉnh hiển thị
                </h4>
                <button type="button" class="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  @click="resetAllDiagnosticFilters">
                  Đặt lại bộ lọc
                </button>
              </div>

              <div class="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Section
                  </label>
                  <div v-if="diagnosticsSectionOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Không có section trong dữ liệu hiện tại.
                  </div>
                  <div v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group" aria-label="Chọn section">
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
                    Thành viên
                  </label>
                  <div v-if="diagnosticsMemberOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Không có thành viên trong dữ liệu hiện tại.
                  </div>
                  <div v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group" aria-label="Chọn thành viên">
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
                    Mức độ quan trọng
                  </label>
                  <div class="relative">
                    <select id="diag-draft-important" v-model="draftImportant"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-amber-500">
                      <option value="">Tất cả</option>
                      <option value="yes">Chỉ KPI quan trọng (⭐)</option>
                      <option value="no">KPI thường (không sao)</option>
                    </select>
                    <i class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Trạng thái KPI
                  </label>
                  <div class="space-y-1 rounded-lg border border-slate-200 bg-white p-2" role="group"
                    aria-label="Chọn trạng thái KPI">
                    <label v-for="st in STATUS_FILTER_OPTIONS" :key="st"
                      class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <input type="checkbox"
                        class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftStatuses.includes(st)" @change="toggleDraftStatus(st)" />
                      <span>{{ kpiStatusLabel(st) }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <button type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200/60"
                  @click="cancelFilterPopover">
                  Huỷ
                </button>
                <button type="button"
                  class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                  @click="applyPopoverFilters">
                  Áp dụng / Lọc
                </button>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Chip bộ lọc đang áp dụng (index.html #active-filters-container) -->
        <div v-if="activeFilterChips.length > 0"
          class="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
          <span class="mt-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Đang lọc theo:
          </span>
          <div class="flex flex-wrap gap-2">
            <span v-for="chip in activeFilterChips" :key="chip.key + chip.label"
              class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
              {{ chip.label }}
              <button type="button"
                class="ml-0.5 rounded p-0.5 text-blue-400 hover:text-blue-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                :aria-label="`Bỏ lọc ${chip.label}`" @click="removeAppliedFilterChip(chip.key)">
                <i class="fas fa-times text-[10px]" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-[1080px] divide-y divide-slate-200">
          <!-- 4+1+2+2+1+2+2+1 - Thêm cột Actual nằm giữa Target và Tiến độ -->
          <div
            class="sticky top-0 z-10 grid grid-cols-15 gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 sm:gap-3">
            <div class="col-span-4 pl-6">Mục tiêu KPI &amp; PM / Leader / Member</div>
            <div class="col-span-1 text-center">Trọng số</div>
            <div class="col-span-2 text-center">Target</div>
            <div class="col-span-2 text-center">Actual</div>
            <div class="col-span-1 text-center leading-tight" title="Tiến độ hoàn thành .">
              Tiến độ hoàn thành
            </div>
            <div class="col-span-2 text-center">Score</div>
            <div class="col-span-2 text-center">Trạng thái</div>
            <div class="col-span-1 text-center">Thao tác</div>
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
                          aria-label="Mở rộng KPI" :aria-expanded="expandedKpis.has(kpi.id)"
                          @click.stop="toggleKpi(kpi.id)">
                          <i class="fas fa-chevron-right text-xs transition-transform duration-300 ease-out motion-reduce:transition-none"
                            :class="expandedKpis.has(kpi.id) ? 'rotate-90' : 'rotate-0'" />
                        </button>
                        <div class="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm"
                          :class="kpiIconWrapClass(kpi.status)">
                          <i class="fas fa-bullseye text-[11px]" />
                        </div>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <i v-if="kpi.isImportant" class="fas fa-star shrink-0 text-[11px] text-amber-500"
                              title="KPI quan trọng (Important)" aria-label="KPI quan trọng" />
                            <span class="text-sm font-bold leading-snug text-slate-800">{{ kpi.name }}</span>
                            <GmStrategicKpiTypeTag :type="kpi.kpiType" size="sm" class="shrink-0" />
                          </div>
                        </div>
                      </div>
                      <div class="col-span-1 text-center">
                        <span
                          class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                          diagnosticsWeightDisplay(kpi.weight) }}</span>
                      </div>
                      <div class="col-span-2 flex justify-center text-center">
                        <span v-if="kpi.kpiType === 'cascading'"
                          :class="diagnosticsTargetPillClass(kpi.targetBalance)"
                          :title="diagnosticsTargetTitle(kpi.targetBalance)">{{ diagnosticsTargetWithUnit(kpi, kpi.target) }}</span>
                        <span v-else class="text-slate-400 font-bold">-</span>
                      </div>
                      <div class="col-span-2 text-center text-sm font-bold tabular-nums"
                        :class="kpi.kpiType === 'cascading' ? (actualBelowTarget(kpiActualDisplayRaw(kpi), kpi.target) ? 'text-red-600' : 'text-green-600') : 'text-slate-400'">
                        {{ kpi.kpiType === 'cascading' ? kpiActualWithUnit(kpi) : '-' }}
                      </div>
                      <div
                        class="col-span-1 text-center text-xs font-bold tabular-nums"
                        :class="kpi.kpiType === 'cascading' ? completionPctTextClass(kpiCompletionPct(kpi)) : 'text-slate-400'"
                        :title="kpi.kpiType === 'cascading' ? 'Tiến độ hoàn thành = (Actual / Target) x 100.' : undefined">
                        {{ kpi.kpiType === 'cascading' ? formatCompletionPct(kpiCompletionPct(kpi)) : '-' }}
                      </div>
                      <div class="col-span-2 text-center text-xs font-bold tabular-nums text-slate-400">
                        -
                      </div>
                      <div class="col-span-2 flex justify-center">
                        <span v-if="kpi.kpiType === 'cascading'"
                          class="inline-flex max-w-full cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                          :class="badgeClass(kpi.status)" :title="diagnosticsReasonTooltip(kpi.blockerSummary)">
                          <i class="fas shrink-0 text-[11px]" :class="kpi.status === 'success'
                              ? 'fa-check-circle'
                              : kpi.status === 'warning'
                                ? 'fa-exclamation-circle'
                                : 'fa-times-circle'
                            " />
                          <span class="truncate">{{ kpiStatusLabel(kpi.status) }}</span>
                        </span>
                        <span v-else
                          class="inline-flex max-w-full cursor-default items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 shadow-sm">
                          {{ kpiNonCascadingSummary(kpi) }}
                        </span>
                      </div>
                      <div class="col-span-1 flex flex-wrap items-center justify-center gap-1" @click.stop>
                        <button type="button"
                          class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                          title="Sửa KPI" aria-label="Sửa KPI" @click="onEditKpiClick(kpi)">
                          <i class="fas fa-pen text-[9px]" aria-hidden="true" />
                        </button>
                        <button type="button"
                          class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                          title="Xóa KPI" aria-label="Xóa KPI" @click="onDeleteKpiClick(kpi)">
                          <i class="fas fa-trash text-[9px]" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <!-- Khối quản lý → PM + cấp dưới (collapse) -->
                    <div v-if="kpi.pmOwners.length > 0"
                      class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                      :class="expandedKpis.has(kpi.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                      <div class="min-h-0">
                        <div class="border-t border-slate-100 bg-white pb-2">
                          <template v-for="pm in kpi.pmOwners" :key="pm.id">
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
                                  <i class="fas fa-sitemap mr-2 shrink-0 text-[11px] text-indigo-500" />
                                  <div class="min-w-0">
                                    <div class="truncate text-xs font-bold text-slate-800">
                                      {{ pmManagedSectionLabel(pm) }}
                                    </div>
                                    <div v-if="!pmHasRollout(pm)"
                                      class="mt-0.5 truncate text-xs font-medium text-slate-500">
                                      {{ pmRollupOwnerSubtitle(pm) }}: {{ pm.name }}
                                    </div>
                                  </div>
                                </div>
                                <div class="col-span-1 text-center">
                                  <span
                                    class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                      diagnosticsWeightDisplay(pm.weight)
                                    }}</span>
                                </div>
                                <div class="col-span-2 flex justify-center text-center">
                                  <span v-if="kpi.kpiType === 'cascading'"
                                    :class="diagnosticsTargetPillClass(pm.targetBalance)"
                                    :title="diagnosticsTargetTitle(pm.targetBalance)">{{ diagnosticsTargetWithUnit(kpi, pm.target) }}</span>
                                  <span v-else class="text-slate-400 font-bold">-</span>
                                </div>
                                <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                  :class="kpi.kpiType === 'cascading' ? (actualBelowTarget(pmActualDisplayRaw(pm, kpi), pm.target) ? 'text-red-600' : 'text-green-600') : 'text-slate-400'">
                                  {{ kpi.kpiType === 'cascading' ? pmActualWithUnit(pm, kpi) : '-' }}
                                </div>
                                <div
                                  class="col-span-1 text-center text-xs font-bold tabular-nums"
                                  :class="kpi.kpiType === 'cascading' ? completionPctTextClass(pmCompletionPct(pm, kpi)) : 'text-slate-400'"
                                  :title="kpi.kpiType === 'cascading' ? 'Tiến độ hoàn thành = (Actual / Target) x 100.' : undefined">
                                  {{ kpi.kpiType === 'cascading' ? formatCompletionPct(pmCompletionPct(pm, kpi)) : '-' }}
                                </div>
                                <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                  :class="kpi.kpiType === 'cascading' ? pmSectionScoreClass(pm) : 'text-slate-400'">
                                  {{ kpi.kpiType === 'cascading' ? pmSectionScoreDisplay(pm) : '-' }}
                                </div>
                                <div class="col-span-2 flex justify-center">
                                  <span v-if="kpi.kpiType === 'cascading'"
                                    class="inline-flex max-w-full cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                                    :class="badgeClass(pm.status)" :title="diagnosticsReasonTooltip(pm.blockerSummary)">
                                    <i class="fas shrink-0 text-[11px]" :class="pm.status === 'success'
                                        ? 'fa-check-circle'
                                        : pm.status === 'warning'
                                          ? 'fa-exclamation-circle'
                                          : 'fa-times-circle'
                                      " />
                                    <span class="truncate">{{ kpiStatusLabel(pm.status) }}</span>
                                  </span>
                                  <span v-else
                                    class="inline-flex max-w-full cursor-default items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 shadow-sm">
                                    {{ pmNonCascadingSummary(pm, kpi) }}
                                  </span>
                                </div>
                                <div class="col-span-1 flex justify-center pr-0.5">
                                  <button v-if="pmHasRollout(pm)" type="button"
                                    class="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold leading-tight text-indigo-700 transition-colors hover:bg-indigo-100 sm:px-2.5 sm:text-xs"
                                    @click.stop="openPmKpiDrawer(pm, kpi)">
                                    Chi tiết
                                  </button>
                                </div>
                              </div>

                              <div v-if="pmHasRollout(pm)"
                                class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                :class="expandedPms.has(pm.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                                <div class="min-h-0">
                                  <div class="border-y border-slate-100 bg-slate-50/50 py-1">

                                    <template v-if="pmSelfMember(pm)">
                                      <div class="border-b border-slate-100/80 last:border-b-0">
                                        <div
                                          class="grid grid-cols-15 items-center gap-2 border-l-2 border-indigo-200/70 bg-indigo-50/35 px-3 py-1.5 sm:gap-3"
                                          :class="pmSelfBranchHasChildren(pm) ? 'cursor-pointer hover:bg-indigo-50/70' : ''"
                                          @click="pmSelfBranchHasChildren(pm) && pmSelfMember(pm) && togglePmSelfRollout(pm.id, String(pmSelfMember(pm)!.id))">
                                          <div class="col-span-4 flex min-w-0 items-center pl-16">
                                            <button type="button" class="mr-1 shrink-0 p-1 text-slate-400"
                                              :disabled="!pmSelfBranchHasChildren(pm)"
                                              :aria-expanded="pmSelfBranchHasChildren(pm) ? expandedLeaders.has(leaderExpandKey(pm.id, `self-${pmSelfMember(pm)?.id}`)) : undefined"
                                              @click.stop="pmSelfBranchHasChildren(pm) && pmSelfMember(pm) && togglePmSelfRollout(pm.id, String(pmSelfMember(pm)!.id))">
                                              <i v-if="pmSelfBranchHasChildren(pm)"
                                                class="fas fa-chevron-right text-[11px] transition-transform duration-300 ease-out motion-reduce:transition-none"
                                                :class="expandedLeaders.has(leaderExpandKey(pm.id, `self-${pmSelfMember(pm)?.id}`)) ? 'rotate-90' : 'rotate-0'" />
                                              <span v-else class="inline-block h-3.5 w-3.5" />
                                            </button>
                                            <div
                                              class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-white shadow-sm">
                                              <i class="fas fa-user text-[10px] text-indigo-600" aria-hidden="true" />
                                            </div>
                                            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                              <span class="truncate text-xs font-semibold text-slate-800">{{ pmSelfMember(pm)?.name }}</span>
                                              <template v-for="mb in [pmSelfMember(pm) ? memberRollupRoleBadge(pmSelfMember(pm)!) : null]" :key="`mbr-self-${pm.id}`">
                                                <span v-if="mb"
                                                  class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                                  :class="mb.badgeClass">{{ mb.label }}</span>
                                              </template>
                                            </div>
                                          </div>
                                          <div class="col-span-1 text-center">
                                            <span
                                              class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                                pmSelfMember(pm) ? diagnosticsWeightDisplay(pmSelfMember(pm)!.weight) : '-'
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 flex justify-center text-center">
                                            <span
                                              :class="diagnosticsTargetPillClass(pmSelfMember(pm)?.targetBalance)"
                                              :title="diagnosticsTargetTitle(pmSelfMember(pm)?.targetBalance)">{{
                                                pmSelfMember(pm) ? memberTableTargetDisplayWithUnit(pmSelfMember(pm)!, kpi) : '-'
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                            :class="pmSelfRowActualBelowTarget(pm, kpi) ? 'text-red-600' : 'text-green-600'">
                                            {{ pmSelfRowActualWithUnit(pm, kpi) }}
                                          </div>
                                          <div
                                            class="col-span-1 text-center text-xs font-bold tabular-nums"
                                            :class="pmSelfRowProgressTextClass(pm, kpi)"
                                            :title="pmSelfMember(pm) ? 'Tiến độ hoàn thành = (Actual / Target) x 100.' : undefined">
                                            {{ pmSelfRowProgressPct(pm, kpi) }}
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                            :class="memberStatusForUi(pmSelfMember(pm)) === 'danger' ? 'text-red-600' : memberStatusForUi(pmSelfMember(pm)) === 'warning' ? 'text-yellow-600' : 'text-green-600'"
                                            :title="pmSelfMember(pm) ? memberDiagnosticsScoreTooltip(pmSelfMember(pm)!) : undefined">
                                            {{ pmSelfMember(pm) ? memberTableScoreDisplay(pmSelfMember(pm)!) : '-' }}
                                          </div>
                                          <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                            <span
                                              class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                              :title="diagnosticsReasonTooltip(pmSelfMember(pm)?.blocker ?? '')">
                                              <template v-if="memberStatusForUi(pmSelfMember(pm)) === 'danger'">
                                                <span class="inline-flex items-center text-red-600">
                                                  <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ pmSelfMember(pm) ? memberDiagnosticsStatusLabel(pmSelfMember(pm)!) : '-' }}
                                                </span>
                                              </template>
                                              <template v-else-if="memberStatusForUi(pmSelfMember(pm)) === 'warning'">
                                                <span class="inline-flex items-center text-yellow-700">
                                                  <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ pmSelfMember(pm) ? memberDiagnosticsStatusLabel(pmSelfMember(pm)!) : '-' }}
                                                </span>
                                              </template>
                                              <template v-else>
                                                <span class="inline-flex items-center text-green-600">
                                                  <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ pmSelfMember(pm) ? memberDiagnosticsStatusLabel(pmSelfMember(pm)!) : '-' }}
                                                </span>
                                              </template>
                                            </span>
                                          </div>
                                          <div class="col-span-1 flex justify-center">
                                            <button
                                              v-if="pmSelfMember(pm) && isMemberFeedbackPendingForGm(pmSelfMember(pm)!)"
                                              type="button"
                                              class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                              @click.stop="openFeedbackDrawerForMember(kpi, pmSelfMember(pm)!)">
                                              Feedback
                                            </button>
                                            <span v-else class="text-xs text-slate-200">-</span>
                                          </div>
                                        </div>

                                        <div v-if="pmSelfBranchHasChildren(pm)"
                                          class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                          :class="expandedLeaders.has(leaderExpandKey(pm.id, `self-${pmSelfMember(pm)?.id}`)) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                                          <div class="min-h-0">
                                            <div v-for="member in pmDirectReportMembers(pm)" :key="member.id"
                                              class="grid grid-cols-15 items-center gap-2 border-l-2 border-indigo-200/60 px-3 py-1.5 pl-2 transition-colors hover:bg-white sm:gap-3">
                                              <div class="col-span-4 flex items-center pl-20">
                                                <span class="mr-1 inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                <div
                                                  class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                                                  <i class="fas fa-user text-[10px] text-slate-400" />
                                                </div>
                                                <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                  <span class="text-xs font-semibold text-slate-700">{{ member.name }}</span>
                                                  <template v-for="mb in [memberRollupRoleBadge(member)]" :key="`mbr-self-child-${member.id}`">
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
                                                <span
                                                  :class="diagnosticsTargetPillClass(member.targetBalance)"
                                                  :title="diagnosticsTargetTitle(member.targetBalance)">{{
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
                                                title="Tiến độ hoàn thành = (Actual / Target) x 100.">
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
                                                  class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                                  :title="diagnosticsReasonTooltip(member.blocker)">
                                                  <template v-if="memberStatusForUiMidYear(member, kpi) === 'danger'">
                                                    <span class="inline-flex items-center text-red-600">
                                                      <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                      {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                                    </span>
                                                  </template>
                                                  <template v-else-if="memberStatusForUiMidYear(member, kpi) === 'warning'">
                                                    <span class="inline-flex items-center text-yellow-700">
                                                      <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                      {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                                    </span>
                                                  </template>
                                                  <template v-else>
                                                    <span class="inline-flex items-center text-green-600">
                                                      <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                      {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                                    </span>
                                                  </template>
                                                </span>
                                              </div>
                                              <div class="col-span-1 flex justify-center">
                                                <button
                                                  v-if="isMemberFeedbackPendingForGm(member)"
                                                  type="button"
                                                  class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                                  @click.stop="openFeedbackDrawerForMember(kpi, member)">
                                                  Feedback
                                                </button>
                                                <span v-else class="text-xs text-slate-200">-</span>
                                              </div>
                                            </div>

                                            <template v-if="pmUsesLeaderTree(pm)">
                                              <div
                                                v-for="row in pmLeadersFlattened(pm)"
                                                :key="pmLeaderFlatRowKey(row)"
                                                class="border-b border-slate-100/80 last:border-b-0">
                                                <div
                                                  v-if="row.kind === 'leader'"
                                                  class="grid grid-cols-15 items-center gap-2 border-l-2 border-violet-200/60 bg-violet-50/35 px-3 py-1.5 pl-2 sm:gap-3">
                                                  <div class="col-span-4 flex min-w-0 items-center pl-20">
                                                    <span class="mr-1 inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    <div
                                                      class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white shadow-sm">
                                                      <i class="fas fa-user text-[10px] text-violet-600" aria-hidden="true" />
                                                    </div>
                                                    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                      <span class="truncate text-xs font-semibold text-slate-800">{{ row.leader.name }}</span>
                                                      <template v-for="lb in [leaderRollupRoleBadge(row.leader)]"
                                                        :key="`lrb-self-${row.leader.id}`">
                                                        <span v-if="lb"
                                                          class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                                          :class="lb.badgeClass">{{ lb.label }}</span>
                                                      </template>
                                                    </div>
                                                  </div>
                                                  <div class="col-span-1 text-center">
                                                    <span
                                                      class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                                        diagnosticsWeightDisplay(row.leader.weight)
                                                      }}</span>
                                                  </div>
                                                  <div class="col-span-2 flex justify-center text-center">
                                                    <span
                                                      :class="diagnosticsTargetPillClass(row.leader.leaderOwnRow!.targetBalance)"
                                                      :title="diagnosticsTargetTitle(row.leader.leaderOwnRow!.targetBalance)">{{
                                                        memberTableTargetDisplayWithUnit(row.leader.leaderOwnRow!, kpi)
                                                      }}</span>
                                                  </div>
                                                  <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                                    :class="memberActualColorClass(row.leader.leaderOwnRow!, kpi)">
                                                    {{ memberActualWithUnit(row.leader.leaderOwnRow!, kpi) }}
                                                  </div>
                                                  <div
                                                    class="col-span-1 text-center text-xs font-bold tabular-nums"
                                                    :class="diagnosticsMemberProgressTextClass(row.leader.leaderOwnRow!, kpi)"
                                                    title="Tiến độ hoàn thành = (Actual / Target) x 100.">
                                                    {{ diagnosticsMemberProgressPct(row.leader.leaderOwnRow!, kpi) }}
                                                  </div>
                                                  <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'danger'
                                                      ? 'text-red-600'
                                                      : memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'warning'
                                                        ? 'text-yellow-600'
                                                        : 'text-green-600'
                                                    " :title="memberDiagnosticsScoreTooltip(row.leader.leaderOwnRow!)">
                                                    {{ memberTableScoreDisplay(row.leader.leaderOwnRow!) }}
                                                  </div>
                                                  <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                                    <span
                                                      class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                                      :title="diagnosticsReasonTooltip(row.leader.leaderOwnRow!.blocker)">
                                                      <template v-if="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'danger'">
                                                        <span class="inline-flex items-center text-red-600">
                                                          <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                        </span>
                                                      </template>
                                                      <template v-else-if="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'warning'">
                                                        <span class="inline-flex items-center text-yellow-700">
                                                          <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                        </span>
                                                      </template>
                                                      <template v-else>
                                                        <span class="inline-flex items-center text-green-600">
                                                          <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                        </span>
                                                      </template>
                                                    </span>
                                                  </div>
                                                  <div class="col-span-1 flex justify-center">
                                                    <button
                                                      v-if="isMemberFeedbackPendingForGm(row.leader.leaderOwnRow!)"
                                                      type="button"
                                                      class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                                      @click.stop="openFeedbackDrawerForMember(kpi, row.leader.leaderOwnRow!)">
                                                      Feedback
                                                    </button>
                                                    <span v-else class="text-xs text-slate-200">-</span>
                                                  </div>
                                                </div>
                                                <div
                                                  v-else
                                                  class="grid grid-cols-15 items-center gap-2 border-l-2 border-violet-200/60 px-3 py-1.5 pl-2 transition-colors hover:bg-white sm:gap-3">
                                                  <div class="col-span-4 flex items-center pl-20">
                                                    <span class="mr-1 inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    <div
                                                      class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                                                      <i class="fas fa-user text-[10px] text-slate-400" />
                                                    </div>
                                                    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                      <span class="text-xs font-semibold text-slate-700">{{ row.member.name }}</span>
                                                      <template v-for="mb in [memberRollupRoleBadge(row.member)]"
                                                        :key="`mbr-l-self-${row.member.id}`">
                                                        <span v-if="mb"
                                                          class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                                          :class="mb.badgeClass">{{ mb.label }}</span>
                                                      </template>
                                                    </div>
                                                  </div>
                                                  <div class="col-span-1 text-center">
                                                    <span
                                                      class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                                        diagnosticsWeightDisplay(row.member.weight)
                                                      }}</span>
                                                  </div>
                                                  <div class="col-span-2 flex justify-center text-center">
                                                    <span
                                                      :class="diagnosticsTargetPillClass(row.member.targetBalance)"
                                                      :title="diagnosticsTargetTitle(row.member.targetBalance)">{{
                                                        memberTableTargetDisplayWithUnit(row.member, kpi)
                                                      }}</span>
                                                  </div>
                                                  <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                                    :class="memberActualColorClass(row.member, kpi)">
                                                    {{ memberActualWithUnit(row.member, kpi) }}
                                                  </div>
                                                  <div
                                                    class="col-span-1 text-center text-xs font-bold tabular-nums"
                                                    :class="diagnosticsMemberProgressTextClass(row.member, kpi)"
                                                    title="Tiến độ hoàn thành = (Actual / Target) x 100.">
                                                    {{ diagnosticsMemberProgressPct(row.member, kpi) }}
                                                  </div>
                                                  <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="memberStatusForUiMidYear(row.member, kpi) === 'danger'
                                                      ? 'text-red-600'
                                                      : memberStatusForUiMidYear(row.member, kpi) === 'warning'
                                                        ? 'text-yellow-600'
                                                        : 'text-green-600'
                                                    " :title="memberDiagnosticsScoreTooltip(row.member)">
                                                    {{ memberTableScoreDisplay(row.member) }}
                                                  </div>
                                                  <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                                    <span
                                                      class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                                      :title="diagnosticsReasonTooltip(row.member.blocker)">
                                                      <template v-if="memberStatusForUiMidYear(row.member, kpi) === 'danger'">
                                                        <span class="inline-flex items-center text-red-600">
                                                          <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                        </span>
                                                      </template>
                                                      <template v-else-if="memberStatusForUiMidYear(row.member, kpi) === 'warning'">
                                                        <span class="inline-flex items-center text-yellow-700">
                                                          <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                        </span>
                                                      </template>
                                                      <template v-else>
                                                        <span class="inline-flex items-center text-green-600">
                                                          <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                          {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                        </span>
                                                      </template>
                                                    </span>
                                                  </div>
                                                  <div class="col-span-1 flex justify-center">
                                                    <button
                                                      v-if="isMemberFeedbackPendingForGm(row.member)"
                                                      type="button"
                                                      class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                                      @click.stop="openFeedbackDrawerForMember(kpi, row.member)">
                                                      Feedback
                                                    </button>
                                                    <span v-else class="text-xs text-slate-200">-</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </template>
                                          </div>
                                        </div>
                                      </div>
                                    </template>

                                    <template v-if="!pmSelfMember(pm) && pm.members.length > 0">
                                      <div v-for="member in pm.members" :key="member.id"
                                        class="grid grid-cols-15 items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white sm:gap-3"
                                        :class="pmUsesLeaderTree(pm) ? 'border-l-2 border-violet-200/60' : ''">
                                        <div class="col-span-4 flex items-center pl-14">
                                          <div
                                            class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                                            <i class="fas fa-user text-[10px] text-slate-400" />
                                          </div>
                                          <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                            <span class="text-xs font-semibold text-slate-700">{{ member.name }}</span>
                                            <template v-for="mb in [memberRollupRoleBadge(member)]"
                                              :key="`mbr-${member.id}`">
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
                                          <span
                                            :class="diagnosticsTargetPillClass(member.targetBalance)"
                                            :title="diagnosticsTargetTitle(member.targetBalance)">{{
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
                                          title="Tiến độ hoàn thành = (Actual / Target) x 100.">
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
                                            class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                            :title="diagnosticsReasonTooltip(member.blocker)">
                                            <template v-if="memberStatusForUiMidYear(member, kpi) === 'danger'">
                                              <span class="inline-flex items-center text-red-600">
                                                <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                              </span>
                                            </template>
                                            <template v-else-if="memberStatusForUiMidYear(member, kpi) === 'warning'">
                                              <span class="inline-flex items-center text-yellow-700">
                                                <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                              </span>
                                            </template>
                                            <template v-else>
                                              <span class="inline-flex items-center text-green-600">
                                                <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                {{ memberDiagnosticsStatusLabelMidYear(member, kpi) }}
                                              </span>
                                            </template>
                                          </span>
                                        </div>
                                        <div class="col-span-1 flex justify-center">
                                          <button
                                            v-if="isMemberFeedbackPendingForGm(member)"
                                            type="button"
                                            class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                            @click.stop="openFeedbackDrawerForMember(kpi, member)">
                                            Feedback
                                          </button>
                                          <span v-else class="text-xs text-slate-200">-</span>
                                        </div>
                                      </div>
                                    </template>

                                    <template v-if="!pmSelfMember(pm) && pmUsesLeaderTree(pm)">
                                      <div
                                        v-for="row in pmLeadersFlattened(pm)"
                                        :key="pmLeaderFlatRowKey(row)"
                                        class="border-b border-slate-100/80 last:border-b-0">
                                        <div
                                          v-if="row.kind === 'leader'"
                                          class="grid grid-cols-15 items-center gap-2 border-l-2 border-violet-200/60 bg-violet-50/35 px-3 py-1.5 sm:gap-3">
                                          <div class="col-span-4 flex min-w-0 items-center pl-14">
                                            <span class="mr-1 inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <div
                                              class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white shadow-sm">
                                              <i class="fas fa-user text-[10px] text-violet-600" aria-hidden="true" />
                                            </div>
                                            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                              <span class="truncate text-xs font-semibold text-slate-800">{{ row.leader.name }}</span>
                                              <template v-for="lb in [leaderRollupRoleBadge(row.leader)]"
                                                :key="`lrb-${row.leader.id}`">
                                                <span v-if="lb"
                                                  class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                                  :class="lb.badgeClass">{{ lb.label }}</span>
                                              </template>
                                            </div>
                                          </div>
                                          <div class="col-span-1 text-center">
                                            <span
                                              class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                                diagnosticsWeightDisplay(row.leader.weight)
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 flex justify-center text-center">
                                            <span
                                              :class="diagnosticsTargetPillClass(row.leader.leaderOwnRow!.targetBalance)"
                                              :title="diagnosticsTargetTitle(row.leader.leaderOwnRow!.targetBalance)">{{
                                                memberTableTargetDisplayWithUnit(row.leader.leaderOwnRow!, kpi)
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                            :class="memberActualColorClass(row.leader.leaderOwnRow!, kpi)">
                                            {{ memberActualWithUnit(row.leader.leaderOwnRow!, kpi) }}
                                          </div>
                                          <div
                                            class="col-span-1 text-center text-xs font-bold tabular-nums"
                                            :class="diagnosticsMemberProgressTextClass(row.leader.leaderOwnRow!, kpi)"
                                            title="Tiến độ hoàn thành = (Actual / Target) x 100.">
                                            {{ diagnosticsMemberProgressPct(row.leader.leaderOwnRow!, kpi) }}
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'danger'
                                              ? 'text-red-600'
                                              : memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'warning'
                                                ? 'text-yellow-600'
                                                : 'text-green-600'
                                            " :title="memberDiagnosticsScoreTooltip(row.leader.leaderOwnRow!)">
                                            {{ memberTableScoreDisplay(row.leader.leaderOwnRow!) }}
                                          </div>
                                          <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                            <span
                                              class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                              :title="diagnosticsReasonTooltip(row.leader.leaderOwnRow!.blocker)">
                                              <template v-if="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'danger'">
                                                <span class="inline-flex items-center text-red-600">
                                                  <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                </span>
                                              </template>
                                              <template v-else-if="memberStatusForUiMidYear(row.leader.leaderOwnRow!, kpi) === 'warning'">
                                                <span class="inline-flex items-center text-yellow-700">
                                                  <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                </span>
                                              </template>
                                              <template v-else>
                                                <span class="inline-flex items-center text-green-600">
                                                  <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.leader.leaderOwnRow!, kpi) }}
                                                </span>
                                              </template>
                                            </span>
                                          </div>
                                          <div class="col-span-1 flex justify-center">
                                            <button
                                              v-if="isMemberFeedbackPendingForGm(row.leader.leaderOwnRow!)"
                                              type="button"
                                              class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                              @click.stop="openFeedbackDrawerForMember(kpi, row.leader.leaderOwnRow!)">
                                              Feedback
                                            </button>
                                            <span v-else class="text-xs text-slate-200">-</span>
                                          </div>
                                        </div>
                                        <div
                                          v-else
                                          class="grid grid-cols-15 items-center gap-2 border-l-2 border-violet-200/60 px-3 py-1.5 transition-colors hover:bg-white sm:gap-3">
                                          <div class="col-span-4 flex items-center pl-14">
                                            <span class="mr-1 inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <div
                                              class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                                              <i class="fas fa-user text-[10px] text-slate-400" />
                                            </div>
                                            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                              <span class="text-xs font-semibold text-slate-700">{{ row.member.name }}</span>
                                              <template v-for="mb in [memberRollupRoleBadge(row.member)]"
                                                :key="`mbr-l-${row.member.id}`">
                                                <span v-if="mb"
                                                  class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                                  :class="mb.badgeClass">{{ mb.label }}</span>
                                              </template>
                                            </div>
                                          </div>
                                          <div class="col-span-1 text-center">
                                            <span
                                              class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700">{{
                                                diagnosticsWeightDisplay(row.member.weight)
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 flex justify-center text-center">
                                            <span
                                              :class="diagnosticsTargetPillClass(row.member.targetBalance)"
                                              :title="diagnosticsTargetTitle(row.member.targetBalance)">{{
                                                memberTableTargetDisplayWithUnit(row.member, kpi)
                                              }}</span>
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums"
                                            :class="memberActualColorClass(row.member, kpi)">
                                            {{ memberActualWithUnit(row.member, kpi) }}
                                          </div>
                                          <div
                                            class="col-span-1 text-center text-xs font-bold tabular-nums"
                                            :class="diagnosticsMemberProgressTextClass(row.member, kpi)"
                                            title="Tiến độ hoàn thành = (Actual / Target) x 100.">
                                            {{ diagnosticsMemberProgressPct(row.member, kpi) }}
                                          </div>
                                          <div class="col-span-2 text-center text-xs font-bold tabular-nums" :class="memberStatusForUiMidYear(row.member, kpi) === 'danger'
                                              ? 'text-red-600'
                                              : memberStatusForUiMidYear(row.member, kpi) === 'warning'
                                                ? 'text-yellow-600'
                                                : 'text-green-600'
                                            " :title="memberDiagnosticsScoreTooltip(row.member)">
                                            {{ memberTableScoreDisplay(row.member) }}
                                          </div>
                                          <div class="col-span-2 flex justify-center items-center text-xs font-semibold">
                                            <span
                                              class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                              :title="diagnosticsReasonTooltip(row.member.blocker)">
                                              <template v-if="memberStatusForUiMidYear(row.member, kpi) === 'danger'">
                                                <span class="inline-flex items-center text-red-600">
                                                  <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                </span>
                                              </template>
                                              <template v-else-if="memberStatusForUiMidYear(row.member, kpi) === 'warning'">
                                                <span class="inline-flex items-center text-yellow-700">
                                                  <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                </span>
                                              </template>
                                              <template v-else>
                                                <span class="inline-flex items-center text-green-600">
                                                  <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                                  {{ memberDiagnosticsStatusLabelMidYear(row.member, kpi) }}
                                                </span>
                                              </template>
                                            </span>
                                          </div>
                                          <div class="col-span-1 flex justify-center">
                                            <button
                                              v-if="isMemberFeedbackPendingForGm(row.member)"
                                              type="button"
                                              class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                                              @click.stop="openFeedbackDrawerForMember(kpi, row.member)">
                                              Feedback
                                            </button>
                                            <span v-else class="text-xs text-slate-200">-</span>
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
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <div v-if="prunedFilteredRows.length === 0" class="p-8 text-center text-xs font-medium text-slate-500">
            <p>Không có KPI nào phù hợp với bộ lọc hiện tại.</p>
            <button v-if="appliedFilterCount > 0" type="button"
              class="mt-3 text-xs font-bold text-blue-600 hover:underline" @click="resetAllDiagnosticFilters">
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="gm-diag-feedback-drawer">
        <div
          v-if="feedbackDrawerOpen && feedbackDrawerKpi"
          class="fixed inset-0 z-[220] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-diag-feedback-title">
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
                      Chỉ tiêu:
                      <span class="font-bold text-slate-900">
                        {{ diagnosticsTargetWithUnit(feedbackDrawerKpi, feedbackDrawerKpi.target) }}
                      </span>
                    </p>
                    <p>
                      Trọng số:
                      <span class="font-bold text-slate-900">{{ diagnosticsWeightDisplay(feedbackDrawerKpi.weight) }}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng drawer feedback"
                  @click="closeFeedbackDrawer">
                  <i class="fas fa-times text-xs" />
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto bg-slate-50/40">
              <section class="border-b border-slate-200 bg-white px-5 py-4">
                <h4 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <i class="fas fa-align-left text-xs text-violet-600" />
                  Đề xuất điều chỉnh
                </h4>
                <div v-if="!activeFeedbackItem" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p class="text-xs font-medium text-slate-600">Không còn feedback nào đang chờ xử lý.</p>
                </div>
                <div v-else class="space-y-4">
                  <div>
                    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Nội dung chi tiết
                    </label>
                    <div
                      class="min-h-[88px] whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                      {{ activeFeedbackItem.note }}
                    </div>
                  </div>
                  <div class="flex justify-end gap-2 pt-1">
                    <button type="button"
                      class="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                      @click="resolvePendingFeedback(activeFeedbackItem.assignmentId, false)">
                      Từ chối feedback
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                      @click="resolvePendingFeedback(activeFeedbackItem.assignmentId, true)">
                      <i class="fas fa-sliders-h text-xs" />
                      Duyệt feedback
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
