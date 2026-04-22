<script setup lang="ts">
import { ref, computed, watch, onUnmounted, provide, reactive } from 'vue'
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
import {
  gmLayoutMockMemberModalKpiItems,
  gmLayoutCycleSnapshots,
  buildGmKpiHierarchyRowsFromDepartmentLayout,
  buildHierarchyKpiFromStrategicCreatePayload,
  buildDeptKpiFromStrategicCreatePayload,
  appendDeptKpisAsHierarchyRows,
  hierarchyInactiveKpiToDeptKpiMock,
  type GmHierarchyKpi,
  type GmInvestigationMember,
  type GmMemberKpiDrawerProfile,
} from '@/mocks/gm-kpi.mock'

const route = useRoute()
const { user, logout } = useAuth()

const navItems = [{ name: 'KPI Overview', icon: 'fas fa-chart-line', to: '/gm/dashboard' }]

const settingsNavItems = [
  { name: 'Create Section', icon: 'fas fa-folder-plus', to: '/gm/settings/create-section' },
  { name: 'KPI Template', icon: 'fas fa-layer-group', to: '/gm/settings/kpi-template' },
]

/** Trang Organization đăng ký `open` — nút header «Thêm Section Mới» (route create-section). */
const gmOrgSectionDrawer = reactive<{ open: () => void }>({ open: () => {} })
provide('gmOrgSectionDrawer', gmOrgSectionDrawer)

/** Trang KPI Template — trang gán `openCreate` để header gọi mở drawer tạo bộ mẫu. */
const gmKpiTemplateLibrary = reactive<{ openCreate: () => void }>({ openCreate: () => {} })
provide('gmKpiTemplateLibrary', gmKpiTemplateLibrary)

/** Tab Đánh giá / Approved KPI / KPI cá nhân — sidebar Overview active khi `?tab=pm`, `?tab=approved`, `?tab=personal`. */
function isNavItemActive(to: string): boolean {
  const [path] = to.split('?')
  return route.path.startsWith(path)
}

const isGmEvaluationRoute = computed(() => route.name === 'gm-employee-evaluation')
const isGmCreateSectionRoute = computed(() => route.name === 'gm-create-section')
const isGmKpiTemplateRoute = computed(() => route.name === 'gm-kpi-template')
const isGmSettingsRoute = computed(() => isGmCreateSectionRoute.value || isGmKpiTemplateRoute.value)
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
  if (route.name === 'gm-create-section') {
    return { category: 'GM Workspace', title: 'Organization Structure' }
  }
  if (route.name === 'gm-kpi-template') {
    return { category: 'GM Workspace', title: 'Template Library' }
  }
  return { category: 'GM Workspace', title: 'KPI Management' }
})

/** Chỉ năm hiện tại và năm kế tiếp (không chọn năm trước). */
function buildGmSelectableCycleYears(): { id: string; label: string }[] {
  const y = new Date().getFullYear()
  return [
    { id: String(y), label: String(y) },
    { id: String(y + 1), label: String(y + 1) },
  ]
}

const gmSelectableCycleOptions = computed(() => buildGmSelectableCycleYears())

/** Mặc định theo năm lịch của máy; nếu không có trong danh sách thì lấy năm hiện tại. */
function defaultGmCycleId(): string {
  const opts = buildGmSelectableCycleYears()
  const id = String(new Date().getFullYear())
  return opts.some((o) => o.id === id) ? id : opts[0]!.id
}

const selectedCycleId = ref(defaultGmCycleId())

function resolveGmLayoutSnapshot(id: string) {
  return gmLayoutCycleSnapshots[id] ?? gmLayoutCycleSnapshots['2026'] ?? gmLayoutCycleSnapshots['2025']!
}

/** Đồng bộ `GmKpiEvaluationPanel` với dropdown Năm ở header (không dùng dropdown năm trong panel). */
const gmEvaluationYear = computed(() => {
  const n = parseInt(String(selectedCycleId.value), 10)
  return Number.isFinite(n) ? n : new Date().getFullYear()
})
provide('gmEvaluationYear', gmEvaluationYear)

