<script setup lang="ts">
import { computed, ref, withDefaults } from 'vue'
import { GM_BSC_LABELS, GM_BSC_ORDER, normalizeGmBscPerspective } from '@/utils/gm-bsc-diagnostics'
import type {
  GmBscPerspective,
  GmPersonalKpiRowMock,
  GmPersonalKpiRowStatus,
} from '@/types/gm-workspace'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'

const props = withDefaults(
  defineProps<{
    /** Năm đánh giá (đồng bộ dropdown header GM). */
    yearId: string
    /** Dữ liệu từ `GET /kpi/leader/kpi-info` (INDIVIDUAL + PROMOTION) sau khi map. */
    rows: GmPersonalKpiRowMock[]
    /** Đang gọi API (hai loại KPI cá nhân). */
    loading?: boolean
  }>(),
  { loading: false },
)

const yearLabel = computed(() => props.yearId.trim() || String(new Date().getFullYear()))

interface BscGroup {
  perspective: GmBscPerspective
  label: string
  rows: { row: GmPersonalKpiRowMock; stt: number }[]
}

const groupedByBsc = computed((): BscGroup[] => {
  const m = new Map<GmBscPerspective, GmPersonalKpiRowMock[]>()
  for (const id of GM_BSC_ORDER) m.set(id, [])
  for (const r of props.rows) {
    m.get(normalizeGmBscPerspective(r.diagnosticsFallbackGroup))!.push(r)
  }
  let stt = 0
  const out: BscGroup[] = []
  for (const perspective of GM_BSC_ORDER) {
    const list = m.get(perspective)!
    if (list.length === 0) continue
    out.push({
      perspective,
      label: GM_BSC_LABELS[perspective],
      rows: list.map((row) => ({ row, stt: ++stt })),
    })
  }
  return out
})

const expandedBscSections = ref<Set<GmBscPerspective>>(new Set(GM_BSC_ORDER))

function toggleBscSection(p: GmBscPerspective) {
  const s = new Set(expandedBscSections.value)
  if (s.has(p)) s.delete(p)
  else s.add(p)
  expandedBscSections.value = s
}

function statusBadge(s: GmPersonalKpiRowStatus) {
  if (s === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (s === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function statusLabel(s: GmPersonalKpiRowStatus) {
  if (s === 'good') return 'Đạt'
  if (s === 'warn') return 'Cần cải thiện'
  return 'Chờ cập nhật'
}
</script>

<template>
  <div class="animate-fade-in">
    <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3
          class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 sm:text-sm"
        >
          <i class="fas fa-bullseye text-[11px] text-indigo-600 sm:text-xs" aria-hidden="true" />
          KPI cá nhân (GM)
        </h3>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-12 text-sm font-medium text-slate-600 shadow-sm"
      role="status"
    >
      <i class="fas fa-spinner fa-spin text-indigo-500" aria-hidden="true" />
      Đang tải KPI cá nhân (Individual + Promotion)…
    </div>

    <div
      v-else-if="rows.length === 0"
      class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center"
    >
      <p class="text-sm font-semibold text-slate-700">Chưa có dữ liệu KPI cá nhân</p>
      <p class="mt-1 text-xs text-slate-500">Không có assignment Individual/Promotion cho năm {{ yearLabel }}.</p>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Chi tiết bảng KPI cá nhân
        </p>
      </div>
      <div class="overflow-x-auto">
        <table
          class="table-fixed w-full min-w-[52rem] border-collapse text-left text-xs sm:min-w-[58rem] sm:text-sm"
        >
          <colgroup>
            <col class="w-11 sm:w-12" />
            <col style="width: 26%" />
            <col style="width: 30%" />
            <col class="w-[4.25rem] sm:w-20" />
            <col class="w-[5.25rem] sm:w-24" />
            <col class="w-[4.25rem] sm:w-20" />
            <col class="w-[7.5rem] sm:w-[8.5rem]" />
          </colgroup>
          <thead>
            <tr
              class="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:text-xs"
            >
              <th class="px-2 py-2.5 text-center sm:px-3">STT</th>
              <th class="px-2 py-2.5 sm:px-3">Mục tiêu</th>
              <th class="px-2 py-2.5 sm:px-3">Target</th>
              <th class="px-2 py-2.5 text-center sm:px-3">Trọng số</th>
              <th class="px-2 py-2.5 text-center sm:px-3">Actual</th>
              <th class="px-2 py-2.5 text-center sm:px-3">Điểm</th>
              <th class="px-2 py-2.5 text-center sm:px-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-for="group in groupedByBsc" :key="'pk-bsc-' + group.perspective">
              <tr class="border-b border-slate-200 bg-slate-50">
                <td colspan="7" class="p-0">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80 sm:px-4"
                    :aria-expanded="expandedBscSections.has(group.perspective)"
                    :aria-controls="`gm-personal-bsc-${group.perspective}`"
                    @click="toggleBscSection(group.perspective)"
                  >
                    <i
                      class="fas fa-chevron-right w-3 shrink-0 text-center text-[10px] text-slate-500 transition-transform duration-200 motion-reduce:transition-none"
                      :class="expandedBscSections.has(group.perspective) ? 'rotate-90' : ''"
                      aria-hidden="true"
                    />
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-800">{{
                      group.label
                    }}</span>
                    <span
                      class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                    >{{ group.rows.length }} KPI</span>
                  </button>
                </td>
              </tr>
              <template v-if="expandedBscSections.has(group.perspective)">
                <tr
                  v-for="({ row, stt }, ri) in group.rows"
                  :key="row.id"
                  :id="ri === 0 ? `gm-personal-bsc-${group.perspective}` : undefined"
                  class="align-top transition-colors hover:bg-slate-50/80"
                >
                  <td class="px-2 py-3 text-center text-[11px] font-semibold text-slate-400 sm:px-3 sm:text-xs">
                    {{ stt }}
                  </td>
                  <td class="min-w-0 px-2 py-3 sm:px-3">
                    <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span class="break-words font-bold leading-snug text-slate-800">{{
                        row.objective
                      }}</span>
                      <GmStrategicKpiTypeTag :type="row.kpiType" size="sm" class="shrink-0" />
                    </div>
                  </td>
                  <td class="min-w-0 px-2 py-3 text-[11px] font-medium leading-snug text-slate-600 sm:px-3 sm:text-xs">
                    <span class="break-words">{{ row.target }}</span>
                  </td>
                  <td class="px-2 py-3 text-center text-[11px] font-semibold tabular-nums text-slate-700 sm:px-3 sm:text-xs">
                    {{ row.weight }}%
                  </td>
                  <td class="px-2 py-3 text-center text-[11px] font-bold tabular-nums text-slate-800 sm:px-3 sm:text-sm">
                    {{ row.actual }}
                  </td>
                  <td class="px-2 py-3 text-center text-[11px] font-semibold tabular-nums text-sky-800 sm:px-3 sm:text-sm">
                    {{ row.finalScore }}
                  </td>
                  <td class="px-2 py-3 text-center sm:px-3">
                    <span
                      class="inline-flex max-w-full items-center justify-center gap-1 whitespace-normal break-words rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight sm:text-[11px]"
                      :class="statusBadge(row.status)"
                    >
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
