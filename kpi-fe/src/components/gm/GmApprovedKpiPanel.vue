<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { GmHierarchyKpi } from '@/types/gm-workspace'

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
    const sortedKpis = [...v.items].sort((a, b) => {
      const ap = Number(a.assignmentStatusCode) === 403 ? 0 : 1
      const bp = Number(b.assignmentStatusCode) === 403 ? 0 : 1
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

const drawerKpisSorted = computed(() => {
  const kpis = selectedMember.value?.kpis ?? []
  return [...kpis].sort((a, b) => {
    const ap = Number(a.assignmentStatusCode) === 403 ? 0 : 1
    const bp = Number(b.assignmentStatusCode) === 403 ? 0 : 1
    if (ap !== bp) return ap - bp
    const ai = a.isImportant ? 1 : 0
    const bi = b.isImportant ? 1 : 0
    if (ai !== bi) return bi - ai
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'vi')
  })
})

/** Chỉ KPI đang chờ quyết định GM (403) — nút bulk & quick action. */
const actionableGmKpis = computed(() =>
  drawerKpisSorted.value.filter((k) => Number(k.assignmentStatusCode) === 403),
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
    rejectReasonError.value = 'Vui lòng nhập lý do từ chối.'
    return
  }
  emit('reject-kpi', { kpi: k, reason: r })
  if (selectedKpiDetail.value?.id === k.id) selectedKpiDetail.value = null
  closeRejectReasonDialog()
}

function onApprove(kpi: GmHierarchyKpi) {
  emit('approve-kpi', kpi)
}

function onApproveAll() {
  if (!actionableGmKpis.value.length || props.actionBusy) return
  emit('approve-all-kpis', [...actionableGmKpis.value])
}

function openRejectAllDialog() {
  if (!actionableGmKpis.value.length || props.actionBusy) return
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
  if (!actionableGmKpis.value.length || props.actionBusy) return
  const r = rejectAllReason.value.trim()
  if (!r) {
    rejectAllError.value = 'Vui lòng nhập lý do từ chối.'
    return
  }
  rejectAllError.value = ''
  emit('reject-all-kpis', { kpis: [...actionableGmKpis.value], reason: r })
  rejectAllDialogOpen.value = false
  rejectAllReason.value = ''
}

function gmApprovedActionsEnabled(kpi: GmHierarchyKpi): boolean {
  if (kpi.assignmentStatusCode != null) return kpi.assignmentStatusCode === 403
  return true
}

