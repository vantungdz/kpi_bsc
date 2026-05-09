<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'
import { useDepartmentManagerOptions } from '@/composables/useDepartmentManagerOptions'
import {
  apiAddGmDepartmentMembers,
  apiCreateGmDepartment,
  apiDeleteGmDepartment,
  apiDeleteGmMember,
  apiListGmDepartmentMemberCandidates,
  apiListGmDepartments,
  apiRemoveGmDepartmentMember,
  apiUpdateGmDepartment,
} from '@/services/modules/kpi-gm.service'
import type {
  GmDepartmentApiRow,
  GmDepartmentMemberCandidateApiRow,
} from '@/types/gm-department-api'
import type { GmDepartmentMock, GmMemberDetailMock } from '@/types/gm-workspace'
import type { DepartmentManagerOption } from '@/types/department-manager'
import { mapGmDepartmentApiRowToWorkspaceMock } from '@/utils/gm-department-from-api'
import { pushGmNotification } from '@/composables/useGmNotifications'
import GmCopyKpiDrawer from '@/components/gm/GmCopyKpiDrawer.vue'

/** Khớp `#gm-main-modal-anchor` trong `GmLayout.vue` — overlay chỉ phủ cột nội dung, không xám sidebar. */
const GM_MAIN_MODAL_ANCHOR = '#gm-main-modal-anchor'

const { users: departmentManagers, load: loadDepartmentManagers, loading: managersLoading } =
  useDepartmentManagerOptions()

type OrgCardColor = 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'purple'

/** Một section trên trang Organization — map từ mock + bản ghi user (layout theo index.html `renderOrgList`). */
interface GmOrgSectionRow {
  id: string
  name: string
  manager: string
  /** `roles.code` — hiển thị cạnh tên quản lý; null nếu không có / chưa biết. */
  managerRoleCode: string | null
  employeeCount: number
  color: OrgCardColor
}

const ORG_COLOR_SEQUENCE: OrgCardColor[] = ['blue', 'indigo', 'rose', 'amber', 'emerald', 'purple']

function colorForIndex(i: number): OrgCardColor {
  return ORG_COLOR_SEQUENCE[i % ORG_COLOR_SEQUENCE.length]!
}

function orgCardTheme(c: OrgCardColor) {
  const themes: Record<
    OrgCardColor,
    { bar: string; iconBox: string; iconText: string; iconBorder: string; iconFa: string }
  > = {
    blue: {
      bar: 'bg-blue-500',
      iconBox: 'bg-blue-50',
      iconText: 'text-blue-600',
      iconBorder: 'border-blue-100',
      iconFa: 'fa-code',
    },
    indigo: {
      bar: 'bg-indigo-500',
      iconBox: 'bg-indigo-50',
      iconText: 'text-indigo-600',
      iconBorder: 'border-indigo-100',
      iconFa: 'fa-code-branch',
    },
    rose: {
      bar: 'bg-rose-500',
      iconBox: 'bg-rose-50',
      iconText: 'text-rose-600',
      iconBorder: 'border-rose-100',
      iconFa: 'fa-shield-halved',
    },
    amber: {
      bar: 'bg-amber-500',
      iconBox: 'bg-amber-50',
      iconText: 'text-amber-600',
      iconBorder: 'border-amber-100',
      iconFa: 'fa-bullhorn',
    },
    emerald: {
      bar: 'bg-emerald-500',
      iconBox: 'bg-emerald-50',
      iconText: 'text-emerald-600',
      iconBorder: 'border-emerald-100',
      iconFa: 'fa-users',
    },
    purple: {
      bar: 'bg-purple-500',
      iconBox: 'bg-purple-50',
      iconText: 'text-purple-600',
      iconBorder: 'border-purple-100',
      iconFa: 'fa-pen-nib',
    },
  }
  return themes[c]
}

function formatManagerRoleCode(code: string | null | undefined): string {
  const c = (code ?? '').trim().toUpperCase()
  return c
}

/** Phòng ban từ API `GET /kpi/gm/departments`. */
const departmentsLocal = ref<GmDepartmentMock[]>([])

const listLoading = ref(false)
const listError = ref<string | null>(null)

async function loadDepartments() {
  listLoading.value = true
  listError.value = null
  try {
    const rows = await apiListGmDepartments(new Date().getFullYear())
    departmentsLocal.value = rows.map(mapGmDepartmentApiRowToWorkspaceMock)
  } catch (e: unknown) {
    listError.value = e instanceof Error ? e.message : 'Không tải được danh sách phòng ban'
    departmentsLocal.value = []
  } finally {
    listLoading.value = false
  }
}

const memberCountByDept = computed(() => {
  const m = new Map<string, number>()
  for (const d of departmentsLocal.value) {
    m.set(d.id, (d.staffDetails ?? []).length)
  }
  return m
})

function deptBySectionId(sectionId: string): GmDepartmentMock | undefined {
  return departmentsLocal.value.find((d) => d.id === sectionId)
}

function membersForDept(deptId: string): GmMemberDetailMock[] {
  const d = deptBySectionId(deptId)
  return d?.staffDetails ?? []
}

const MEMBER_AVATAR_CLASSES = [
  'bg-indigo-100 text-indigo-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-sky-100 text-sky-600',
] as const

function memberAvatarClass(i: number): string {
  return MEMBER_AVATAR_CLASSES[i % MEMBER_AVATAR_CLASSES.length]!
}

function memberInitial(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return '?'
  return p[p.length - 1]!.slice(0, 1).toUpperCase()
}

function memberSubtitle(m: GmMemberDetailMock): string {
  const rank = m.rank ? `Rank ${m.rank}` : ''
  const lead = m.leader || ''
  if (rank && lead) return `${rank} · ${lead}`
  return rank || lead || '—'
}

/**
 * Avatar nhân sự trên thẻ — khớp `employeeCount`: tối đa 2 mặt từ danh sách nhân sự (API hoặc mock),
 * phần còn lại là +N (N > 0). Không dùng chữ cái tên PM làm “nhân sự”.
 */
function orgSectionMemberStack(sectionId: string, employeeCount: number) {
  if (employeeCount <= 0) {
    return { preview: [] as GmMemberDetailMock[], overflow: 0 }
  }
  const members = membersForDept(sectionId)
  const maxFaces = Math.min(2, employeeCount)
  const preview = members.slice(0, Math.min(maxFaces, members.length))
  const overflow = Math.max(0, employeeCount - preview.length)
  return { preview, overflow }
}

function rowFromDepartment(d: GmDepartmentMock, index: number): GmOrgSectionRow {
  return {
    id: d.id,
    name: d.name,
    manager: d.manager,
    managerRoleCode: d.managerRoleCode?.trim() ? d.managerRoleCode.trim().toUpperCase() : null,
    employeeCount: memberCountByDept.value.get(d.id) ?? 0,
    color: colorForIndex(index),
  }
}

const sections = computed(() => departmentsLocal.value.map((d, i) => rowFromDepartment(d, i)))

const orgSearch = ref('')

