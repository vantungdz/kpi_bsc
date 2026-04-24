<script setup lang="ts">
import { ref, computed, shallowRef, watch, onMounted, onUnmounted, nextTick } from 'vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import { gmKpiHierarchyMockRows, gmLayoutMockDepartments } from '@/mocks/gm-kpi.mock'
import type {
  GmBscPerspective,
  GmHierarchyKpi,
  GmHierarchyLeader,
  GmHierarchyMember,
  GmHierarchyPm,
  GmHierarchyStatus,
  GmKpiSubmissionStatus,
  GmMemberKpiDrawerProfile,
  GmModalKpiItemMock,
  GmPmKpiRolloutPayload,
} from '@/types/gm-workspace'
import { GM_BSC_LABELS, GM_BSC_ORDER, normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'

const props = withDefaults(
  defineProps<{
    /** Mặc định: `gmKpiHierarchyMockRows` — sinh từ `gmLayoutMockDepartments` + `gmLayoutMockMembersDetails` */
    rows?: GmHierarchyKpi[]
  }>(),
  { rows: () => gmKpiHierarchyMockRows },
)

const emit = defineEmits<{
  'edit-kpi': [kpi: GmHierarchyKpi]
  'delete-kpi': [kpi: GmHierarchyKpi]
}>()

function onEditKpiClick(kpi: GmHierarchyKpi) {
  emit('edit-kpi', kpi)
}

function onDeleteKpiClick(kpi: GmHierarchyKpi) {
  emit('delete-kpi', kpi)
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

/** Cây PM → Leader → Member (khi mock/API có `leaders`). */
function pmUsesLeaderTree(pm: GmHierarchyPm): boolean {
  return Array.isArray(pm.leaders) && pm.leaders.length > 0
}

function allMembersUnderPm(pm: GmHierarchyPm): GmHierarchyMember[] {
  const fromLeaders = pm.leaders?.flatMap((l) => l.members) ?? []
  return [...pm.members, ...fromLeaders]
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

function toggleLeader(pmId: string, leaderId: string) {
  toggleSet(expandedLeaders, leaderExpandKey(pmId, leaderId))
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
  return parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0
}

/** Có đủ số thô PM giao / member nộp để hiện % tiến độ trên bảng. */
function hasMemberSubmissionProgress(member: GmHierarchyMember) {
  return (
    member.submissionTarget != null &&
    member.submissionTarget > 0 &&
    member.submissionActual != null
  )
}

/** Actual trên bảng = (submissionActual / submissionTarget) * 100 (làm tròn). */
function memberTableActualDisplay(member: GmHierarchyMember) {
  if (!hasMemberSubmissionProgress(member)) return member.actual
  const pct = Math.round((100 * member.submissionActual!) / member.submissionTarget!)
  return `${pct}%`
}

function memberDiagnosticsStatusLabel(member: GmHierarchyMember): string {
  const pl = member.performanceLabel?.trim()
  if (pl) return pl
  if (member.status === 'danger') return 'Fail'
  if (member.status === 'warning') return 'Warning'
  return 'Done'
}

/**
 * Target trên bảng (dòng member): khi có số thô PM giao → hiển thị 100% (mức chuẩn “đủ chỉ tiêu được giao”),
 * để cùng cơ sở với Actual = (submissionActual / submissionTarget) * 100%.
 */
function memberTableTargetDisplay(member: GmHierarchyMember) {
  if (hasMemberSubmissionProgress(member)) return '100%'
  return member.target
}

/** % hiển thị trên card drawer (đồng bộ logic với cột Actual bảng khi có submission). */
function memberDrawerActualProgressPct(member: GmHierarchyMember): string | null {
  if (hasMemberSubmissionProgress(member)) {
    return `${Math.round((100 * member.submissionActual!) / member.submissionTarget!)}%`
  }
  const t = parseNumPct(member.target)
  const a = parseNumPct(member.actual)
  if (t > 0) return `${Math.round((100 * a) / t)}%`
  return null
}

function actualBelowTarget(actual: string, target: string) {
  return parseNumPct(actual) < parseNumPct(target)
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
  return pmRollupRoleBadge(pm)?.label ?? '—'
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
  if (ct === 'TEAM') return 'Dòng KPI team — danh sách người nhận bên dưới'
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
          const leaders = nextLeaders.filter((ldr) => ldr.members.length > 0)
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
      if (memSet.size > 0 && pmUsesLeaderTree(pm)) {
        for (const l of pm.leaders!) {
          if (l.members.some((m) => memSet.has(String(m.name ?? '').trim()))) {
            leaderKeys.add(leaderExpandKey(pm.id, l.id))
          }
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
  if (!t || t === '-') return undefined
  return t
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

function memberDrawerDepartmentLabel(pm: GmHierarchyPm, kpi: GmHierarchyKpi) {
  const fromLine = stripRollupUnitLinePrefix(pm.unitLine)
  if (fromLine) return fromLine.toUpperCase()
  if (kpi.investigateDeptId) {
    const n = gmLayoutMockDepartments.find((d) => d.id === kpi.investigateDeptId)?.name
    if (n) return n.toUpperCase()
  }
  return undefined
}

function parseWeightPct(weight: string): number {
  const n = parseInt(String(weight).replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function submissionFromMemberStatus(s: GmHierarchyStatus): GmKpiSubmissionStatus {
  if (s === 'danger') return 'missing_data'
  if (s === 'warning') return 'submitted'
  return 'submitted_with_file'
}

/** Một dòng KPI trong drawer — đúng KPI đang xem trên bảng, không phải toàn bộ KPI của member. */
function memberRowToModalItem(member: GmHierarchyMember, kpi: GmHierarchyKpi, pm: GmHierarchyPm): GmModalKpiItemMock {
  const evidenceNote = member.blocker !== '-' ? member.blocker : '—'
  const drawerTarget =
    member.submissionTarget != null ? String(member.submissionTarget) : member.target
  const drawerActual =
    member.submissionActual != null ? String(member.submissionActual) : member.actual
  return {
    code: member.id,
    obj: kpi.name,
    weight: parseWeightPct(kpi.weight),
    target: drawerTarget,
    actual: drawerActual,
    isFail: member.status === 'danger',
    rootCause: member.blocker !== '-' ? member.blocker : '',
    score: member.actual,
    kpiType: kpi.kpiType,
    submissionStatus: submissionFromMemberStatus(member.status),
    targetSummary: `Đóng góp trong KPI «${kpi.name}» · Minh chứng / ghi chú: ${evidenceNote} · ${pmRollupShortRoleForLabel(pm)}: ${pm.name}`,
    actualProgressPct: memberDrawerActualProgressPct(member),
    evidenceAttachmentUrl: member.evidenceAttachmentUrl ?? null,
  }
}

function openPmKpiDrawer(pm: GmHierarchyPm, kpi: GmHierarchyKpi) {
  const rolloutMembers = allMembersUnderPm(pm)
  if (!rolloutMembers.length) return
  drawerPmKpiRollout.value = {
    pmName: pm.name,
    rollupRoleLabel: pmRollupShortRoleForLabel(pm),
    pmUnitLine: pm.unitLine,
    kpiName: kpi.name,
    kpiTarget: kpi.target,
    rows: rolloutMembers.map((m) => ({
      profile: {
        name: m.name,
        rank: m.rank,
        leader: m.leader,
        departmentLabel: memberDrawerDepartmentLabel(pm, kpi),
      },
      item: memberRowToModalItem(m, kpi, pm),
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

<template>
  <div>
  <div
    id="diagnostics-section"
    class="w-auto animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white pb-4 shadow-sm"
  >
    <!-- Header + nút Bộ lọc (popover theo Documents/index.html) -->
    <div class="flex flex-col gap-3 border-b border-slate-200 bg-white p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <h3
            class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 sm:text-sm"
          >
            <i class="fas fa-layer-group text-[11px] text-blue-600 sm:text-xs" />
            Strategic KPIs Tracking & Diagnostics
          </h3>
        </div>

        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 self-start lg:self-auto">
          <button
            v-if="appliedFilterCount > 0"
            type="button"
            class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50/80 hover:text-rose-800"
            aria-label="Đặt lại tất cả bộ lọc"
            @click.stop="resetAllDiagnosticFilters"
          >
            <i class="fas fa-rotate-left text-[11px] text-slate-500" aria-hidden="true" />
            Đặt lại bộ lọc
          </button>
          <div ref="filterPopoverWrapRef" class="relative">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
              aria-haspopup="dialog"
              :aria-expanded="filterPopoverOpen"
              @click.stop="toggleFilterPopover"
            >
              <i class="fas fa-sliders-h text-sm text-slate-500" aria-hidden="true" />
              Bộ lọc
              <span
                v-if="appliedFilterCount > 0"
                class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-blue-700"
              >{{ appliedFilterCount }}</span>
            </button>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <Transition name="gm-diag-filter-pop">
          <div
            v-if="filterPopoverOpen"
            ref="filterPopoverPanelRef"
            class="fixed z-[200] flex max-h-[min(24rem,calc(100vh-1rem))] origin-top-right flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            :style="filterPanelFixedStyle"
            role="dialog"
            aria-label="Tùy chỉnh bộ lọc"
            @click.stop
          >
              <div class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Tùy chỉnh hiển thị
                </h4>
                <button
                  type="button"
                  class="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  @click="resetAllDiagnosticFilters"
                >
                  Đặt lại bộ lọc
                </button>
              </div>

              <div class="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Section
                  </label>
                  <div
                    v-if="diagnosticsSectionOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                  >
                    Không có section trong dữ liệu hiện tại.
                  </div>
                  <div
                    v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group"
                    aria-label="Chọn section"
                  >
                    <label
                      v-for="s in diagnosticsSectionOptions"
                      :key="s"
                      class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftSections.includes(s)"
                        @change="toggleDraftSection(s)"
                      />
                      <span class="min-w-0 leading-snug">{{ s }}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Thành viên
                  </label>
                  <div
                    v-if="diagnosticsMemberOptions.length === 0"
                    class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                  >
                    Không có thành viên trong dữ liệu hiện tại.
                  </div>
                  <div
                    v-else
                    class="custom-scrollbar max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                    role="group"
                    aria-label="Chọn thành viên"
                  >
                    <label
                      v-for="n in diagnosticsMemberOptions"
                      :key="n"
                      class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftMembers.includes(n)"
                        @change="toggleDraftMember(n)"
                      />
                      <span class="min-w-0 leading-snug">{{ n }}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500" for="diag-draft-important">
                    Mức độ quan trọng
                  </label>
                  <div class="relative">
                    <select
                      id="diag-draft-important"
                      v-model="draftImportant"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-amber-500"
                    >
                      <option value="">Tất cả</option>
                      <option value="yes">Chỉ KPI quan trọng (⭐)</option>
                      <option value="no">KPI thường (không sao)</option>
                    </select>
                    <i
                      class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-[10px] font-bold text-slate-500">
                    Trạng thái KPI
                  </label>
                  <div
                    class="space-y-1 rounded-lg border border-slate-200 bg-white p-2"
                    role="group"
                    aria-label="Chọn trạng thái KPI"
                  >
                    <label
                      v-for="st in STATUS_FILTER_OPTIONS"
                      :key="st"
                      class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        class="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="draftStatuses.includes(st)"
                        @change="toggleDraftStatus(st)"
                      />
                      <span>{{ kpiStatusLabel(st) }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200/60"
                  @click="cancelFilterPopover"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                  @click="applyPopoverFilters"
                >
                  Áp dụng / Lọc
                </button>
              </div>
            </div>
          </Transition>
      </Teleport>

      <!-- Chip bộ lọc đang áp dụng (index.html #active-filters-container) -->
      <div
        v-if="activeFilterChips.length > 0"
        class="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3"
      >
        <span class="mt-1.5 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Đang lọc theo:
        </span>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="chip in activeFilterChips"
            :key="chip.key + chip.label"
            class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800"
          >
            {{ chip.label }}
            <button
              type="button"
              class="ml-0.5 rounded p-0.5 text-blue-400 hover:text-blue-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              :aria-label="`Bỏ lọc ${chip.label}`"
              @click="removeAppliedFilterChip(chip.key)"
            >
              <i class="fas fa-times text-[10px]" aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <div class="min-w-[860px] divide-y divide-slate-200">
        <!-- 4+1+2+2+2+1 — Target/Actual rộng hơn; cột Thao tác căn nút Chi tiết -->
        <div
          class="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 sm:gap-3"
        >
          <div class="col-span-4 pl-6">Mục tiêu KPI &amp; PM / Leader / Member</div>
          <div class="col-span-1 text-center">Trọng số</div>
          <div class="col-span-2 text-center">Target</div>
          <div class="col-span-2 text-center">Actual</div>
          <div class="col-span-2 text-center">Trạng thái</div>
          <div class="col-span-1 text-center">Thao tác</div>
        </div>

        <template v-for="group in visibleRowGroups" :key="'sec-' + group.key">
          <div class="border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
              :aria-expanded="expandedSectionKeys.has(group.key)"
              :aria-controls="sectionDomId(group.key)"
              @click="toggleSection(group.key)"
            >
              <i
                class="fas fa-chevron-right w-3 shrink-0 text-center text-[10px] text-slate-500 transition-transform duration-200 motion-reduce:transition-none"
                :class="expandedSectionKeys.has(group.key) ? 'rotate-90' : ''"
                aria-hidden="true"
              />
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-800">{{ group.label }}</span>
              <span
                class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                >{{ group.rows.length }} KPI</span>
            </button>
          </div>
          <div
            :id="sectionDomId(group.key)"
            class="grid overflow-hidden border-b border-slate-200 transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
            :class="expandedSectionKeys.has(group.key) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
          >
            <div class="min-h-0 divide-y divide-slate-200">
            <template v-for="kpi in group.rows" :key="kpi.id">
          <!-- Dòng KPI -->
          <div class="flex flex-col">
            <div
              class="grid cursor-pointer grid-cols-12 items-center gap-2 px-3 py-2.5 transition-colors sm:gap-3"
              :class="expandedKpis.has(kpi.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'"
              @click="toggleKpi(kpi.id)"
            >
              <div class="col-span-4 flex items-center">
                <button
                  type="button"
                  class="mr-1 p-0.5 text-slate-500 hover:text-slate-800"
                  aria-label="Mở rộng KPI"
                  :aria-expanded="expandedKpis.has(kpi.id)"
                  @click.stop="toggleKpi(kpi.id)"
                >
                  <i
                    class="fas fa-chevron-right text-xs transition-transform duration-300 ease-out motion-reduce:transition-none"
                    :class="expandedKpis.has(kpi.id) ? 'rotate-90' : 'rotate-0'"
                  />
                </button>
                <div
                  class="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm"
                  :class="kpiIconWrapClass(kpi.status)"
                >
                  <i class="fas fa-bullseye text-[11px]" />
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <i
                      v-if="kpi.isImportant"
                      class="fas fa-star shrink-0 text-[11px] text-amber-500"
                      title="KPI quan trọng (Important)"
                      aria-label="KPI quan trọng"
                    />
                    <span class="text-sm font-bold leading-snug text-slate-800">{{ kpi.name }}</span>
                    <GmStrategicKpiTypeTag :type="kpi.kpiType" size="sm" class="shrink-0" />
                  </div>
                </div>
              </div>
              <div class="col-span-1 text-center">
                <span
                  class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700"
                >{{ kpi.weight }}</span>
              </div>
              <div class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600">
                {{ kpi.target }}
              </div>
              <div
                class="col-span-2 text-center text-sm font-bold tabular-nums"
                :class="actualBelowTarget(kpi.actual, kpi.target) ? 'text-red-600' : 'text-green-600'"
              >
                {{ kpi.actual }}
              </div>
              <div class="col-span-2 flex justify-center">
                <span
                  class="inline-flex max-w-full cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                  :class="badgeClass(kpi.status)"
                  :title="diagnosticsReasonTooltip(kpi.blockerSummary)"
                >
                  <i
                    class="fas shrink-0 text-[11px]"
                    :class="
                      kpi.status === 'success'
                        ? 'fa-check-circle'
                        : kpi.status === 'warning'
                          ? 'fa-exclamation-circle'
                          : 'fa-times-circle'
                    "
                  />
                  <span class="truncate">{{ kpiStatusLabel(kpi.status) }}</span>
                </span>
              </div>
              <div class="col-span-1 flex flex-wrap items-center justify-center gap-1" @click.stop>
                <button
                  type="button"
                  class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                  title="Sửa KPI"
                  aria-label="Sửa KPI"
                  @click="onEditKpiClick(kpi)"
                >
                  <i class="fas fa-pen text-[9px]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  title="Xóa KPI"
                  aria-label="Xóa KPI"
                  @click="onDeleteKpiClick(kpi)"
                >
                  <i class="fas fa-trash text-[9px]" aria-hidden="true" />
                </button>
              </div>
            </div>

            <!-- Khối quản lý → PM + cấp dưới (collapse) -->
            <div
              v-if="kpi.pmOwners.length > 0"
              class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
              :class="expandedKpis.has(kpi.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
              <div class="min-h-0">
                <div class="border-t border-slate-100 bg-white pb-2">
                  <template v-for="pm in kpi.pmOwners" :key="pm.id">
                    <div class="flex flex-col">
                      <div
                        class="grid grid-cols-12 items-center gap-2 border-b border-slate-50 px-3 py-2 sm:gap-3"
                        :class="pmHasRollout(pm) ? 'cursor-pointer hover:bg-slate-50' : ''"
                        @click="pmHasRollout(pm) && togglePm(pm.id)"
                      >
                        <div class="col-span-4 flex min-w-0 items-center pl-9">
                          <button
                            type="button"
                            class="mr-1 shrink-0 p-1 text-slate-400"
                            :disabled="!pmHasRollout(pm)"
                            :aria-expanded="pmHasRollout(pm) ? expandedPms.has(pm.id) : undefined"
                            @click.stop="pmHasRollout(pm) && togglePm(pm.id)"
                          >
                            <i
                              v-if="pmHasRollout(pm)"
                              class="fas fa-chevron-right text-xs transition-transform duration-300 ease-out motion-reduce:transition-none"
                              :class="expandedPms.has(pm.id) ? 'rotate-90' : 'rotate-0'"
                            />
                            <span v-else class="inline-block h-4 w-4" />
                          </button>
                          <i class="fas fa-sitemap mr-2 shrink-0 text-[11px] text-indigo-500" />
                          <div class="min-w-0">
                            <div class="truncate text-xs font-bold text-slate-800">
                              {{ pmManagedSectionLabel(pm) }}
                            </div>
                            <div v-if="!pmHasRollout(pm)" class="mt-0.5 truncate text-xs font-medium text-slate-500">
                              {{ pmRollupOwnerSubtitle(pm) }}: {{ pm.name }}
                            </div>
                          </div>
                        </div>
                        <div class="col-span-1 text-center text-xs text-slate-300">-</div>
                        <div class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600">
                          {{ pm.target }}
                        </div>
                        <div class="col-span-2 text-center text-xs font-bold tabular-nums text-slate-800">
                          {{ pm.actual }}
                        </div>
                        <div class="col-span-2 flex justify-center">
                          <span
                            class="inline-flex max-w-full cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                            :class="badgeClass(pm.status)"
                            :title="diagnosticsReasonTooltip(pm.blockerSummary)"
                          >
                            <i
                              class="fas shrink-0 text-[11px]"
                              :class="
                                pm.status === 'success'
                                  ? 'fa-check-circle'
                                  : pm.status === 'warning'
                                    ? 'fa-exclamation-circle'
                                    : 'fa-times-circle'
                              "
                            />
                            <span class="truncate">{{ kpiStatusLabel(pm.status) }}</span>
                          </span>
                        </div>
                        <div class="col-span-1 flex justify-center pr-0.5">
                          <button
                            v-if="pmHasRollout(pm)"
                            type="button"
                            class="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold leading-tight text-indigo-700 transition-colors hover:bg-indigo-100 sm:px-2.5 sm:text-xs"
                            @click.stop="openPmKpiDrawer(pm, kpi)"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </div>

                      <div
                        v-if="pmHasRollout(pm)"
                        class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                        :class="expandedPms.has(pm.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
                      >
                        <div class="min-h-0">
                          <div class="border-y border-slate-100 bg-slate-50/50 py-1">
                            <div
                              v-if="!(pmHasRollout(pm) && pmRolloutSelfOnlyRedundantSummaryBand(pm))"
                              class="flex flex-wrap items-center gap-2 border-b border-indigo-100/90 bg-gradient-to-r from-indigo-50/50 to-transparent py-2 pl-20 pr-3"
                              :title="`Target, Actual và trạng thái tổng hợp của nhóm «${pmManagedSectionLabel(pm)}» nằm ở dòng khối phía trên. Phía dưới: ${pm.members.length > 0 && pmUsesLeaderTree(pm) ? 'thành viên trực tiếp và nhóm theo supervisor' : pmUsesLeaderTree(pm) ? 'nhóm theo supervisor' : 'từng thành viên'}.`"
                            >
                              <span class="sr-only">
                                {{ pmRollupOwnerSrOnly(pm) }}; chỉ số tổng hợp nằm ở dòng khối phía trên.
                              </span>
                              <div
                                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-white shadow-sm"
                              >
                                <i class="fas fa-user-tie text-[10px] text-indigo-600" aria-hidden="true" />
                              </div>
                              <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span class="text-xs font-semibold text-slate-800">{{ pm.name }}</span>
                                <template v-for="rb in [pmRollupRoleBadge(pm)]" :key="`rb-${pm.id}`">
                                  <span
                                    v-if="rb"
                                    class="rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                    :class="rb.badgeClass"
                                  >{{ rb.label }}</span>
                                </template>
                              </div>
                              <span
                                class="ml-auto hidden shrink-0 items-center gap-1 text-[10px] font-medium text-slate-400 sm:inline-flex"
                                aria-hidden="true"
                              >
                                <i class="fas fa-arrow-up text-[9px]" />
                                Chỉ số nhóm · dòng khối
                              </span>
                            </div>

                            <template v-if="pm.members.length > 0">
                              <div
                                v-for="member in pm.members"
                                :key="member.id"
                                class="grid grid-cols-12 items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white sm:gap-3"
                              >
                                <div class="col-span-4 flex items-center pl-20">
                                  <div
                                    class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"
                                  >
                                    <i class="fas fa-user text-[10px] text-slate-400" />
                                  </div>
                                  <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span class="text-xs font-semibold text-slate-700">{{ member.name }}</span>
                                    <template v-for="mb in [memberRollupRoleBadge(member)]" :key="`mbr-${member.id}`">
                                      <span
                                        v-if="mb"
                                        class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                        :class="mb.badgeClass"
                                      >{{ mb.label }}</span>
                                    </template>
                                  </div>
                                </div>
                                <div class="col-span-1 text-center text-xs text-slate-300">-</div>
                                <div class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600">
                                  {{ memberTableTargetDisplay(member) }}
                                </div>
                                <div
                                  class="col-span-2 text-center text-xs font-bold tabular-nums"
                                  :class="
                                    member.status === 'danger'
                                      ? 'text-red-600'
                                      : member.status === 'warning'
                                        ? 'text-yellow-600'
                                        : 'text-green-600'
                                  "
                                  :title="
                                    hasMemberSubmissionProgress(member)
                                      ? `PM giao: ${member.submissionTarget}, Member nộp: ${member.submissionActual} → ${memberTableActualDisplay(member)}`
                                      : undefined
                                  "
                                >
                                  {{ memberTableActualDisplay(member) }}
                                </div>
                                <div class="col-span-2 flex justify-center text-xs font-semibold">
                                  <span
                                    class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                    :title="diagnosticsReasonTooltip(member.blocker)"
                                  >
                                    <template v-if="member.status === 'danger'">
                                      <span class="inline-flex items-center text-red-600">
                                        <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                        {{ memberDiagnosticsStatusLabel(member) }}
                                      </span>
                                    </template>
                                    <template v-else-if="member.status === 'warning'">
                                      <span class="inline-flex items-center text-yellow-700">
                                        <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                        {{ memberDiagnosticsStatusLabel(member) }}
                                      </span>
                                    </template>
                                    <template v-else>
                                      <span class="inline-flex items-center text-green-600">
                                        <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                        {{ memberDiagnosticsStatusLabel(member) }}
                                      </span>
                                    </template>
                                  </span>
                                </div>
                                <div class="col-span-1 text-center text-xs text-slate-200">—</div>
                              </div>
                            </template>

                            <template v-if="pmUsesLeaderTree(pm)">
                              <div
                                v-for="leader in pm.leaders"
                                :key="leader.id"
                                class="border-b border-slate-100/80 last:border-b-0"
                              >
                                <div
                                  class="grid grid-cols-12 items-center gap-2 border-l-2 border-violet-200/70 bg-violet-50/35 px-3 py-1.5 sm:gap-3"
                                  :class="leader.members.length ? 'cursor-pointer hover:bg-violet-50/70' : ''"
                                  @click="leader.members.length && toggleLeader(pm.id, leader.id)"
                                >
                                  <div class="col-span-4 flex min-w-0 items-center pl-24">
                                    <button
                                      type="button"
                                      class="mr-1 shrink-0 p-1 text-slate-400"
                                      :disabled="!leader.members.length"
                                      :aria-expanded="
                                        leader.members.length
                                          ? expandedLeaders.has(leaderExpandKey(pm.id, leader.id))
                                          : undefined
                                      "
                                      @click.stop="leader.members.length && toggleLeader(pm.id, leader.id)"
                                    >
                                      <i
                                        v-if="leader.members.length"
                                        class="fas fa-chevron-right text-[11px] transition-transform duration-300 ease-out motion-reduce:transition-none"
                                        :class="
                                          expandedLeaders.has(leaderExpandKey(pm.id, leader.id))
                                            ? 'rotate-90'
                                            : 'rotate-0'
                                        "
                                      />
                                      <span v-else class="inline-block h-3.5 w-3.5" />
                                    </button>
                                    <div
                                      class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white shadow-sm"
                                    >
                                      <i class="fas fa-user text-[10px] text-violet-600" aria-hidden="true" />
                                    </div>
                                    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <span class="truncate text-xs font-semibold text-slate-800">{{ leader.name }}</span>
                                      <template v-for="lb in [leaderRollupRoleBadge(leader)]" :key="`lrb-${leader.id}`">
                                        <span
                                          v-if="lb"
                                          class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                          :class="lb.badgeClass"
                                        >{{ lb.label }}</span>
                                      </template>
                                    </div>
                                  </div>
                                  <div class="col-span-1 text-center text-xs text-slate-300">-</div>
                                  <div
                                    class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600"
                                  >
                                    {{ leader.target }}
                                  </div>
                                  <div
                                    class="col-span-2 text-center text-xs font-bold tabular-nums text-slate-800"
                                  >
                                    {{ leader.actual }}
                                  </div>
                                  <div class="col-span-2 flex justify-center">
                                    <span
                                      class="inline-flex max-w-full cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                                      :class="badgeClass(leader.status)"
                                      :title="diagnosticsReasonTooltip(leader.blockerSummary)"
                                    >
                                      <i
                                        class="fas shrink-0 text-[11px]"
                                        :class="
                                          leader.status === 'success'
                                            ? 'fa-check-circle'
                                            : leader.status === 'warning'
                                              ? 'fa-exclamation-circle'
                                              : 'fa-times-circle'
                                        "
                                      />
                                      <span class="truncate">{{ kpiStatusLabel(leader.status) }}</span>
                                    </span>
                                  </div>
                                  <div class="col-span-1 text-center text-xs text-slate-200">—</div>
                                </div>

                                <div
                                  v-if="leader.members.length > 0"
                                  class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                                  :class="
                                    expandedLeaders.has(leaderExpandKey(pm.id, leader.id))
                                      ? 'grid-rows-[1fr]'
                                      : 'grid-rows-[0fr]'
                                  "
                                >
                                  <div class="min-h-0">
                                    <div
                                      v-for="member in leader.members"
                                      :key="member.id"
                                      class="grid grid-cols-12 items-center gap-2 border-l-2 border-slate-200/80 px-3 py-1.5 transition-colors hover:bg-white sm:gap-3"
                                    >
                                      <div class="col-span-4 flex items-center pl-28">
                                        <div
                                          class="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"
                                        >
                                          <i class="fas fa-user text-[10px] text-slate-400" />
                                        </div>
                                        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                          <span class="text-xs font-semibold text-slate-700">{{ member.name }}</span>
                                          <template v-for="mb in [memberRollupRoleBadge(member)]" :key="`mbr-l-${member.id}`">
                                            <span
                                              v-if="mb"
                                              class="shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
                                              :class="mb.badgeClass"
                                            >{{ mb.label }}</span>
                                          </template>
                                        </div>
                                      </div>
                                      <div class="col-span-1 text-center text-xs text-slate-300">-</div>
                                      <div
                                        class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600"
                                      >
                                        {{ memberTableTargetDisplay(member) }}
                                      </div>
                                      <div
                                        class="col-span-2 text-center text-xs font-bold tabular-nums"
                                        :class="
                                          member.status === 'danger'
                                            ? 'text-red-600'
                                            : member.status === 'warning'
                                              ? 'text-yellow-600'
                                              : 'text-green-600'
                                        "
                                        :title="
                                          hasMemberSubmissionProgress(member)
                                            ? `PM giao: ${member.submissionTarget}, Member nộp: ${member.submissionActual} → ${memberTableActualDisplay(member)}`
                                            : undefined
                                        "
                                      >
                                        {{ memberTableActualDisplay(member) }}
                                      </div>
                                      <div class="col-span-2 flex justify-center text-xs font-semibold">
                                        <span
                                          class="inline-flex max-w-full cursor-default items-center gap-1 truncate rounded px-0.5 py-0.5"
                                          :title="diagnosticsReasonTooltip(member.blocker)"
                                        >
                                          <template v-if="member.status === 'danger'">
                                            <span class="inline-flex items-center text-red-600">
                                              <i class="fas fa-times-circle mr-1 shrink-0 text-[11px]" />
                                              {{ memberDiagnosticsStatusLabel(member) }}
                                            </span>
                                          </template>
                                          <template v-else-if="member.status === 'warning'">
                                            <span class="inline-flex items-center text-yellow-700">
                                              <i class="fas fa-exclamation-circle mr-1 shrink-0 text-[11px]" />
                                              {{ memberDiagnosticsStatusLabel(member) }}
                                            </span>
                                          </template>
                                          <template v-else>
                                            <span class="inline-flex items-center text-green-600">
                                              <i class="fas fa-check-circle mr-1 shrink-0 text-[11px]" />
                                              {{ memberDiagnosticsStatusLabel(member) }}
                                            </span>
                                          </template>
                                        </span>
                                      </div>
                                      <div class="col-span-1 text-center text-xs text-slate-200">—</div>
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
            </div>
          </div>
            </template>
            </div>
          </div>
        </template>

        <div v-if="prunedFilteredRows.length === 0" class="p-8 text-center text-xs font-medium text-slate-500">
          <p>Không có KPI nào phù hợp với bộ lọc hiện tại.</p>
          <button
            v-if="appliedFilterCount > 0"
            type="button"
            class="mt-3 text-xs font-bold text-blue-600 hover:underline"
            @click="resetAllDiagnosticFilters"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>
    </div>
  </div>

  <GmMemberKpiDrawer
    :open="showMemberDrawer"
    :member="drawerMember"
    :items="drawerKpiItems"
    :pm-kpi-rollout="drawerPmKpiRollout"
    @close="closeMemberDrawer"
  />
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
</style>
