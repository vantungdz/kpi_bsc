<script setup lang="ts">
/**
 * Khối đánh giá (GM) — dùng chung cho tab trên dashboard và route `/gm/employee-evaluation`.
 * Mock (`VITE_USE_MOCK=true`): dữ liệu mock cây PM. Thật: `GET /kpi/gm/evaluation-hub/assignments?cycleId=`.
 */
import { computed, inject, ref, watch, type Ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import GmKpiEvaluationPanel from '@/components/gm/GmKpiEvaluationPanel.vue'
import {
  flattenGmEvalPmHubTreeForScores,
  getGmEvalBroker,
  getGmEvalPmHubRows,
  getGmEvalPmHubTree,
  type GmEvalMember,
  type GmEvalPmBranch,
} from '@/mocks/gmEmployeeEvaluation.mock'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import { mapGmEvaluationHubApiToPmBranches } from '@/utils/mapGmEvaluationHubApiToPmBranches'
import { pushGmNotification } from '@/composables/useGmNotifications'

const emit = defineEmits<{
  (e: 'pending-count', count: number): void
}>()

const route = useRoute()
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
const selectedCycleId = inject<Ref<string>>('gmSelectedCycleId', ref(''))

const pmBrokerId = computed(() => {
  const q = route.query.pm
  return typeof q === 'string' && q.trim() ? q.trim() : null
})

const hubLoading = ref(false)
const basePmBranches = ref<GmEvalPmBranch[]>([])
const baseEmployees = ref<GmEvalMember[]>([])

async function loadEvaluationHub() {
  if (useMock) {
    basePmBranches.value = getGmEvalPmHubTree()
    baseEmployees.value = getGmEvalPmHubRows()
    return
  }
  const cid = String(selectedCycleId.value ?? '').trim()
  if (!cid) {
    basePmBranches.value = []
    baseEmployees.value = []
    return
  }
  hubLoading.value = true
  try {
    const data = await gmKpiService.getEvaluationHubAssignments(cid)
    const tree = mapGmEvaluationHubApiToPmBranches(data)
    basePmBranches.value = tree
    baseEmployees.value = flattenGmEvalPmHubTreeForScores(tree)
  } catch (e: unknown) {
    basePmBranches.value = []
    baseEmployees.value = []
    pushGmNotification(e instanceof Error ? e.message : 'Không tải được dữ liệu tab Đánh giá', {
      variant: 'error',
      durationMs: 8000,
    })
  } finally {
    hubLoading.value = false
  }
}

watch(
  () => [useMock, selectedCycleId.value] as const,
  () => {
    void loadEvaluationHub()
  },
  { immediate: true },
)

const employees = computed<GmEvalMember[]>(() => {
  const all = baseEmployees.value
  const id = pmBrokerId.value
  if (!id) return all
  return all.filter((e) => e.projectIds.includes(id))
})

const pendingEvaluationCount = computed(() => {
  return employees.value.filter((e) => e.gmApprovalActionEnabled === true).length
})

watch(
  pendingEvaluationCount,
  (count) => {
    emit('pending-count', count)
  },
  { immediate: true },
)

const pmBranches = computed<GmEvalPmBranch[]>(() => {
  const tree = basePmBranches.value
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
    <div
      v-if="hubLoading && !useMock"
      class="px-4 py-10 text-center text-sm font-medium text-slate-500 sm:px-5"
    >
      <i class="fas fa-spinner fa-spin mr-2 text-indigo-500" aria-hidden="true" />
      Đang tải dữ liệu đánh giá…
    </div>
    <GmKpiEvaluationPanel
      v-else
      list-entity="pm"
      :employees="employees"
      :pm-branches="pmBranches"
      @reload-evaluation-hub="loadEvaluationHub"
    />
  </div>
</template>