const activeSnapshot = computed(() => resolveGmLayoutSnapshot(selectedCycleId.value))

const activeCycleLabel = computed(() => {
  return gmSelectableCycleOptions.value.find((c) => c.id === selectedCycleId.value)?.label ?? ''
})

watch(
  gmSelectableCycleOptions,
  (opts) => {
    const ids = new Set(opts.map((o) => o.id))
    if (!ids.has(selectedCycleId.value)) {
      selectedCycleId.value = opts[0]?.id ?? String(new Date().getFullYear())
    }
  },
  { deep: true, immediate: true },
)

const investigatingKPI = ref<string | null>(null)
const selectedDept = ref<any>(null)

watch(
  () => route.name,
  (name) => {
    if (name === 'gm-employee-evaluation' || name === 'gm-create-section' || name === 'gm-kpi-template') {
      selectedDept.value = null
      investigatingKPI.value = null
    }
  },
)

const showKpiModal = ref(false)
const showCreateStrategicKpiModal = ref(false)
/** Dòng diagnostics đang sửa — truyền vào drawer tạo/sửa KPI. */
const strategicKpiEditTarget = ref<GmHierarchyKpi | null>(null)
const selectedMember = ref<GmMemberKpiDrawerProfile | null>(null)

// Dữ liệu mock theo năm — đổi `selectedCycleId` để đồng bộ UI (API thật: fetch theo năm)
const initialSnap = resolveGmLayoutSnapshot(selectedCycleId.value)
const departments = ref(structuredClone(initialSnap.departments))
const mockMembersDetails = ref(structuredClone(initialSnap.membersDetails))
const mockKPIItems = ref(structuredClone(gmLayoutMockMemberModalKpiItems))

/** KPI inactive chờ GM duyệt (tab Approved KPI) — theo năm; đổi năm reset từ snapshot. */
const inactivePendingKpisByCycle = ref<Record<string, GmHierarchyKpi[]>>({
  [selectedCycleId.value]: structuredClone(initialSnap.inactivePendingKpis ?? []),
})

const inactivePendingRowsForSelectedCycle = computed(
  () => inactivePendingKpisByCycle.value[selectedCycleId.value] ?? [],
)

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

/**
 * Diagnostics: hierarchy dựng lại từ `departments` + members (sửa KPI phản ánh ngay) + KPI thêm theo năm,
 * rồi `appendDeptKpisAsHierarchyRows`.
 */
const diagnosticsHierarchyRows = computed(() => {
  const id = selectedCycleId.value
  const removed = new Set(removedDiagnosticsKpiIdsByCycle.value[id] ?? [])
  const baseLive = buildGmKpiHierarchyRowsFromDepartmentLayout(departments.value, mockMembersDetails.value)
  const base = baseLive.filter((r) => !removed.has(r.id))
  const extra = (extraHierarchyKpisByCycle.value[id] ?? []).filter((r) => !removed.has(r.id))
  const merged = [...extra, ...base]
  return appendDeptKpisAsHierarchyRows(merged, departments.value).filter((r) => !removed.has(r.id))
})

const gmToastMessage = ref<string | null>(null)
let gmToastTimer: ReturnType<typeof setTimeout> | null = null

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
    showGmToast(`Đã cập nhật KPI «${title}».`, 4500)
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
    gmToastMessage.value = `Đã tạo KPI «${title}» — năm ${cycleId}.`
    if (gmToastTimer != null) window.clearTimeout(gmToastTimer)
    gmToastTimer = window.setTimeout(() => {
      gmToastMessage.value = null
      gmToastTimer = null
    }, 4500)
  }
}