const filteredSections = computed(() => {
  let list = sections.value
  const q = orgSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((s) => {
      const hay = `${s.name} ${s.id} ${s.manager} ${s.managerRoleCode ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }
  return list
})

/** Mỗi thẻ dùng một lần tính stack nhân sự (tránh gọi lặp trong template). */
type GmOrgSectionCardVm = {
  row: GmOrgSectionRow
  memberStack: ReturnType<typeof orgSectionMemberStack>
}

const filteredSectionCards = computed((): GmOrgSectionCardVm[] =>
  filteredSections.value.map((row) => ({
    row,
    memberStack: orgSectionMemberStack(row.id, row.employeeCount),
  })),
)

const drawerOpen = ref(false)

/** Drawer chi tiết khối — mở từ nút «Quản lý» trên thẻ (theo index.html `section-detail-drawer`). */
const sectionDetailOpen = ref(false)
/** Section đang mở drawer chi tiết — dùng id để `sections` computed luôn khớp. */
const sectionDetailSectionId = ref<string | null>(null)

const sectionDetailRow = computed((): GmOrgSectionRow | null => {
  const id = sectionDetailSectionId.value
  if (!id) return null
  const idx = departmentsLocal.value.findIndex((d) => d.id === id)
  if (idx < 0) return null
  return rowFromDepartment(departmentsLocal.value[idx]!, idx)
})

const sectionDetailDept = computed(() => {
  const id = sectionDetailSectionId.value
  if (!id) return undefined
  return deptBySectionId(id)
})

const sectionDetailMembers = computed(() => {
  const id = sectionDetailSectionId.value
  if (!id) return []
  return membersForDept(id)
})

/** Drawer chi tiết: ban đầu 4 nhân sự; «Xem tất cả» mở hết danh sách. */
const SECTION_DETAIL_MEMBERS_INITIAL = 4

const sectionDetailMembersVisibleCount = ref(SECTION_DETAIL_MEMBERS_INITIAL)

const sectionDetailMembersPreview = computed(() =>
  sectionDetailMembers.value.slice(0, sectionDetailMembersVisibleCount.value),
)

const sectionDetailMembersHasMore = computed(
  () => sectionDetailMembers.value.length > sectionDetailMembersPreview.value.length,
)

function showAllSectionDetailMembers() {
  sectionDetailMembersVisibleCount.value = sectionDetailMembers.value.length
}

const sectionDetailMembersCanCollapse = computed(
  () => sectionDetailMembersVisibleCount.value > SECTION_DETAIL_MEMBERS_INITIAL,
)

function collapseSectionDetailMembers() {
  sectionDetailMembersVisibleCount.value = SECTION_DETAIL_MEMBERS_INITIAL
}

const sectionName = ref('')
const description = ref('')
const managerId = ref('')

const formErrors = ref<{ name?: string }>({})
const saving = ref(false)

const managerLabel = computed(() => {
  const m = departmentManagers.value.find((o) => o.id === managerId.value)
  return m?.fullName ?? ''
})

function clearErrors() {
  formErrors.value = {}
}

function resetFormFields() {
  sectionName.value = ''
  description.value = ''
  managerId.value = ''
  clearErrors()
}

function showPageToast(message: string, variant: 'success' | 'error' = 'success') {
  pushGmNotification(message, {
    variant,
    durationMs: variant === 'error' ? 8000 : 4500,
  })
}

type GmOrgSectionDrawerHost = { open: () => void }

const orgSectionDrawerHost = inject<GmOrgSectionDrawerHost | null>('gmOrgSectionDrawer', null)

const gmRequestStrategicDiagnosticsReload = inject<(() => void) | undefined>(
  'gmRequestStrategicDiagnosticsReload',
  undefined,
)

/** Sau mutation org — cập nhật danh sách phòng ban và refetch diagnostics ở `GmLayout` (cùng shell). */
async function refreshOrgListAndStrategicDiagnostics() {
  await loadDepartments()
  gmRequestStrategicDiagnosticsReload?.()
}

function openDrawer() {
  drawerOpen.value = true
}

function openSectionDetail(row: GmOrgSectionRow) {
  sectionDetailMembersVisibleCount.value = SECTION_DETAIL_MEMBERS_INITIAL
  sectionDetailSectionId.value = row.id
  sectionDetailOpen.value = true
}

function closeSectionDetail() {
  sectionDetailOpen.value = false
  sectionDetailSectionId.value = null
  sectionDetailMembersVisibleCount.value = SECTION_DETAIL_MEMBERS_INITIAL
}

const editSectionModalOpen = ref(false)
const editSectionName = ref('')
const editSectionManagerId = ref('')
const editFormErrors = ref<{ name?: string; manager?: string }>({})
const savingEdit = ref(false)

const editManagerChoices = computed((): DepartmentManagerOption[] => {
  const base = departmentManagers.value.slice()
  const dept = sectionDetailDept.value
  if (dept?.managerUserId && !base.some((u) => u.id === dept.managerUserId)) {
    base.unshift({
      id: dept.managerUserId,
      username: '',
      email: '',
      fullName: dept.manager || dept.managerUserId,
    })
  }
  return base
})

function openEditSectionFromDetail() {
  const dept = sectionDetailDept.value
  if (!dept) return
  editSectionName.value = dept.name
  editSectionManagerId.value = dept.managerUserId ?? ''
  editFormErrors.value = {}
  editSectionModalOpen.value = true
}

function closeEditSectionModal() {
  editSectionModalOpen.value = false
}

function validateEdit(): boolean {
  editFormErrors.value = {}
  const err: typeof editFormErrors.value = {}
  const name = editSectionName.value.trim()
  if (!name) err.name = 'Vui lòng nhập tên phòng ban.'
  if (!editSectionManagerId.value.trim()) err.manager = 'Vui lòng chọn người quản lý.'
  editFormErrors.value = err
  return Object.keys(err).length === 0
}

async function saveEditSection() {
  const dept = sectionDetailDept.value
  if (!dept) return
  if (!validateEdit()) return
  savingEdit.value = true
  try {
    await apiUpdateGmDepartment(dept.id, {
      name: editSectionName.value.trim(),
      parentId: dept.parentId ?? null,
      managerId: editSectionManagerId.value.trim() || null,
    })
    await refreshOrgListAndStrategicDiagnostics()
    closeEditSectionModal()
    showPageToast(`Đã cập nhật phòng ban «${editSectionName.value.trim()}».`)
  } catch (e: unknown) {
    showPageToast(e instanceof Error ? e.message : 'Không lưu được phòng ban', 'error')
  } finally {
    savingEdit.value = false
  }
}

/** Thứ tự hiển thị rank trong bộ lọc (giống nhóm checkbox diagnostics). */
const ADD_MEMBER_RANK_ORDER = ['A', 'B', 'C', 'D'] as const

const addMemberModalOpen = ref(false)
const addMemberSearch = ref('')
/** Rank đang lọc (rỗng = tất cả) — checkbox đa chọn như Strategic KPIs diagnostics. */
const addMemberFilterRanks = ref<string[]>([])
const addMemberSelectedIds = ref<string[]>([])
const addMemberBulkError = ref('')
const savingMember = ref(false)
/** Danh sách ứng viên từ GET /kpi/gm/departments/:id/member-candidates */
const addMemberCandidates = ref<GmDepartmentMemberCandidateApiRow[]>([])
const addMemberCandidatesLoading = ref(false)

const addMemberRankOptions = computed(() => {
  const present = new Set<string>()
  for (const c of addMemberCandidates.value) {
    const r = c.rankCode?.trim()
    if (r) present.add(r)
  }
  const order = ADD_MEMBER_RANK_ORDER as readonly string[]
  const ordered = order.filter((r) => present.has(r))
  const rest = [...present]
    .filter((r) => !order.includes(r))
    .sort((a, b) => a.localeCompare(b, 'vi'))
  return [...ordered, ...rest]
})

function addMemberRankOrderIdx(r: string): number {
  const i = (ADD_MEMBER_RANK_ORDER as readonly string[]).indexOf(r)
  return i === -1 ? 99 : i
}

const addMemberRankFilterButtonText = computed(() => {
  const sel = addMemberFilterRanks.value
  if (!sel.length) return 'Tất cả rank'
  const sorted = [...sel].sort((a, b) => addMemberRankOrderIdx(a) - addMemberRankOrderIdx(b))
  if (sorted.length <= 4) return `Rank: ${sorted.join(', ')}`
  return `Rank: ${sorted.length} đã chọn`
})

const addMemberRankPopoverOpen = ref(false)
const addMemberRankWrapRef = ref<HTMLElement | null>(null)

function toggleAddMemberRankPopover() {
  addMemberRankPopoverOpen.value = !addMemberRankPopoverOpen.value
}

function closeAddMemberRankPopover() {
  addMemberRankPopoverOpen.value = false
}

function onAddMemberRankDocPointerDown(ev: PointerEvent) {
  if (!addMemberRankPopoverOpen.value) return
  const wrap = addMemberRankWrapRef.value
  const t = ev.target
  if (!wrap || !(t instanceof Node) || wrap.contains(t)) return
  closeAddMemberRankPopover()
}

watch(addMemberRankPopoverOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onAddMemberRankDocPointerDown, true)
  } else {
    document.removeEventListener('pointerdown', onAddMemberRankDocPointerDown, true)
  }
})

const addMemberSelectedCount = computed(() => addMemberSelectedIds.value.length)

const addMemberFilteredCandidates = computed((): GmDepartmentMemberCandidateApiRow[] => {
  if (!sectionDetailSectionId.value) return []
  const q = addMemberSearch.value.trim().toLowerCase()
  let list = addMemberCandidates.value
  if (q) {
    list = list.filter((c) => {
      const hay = `${c.fullName} ${c.email ?? ''} ${c.jobTitleLabel ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }
  if (addMemberFilterRanks.value.length > 0) {
    const rankSet = new Set(addMemberFilterRanks.value)
    list = list.filter((c) => c.rankCode && rankSet.has(c.rankCode))
  }
  return list
})

function isAddMemberSelected(id: string): boolean {
  return addMemberSelectedIds.value.includes(id)
}

function toggleAddMemberCandidate(id: string, checked: boolean) {
  const cur = new Set(addMemberSelectedIds.value)
  if (checked) cur.add(id)
  else cur.delete(id)
  addMemberSelectedIds.value = [...cur]
}

function toggleAddMemberFilterRank(rank: string, checked: boolean) {
  const cur = new Set(addMemberFilterRanks.value)
  if (checked) cur.add(rank)
  else cur.delete(rank)
  addMemberFilterRanks.value = [...cur]
}

function resetAddMemberRankFilters() {
  addMemberFilterRanks.value = []
}

async function openAddMemberFromDetail() {
  const deptId = sectionDetailSectionId.value
  if (!deptId) return
  addMemberSearch.value = ''
  addMemberFilterRanks.value = []
  addMemberSelectedIds.value = []
  addMemberBulkError.value = ''
  addMemberRankPopoverOpen.value = false
  addMemberModalOpen.value = true
  addMemberCandidatesLoading.value = true
  addMemberCandidates.value = []
  try {
    addMemberCandidates.value = await apiListGmDepartmentMemberCandidates(deptId)
  } catch (e: unknown) {
    addMemberBulkError.value =
      e instanceof Error ? e.message : 'Không tải được danh sách ứng viên từ server.'
  } finally {
    addMemberCandidatesLoading.value = false
  }
}

function closeAddMemberModal() {
  addMemberRankPopoverOpen.value = false
  addMemberModalOpen.value = false
}

function candidateSubtitle(c: GmDepartmentMemberCandidateApiRow): string {
  const job = c.jobTitleLabel?.trim() || '—'
  const rc = c.rankCode?.trim() ? `Rank ${c.rankCode}` : 'Rank —'
  return `${job} · ${rc}`
}

async function saveAddMember() {
  const deptId = sectionDetailSectionId.value
  if (!deptId) return
  const ids = [...addMemberSelectedIds.value]
  if (ids.length === 0) {
    addMemberBulkError.value = 'Vui lòng chọn ít nhất một người.'
    return
  }
  addMemberBulkError.value = ''
  savingMember.value = true
  try {
    await apiAddGmDepartmentMembers(deptId, { userIds: ids })
    await refreshOrgListAndStrategicDiagnostics()
    closeAddMemberModal()
    const n = ids.length
    showPageToast(n === 1 ? `Đã thêm thành viên vào phòng ban.` : `Đã thêm ${n} thành viên vào phòng ban.`)
  } catch (e: unknown) {
    addMemberBulkError.value = e instanceof Error ? e.message : 'Không thêm được thành viên.'
  } finally {
    savingMember.value = false
  }
}

const removeMemberModalOpen = ref(false)
const removeMemberTarget = ref<GmMemberDetailMock | null>(null)
const removingMember = ref(false)

function openRemoveMemberModal(m: GmMemberDetailMock) {
  const isManager = departmentsLocal.value.some((d) => d.managerUserId === m.id)
  if (isManager) {
    showPageToast('Không thể gỡ nhân viên đang là Quản lý của một phòng ban.', 'error')
    return
  }
  removeMemberTarget.value = m
  removeMemberModalOpen.value = true
}

function closeRemoveMemberModal() {
  removeMemberModalOpen.value = false
  removeMemberTarget.value = null
  removingMember.value = false
}

async function confirmRemoveMember() {
  const m = removeMemberTarget.value
  const deptId = sectionDetailSectionId.value
  if (!m || !deptId || removingMember.value) return
  removingMember.value = true
  try {
    await apiRemoveGmDepartmentMember(deptId, m.id)
    await refreshOrgListAndStrategicDiagnostics()
    showPageToast(`Đã gỡ «${m.name}» khỏi phòng ban.`)
    closeRemoveMemberModal()
  } catch (e: unknown) {
    showPageToast(e instanceof Error ? e.message : 'Không xóa được thành viên', 'error')
    closeRemoveMemberModal()
  } finally {
    removingMember.value = false
  }
}

const deleteSectionModalOpen = ref(false)
const deleteSectionTarget = ref<GmOrgSectionRow | null>(null)

function openDeleteSectionModal(row: GmOrgSectionRow) {
  deleteSectionTarget.value = row
  deleteSectionModalOpen.value = true
}

function closeDeleteSectionModal() {
  deleteSectionModalOpen.value = false
  deleteSectionTarget.value = null
}

async function confirmDeleteSection() {
  const row = deleteSectionTarget.value
  if (!row) return
  const id = row.id

  if (editSectionModalOpen.value && sectionDetailSectionId.value === id) {
    closeEditSectionModal()
  }
  if (addMemberModalOpen.value && sectionDetailSectionId.value === id) {
    closeAddMemberModal()
  }
  if (sectionDetailSectionId.value === id) {
    closeSectionDetail()
  }

  try {
    await apiDeleteGmDepartment(id)
    await refreshOrgListAndStrategicDiagnostics()
    const label = row.name
    closeDeleteSectionModal()
    showPageToast(`Đã xóa phòng ban «${label}».`)
  } catch (e: unknown) {
    showPageToast(e instanceof Error ? e.message : 'Không xóa được phòng ban', 'error')
    closeDeleteSectionModal()
  }
}

onMounted(() => {
  void loadDepartmentManagers()
  void loadDepartments()
  if (orgSectionDrawerHost) orgSectionDrawerHost.open = openDrawer
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onAddMemberRankDocPointerDown, true)
  if (orgSectionDrawerHost) orgSectionDrawerHost.open = () => {}
})

function closeDrawer() {
  drawerOpen.value = false
  resetFormFields()
}

function validate(): boolean {
  clearErrors()
  const err: typeof formErrors.value = {}
  const name = sectionName.value.trim()
  if (!name) err.name = 'Vui lòng nhập tên phòng ban.'
  formErrors.value = err
  return Object.keys(err).length === 0
}

async function onSubmit() {
  if (!validate()) return
  saving.value = true
  try {
    const name = sectionName.value.trim()
    await apiCreateGmDepartment({
      name,
      parentId: null,
      managerId: managerId.value.trim() || null,
    })
    await refreshOrgListAndStrategicDiagnostics()
    showPageToast(`Đã thêm phòng ban «${name}»${managerLabel.value ? ` — ${managerLabel.value}` : ''}.`)
    closeDrawer()
  } catch (e: unknown) {
    showPageToast(e instanceof Error ? e.message : 'Không tạo được phòng ban', 'error')
  } finally {
    saving.value = false
  }
}

// ── Tab ─────────────────────────────────────────────────────────────────────
type OrgPageTab = 'departments' | 'employees'
const activeTab = ref<OrgPageTab>('departments')

/** Danh sách tất cả nhân viên gầp phẳng từ mọi phòng ban. */
const allMembers = computed((): Array<GmMemberDetailMock & { deptName: string }> => {
  const result: Array<GmMemberDetailMock & { deptName: string }> = []
  for (const d of departmentsLocal.value) {
    for (const m of d.staffDetails ?? []) {
      result.push({ ...m, deptName: d.name })
    }
  }
  return result
})

const employeeSearch = ref('')
const filteredEmployees = computed(() => {
  const q = employeeSearch.value.trim().toLowerCase()
  if (!q) return allMembers.value
  return allMembers.value.filter((m) => {
    const hay = `${m.name} ${m.rank ?? ''} ${m.deptName}`.toLowerCase()
    return hay.includes(q)
  })
})

/** Xóa member từ tab Nhân viên — xóa hoàn toàn khỏi hệ thống (hard delete). */
const deleteEmployeeModalOpen = ref(false)
const deleteEmployeeTarget = ref<(GmMemberDetailMock & { deptName: string }) | null>(null)
const deletingEmployee = ref(false)

function onEmployeeTabRemoveMember(emp: GmMemberDetailMock & { deptName: string }) {
  const isManager = departmentsLocal.value.some((d) => d.managerUserId === emp.id)
  if (isManager) {
    showPageToast('Không thể xóa nhân viên đang là Quản lý của một phòng ban.', 'error')
    return
  }
  deleteEmployeeTarget.value = emp
  deleteEmployeeModalOpen.value = true
}

function closeDeleteEmployeeModal() {
  deleteEmployeeModalOpen.value = false
  deleteEmployeeTarget.value = null
  deletingEmployee.value = false
}

async function confirmDeleteEmployee() {
  const emp = deleteEmployeeTarget.value
  if (!emp || deletingEmployee.value) return
  deletingEmployee.value = true
  try {
    await apiDeleteGmMember(emp.id)
    await loadDepartments()
    gmRequestStrategicDiagnosticsReload?.()
    showPageToast(`Đã xóa nhân viên «${emp.name}» khỏi hệ thống.`)
    closeDeleteEmployeeModal()
  } catch (e: unknown) {
    showPageToast(e instanceof Error ? e.message : 'Không xóa được nhân viên', 'error')
    closeDeleteEmployeeModal()
  }
}

/** Logic Copy KPI */
const copyKpiDrawerOpen = ref(false)
const copyKpiTargetMember = ref<(GmMemberDetailMock & { deptName: string }) | null>(null)

function openCopyKpiDrawer(emp: GmMemberDetailMock & { deptName: string }) {
  copyKpiTargetMember.value = emp
  copyKpiDrawerOpen.value = true
}

</script>

<template>
  <div class="w-full bg-slate-50/50 pb-12">
    <div class="mx-auto w-full max-w-none space-y-6 px-4 py-4 sm:px-6 lg:px-8">

      <!-- Tab bar -->
      <div class="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'departments'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
          @click="activeTab = 'departments'"
        >
          <i class="fas fa-building text-xs" aria-hidden="true" />
          Danh sách Phòng ban
        </button>
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'employees'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
          @click="activeTab = 'employees'"
        >
          <i class="fas fa-users text-xs" aria-hidden="true" />
          Danh sách Nhân viên
          <span v-if="allMembers.length > 0"
            class="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            :class="activeTab === 'employees' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'"
          >{{ allMembers.length }}</span>
        </button>
      </div>

      <div
        v-if="listError"
        class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 shadow-sm"
        role="alert"
      >
        {{ listError }}
      </div>

      <div v-if="listLoading" class="flex justify-center py-8 text-sm font-medium text-slate-500">
        <i class="fas fa-spinner fa-spin mr-2 text-indigo-500" aria-hidden="true" />
        Đang tải danh sách phòng ban…
      </div>

      <!-- Tab: Phòng ban -->
      <template v-if="activeTab === 'departments'">

      <!-- Tìm kiếm — canh phải -->
      <div v-if="sections.length > 0" class="flex justify-end">
        <div class="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
          <i
            class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            aria-hidden="true"
          />
          <input
            v-model="orgSearch"
            type="search"
            placeholder="Tìm kiếm tên phòng ban hoặc quản lý..."
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <!-- Lưới thẻ phòng ban — lg+ 4 cột / card gọn -->
      <div
        v-if="sections.length > 0 && filteredSectionCards.length > 0"
        class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4"
      >
        <article
          v-for="sectionCard in filteredSectionCards"
          :key="sectionCard.row.id"
          class="group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
        >
          <div
            class="absolute left-0 right-0 top-0 h-0.5"
            :class="orgCardTheme(sectionCard.row.color).bar"
            aria-hidden="true"
          />
          <div class="flex items-start justify-between gap-2 border-b border-slate-100/60 px-2.5 py-2">
            <div class="flex min-w-0 flex-1 items-start gap-2">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105"
                :class="[
                  orgCardTheme(sectionCard.row.color).iconBox,
                  orgCardTheme(sectionCard.row.color).iconText,
                  orgCardTheme(sectionCard.row.color).iconBorder,
                ]"
              >
                <i
                  class="fas text-base"
                  :class="orgCardTheme(sectionCard.row.color).iconFa"
                  aria-hidden="true"
                />
              </div>
              <div class="min-w-0 flex-1">
                <h2
                  class="line-clamp-2 break-words text-sm font-bold leading-snug text-slate-800 transition-colors group-hover:text-indigo-600 sm:text-[15px]"
                >
                  {{ sectionCard.row.name }}
                </h2>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              aria-label="Xóa phòng ban"
              title="Xóa phòng ban"
              @click.stop="openDeleteSectionModal(sectionCard.row)"
            >
              <i class="fas fa-trash-can text-sm" aria-hidden="true" />
            </button>
          </div>

          <div class="flex flex-1 flex-col gap-2 px-2.5 py-2">
            <div
              class="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-2 py-2"
            >
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm"
              >
                <i class="fas fa-user text-xs" aria-hidden="true" />
              </div>
              <div class="flex min-w-0 flex-1 items-center gap-1.5">
                <p class="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 sm:text-sm">
                  {{ sectionCard.row.manager }}
                </p>
                <span
                  v-if="sectionCard.row.managerRoleCode"
                  class="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500 sm:text-xs"
                >
                  <i class="fas fa-award text-[10px] text-amber-500 sm:text-xs" aria-hidden="true" />
                  {{ formatManagerRoleCode(sectionCard.row.managerRoleCode) }}
                </span>
              </div>
            </div>

            <div>
              <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                Nhân sự
              </p>
              <p class="flex items-center gap-1.5 text-xs font-bold text-slate-800 sm:text-sm">
                <i class="fas fa-users text-sm text-blue-500" aria-hidden="true" />
                {{ sectionCard.row.employeeCount }}
              </p>
            </div>
          </div>

          <div
            class="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-2.5 py-2"
          >
            <div class="flex min-w-0 flex-1 items-center">
              <template v-if="sectionCard.row.employeeCount <= 0">
                <span class="text-xs font-medium text-slate-400">Chưa có nhân sự</span>
              </template>
              <div v-else class="flex -space-x-1.5">
                <div
                  v-for="(m, mi) in sectionCard.memberStack.preview"
                  :key="m.id"
                  class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold"
                  :class="memberAvatarClass(mi)"
                >
                  {{ memberInitial(m.name) }}
                </div>
                <div
                  v-if="sectionCard.memberStack.overflow > 0"
                  class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-500"
                >
                  +{{ sectionCard.memberStack.overflow }}
                </div>
              </div>
            </div>
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-indigo-600 underline-offset-2 transition-colors hover:text-indigo-800 group-hover:underline sm:text-sm"
              @click.stop="openSectionDetail(sectionCard.row)"
            >
              Quản lý
              <i
                class="fas fa-arrow-right text-[11px] transition-transform group-hover:translate-x-0.5 sm:text-xs"
                aria-hidden="true"
              />
            </button>
          </div>
        </article>
      </div>

      <!-- Không khớp bộ lọc / tìm kiếm -->
      <div
        v-else-if="sections.length > 0"
        class="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
      >
        <i class="fas fa-magnifying-glass mb-3 text-3xl text-slate-300" aria-hidden="true" />
        <p class="text-sm font-bold text-slate-600">Không có phòng ban khớp tìm kiếm</p>
        <p class="mt-1 text-xs text-slate-400">Thử đổi từ khóa tìm kiếm theo tên, role hoặc quản lý.</p>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center sm:py-20"
      >
        <div class="mx-auto flex max-w-md flex-col items-center">
          <i class="fas fa-sitemap mb-4 text-5xl text-slate-300 sm:text-6xl" aria-hidden="true" />
          <h2 class="text-lg font-bold text-slate-600">Chưa có dữ liệu hiển thị</h2>
          <p class="mt-2 text-sm leading-relaxed text-slate-400">
            Bấm &quot;Thêm phòng ban mới&quot; để bắt đầu thiết lập sơ đồ tổ chức.
          </p>
        </div>
      </div>

      </template>
      <!-- /Tab Phòng ban -->

      <!-- Tab: Danh sách Nhân viên -->
      <template v-if="activeTab === 'employees'">
        <!-- Thanh tìm kiếm -->
        <div class="relative">
          <i class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true" />
          <input
            v-model="employeeSearch"
            type="search"
            placeholder="Tìm theo tên, phòng ban, rank..."
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <!-- Bảng nhân viên -->
        <div v-if="filteredEmployees.length > 0" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50">
                <th class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Họ tên</th>
                <th class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Phòng ban</th>
                <th class="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Rank</th>
                <th class="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(emp, idx) in filteredEmployees"
                :key="emp.id"
                class="transition-colors hover:bg-slate-50"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      :class="memberAvatarClass(idx)"
                    >
                      {{ memberInitial(emp.name) }}
                    </div>
                    <span class="font-semibold text-slate-800">{{ emp.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    <i class="fas fa-building text-[10px]" aria-hidden="true" />
                    {{ emp.deptName }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="emp.rank" class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Rank {{ emp.rank }}</span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-2">
                    <!-- Copy KPI -->
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 hover:text-indigo-900"
                      title="Sao chép KPI cho nhân viên này"
                      @click.stop="openCopyKpiDrawer(emp)"
                    >
                      <i class="fas fa-copy text-[10px]" aria-hidden="true" />
                      Copy KPI
                    </button>
                    <!-- Xóa member -->
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-900"
                      title="Xóa nhân viên khỏi phòng ban"
                      @click.stop="onEmployeeTabRemoveMember(emp)"
                    >
                      <i class="fas fa-user-minus text-[10px]" aria-hidden="true" />
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty state nhân viên -->
        <div
          v-else-if="!listLoading"
          class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center"
        >
          <i class="fas fa-users mb-3 text-4xl text-slate-300" aria-hidden="true" />
          <p class="text-sm font-bold text-slate-500">
            {{ employeeSearch ? 'Không tìm thấy nhân viên khớp tìm kiếm' : 'Chưa có nhân viên nào trong hệ thống' }}
          </p>
        </div>
      </template>
      <!-- /Tab Nhân viên -->

    </div>

    <!-- Drawer Create Section — theo index.html + mock ảnh -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <Transition name="gm-section-drawer">
        <div
          v-if="drawerOpen"
          class="absolute inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-create-department-title"
        >
          <div
            class="gm-section-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeDrawer"
          />

          <div
            class="gm-section-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[500px] lg:max-w-[600px]"
          >
            <!-- Drawer header -->
            <div
              class="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-sm"
                  aria-hidden="true"
                >
                  <i class="fas fa-sitemap text-lg" aria-hidden="true"></i>
                </div>
                <div class="min-w-0 pt-0.5">
                  <h2 id="gm-create-department-title" class="text-xl font-bold leading-tight text-slate-800">
                    Create New Department
                  </h2>
                  <p
                    class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500"
                  >
                    Thiết lập phòng ban / đội nhóm mới
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
                @click="closeDrawer"
              >
                <i class="fas fa-times text-lg" aria-hidden="true" />
              </button>
            </div>

            <!-- Drawer body -->
            <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
              <!-- Thông tin cơ bản -->
              <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <i class="fas fa-circle-info text-sm" aria-hidden="true" />
                  </div>
                  <h3 class="text-sm font-bold text-slate-800">Thông tin Cơ bản</h3>
                </div>

                <div>
                  <label
                    for="gm-section-name"
                    class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Tên phòng ban <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="gm-section-name"
                    v-model="sectionName"
                    type="text"
                    placeholder="e.g. Software Development 3"
                    autocomplete="organization"
                    class="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    :class="formErrors.name ? 'border-rose-300 ring-1 ring-rose-200' : ''"
                  />
                  <p v-if="formErrors.name" class="mt-1 text-xs font-semibold text-rose-600">{{ formErrors.name }}</p>
                </div>

                <div>
                  <label
                    for="gm-section-desc"
                    class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Mô tả chức năng
                    <span class="font-medium normal-case text-slate-400">(Optional)</span>
                  </label>
                  <textarea
                    id="gm-section-desc"
                    v-model="description"
                    rows="3"
                    placeholder="Mô tả nhiệm vụ chính của phòng ban này..."
                    class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </section>

              <!-- Quản lý & nhân sự -->
              <section class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <i class="fas fa-user-check text-sm" aria-hidden="true" />
                  </div>
                  <h3 class="text-sm font-bold text-slate-800">Quản lý &amp; Nhân sự</h3>
                </div>

                <div>
                  <label
                    for="gm-section-manager"
                    class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Người quản lý (Manager / PM)
                    <span class="font-medium normal-case text-slate-400">(Optional)</span>
                  </label>
                  <div class="group relative">
                    <i
                      class="fas fa-user pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 group-focus-within:text-indigo-500"
                      aria-hidden="true"
                    />
                    <select
                      id="gm-section-manager"
                      v-model="managerId"
                      class="w-full cursor-pointer appearance-none rounded-lg border border-indigo-200 bg-indigo-50/50 py-2 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      :disabled="managersLoading"
                    >
                      <option value="">{{ managersLoading ? 'Đang tải…' : '— Không gán —' }}</option>
                      <option v-for="m in departmentManagers" :key="m.id" :value="m.id">{{ m.fullName }}</option>
                    </select>
                    <i
                      class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div
                  class="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[11px] font-medium leading-relaxed text-amber-800"
                >
                  <i class="fas fa-circle-exclamation mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                  <p>
                    Người quản lý được chọn sẽ chịu trách nhiệm nhận và phân bổ các
                    <span class="font-bold">Cascading KPI</span>
                    xuống cho các thành viên trong phòng ban này.
                  </p>
                </div>
              </section>
            </div>

            <!-- Drawer footer -->
            <div
              class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
            >
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                :disabled="saving"
                @click="closeDrawer"
              >
                Hủy
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="saving"
                @click="onSubmit"
              >
                <i v-if="!saving" class="fas fa-floppy-disk text-sm" aria-hidden="true" />
                <i v-else class="fas fa-spinner fa-spin text-sm" aria-hidden="true" />
                {{ saving ? 'Đang lưu…' : 'Tạo phòng ban' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Drawer chi tiết Section — theo index.html `#section-detail-drawer` -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <Transition name="gm-section-detail-drawer">
        <div
          v-if="sectionDetailOpen && sectionDetailRow"
          class="absolute inset-0 z-[120]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-section-detail-title"
        >
          <div
            class="gm-section-detail-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeSectionDetail"
          />

          <div
            class="gm-section-detail-drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[500px] lg:max-w-[600px]"
          >
            <div
              class="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2
                id="gm-section-detail-title"
                class="flex items-center gap-2 text-sm font-bold text-slate-800"
              >
                <i class="fas fa-network-wired text-indigo-500" aria-hidden="true" />
                Quản lý phòng ban
              </h2>
              <button
                type="button"
                class="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Đóng"
                @click="closeSectionDetail"
              >
                <i class="fas fa-times text-sm" aria-hidden="true" />
              </button>
            </div>

            <!-- Banner hồ sơ khối -->
            <div
              class="relative flex shrink-0 items-start gap-4 overflow-hidden bg-[#1e293b] p-6 shadow-md"
            >
              <div
                class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl"
                aria-hidden="true"
              />
              <div
                class="relative z-10 mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/20 text-indigo-300 shadow-inner"
              >
                <i class="fas text-xl" :class="orgCardTheme(sectionDetailRow.color).iconFa" aria-hidden="true" />
              </div>
              <div class="relative z-10 min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3 class="text-xl font-bold leading-tight text-white">
                      {{ sectionDetailRow.name }}
                    </h3>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-white/20"
                    @click="openEditSectionFromDetail"
                  >
                    <i class="fas fa-pen mr-1 text-[9px]" aria-hidden="true" />
                    Edit
                  </button>
                </div>
                <div class="mt-3 border-t border-slate-600/50 pt-3">
                  <p class="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-300">
                    <i class="fas fa-user text-[11px] text-slate-400" aria-hidden="true" />
                    {{
                      sectionDetailDept?.managerRoleCode
                        ? formatManagerRoleCode(sectionDetailDept.managerRoleCode)
                        : 'Quản lý'
                    }}:
                    <span class="font-bold text-white">{{ sectionDetailRow.manager }}</span>
                  </p>
                </div>
              </div>
            </div>

            <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-5">
              <!-- Nhân sự -->
              <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div
                  class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4"
                >
                  <h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                    <i class="fas fa-users text-indigo-500" aria-hidden="true" />
                    Nhân sự ( {{ sectionDetailMembers.length }} )
                  </h3>
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                    @click="openAddMemberFromDetail"
                  >
                    <i class="fas fa-user-plus text-[9px]" aria-hidden="true" />
                    Thêm thành viên
                  </button>
                </div>
                <div class="space-y-1 p-2">
                  <template v-if="sectionDetailMembers.length">
                    <div
                      v-for="(m, mi) in sectionDetailMembersPreview"
                      :key="m.id"
                      class="group flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50"
                    >
                      <div class="flex min-w-0 items-center gap-3">
                        <div
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          :class="memberAvatarClass(mi)"
                        >
                          {{ memberInitial(m.name) }}
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-bold text-slate-700">{{ m.name }}</p>
                          <p class="text-[10px] text-slate-500">{{ memberSubtitle(m) }}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="p-1 text-slate-400 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100"
                        title="Xóa khỏi nhóm"
                        aria-label="Xóa khỏi nhóm"
                        @click.stop="openRemoveMemberModal(m)"
                      >
                        <i class="fas fa-user-minus text-xs" aria-hidden="true" />
                      </button>
                    </div>
                    <div
                      v-if="sectionDetailMembersHasMore || sectionDetailMembersCanCollapse"
                      class="mt-1 flex flex-col gap-1.5 sm:flex-row sm:gap-2"
                    >
                      <button
                        v-if="sectionDetailMembersHasMore"
                        type="button"
                        class="w-full flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-center text-[10px] font-bold text-indigo-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
                        @click="showAllSectionDetailMembers"
                      >
                        Xem tất cả thành viên
                      </button>
                      <button
                        v-if="sectionDetailMembersCanCollapse"
                        type="button"
                        class="w-full flex-1 rounded-lg border border-slate-300 bg-slate-50 py-2.5 text-center text-[10px] font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100"
                        @click="collapseSectionDetailMembers"
                      >
                        Ẩn bớt
                      </button>
                    </div>
                  </template>
                  <p v-else class="px-2 py-6 text-center text-xs text-slate-400">
                    Chưa có nhân sự trong phòng ban này.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Chỉnh sửa section — theo index.html `#edit-section-modal` -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <div
        v-if="editSectionModalOpen"
        class="absolute inset-0 z-[150] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-edit-section-title"
      >
        <div
          class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeEditSectionModal"
        />
        <div
          class="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
            <h3
              id="gm-edit-section-title"
              class="flex items-center gap-2 text-sm font-bold text-slate-800"
            >
              <i class="fas fa-pen text-indigo-600" aria-hidden="true" />
              Chỉnh sửa phòng ban
            </h3>
            <button
              type="button"
              class="text-slate-400 transition-colors hover:text-slate-700"
              aria-label="Đóng"
              @click="closeEditSectionModal"
            >
              <i class="fas fa-times" aria-hidden="true" />
            </button>
          </div>
          <div class="space-y-4 overflow-y-auto bg-white p-5">
            <div>
              <label
                for="gm-edit-section-name"
                class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Tên phòng ban <span class="text-rose-500">*</span>
              </label>
              <input
                id="gm-edit-section-name"
                v-model="editSectionName"
                type="text"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                :class="editFormErrors.name ? 'border-rose-300 ring-1 ring-rose-200' : ''"
              />
              <p v-if="editFormErrors.name" class="mt-1 text-xs font-semibold text-rose-600">
                {{ editFormErrors.name }}
              </p>
            </div>
            <div>
              <label
                for="gm-edit-section-manager"
                class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Người quản lý (PM) <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <select
                  id="gm-edit-section-manager"
                  v-model="editSectionManagerId"
                  class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 py-2 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  :class="editFormErrors.manager ? 'border-rose-300 ring-1 ring-rose-200' : ''"
                  :disabled="managersLoading"
                >
                  <option disabled value="">{{ managersLoading ? 'Đang tải…' : '-- Chọn Quản lý --' }}</option>
                  <option v-for="m in editManagerChoices" :key="m.id" :value="m.id">{{ m.fullName }}</option>
                </select>
                <i
                  class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                  aria-hidden="true"
                />
              </div>
              <p v-if="editFormErrors.manager" class="mt-1 text-xs font-semibold text-rose-600">
                {{ editFormErrors.manager }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              :disabled="savingEdit"
              @click="closeEditSectionModal"
            >
              Hủy
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingEdit"
              @click="saveEditSection"
            >
              <i v-if="!savingEdit" class="fas fa-floppy-disk text-xs" aria-hidden="true" />
              <i v-else class="fas fa-spinner fa-spin text-xs" aria-hidden="true" />
              {{ savingEdit ? 'Đang lưu…' : 'Lưu thay đổi' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Thêm nhân viên — wireframe: tìm kiếm, chip lọc, checkbox đa chọn, Đã chọn -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <div
        v-if="addMemberModalOpen"
        class="absolute inset-0 z-[150] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-add-member-title"
      >
        <div
          class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeAddMemberModal"
        />
        <div
          class="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
            <h3
              id="gm-add-member-title"
              class="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm font-bold text-slate-800"
            >
              <i class="fas fa-user-plus shrink-0 text-violet-600" aria-hidden="true" />
              <span class="shrink-0">Thêm nhân sự vào</span>
              <span class="truncate text-violet-600">{{ sectionDetailRow?.name ?? 'Phòng ban' }}</span>
            </h3>
            <button
              type="button"
              class="ml-2 shrink-0 text-slate-400 transition-colors hover:text-slate-700"
              aria-label="Đóng"
              @click="closeAddMemberModal"
            >
              <i class="fas fa-times" aria-hidden="true" />
            </button>
          </div>

          <div class="shrink-0 space-y-4 border-b border-slate-100 bg-white p-4">
            <div class="relative">
              <i
                class="fas fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                aria-hidden="true"
              />
              <input
                v-model="addMemberSearch"
                type="search"
                placeholder="Tìm kiếm tên, email, chức vụ..."
                class="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <!-- Rank: một nút + popover — tránh cột dài nhiều checkbox khi có nhiều rank -->
            <div ref="addMemberRankWrapRef" class="relative">
              <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Rank</label>
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80"
                aria-haspopup="dialog"
                :aria-expanded="addMemberRankPopoverOpen"
                @click.stop="toggleAddMemberRankPopover"
              >
                <span class="flex min-w-0 flex-1 items-center gap-2">
                  <i class="fas fa-sliders-h shrink-0 text-xs text-slate-500" aria-hidden="true" />
                  <span class="min-w-0 truncate font-semibold text-slate-800">{{
                    addMemberRankFilterButtonText
                  }}</span>
                </span>
                <span class="flex shrink-0 items-center gap-1.5">
                  <span
                    v-if="addMemberFilterRanks.length > 0"
                    class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-blue-700"
                  >
                    {{ addMemberFilterRanks.length }}
                  </span>
                  <i
                    class="fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200"
                    :class="addMemberRankPopoverOpen ? 'rotate-180' : ''"
                    aria-hidden="true"
                  />
                </span>
              </button>

              <Transition name="gm-add-member-rank-pop">
                <div
                  v-if="addMemberRankPopoverOpen"
                  class="absolute left-0 right-0 top-full z-20 mt-1 flex min-h-0 max-h-[min(16rem,calc(100vh-12rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                  role="dialog"
                  aria-label="Chọn rank"
                  @click.stop
                >
                  <div
                    class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Chọn rank
                    </span>
                    <button
                      v-if="addMemberFilterRanks.length > 0"
                      type="button"
                      class="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      @click="resetAddMemberRankFilters"
                    >
                      Đặt lại
                    </button>
                  </div>
                  <div
                    class="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
                    role="group"
                  >
                    <label
                      v-for="r in addMemberRankOptions"
                      :key="r"
                      class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        :checked="addMemberFilterRanks.includes(r)"
                        @change="
                          toggleAddMemberFilterRank(r, ($event.target as HTMLInputElement).checked)
                        "
                      />
                      <span class="min-w-0 leading-snug">Rank {{ r }}</span>
                    </label>
                  </div>
                  <div class="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50/80 px-3 py-2">
                    <button
                      type="button"
                      class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                      @click="closeAddMemberRankPopover"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-white p-2">
            <p v-if="addMemberBulkError" class="mb-2 px-2 text-xs font-semibold text-rose-600">
              {{ addMemberBulkError }}
            </p>
            <p
              v-if="addMemberCandidatesLoading"
              class="px-3 py-8 text-center text-xs font-medium text-slate-500"
            >
              Đang tải danh sách ứng viên…
            </p>
            <template v-else-if="addMemberFilteredCandidates.length">
              <label
                v-for="c in addMemberFilteredCandidates"
                :key="c.userId"
                class="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-slate-200 hover:bg-slate-50 has-[:checked]:border-violet-200 has-[:checked]:bg-violet-50/60"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 shrink-0 rounded accent-violet-600"
                  :checked="isAddMemberSelected(c.userId)"
                  @change="
                    toggleAddMemberCandidate(c.userId, ($event.target as HTMLInputElement).checked)
                  "
                />
                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600"
                >
                  {{ memberInitial(c.fullName) }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-700">{{ c.fullName }}</p>
                  <p class="text-[10px] font-medium text-slate-500">{{ candidateSubtitle(c) }}</p>
                </div>
              </label>
            </template>
            <p v-else class="px-3 py-8 text-center text-xs font-medium text-slate-400">
              Không có nhân sự phù hợp. Thử đổi từ khóa tìm kiếm hoặc bộ lọc rank.
            </p>
          </div>

          <div
            class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4"
          >
            <span class="text-xs font-bold text-slate-500">
              Đã chọn:
              <span class="text-violet-600">{{ addMemberSelectedCount }}</span>
            </span>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                :disabled="savingMember"
                @click="closeAddMemberModal"
              >
                Hủy
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingMember || addMemberCandidatesLoading"
                @click="saveAddMember"
              >
                <i v-if="!savingMember" class="fas fa-check text-xs" aria-hidden="true" />
                <i v-else class="fas fa-spinner fa-spin text-xs" aria-hidden="true" />
                {{ savingMember ? 'Đang xử lý…' : 'Thêm vào khối' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Xác nhận xóa section -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <div
        v-if="deleteSectionModalOpen && deleteSectionTarget"
        class="absolute inset-0 z-[160] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-delete-section-title"
      >
        <div
          class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeDeleteSectionModal"
        />
        <div
          class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div class="border-b border-rose-100 bg-rose-50/80 px-5 py-4">
            <h3
              id="gm-delete-section-title"
              class="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <i class="fas fa-triangle-exclamation text-rose-600" aria-hidden="true" />
              Xóa phòng ban?
            </h3>
            <p class="mt-2 text-xs font-medium leading-relaxed text-slate-600">
              Bạn có chắc muốn xóa phòng ban
              <span class="font-bold text-slate-800">«{{ deleteSectionTarget.name }}»</span>
              không? Toàn bộ nhân sự thuộc phòng ban này cũng sẽ bị gỡ.
            </p>
          </div>
          <div class="flex justify-end gap-2 bg-white px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              @click="closeDeleteSectionModal"
            >
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
              @click="confirmDeleteSection"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Xác nhận gỡ thành viên khỏi phòng ban -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <div
        v-if="removeMemberModalOpen && removeMemberTarget"
        class="absolute inset-0 z-[160] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-remove-member-title"
      >
        <div
          class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeRemoveMemberModal"
        />
        <div
          class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div class="border-b border-rose-100 bg-rose-50/80 px-5 py-4">
            <h3
              id="gm-remove-member-title"
              class="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <i class="fas fa-user-minus text-rose-600" aria-hidden="true" />
              Gỡ thành viên?
            </h3>
            <p class="mt-2 text-xs font-medium leading-relaxed text-slate-600">
              Bạn có chắc muốn gỡ
              <span class="font-bold text-slate-800">«{{ removeMemberTarget.name }}»</span>
              khỏi phòng ban
              <span class="font-bold text-slate-800">«{{ sectionDetailRow?.name ?? '—' }}»</span>?
            </p>
          </div>
          <div class="flex justify-end gap-2 bg-white px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              :disabled="removingMember"
              @click="closeRemoveMemberModal"
            >
              Hủy
            </button>
            <button
              type="button"
              class="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-60"
              :disabled="removingMember"
              @click="confirmRemoveMember"
            >
              <i
                v-if="removingMember"
                class="fas fa-spinner fa-spin mr-1.5 text-[10px]"
                aria-hidden="true"
              />
              {{ removingMember ? 'Đang xử lý…' : 'Xác nhận gỡ' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal xác nhận xóa nhân viên khỏi hệ thống -->
    <Teleport :to="GM_MAIN_MODAL_ANCHOR">
      <div
        v-if="deleteEmployeeModalOpen && deleteEmployeeTarget"
        class="absolute inset-0 z-[160] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-delete-employee-title"
      >
        <div
          class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="closeDeleteEmployeeModal"
        />
        <div class="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div class="border-b border-rose-100 bg-rose-50/80 px-5 py-4">
            <h3
              id="gm-delete-employee-title"
              class="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <i class="fas fa-trash-can text-rose-600" aria-hidden="true" />
              Xóa nhân viên khỏi hệ thống?
            </h3>
            <p class="mt-2 text-xs font-medium leading-relaxed text-slate-600">
              Bạn có chắc muốn xóa hoàn toàn nhân viên
              <span class="font-bold text-slate-800">«{{ deleteEmployeeTarget.name }}»</span>
              (phòng ban: <span class="font-bold text-slate-800">{{ deleteEmployeeTarget.deptName }}</span>)
              khỏi hệ thống? Hành động này <span class="font-bold text-rose-600">không thể hoàn tác</span>.
            </p>
          </div>
          <div class="flex justify-end gap-2 bg-white px-5 py-4">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              :disabled="deletingEmployee"
              @click="closeDeleteEmployeeModal"
            >
              Hủy
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-60"
              :disabled="deletingEmployee"
              @click="confirmDeleteEmployee"
            >
              <i v-if="deletingEmployee" class="fas fa-spinner fa-spin text-[10px]" aria-hidden="true" />
              <i v-else class="fas fa-trash-can text-[10px]" aria-hidden="true" />
              {{ deletingEmployee ? 'Đang xóa…' : 'Xác nhận xóa' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Drawer Copy KPI -->
    <GmCopyKpiDrawer
      v-model:open="copyKpiDrawerOpen"
      :target-member="copyKpiTargetMember"
      :all-members="allMembers"
      @copied="gmRequestStrategicDiagnosticsReload?.()"
    />
  </div>
</template>

<style scoped>
/* Drawer: backdrop + panel — cùng pattern GmCreateStrategicKpiModal */
.gm-section-drawer-enter-active,
.gm-section-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-section-drawer-enter-active .gm-section-drawer-backdrop,
.gm-section-drawer-leave-active .gm-section-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-section-drawer-enter-active .gm-section-drawer-panel,
.gm-section-drawer-leave-active .gm-section-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-section-drawer-enter-from .gm-section-drawer-backdrop,
.gm-section-drawer-leave-to .gm-section-drawer-backdrop {
  opacity: 0;
}
.gm-section-drawer-enter-to .gm-section-drawer-backdrop,
.gm-section-drawer-leave-from .gm-section-drawer-backdrop {
  opacity: 1;
}
.gm-section-drawer-enter-from .gm-section-drawer-panel,
.gm-section-drawer-leave-to .gm-section-drawer-panel {
  transform: translateX(100%);
}
.gm-section-drawer-enter-to .gm-section-drawer-panel,
.gm-section-drawer-leave-from .gm-section-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-section-drawer-enter-active,
  .gm-section-drawer-leave-active,
  .gm-section-drawer-enter-active .gm-section-drawer-backdrop,
  .gm-section-drawer-leave-active .gm-section-drawer-backdrop,
  .gm-section-drawer-enter-active .gm-section-drawer-panel,
  .gm-section-drawer-leave-active .gm-section-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .gm-section-drawer-enter-from .gm-section-drawer-panel,
  .gm-section-drawer-leave-to .gm-section-drawer-panel {
    transform: none;
  }
}

/* Drawer chi tiết section — cùng animation slide phải */
.gm-section-detail-drawer-enter-active,
.gm-section-detail-drawer-leave-active {
  transition-duration: 0.28s;
}
.gm-section-detail-drawer-enter-active .gm-section-detail-drawer-backdrop,
.gm-section-detail-drawer-leave-active .gm-section-detail-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.gm-section-detail-drawer-enter-active .gm-section-detail-drawer-panel,
.gm-section-detail-drawer-leave-active .gm-section-detail-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.gm-section-detail-drawer-enter-from .gm-section-detail-drawer-backdrop,
.gm-section-detail-drawer-leave-to .gm-section-detail-drawer-backdrop {
  opacity: 0;
}
.gm-section-detail-drawer-enter-to .gm-section-detail-drawer-backdrop,
.gm-section-detail-drawer-leave-from .gm-section-detail-drawer-backdrop {
  opacity: 1;
}
.gm-section-detail-drawer-enter-from .gm-section-detail-drawer-panel,
.gm-section-detail-drawer-leave-to .gm-section-detail-drawer-panel {
  transform: translateX(100%);
}
.gm-section-detail-drawer-enter-to .gm-section-detail-drawer-panel,
.gm-section-detail-drawer-leave-from .gm-section-detail-drawer-panel {
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-section-detail-drawer-enter-active,
  .gm-section-detail-drawer-leave-active,
  .gm-section-detail-drawer-enter-active .gm-section-detail-drawer-backdrop,
  .gm-section-detail-drawer-leave-active .gm-section-detail-drawer-backdrop,
  .gm-section-detail-drawer-enter-active .gm-section-detail-drawer-panel,
  .gm-section-detail-drawer-leave-active .gm-section-detail-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .gm-section-detail-drawer-enter-from .gm-section-detail-drawer-panel,
  .gm-section-detail-drawer-leave-to .gm-section-detail-drawer-panel {
    transform: none;
  }
}

/* Popover lọc rank — gọn trong modal */
.gm-add-member-rank-pop-enter-active,
.gm-add-member-rank-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}
.gm-add-member-rank-pop-enter-from,
.gm-add-member-rank-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.gm-add-member-rank-pop-enter-to,
.gm-add-member-rank-pop-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e2e8f0;
  border-radius: 4px;
}
</style>
