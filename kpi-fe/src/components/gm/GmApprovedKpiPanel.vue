<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import type { GmHierarchyKpi } from '@/types/gm-workspace'
import { kpiCreatorCardBgClass } from '@/utils/kpiCreatorRowBg'

const props = withDefaults(
  defineProps<{
    rows: GmHierarchyKpi[]
    /** Khi parent đang gọi API duyệt / từ chối hàng loạt. */
    actionBusy?: boolean
  }>(),
  { actionBusy: false },
)

const emit = defineEmits<{
  'approve-kpi': [kpi: GmHierarchyKpi]
  'reject-kpi': [payload: { kpi: GmHierarchyKpi; reason: string }]
  'approve-all-kpis': [kpis: GmHierarchyKpi[]]
  'reject-all-kpis': [payload: { kpis: GmHierarchyKpi[]; reason: string }]
}>()

type GmApprovedMemberSummary = {
  memberKey: string
  assigneeUserId: string | null
  displayName: string
  avatar: string
  roleCodes: string[]
  pendingCount: number
  latestDateLabel: string
  kpis: GmHierarchyKpi[]
}

function initialsFromName(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase()
}

function memberKeyForRow(k: GmHierarchyKpi): string {
  const uid = String(k.assigneeUserId ?? '').trim()
  if (uid) return `u:${uid}`
  const n = String(k.assigneeDisplayName ?? '').trim()
  return `n:${n || k.id}`
}

function roleCodesForItems(items: GmHierarchyKpi[]): string[] {
  for (const it of items) {
    const r = it.assigneeRoleCodes
    if (r?.length) return [...r]
  }
  return []
}

function roleTagClass(code: string): string {
  const u = code.toUpperCase().trim()
  if (u === 'GM') return 'bg-rose-50 text-rose-800 ring-rose-200/80'
  if (u === 'PM') return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (u === 'LEADER') return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (u === 'MEMBER') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  return 'bg-slate-100 text-slate-700 ring-slate-200/80'
}

const memberSummaries = computed<GmApprovedMemberSummary[]>(() => {
  const map = new Map<
    string,
    { assigneeUserId: string | null; displayName: string; items: GmHierarchyKpi[] }
  >()
  for (const k of props.rows) {
    const key = memberKeyForRow(k)
    const displayName = String(k.assigneeDisplayName ?? '—').trim() || '—'
    if (!map.has(key)) {
      map.set(key, {
        assigneeUserId: String(k.assigneeUserId ?? '').trim() || null,
        displayName,
        items: [],
      })
    } else {
      const cur = map.get(key)!
      if ((cur.displayName === '—' || !cur.displayName) && displayName !== '—') {
        cur.displayName = displayName
      }
    }
    map.get(key)!.items.push(k)
  }
  const out: GmApprovedMemberSummary[] = []
  for (const [memberKey, v] of map.entries()) {
    let latestIso = ''
    let bestMs = -Infinity
    for (const it of v.items) {
      const t = it.requestedAt
      if (t == null || String(t).trim() === '') continue
      const ms = Date.parse(String(t))
      if (!Number.isFinite(ms)) continue
      if (ms >= bestMs) {
        bestMs = ms
        latestIso = String(t)
      }
    }
    const latestDateLabel = latestIso
      ? new Date(latestIso).toLocaleDateString('vi-VN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—'
    const sortPri = (c: number) => (c === 402 ? 0 : c === 403 ? 1 : 2)
    const sortedKpis = [...v.items].sort((a, b) => {
      const ap = sortPri(Number(a.assignmentStatusCode))
      const bp = sortPri(Number(b.assignmentStatusCode))
      if (ap !== bp) return ap - bp
      const ai = a.isImportant ? 1 : 0
      const bi = b.isImportant ? 1 : 0
      if (ai !== bi) return bi - ai
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'vi')
    })
    out.push({
      memberKey,
      assigneeUserId: v.assigneeUserId,
      displayName: v.displayName,
      avatar: initialsFromName(v.displayName),
      roleCodes: roleCodesForItems(v.items),
      pendingCount: v.items.length,
      latestDateLabel,
      kpis: sortedKpis,
    })
  }
  out.sort(
    (a, b) =>
      b.pendingCount - a.pendingCount || a.displayName.localeCompare(b.displayName, 'vi'),
  )
  return out
})