function onStrategicKpiSaved(payload: Record<string, unknown> | Record<string, unknown>[]) {
  const items = Array.isArray(payload) ? payload : [payload]
  if (items.length === 0) return
  if (items.length === 1) {
    applyOneStrategicKpiCreate(items[0]!)
    return
  }
  for (const p of items) {
    applyOneStrategicKpiCreate(p, { skipCreateToast: true })
  }
  const years = [...new Set(items.map((p) => String(p.cycleId ?? selectedCycleId.value)))]
  showGmToast(`Đã tạo ${items.length} KPI${years.length ? ` — năm ${years.join(', ')}` : ''}.`, 5000)
}

function showGmToast(msg: string, ms = 4000) {
  gmToastMessage.value = msg
  if (gmToastTimer != null) window.clearTimeout(gmToastTimer)
  gmToastTimer = window.setTimeout(() => {
    gmToastMessage.value = null
    gmToastTimer = null
  }, ms)
}

function onDiagnosticsEditKpi(kpi: GmHierarchyKpi) {
  strategicKpiEditTarget.value = kpi
  showCreateStrategicKpiModal.value = true
}

function openCreateStrategicKpiDrawer() {
  strategicKpiEditTarget.value = null
  showCreateStrategicKpiModal.value = true
}

const deleteKpiModalOpen = ref(false)
const deleteKpiTarget = ref<GmHierarchyKpi | null>(null)

function closeDeleteKpiModal() {
  deleteKpiModalOpen.value = false
  deleteKpiTarget.value = null
}

function onDiagnosticsDeleteKpi(kpi: GmHierarchyKpi) {
  deleteKpiTarget.value = kpi
  deleteKpiModalOpen.value = true
}

function confirmDeleteKpi() {
  const kpi = deleteKpiTarget.value
  if (!kpi) return
  const name = String(kpi.name ?? '').trim() || 'KPI'
  const cid = selectedCycleId.value
  const kid = String(kpi.id ?? '')

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
  showGmToast(`Đã xóa KPI «${name}».`, 4500)
}

watch(showCreateStrategicKpiModal, (v) => {
  if (!v) strategicKpiEditTarget.value = null
})

onUnmounted(() => {
  if (gmToastTimer != null) window.clearTimeout(gmToastTimer)
})

watch(selectedCycleId, (id) => {
  const snap = resolveGmLayoutSnapshot(id)
  departments.value = structuredClone(snap.departments)
  mockMembersDetails.value = structuredClone(snap.membersDetails)
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [id]: structuredClone(snap.inactivePendingKpis ?? []),
  }
  selectedDept.value = null
  investigatingKPI.value = null
  closeDeleteKpiModal()
  removedDiagnosticsKpiIdsByCycle.value = {}
})

function onApproveInactiveKpi(kpi: GmHierarchyKpi) {
  const cid = selectedCycleId.value
  const cur = inactivePendingKpisByCycle.value[cid] ?? []
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [cid]: cur.filter((r) => r.id !== kpi.id),
  }
  const d0 = departments.value[0]
  if (d0) {
    d0.kpis = [...d0.kpis, hierarchyInactiveKpiToDeptKpiMock(kpi)]
  }
  const title = String(kpi.name ?? '').trim() || 'KPI'
  showGmToast(`Đã duyệt và kích hoạt KPI «${title}».`, 4500)
}

