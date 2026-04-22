<script setup lang="ts">
/**
 * Khối đánh giá (GM) — dùng chung cho tab trên dashboard và route `/gm/employee-evaluation`.
 */
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import GmKpiEvaluationPanel from '@/components/gm/GmKpiEvaluationPanel.vue'
import {
  getGmEvalPmHubRows,
  getGmEvalPmHubTree,
  getGmEvalBroker,
  type GmEvalMember,
  type GmEvalPmBranch,
} from '@/mocks/gmEmployeeEvaluation.mock'

const route = useRoute()

const pmBrokerId = computed(() => {
  const q = route.query.pm
  return typeof q === 'string' && q.trim() ? q.trim() : null
})

const employees = computed<GmEvalMember[]>(() => {
  const all = getGmEvalPmHubRows()
  const id = pmBrokerId.value
  if (!id) return all
  return all.filter((e) => e.projectIds.includes(id))
})

const pmBranches = computed<GmEvalPmBranch[]>(() => {
  const tree = getGmEvalPmHubTree()
  const id = pmBrokerId.value
  if (!id) return tree
  return tree.filter((b) => b.pm.projectIds.includes(id))
})

const filterSubtitle = computed(() => {
  const id = pmBrokerId.value
  if (!id) return ''
  const b = getGmEvalBroker(id)
  if (b) return `Đang lọc: ${b.name} (từ Diagnostics).`
  return 'Đang lọc 1 PM (từ Diagnostics).'
})
</script>

<template>
  <!-- Cùng khung với `GmKpiDiagnosticsTable` (rounded-2xl + border + shadow) -->
  <div
    class="w-full animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white pb-4 shadow-sm"
  >
    <div
      v-if="pmBrokerId"
      class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-indigo-50/50 px-4 py-3 text-xs sm:px-5 sm:text-sm"
    >
      <p class="font-medium text-slate-700">
        {{ filterSubtitle }}
      </p>
      <RouterLink
        :to="{ path: '/gm/dashboard', query: { tab: 'pm' } }"
        class="shrink-0 text-[11px] font-bold text-indigo-700 underline-offset-2 hover:underline sm:text-xs"
      >
        Xem tất cả PM
      </RouterLink>
    </div>
    <GmKpiEvaluationPanel list-entity="pm" :employees="employees" :pm-branches="pmBranches" />
  </div>
</template>