const selectedMember = ref<GmApprovedMemberSummary | null>(null)

/** Checkbox trên bảng member — duyệt/từ chối hàng loạt không cần mở drawer. */
const selectedMemberKeys = ref<Set<string>>(new Set())

function actionableKpisForMember(m: GmApprovedMemberSummary): GmHierarchyKpi[] {
  const sc = (k: GmHierarchyKpi) => Number(k.assignmentStatusCode)
  return m.kpis.filter((k) => sc(k) === 402 || sc(k) === 403)
}

const selectableMemberSummaries = computed(() =>
  memberSummaries.value.filter((m) => actionableKpisForMember(m).length > 0),
)

const selectedActionableKpis = computed(() => {
  const keys = selectedMemberKeys.value
  const out: GmHierarchyKpi[] = []
  for (const m of memberSummaries.value) {
    if (!keys.has(m.memberKey)) continue
    out.push(...actionableKpisForMember(m))
  }
  return out
})

const selectedMemberCount = computed(() => selectedMemberKeys.value.size)

const isAllMembersSelected = computed(() => {
  const keys = selectableMemberSummaries.value.map((m) => m.memberKey)
  return keys.length > 0 && keys.every((k) => selectedMemberKeys.value.has(k))
})

const isSomeMembersSelected = computed(() => {
  const keys = selectableMemberSummaries.value.map((m) => m.memberKey)
  return keys.some((k) => selectedMemberKeys.value.has(k)) && !isAllMembersSelected.value
})

function syncSelectedMemberKeys() {
  const valid = new Set(memberSummaries.value.map((m) => m.memberKey))
  const next = new Set<string>()
  for (const k of selectedMemberKeys.value) {
    if (valid.has(k)) next.add(k)
  }
  selectedMemberKeys.value = next
}

watch(memberSummaries, syncSelectedMemberKeys)

function toggleMemberSelection(memberKey: string, event?: Event) {
  event?.stopPropagation()
  const next = new Set(selectedMemberKeys.value)
  if (next.has(memberKey)) next.delete(memberKey)
  else next.add(memberKey)
  selectedMemberKeys.value = next
}

function toggleSelectAllMembers(event?: Event) {
  event?.stopPropagation()
  if (isAllMembersSelected.value) {
    selectedMemberKeys.value = new Set()
    return
  }
  selectedMemberKeys.value = new Set(selectableMemberSummaries.value.map((m) => m.memberKey))
}

const rejectAllMode = ref<'drawer' | 'list'>('drawer')

const drawerKpisSorted = computed(() => {
  const kpis = selectedMember.value?.kpis ?? []
  const sortPri = (c: number) => (c === 402 ? 0 : c === 403 ? 1 : 2)
  return [...kpis].sort((a, b) => {
    const ap = sortPri(Number(a.assignmentStatusCode))
    const bp = sortPri(Number(b.assignmentStatusCode))
    if (ap !== bp) return ap - bp
    const ai = a.isImportant ? 1 : 0
    const bi = b.isImportant ? 1 : 0
    if (ai !== bi) return bi - ai
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'vi')
  })
})

/** KPI chờ GM duyệt (402 bỏ qua PM, hoặc 403 sau PM) — nút bulk & quick action. */
const actionableGmKpis = computed(() =>
  drawerKpisSorted.value.filter((k) => {
    const sc = Number(k.assignmentStatusCode)
    return sc === 402 || sc === 403
  }),
)

const rejectAllDialogOpen = ref(false)
const rejectAllReason = ref('')
const rejectAllError = ref('')

const rejectReasonTargetKpi = ref<GmHierarchyKpi | null>(null)
const rejectReasonText = ref('')
const rejectReasonError = ref('')