function onRejectInactiveKpi(kpi: GmHierarchyKpi) {
  const cid = selectedCycleId.value
  const cur = inactivePendingKpisByCycle.value[cid] ?? []
  inactivePendingKpisByCycle.value = {
    ...inactivePendingKpisByCycle.value,
    [cid]: cur.filter((r) => r.id !== kpi.id),
  }
  const title = String(kpi.name ?? '').trim() || 'KPI'
  showGmToast(`Đã từ chối đề xuất KPI «${title}».`, 4500)
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
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isNavItemActive(item.to)
            ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'"
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isNavItemActive(item.to) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'"
          >
            <i :class="[item.icon, 'text-xs']" />
          </span>
          <span class="flex-1">{{ item.name }}</span>
          <span v-if="isNavItemActive(item.to)" class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        </RouterLink>

        <p class="px-2 pt-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Settings
        </p>
        <RouterLink
          v-for="item in settingsNavItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border"
          :class="isNavItemActive(item.to)
            ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-200'"
        >
          <span
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :class="isNavItemActive(item.to) ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'"
          >
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
          @click="logout"
        >
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
        class="z-10 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2 sm:px-8"
      >
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
              <select
                id="gm-year-select"
                v-model="selectedCycleId"
                class="min-w-[11rem] cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option v-for="c in gmSelectableCycleOptions" :key="c.id" :value="c.id">
                  {{ c.label }}
                </option>
              </select>
              <i
                class="fas fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
              />
            </div>
          </div>
          <button
            v-if="!isGmEvaluationRoute && !isGmSettingsRoute"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            @click="openCreateStrategicKpiDrawer"
          >
            <i class="fas fa-plus text-xs" />
            Create Strategic KPI
          </button>
          <button
            v-else-if="isGmCreateSectionRoute"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            @click="gmOrgSectionDrawer.open()"
          >
            <i class="fas fa-plus text-xs" />
            Thêm Section Mới
          </button>
          <button
            v-else-if="isGmKpiTemplateRoute"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
            @click="gmKpiTemplateLibrary?.openCreate?.()"
          >
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
          <GmProcessTimeline
            :mid-year-issues="activeSnapshot.midYearIssues"
            :setting-issues="activeSnapshot.settingIssues"
            :year-end-issues="activeSnapshot.yearEndIssues"
          />

          <template v-if="isGmDashboardRoute">
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <!-- Tab kiểu gọn, canh trái + gạch dưới (tham khảo Personal KPI) -->
              <div
                class="border-b border-slate-200 bg-white px-4 pt-2 sm:px-5"
                role="tablist"
                aria-label="Khu vực làm việc GM dưới timeline"
              >
                <nav class="flex flex-wrap items-end gap-1 sm:gap-2">
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="dashboardWorkspaceTab === 'diagnostics'"
                    class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                    :class="
                      dashboardWorkspaceTab === 'diagnostics'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    "
                    @click="setDashboardWorkspaceTab('diagnostics')"
                  >
                    <span class="flex max-w-[11rem] items-center gap-2 leading-snug sm:max-w-none sm:whitespace-nowrap">
                      <i class="fas fa-table-list shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                      Strategic KPIs Tracking &amp; Diagnostics
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="dashboardWorkspaceTab === 'pm-eval'"
                    class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                    :class="
                      dashboardWorkspaceTab === 'pm-eval'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    "
                    @click="setDashboardWorkspaceTab('pm-eval')"
                  >
                    <span class="flex items-center gap-2 sm:whitespace-nowrap">
                      <i class="fas fa-user-tie shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                      Đánh giá
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="dashboardWorkspaceTab === 'approved-kpi'"
                    class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                    :class="
                      dashboardWorkspaceTab === 'approved-kpi'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    "
                    @click="setDashboardWorkspaceTab('approved-kpi')"
                  >
                    <span class="flex items-center gap-2 sm:whitespace-nowrap">
                      <i class="fas fa-clipboard-check shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                      Approved KPI
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    :aria-selected="dashboardWorkspaceTab === 'personal'"
                    class="-mb-px shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:px-4 sm:text-sm"
                    :class="
                      dashboardWorkspaceTab === 'personal'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    "
                    @click="setDashboardWorkspaceTab('personal')"
                  >
                    <span class="flex items-center gap-2 sm:whitespace-nowrap">
                      <i class="fas fa-bullseye shrink-0 text-[11px] opacity-70" aria-hidden="true" />
                      KPI cá nhân
                    </span>
                  </button>
                </nav>
              </div>

              <div class="min-h-0">
                <div v-show="dashboardWorkspaceTab === 'diagnostics'" class="p-3 sm:p-4 lg:p-5">
                  <GmKpiDiagnosticsTable
                    :rows="diagnosticsHierarchyRows"
                    @edit-kpi="onDiagnosticsEditKpi"
                    @delete-kpi="onDiagnosticsDeleteKpi"
                  />
                </div>
                <div v-show="dashboardWorkspaceTab === 'pm-eval'" class="p-3 sm:p-4 lg:p-5">
                  <GmPmEvaluationWorkspace />
                </div>
                <div v-show="dashboardWorkspaceTab === 'approved-kpi'" class="p-3 sm:p-4 lg:p-5">
                  <GmApprovedKpiPanel
                    :rows="inactivePendingRowsForSelectedCycle"
                    @approve-kpi="onApproveInactiveKpi"
                    @reject-kpi="onRejectInactiveKpi"
                  />
                </div>
                <div v-show="dashboardWorkspaceTab === 'personal'" class="p-3 sm:p-4 lg:p-5">
                  <GmGmPersonalKpiPanel
                    :year-id="selectedCycleId"
                    :rows="activeSnapshot.personalKpiRows"
                  />
                </div>
              </div>
            </div>
          </template>
          <GmKpiDiagnosticsTable
            v-else
            :rows="diagnosticsHierarchyRows"
            @edit-kpi="onDiagnosticsEditKpi"
            @delete-kpi="onDiagnosticsDeleteKpi"
          />
        </div>

        <!-- VIEW 2: chi tiết department / Investigate -->
        <GmDepartmentInvestigation
          v-else-if="selectedDept"
          :department="selectedDept"
          :investigating-kpi="investigatingKPI"
          :members="mockMembersDetails"
          @back="handleBack"
          @view-kpi="openModal"
        />

        <GmCreateStrategicKpiModal
          v-model="showCreateStrategicKpiModal"
          :cycle-id="selectedCycleId"
          :edit-initial="strategicKpiEditTarget"
          @saved="onStrategicKpiSaved"
        />

        <Teleport to="body">
          <Transition name="gm-toast">
            <div
              v-if="gmToastMessage"
              class="fixed left-1/2 top-6 z-[120] max-w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-xs font-bold text-emerald-900 shadow-lg sm:top-8"
              role="status"
            >
              {{ gmToastMessage }}
            </div>
          </Transition>
        </Teleport>

        <Teleport to="body">
          <Transition name="gm-delete-kpi-modal">
            <div
              v-if="deleteKpiModalOpen && deleteKpiTarget"
              class="gm-delete-kpi-modal-root fixed inset-0 z-[160] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gm-delete-kpi-title"
            >
              <div
                class="gm-delete-kpi-modal-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
                @click="closeDeleteKpiModal"
              />
              <div
                class="gm-delete-kpi-modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
              <div class="border-b border-rose-100 bg-rose-50/80 px-5 py-4">
                <h3
                  id="gm-delete-kpi-title"
                  class="flex items-center gap-2 text-sm font-bold text-slate-900"
                >
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
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                  @click="closeDeleteKpiModal"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
                  @click="confirmDeleteKpi"
                >
                  Xác nhận xóa
                </button>
              </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <GmMemberKpiDrawer
          :open="showKpiModal && !!selectedMember"
          :member="selectedMember"
          :items="mockKPIItems"
          @close="closeModal"
        />

      </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.gm-toast-enter-active,
.gm-toast-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.gm-toast-enter-from,
.gm-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
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
  .gm-delete-kpi-modal-enter-active,
  .gm-delete-kpi-modal-leave-active,
  .gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-backdrop,
  .gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-backdrop,
  .gm-delete-kpi-modal-enter-active .gm-delete-kpi-modal-panel,
  .gm-delete-kpi-modal-leave-active .gm-delete-kpi-modal-panel {
    transition-duration: 0.01ms !important;
  }
}

.overflow-x-auto::-webkit-scrollbar, .overflow-y-auto::-webkit-scrollbar { height: 6px; width: 6px; }
.overflow-x-auto::-webkit-scrollbar-thumb, .overflow-y-auto::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
</style>