/** Ưu tiên mô tả ASM (vd. «Chờ GM duyệt KPI đầu năm») thay cho mã 403 · … */
function asmStatusBadgeDisplay(kpi: GmHierarchyKpi): string {
  const d = approvedKpiAsmDescription(kpi)
  if (d && d !== '—') return d
  const c = kpi.assignmentStatusCode
  if (c === 403) return 'Chờ GM duyệt'
  if (c === 402) return 'Chờ PM duyệt'
  if (c === 401) return 'Soạn thảo / nháp'
  if (c == null) return '—'
  return `Trạng thái ${c}`
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
      bands.push({ levelLabel: `MỨC ${num}`, rangeText: range })
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
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Tìm kiếm"
            title="Tìm kiếm"
            @click.stop
          >
            <i class="fas fa-search text-sm" />
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Lọc"
            title="Lọc"
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
        <p class="font-semibold text-slate-700">Không có KPI chờ duyệt</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[520px] table-fixed border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-200 bg-white">
              <th class="py-3.5 pl-5 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Thành viên
              </th>
              <th
                class="w-[9.5rem] px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Số KPI chờ GM
              </th>
              <th
                class="w-[11rem] px-3 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Gửi gần nhất
              </th>
              <th
                class="w-[10rem] py-3.5 pl-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Thao tác
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
              <td class="py-4 pl-5 pr-3 align-middle">
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
                  Xem &amp; duyệt
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
                  KPI chờ duyệt
                </h2>
              </div>
              <button
                type="button"
                class="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Đóng"
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
                    {{ actionableGmKpis.length }} KPI chờ GM · {{ selectedMember.pendingCount }} KPI trong hàng
                    đợi
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
                  Duyệt tất cả
                </button>
                <button
                  type="button"
                  :disabled="actionBusy"
                  class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  @click="openRejectAllDialog"
                >
                  <i class="fas fa-circle-xmark mr-1.5 text-xs" />
                  Từ chối tất cả
                </button>
              </div>

              <div
                v-if="!drawerKpisSorted.length"
                class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
              >
                Không còn KPI trong hàng đợi cho thành viên này.
              </div>

              <div
                v-for="kpi in drawerKpisSorted"
                :key="kpi.id"
                class="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
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
                        title="KPI quan trọng"
                        aria-label="KPI quan trọng"
                      />
                      <h4 class="truncate text-sm font-bold text-slate-800">{{ kpi.name }}</h4>
                    </div>
                    <p class="mt-1 text-[10px] font-medium text-slate-400">
                      Gửi: {{ formatKpiSentLine(kpi) }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span
                        ><span class="font-bold text-slate-400">Trọng số:</span>
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
                    aria-label="Chi tiết KPI"
                    @click="openKpiDetail(kpi)"
                  >
                    <i class="fas fa-chevron-right text-[10px]" />
                  </button>
                </div>

                <div v-if="gmApprovedActionsEnabled(kpi)" class="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    :disabled="actionBusy"
                    class="rounded-md px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    @click="openRejectReasonDialog(kpi)"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    :disabled="actionBusy"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    @click="onApprove(kpi)"
                  >
                    Duyệt
                  </button>
                </div>
              </div>
            </div>

            <div class="z-10 shrink-0 border-t border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                @click="closeDrawer"
              >
                Đóng
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
                        Chi tiết KPI chờ duyệt
                      </p>
                      <h2 class="mt-0.5 text-lg font-bold leading-snug text-slate-900">
                        {{ selectedKpiDetail.name }}
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
                      aria-label="Đóng chi tiết KPI"
                      @click="closeKpiDetail"
                    >
                      <i class="fas fa-times text-sm leading-none" />
                    </button>
                  </div>

                  <div class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                    <div class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-user w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Thành viên</span>
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
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Trọng số</span>
                        <span class="text-right text-sm font-bold text-blue-600">{{ selectedKpiDetail.weight }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-book w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Khía cạnh BSC</span>
                        <span class="max-w-[58%] text-right text-xs font-bold leading-snug text-slate-900">{{
                          bscAspectLabel(selectedKpiDetail)
                        }}</span>
                      </div>
                      <div class="flex items-center gap-3 px-3 py-2.5">
                        <i class="fas fa-calendar-day w-4 shrink-0 text-center text-[13px] text-slate-400" />
                        <span class="min-w-0 flex-1 text-xs font-medium text-slate-500">Ngày gửi</span>
                        <span class="text-right text-sm font-bold text-slate-900">{{
                          formatKpiSentLine(selectedKpiDetail)
                        }}</span>
                      </div>
                    </div>

                    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div class="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <i class="fas fa-list-check text-[13px] text-slate-600" />
                        <span class="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          Quy tắc chấm điểm
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
                      Đóng
                    </button>
                    <template v-if="gmApprovedActionsEnabled(selectedKpiDetail)">
                      <button
                        type="button"
                        :disabled="actionBusy"
                        class="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        @click="onKpiDetailModalReject"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        :disabled="actionBusy"
                        class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        @click="onKpiDetailModalApprove"
                      >
                        Duyệt
                      </button>
                    </template>
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
                    <h3 class="text-lg font-bold text-slate-900">Xác nhận từ chối</h3>
                  </div>
                  <p class="mb-3 text-sm text-slate-600">Vui lòng nhập lý do từ chối KPI này.</p>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">
                    Lý do từ chối <span class="text-rose-500">*</span>
                  </label>
                  <textarea
                    v-model="rejectReasonText"
                    class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                    :class="
                      rejectReasonError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'
                    "
                    placeholder="Nhập lý do chi tiết..."
                  />
                  <p v-if="rejectReasonError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectReasonError }}</p>
                  <div class="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      @click="closeRejectReasonDialog"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      :disabled="actionBusy"
                      class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      @click="confirmRejectReasonDialog"
                    >
                      Xác nhận từ chối
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
                    <h3 class="text-lg font-bold text-slate-900">Từ chối tất cả</h3>
                  </div>
                  <p class="mb-3 text-sm text-slate-600">
                    Bạn sắp từ chối
                    <strong>{{ actionableGmKpis.length }}</strong>
                    KPI đang chờ GM duyệt của thành viên này. Vui lòng nhập lý do áp dụng cho tất cả.
                  </p>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">
                    Lý do từ chối <span class="text-rose-500">*</span>
                  </label>
                  <textarea
                    v-model="rejectAllReason"
                    class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
                    :class="
                      rejectAllError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'
                    "
                    placeholder="Nhập lý do chi tiết..."
                  />
                  <p v-if="rejectAllError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectAllError }}</p>
                  <div class="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      @click="closeRejectAllDialog"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      :disabled="actionBusy"
                      class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      @click="confirmRejectAll"
                    >
                      Xác nhận từ chối
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