watch(
  memberSummaries,
  (list) => {
    const sel = selectedMember.value
    if (!sel) return
    const next = list.find((m) => m.memberKey === sel.memberKey)
    if (next) selectedMember.value = next
    else selectedMember.value = null
  },
)

watch(selectedMember, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) {
    rejectAllDialogOpen.value = false
    rejectAllReason.value = ''
    rejectAllError.value = ''
    closeRejectReasonDialog()
    selectedKpiDetail.value = null
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

function openDrawer(m: GmApprovedMemberSummary) {
  selectedMember.value = m
}

function closeDrawer() {
  selectedKpiDetail.value = null
  selectedMember.value = null
  rejectAllDialogOpen.value = false
  rejectAllReason.value = ''
  rejectAllError.value = ''
  closeRejectReasonDialog()
}

/** Modal chi tiết từng KPI (tương tự PM). */
const selectedKpiDetail = ref<GmHierarchyKpi | null>(null)

function openKpiDetail(kpi: GmHierarchyKpi) {
  selectedKpiDetail.value = kpi
}

function closeKpiDetail() {
  selectedKpiDetail.value = null
}

function onKpiDetailModalReject() {
  const k = selectedKpiDetail.value
  if (k) openRejectReasonDialog(k)
}

function onKpiDetailModalApprove() {
  const k = selectedKpiDetail.value
  if (k) onApprove(k)
  closeKpiDetail()
}

function openRejectReasonDialog(kpi: GmHierarchyKpi) {
  rejectAllDialogOpen.value = false
  rejectReasonTargetKpi.value = kpi
  rejectReasonText.value = ''
  rejectReasonError.value = ''
}

function closeRejectReasonDialog() {
  rejectReasonTargetKpi.value = null
  rejectReasonText.value = ''
  rejectReasonError.value = ''
}

function confirmRejectReasonDialog() {
  const k = rejectReasonTargetKpi.value
  if (!k || props.actionBusy) return
  const r = rejectReasonText.value.trim()
  if (!r) {
    rejectReasonError.value = 'Please enter a rejection reason.'
    return
  }
  emit('reject-kpi', { kpi: k, reason: r })
  if (selectedKpiDetail.value?.id === k.id) selectedKpiDetail.value = null
  closeRejectReasonDialog()
}

function onApprove(kpi: GmHierarchyKpi) {
  emit('approve-kpi', kpi)
}

const rejectAllTargets = computed(() =>
  rejectAllMode.value === 'list' ? selectedActionableKpis.value : actionableGmKpis.value,
)

function onApproveAll() {
  if (!actionableGmKpis.value.length || props.actionBusy) return
  emit('approve-all-kpis', [...actionableGmKpis.value])
}

function onApproveSelectedMembers() {
  if (!selectedActionableKpis.value.length || props.actionBusy) return
  emit('approve-all-kpis', [...selectedActionableKpis.value])
  selectedMemberKeys.value = new Set()
}

function openRejectAllDialog() {
  if (!actionableGmKpis.value.length || props.actionBusy) return
  rejectAllMode.value = 'drawer'
  selectedKpiDetail.value = null
  closeRejectReasonDialog()
  rejectAllReason.value = ''
  rejectAllError.value = ''
  rejectAllDialogOpen.value = true
}

function openListRejectDialog() {
  if (!selectedActionableKpis.value.length || props.actionBusy) return
  rejectAllMode.value = 'list'
  selectedKpiDetail.value = null
  closeRejectReasonDialog()
  rejectAllReason.value = ''
  rejectAllError.value = ''
  rejectAllDialogOpen.value = true
}

function closeRejectAllDialog() {
  rejectAllDialogOpen.value = false
  rejectAllReason.value = ''
  rejectAllError.value = ''
}

function confirmRejectAll() {
  const targets = rejectAllTargets.value
  if (!targets.length || props.actionBusy) return
  const r = rejectAllReason.value.trim()
  if (!r) {
    rejectAllError.value = 'Please enter a rejection reason.'
    return
  }
  rejectAllError.value = ''
  emit('reject-all-kpis', { kpis: [...targets], reason: r })
  rejectAllDialogOpen.value = false
  rejectAllReason.value = ''
  if (rejectAllMode.value === 'list') {
    selectedMemberKeys.value = new Set()
  }
}

function gmApprovedActionsEnabled(kpi: GmHierarchyKpi): boolean {
  if (kpi.assignmentStatusCode != null) {
    const sc = Number(kpi.assignmentStatusCode)
    return sc === 402 || sc === 403
  }
  return true
}

/** Ưu tiên mô tả ASM (vd. «Chờ GM duyệt KPI đầu năm») thay cho mã 403 · … */
function asmStatusBadgeDisplay(kpi: GmHierarchyKpi): string {
  const d = approvedKpiAsmDescription(kpi)
  if (d && d !== '—') return d
  const c = kpi.assignmentStatusCode
  if (c === 403) return 'Awaiting GM approval'
  if (c === 402) return 'Awaiting PM approval'
  if (c === 401) return 'Draft'
  if (c == null) return '—'
  return `Status ${c}`
}

function approvedKpiStatusBadgeClass(kpi: GmHierarchyKpi): string {
  const base =
    'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-left text-[10px] font-bold leading-snug sm:px-2.5 sm:text-xs'
  const c = kpi.assignmentStatusCode
  if (c === 407) return `${base} border-violet-200 bg-violet-50 text-violet-700`
  if (c === 403) return `${base} border-orange-200 bg-orange-50 text-orange-900`
  if (c === 402) return `${base} border-amber-200 bg-amber-50 text-amber-900`
  if (c === 401) return `${base} border-slate-200 bg-slate-100 text-slate-600`
  return `${base} border-slate-200 bg-slate-100 text-slate-500`
}

function formatKpiSentLine(kpi: GmHierarchyKpi): string {
  const t = kpi.requestedAt
  if (t == null || !String(t).trim()) return '—'
  try {
    const d = new Date(String(t))
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

function approvedKpiAsmDescription(kpi: GmHierarchyKpi): string {
  const d = String(kpi.assignmentStatusLabel ?? '').trim()
  if (d) return d
  return '—'
}

function bscAspectLabel(kpi: GmHierarchyKpi): string {
  const n = String(kpi.categoryName ?? '').trim()
  if (n) return n
  return '—'
}

function approvedKpiScoringRulesRaw(kpi: GmHierarchyKpi): string {
  return String(kpi.scoringRulesText ?? '').trim()
}

function scoringRuleLines(text: string): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

type ScoringRuleBand = { levelLabel: string; rangeText: string }

function parseScoringRuleBands(text: string): ScoringRuleBand[] {
  const lines = scoringRuleLines(text)
  const bands: ScoringRuleBand[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[:：]\s*(.+)$/)
    if (m) {
      const num = m[1]
      let range = m[2].trim()
      range = range.replace(/\s+/g, ' ')
      bands.push({ levelLabel: `LEVEL ${num}`, rangeText: range })
    }
  }
  bands.sort((a, b) => {
    const na = parseInt(a.levelLabel.replace(/\D/g, ''), 10) || 0
    const nb = parseInt(b.levelLabel.replace(/\D/g, ''), 10) || 0
    return nb - na
  })
  return bands
}

const selectedKpiScoringBands = computed(() => {
  const k = selectedKpiDetail.value
  if (!k) return []
  return parseScoringRuleBands(approvedKpiScoringRulesRaw(k))
})

const selectedKpiScoringLinesFallback = computed(() => {
  const k = selectedKpiDetail.value
  if (!k) return []
  return scoringRuleLines(approvedKpiScoringRulesRaw(k))
})

watch(drawerKpisSorted, (kpis) => {
  const sel = selectedKpiDetail.value
  if (!sel) return
  const exists = kpis.some((k) => k.id === sel.id)
  if (!exists) selectedKpiDetail.value = null
})
</script>

<template>
  <div class="animate-fade-in space-y-4">
    <div
      class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100"
    >
      <div class="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <h3 class="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-800">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm"
            aria-hidden="true"
          >
            <i class="fas fa-clipboard-check text-[17px] leading-none" />
          </span>
          Approved KPI
        </h3>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <template v-if="selectedMemberCount > 0">
            <span class="text-[11px] font-semibold text-slate-500">
              {{ selectedMemberCount }} selected
            </span>
            <button
              type="button"
              :disabled="actionBusy"
              class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              @click.stop="onApproveSelectedMembers"
            >
              <i class="fas fa-check text-[11px]" aria-hidden="true" />
              Approve
            </button>
            <button
              type="button"
              :disabled="actionBusy"
              class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 shadow-sm hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              @click.stop="openListRejectDialog"
            >
              <i class="fas fa-times text-[11px]" aria-hidden="true" />
              Reject
            </button>
          </template>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Search"
            title="Search"
            @click.stop
          >
            <i class="fas fa-search text-sm" />
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Filter"
            title="Filter"
            @click.stop
          >
            <i class="fas fa-filter text-sm" />
          </button>
        </div>
      </div>

      <div
        v-if="!rows.length"
        class="border-t border-slate-100 px-4 py-12 text-center text-sm text-slate-500"
      >
        <p class="font-semibold text-slate-700">No KPIs awaiting approval</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[520px] table-fixed border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-200 bg-white">
              <th class="w-10 py-3.5 pl-5 pr-1">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  :checked="isAllMembersSelected"
                  :indeterminate="isSomeMembersSelected"
                  :disabled="!selectableMemberSummaries.length || actionBusy"
                  aria-label="Select all members"
                  @click.stop="toggleSelectAllMembers"
                />
              </th>
              <th class="py-3.5 pl-2 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                All
              </th>
              <th
                class="w-[9.5rem] px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                KPIs awaiting GM
              </th>
              <th
                class="w-[11rem] px-3 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Last submitted
              </th>
              <th
                class="w-[10rem] py-3.5 pl-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="m in memberSummaries"
              :key="m.memberKey"
              class="cursor-pointer bg-white transition-colors hover:bg-slate-50/90"
              @click="openDrawer(m)"
            >
              <td class="py-4 pl-5 pr-1 align-middle">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  :checked="selectedMemberKeys.has(m.memberKey)"
                  :disabled="!actionableKpisForMember(m).length || actionBusy"
                  :aria-label="`Select ${m.displayName}`"
                  @click.stop="toggleMemberSelection(m.memberKey, $event)"
                />
              </td>
              <td class="py-4 pl-2 pr-3 align-middle">
                <div class="flex min-w-0 items-center gap-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[13px] font-bold uppercase tracking-tight text-sky-800 shadow-sm"
                  >
                    {{ m.avatar }}
                  </div>
                  <div class="min-w-0 flex-1 overflow-hidden">
                    <div class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
                      <span class="min-w-0 truncate text-sm font-semibold text-slate-900">
                        {{ m.displayName }}
                      </span>
                      <div v-if="m.roleCodes.length" class="flex shrink-0 flex-wrap items-center gap-1">
                        <span
                          v-for="(rc, ri) in m.roleCodes"
                          :key="ri"
                          class="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase leading-none tracking-wide ring-1"
                          :class="roleTagClass(rc)"
                          :title="rc"
                        >
                          {{ rc }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-4 text-center align-middle">
                <span
                  class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-orange-50 px-2.5 text-xs font-bold tabular-nums text-orange-800 ring-1 ring-orange-100"
                >
                  {{ m.pendingCount }}
                </span>
              </td>
              <td class="px-3 py-4 align-middle text-sm tabular-nums text-slate-600">
                {{ m.latestDateLabel }}
              </td>
              <td class="py-4 pl-3 pr-5 text-right align-middle">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-800"
                  @click.stop="openDrawer(m)"
                >
                  View &amp; approve
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="gm-drawer">
        <div v-if="selectedMember" class="fixed inset-0 z-[140] flex justify-end">
          <div
            class="gm-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
            @click="closeDrawer"
          />

          <div
            class="gm-drawer-panel relative flex h-full w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:w-[520px] lg:w-[640px]"
            @click.stop
          >
            <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <span class="rounded-lg bg-orange-100 p-1.5 text-orange-600 shadow-sm">
                    <i class="fas fa-inbox text-sm" />
                  </span>
                  KPIs pending approval
                </h2>
              </div>
              <button
                type="button"
                class="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
                @click="closeDrawer"
              >
                <i class="fas fa-times text-base" />
              </button>
            </div>

            <div class="flex-1 space-y-3 overflow-y-auto p-4">
              <div class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-bold text-slate-600"
                >
                  {{ selectedMember.avatar }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                    <p class="truncate text-base font-bold text-slate-800">
                      {{ selectedMember.displayName }}
                    </p>
                    <span
                      v-for="(rc, ri) in selectedMember.roleCodes"
                      :key="ri"
                      class="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase leading-none tracking-wide ring-1"
                      :class="roleTagClass(rc)"
                    >
                      {{ rc }}
                    </span>
                  </div>
                  <p class="mt-0.5 text-xs font-semibold uppercase text-slate-500">
                    {{ actionableGmKpis.length }} KPI(s) awaiting GM · {{ selectedMember.pendingCount }} KPI(s) in
                    queue
                  </p>
                </div>
              </div>

              <div v-if="actionableGmKpis.length > 0" class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  @click="onApproveAll"
                >
                  <i class="fas fa-list-check mr-1.5 text-xs" />
                  Approve all
                </button>
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  @click="openRejectAllDialog"
                >
                  <i class="fas fa-circle-xmark mr-1.5 text-xs" />
                  Reject all
                </button>
              </div>

              <div
                v-if="!drawerKpisSorted.length"
                class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
              >
                No more KPIs in the queue for this member.
              </div>

              <div
                v-for="kpi in drawerKpisSorted"
                :key="kpi.id"
                class="rounded-xl border border-slate-200 p-4 text-left shadow-sm"
                :class="kpiCreatorCardBgClass(kpi.creatorRoleCode)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <span
                      :title="asmStatusBadgeDisplay(kpi)"
                      class="inline-flex max-w-full rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-left text-[9px] font-semibold leading-snug text-orange-900"
                    >
                      <span class="line-clamp-2">{{ asmStatusBadgeDisplay(kpi) }}</span>
                    </span>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <i
                        v-if="kpi.isImportant"
                        class="fas fa-star shrink-0 text-[11px] text-amber-500"
                        title="Important KPI"
                        aria-label="Important KPI"
                      />
                      <h4 class="truncate text-sm font-bold text-slate-800">{{ kpi.name }}</h4>
                      <GmStrategicKpiTypeTag :type="kpi.kpiType" size="sm" />
                    </div>
                    <p class="mt-1 text-[10px] font-medium text-slate-400">
                      Sent: {{ formatKpiSentLine(kpi) }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span
                        ><span class="font-bold text-slate-400">Weight:</span>
                        <span class="font-semibold text-slate-700">{{ kpi.weight }}</span></span
                      >
                      <span
                        ><span class="font-bold text-slate-400">Target:</span>
                        <span class="font-semibold tabular-nums text-slate-700">{{ kpi.target }}</span></span
                      >
                    </div>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                    aria-label="KPI details"
                    @click="openKpiDetail(kpi)"
                  >
                    <i class="fas fa-chevron-right text-[10px]" />
                  </button>
                </div>

                <!-- Per-KPI approve/reject actions are intentionally hidden for now.
                <div v-if="gmApprovedActionsEnabled(kpi)" class="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    :disabled="actionBusy"
                    class="rounded-md px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    @click="openRejectReasonDialog(kpi)"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    @click="onApprove(kpi)"
                  >
                    Approve
                  </button>
                </div>
                -->
              </div>
            </div>

            <div class="z-10 shrink-0 border-t border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                @click="closeDrawer"
              >
                Close
              </button>
            </div>

            <Transition name="gm-fade">
              <div
                v-if="selectedKpiDetail && selectedMember"
                class="absolute inset-0 z-[155] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]"
                @click.self="closeKpiDetail"
              >
                <div
                  class="flex max-h-[min(90vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                  @click.stop
                >
                  <div class="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-3">
                    <div class="min-w-0 pr-2">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Pending KPI details
                      </p>
                      <h2 class="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-bold leading-snug text-slate-900">
                        <span class="min-w-0 truncate">{{ selectedKpiDetail.name }}</span>
                        <GmStrategicKpiTypeTag
                          :type="selectedKpiDetail.kpiType"
                          size="sm"
                        />
                      </h2>
                      <div class="mt-2 flex flex-wrap items-center gap-1.5">
                        <span :class="approvedKpiStatusBadgeClass(selectedKpiDetail)">
                          {{ asmStatusBadgeDisplay(selectedKpiDetail) }}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close KPI details"
                      @click="closeKpiDetail"
                    >
                      <i class="fas fa-times text-sm leading-none" />
                    </button>
                  </div>

                  <div class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                    <div class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-user w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Member</span>
                        <span class="max-w-[55%] text-right text-sm font-bold leading-snug text-slate-900">{{
                          selectedMember.displayName
                        }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-bullseye w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Target</span>
                        <span class="max-w-[55%] text-right text-sm font-bold tabular-nums text-slate-900">{{
                          selectedKpiDetail.target
                        }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-percent w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Weight</span>
                        <span class="text-right text-sm font-bold text-blue-600">{{ selectedKpiDetail.weight }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-book w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">BSC perspective</span>
                        <span class="max-w-[58%] text-right text-xs font-bold leading-snug text-slate-900">{{
                          bscAspectLabel(selectedKpiDetail)
                        }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-calendar-day w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Submitted on</span>
                        <span class="text-right text-sm font-bold text-slate-900">{{
                          formatKpiSentLine(selectedKpiDetail)
                        }}</span>
                      </div>
                    </div>

                    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <i class="fas fa-list-check text-[13px] text-slate-600" />
                        <span class="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          Scoring rules
                        </span>
                      </div>
                      <div class="px-3 py-3">
                        <div
                          v-if="selectedKpiScoringBands.length"
                          class="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <div
                            v-for="(band, idx) in selectedKpiScoringBands"
                            :key="idx"
                            class="min-w-[4.25rem] flex-1 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-center sm:min-w-0"
                          >
                            <div class="text-[10px] font-bold uppercase leading-tight text-slate-500">
                              {{ band.levelLabel }}
                            </div>
                            <div class="mt-1 text-[11px] font-bold leading-tight text-slate-900">
                              {{ band.rangeText }}
                            </div>
                          </div>
                        </div>
                        <p
                          v-else-if="selectedKpiScoringLinesFallback.length"
                          class="whitespace-pre-line font-mono text-[11px] leading-relaxed text-slate-600"
                        >
                          {{ approvedKpiScoringRulesRaw(selectedKpiDetail) }}
                        </p>
                        <p v-else class="text-center text-xs text-slate-400">—</p>
                      </div>
                    </div>
                  </div>

                  <div
                    class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5"
                  >
                    <button
                      type="button"
                      class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      @click="closeKpiDetail"
                    >
                      Close
                    </button>
                    <!-- Per-KPI detail modal approve/reject actions are intentionally hidden for now.
                    <template v-if="gmApprovedActionsEnabled(selectedKpiDetail)">
                      <button
                        type="button"
                        :disabled="actionBusy"
                        class="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        @click="onKpiDetailModalReject"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        :disabled="actionBusy"
                        class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        @click="onKpiDetailModalApprove"
                      >
                        Approve
                      </button>
                    </template>
                    -->
                  </div>
                </div>
              </div>
            </Transition>

            <Transition name="gm-fade">
              <div
                v-if="rejectReasonTargetKpi"
                class="absolute inset-0 z-[160] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
                @click.self="closeRejectReasonDialog"
              >
                <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div class="mb-3 flex items-center gap-3">
                    <div class="rounded-full bg-rose-100 p-2 text-rose-600">
                      <i class="fas fa-circle-exclamation text-lg" />
                    </div>
                    <h3 class="text-lg font-bold text-slate-900">Confirm rejection</h3>
                  </div>
                  <p class="mb-3 text-sm text-slate-600">Please enter a reason for rejecting this KPI.</p>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">
                    Rejection reason <span class="text-rose-500">*</span>
                  </label>
                  <textarea
                    v-model="rejectReasonText"
                    class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                    :class="
                      rejectReasonError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'
                    "
                    placeholder="Enter a detailed reason..."
                  />
                  <p v-if="rejectReasonError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectReasonError }}</p>
                  <div class="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      @click="closeRejectReasonDialog"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      :disabled="actionBusy"
                      class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      @click="confirmRejectReasonDialog"
                    >
                      Confirm rejection
                    </button>
                  </div>
                </div>
              </div>
            </Transition>

            <Transition name="gm-fade">
              <div
                v-if="rejectAllDialogOpen"
                class="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
                @click.self="closeRejectAllDialog"
              >
                <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div class="mb-3 flex items-center gap-3">
                    <div class="rounded-full bg-rose-100 p-2 text-rose-600">
                      <i class="fas fa-circle-exclamation text-lg" />
                    </div>
                    <h3 class="text-lg font-bold text-slate-900">Reject all</h3>
                  </div>
                  <p class="mb-3 text-sm text-slate-600">
                    You are about to reject
                    <strong>{{ rejectAllTargets.length }}</strong>
                    KPI(s) awaiting GM approval
                    <template v-if="rejectAllMode === 'list'">
                      for {{ selectedMemberCount }} selected member(s).
                    </template>
                    <template v-else> for this member.</template>
                    Enter a reason that applies to all of them.
                  </p>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">
                    Rejection reason <span class="text-rose-500">*</span>
                  </label>
                  <textarea
                    v-model="rejectAllReason"
                    class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                    :class="
                      rejectAllError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'
                    "
                    placeholder="Enter a detailed reason..."
                  />
                  <p v-if="rejectAllError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectAllError }}</p>
                  <div class="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      @click="closeRejectAllDialog"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      :disabled="actionBusy"
                      class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      @click="confirmRejectAll"
                    >
                      Confirm rejection
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.gm-drawer-enter-active,
.gm-drawer-leave-active {
  transition-duration: 0.36s;
}
.gm-drawer-enter-active .gm-drawer-backdrop,
.gm-drawer-leave-active .gm-drawer-backdrop {
  transition: opacity 0.36s ease;
}
.gm-drawer-enter-active .gm-drawer-panel,
.gm-drawer-leave-active .gm-drawer-panel {
  transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
.gm-drawer-enter-from .gm-drawer-backdrop,
.gm-drawer-leave-to .gm-drawer-backdrop {
  opacity: 0;
}
.gm-drawer-enter-to .gm-drawer-backdrop,
.gm-drawer-leave-from .gm-drawer-backdrop {
  opacity: 1;
}
.gm-drawer-enter-from .gm-drawer-panel,
.gm-drawer-leave-to .gm-drawer-panel {
  transform: translate3d(100%, 0, 0);
}
.gm-drawer-enter-to .gm-drawer-panel,
.gm-drawer-leave-from .gm-drawer-panel {
  transform: translate3d(0, 0, 0);
}

.gm-fade-enter-active,
.gm-fade-leave-active {
  transition: opacity 0.2s ease;
}
.gm-fade-enter-from,
.gm-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .gm-drawer-enter-active,
  .gm-drawer-leave-active,
  .gm-drawer-enter-active .gm-drawer-backdrop,
  .gm-drawer-leave-active .gm-drawer-backdrop,
  .gm-drawer-enter-active .gm-drawer-panel,
  .gm-drawer-leave-active .gm-drawer-panel {
    transition-duration: 0.01ms !important;
  }
  .gm-drawer-enter-from .gm-drawer-panel,
  .gm-drawer-leave-to .gm-drawer-panel {
    transform: none;
  }
}
</style>
