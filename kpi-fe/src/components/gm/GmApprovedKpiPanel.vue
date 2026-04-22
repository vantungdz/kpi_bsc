<script setup lang="ts">
import { computed, ref } from 'vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import {
  GM_BSC_LABELS,
  GM_BSC_ORDER,
  normalizeGmBscPerspective,
  type GmBscPerspective,
  type GmHierarchyKpi,
} from '@/mocks/gm-kpi.mock'

const props = defineProps<{
  rows: GmHierarchyKpi[]
}>()

const emit = defineEmits<{
  'approve-kpi': [kpi: GmHierarchyKpi]
  'reject-kpi': [kpi: GmHierarchyKpi]
}>()

function sortImportantKpisFirst(list: GmHierarchyKpi[]): GmHierarchyKpi[] {
  return [...list].sort((a, b) => {
    const ai = a.isImportant ? 1 : 0
    const bi = b.isImportant ? 1 : 0
    if (ai !== bi) return bi - ai
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'vi')
  })
}

const rowsByBsc = computed(() => {
  const m = new Map<GmBscPerspective, GmHierarchyKpi[]>()
  for (const id of GM_BSC_ORDER) m.set(id, [])
  for (const k of props.rows) {
    m.get(normalizeGmBscPerspective(k.bscPerspective))!.push(k)
  }
  return GM_BSC_ORDER.map((perspective) => ({
    perspective,
    label: GM_BSC_LABELS[perspective],
    rows: sortImportantKpisFirst(m.get(perspective)!),
  })).filter((g) => g.rows.length > 0)
})

const expandedBscSections = ref<Set<GmBscPerspective>>(new Set(GM_BSC_ORDER))

function toggleBscSection(p: GmBscPerspective) {
  const s = new Set(expandedBscSections.value)
  if (s.has(p)) s.delete(p)
  else s.add(p)
  expandedBscSections.value = s
}

function onApprove(kpi: GmHierarchyKpi) {
  emit('approve-kpi', kpi)
}

function onReject(kpi: GmHierarchyKpi) {
  emit('reject-kpi', kpi)
}
</script>

<template>
  <div class="animate-fade-in space-y-4">
    <div>
      <h3
        class="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 sm:text-sm"
      >
        <i class="fas fa-clipboard-check text-[11px] text-indigo-600 sm:text-xs" aria-hidden="true" />
        Approved KPI
      </h3>
    </div>

    <div v-if="rows.length === 0" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
      <p class="text-sm font-semibold text-slate-700">Không có KPI chờ duyệt</p>
      <p class="mt-1 text-xs text-slate-500">Khi có đề xuất mới, chúng sẽ xuất hiện tại đây theo khía cạnh BSC.</p>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <div class="min-w-[640px] divide-y divide-slate-200">
          <div
            class="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:gap-3 sm:text-xs"
          >
            <div class="col-span-5 pl-2 sm:pl-3">Mục tiêu KPI</div>
            <div class="col-span-2 text-center">Trọng số</div>
            <div class="col-span-2 text-center">Target</div>
            <div class="col-span-3 text-center">Thao tác</div>
          </div>

          <template v-for="group in rowsByBsc" :key="'approved-bsc-' + group.perspective">
            <div class="border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
                :aria-expanded="expandedBscSections.has(group.perspective)"
                :aria-controls="`gm-approved-bsc-${group.perspective}`"
                @click="toggleBscSection(group.perspective)"
              >
                <i
                  class="fas fa-chevron-right w-3 shrink-0 text-center text-[10px] text-slate-500 transition-transform duration-200 motion-reduce:transition-none"
                  :class="expandedBscSections.has(group.perspective) ? 'rotate-90' : ''"
                  aria-hidden="true"
                />
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-800">{{ group.label }}</span>
                <span
                  class="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600"
                >{{ group.rows.length }} KPI</span>
              </button>
            </div>
            <div
              :id="`gm-approved-bsc-${group.perspective}`"
              class="grid overflow-hidden border-b border-slate-200 transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
              :class="expandedBscSections.has(group.perspective) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
              <div class="min-h-0 divide-y divide-slate-200">
                <div
                  v-for="kpi in group.rows"
                  :key="kpi.id"
                  class="grid grid-cols-12 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:gap-3"
                >
                  <div class="col-span-5 flex min-w-0 items-center pl-2 sm:pl-3">
                    <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <i
                        v-if="kpi.isImportant"
                        class="fas fa-star shrink-0 text-[11px] text-amber-500"
                        title="KPI quan trọng"
                        aria-label="KPI quan trọng"
                      />
                      <span class="text-sm font-bold leading-snug text-slate-800">{{ kpi.name }}</span>
                      <GmStrategicKpiTypeTag :type="kpi.kpiType" size="sm" class="shrink-0" />
                    </div>
                  </div>
                  <div class="col-span-2 text-center">
                    <span
                      class="inline-block min-w-[2.25rem] rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold tabular-nums text-slate-700"
                    >{{ kpi.weight }}</span>
                  </div>
                  <div class="col-span-2 text-center text-xs font-semibold tabular-nums text-slate-600">
                    {{ kpi.target }}
                  </div>
                  <div class="col-span-3 flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      title="Đồng ý duyệt — kích hoạt KPI"
                      aria-label="Đồng ý duyệt KPI"
                      @click="onApprove(kpi)"
                    >
                      <i class="fas fa-check text-sm" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-100 hover:text-rose-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      title="Từ chối đề xuất"
                      aria-label="Từ chối KPI"
                      @click="onReject(kpi)"
                    >
                      <i class="fas fa-times text-sm" aria-hidden="true" />
                    </button>
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
