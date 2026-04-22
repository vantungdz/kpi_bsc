<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import GmStrategicKpiTypeTag from '@/components/gm/GmStrategicKpiTypeTag.vue'
import type { GmDeptKpiMock, GmInvestigationMember, GmStrategicKpiKind } from '@/mocks/gm-kpi.mock'

const props = defineProps<{
  department: Record<string, unknown> & { id: string; name: string; manager: string }
  investigatingKpi: string | null
  members: GmInvestigationMember[]
}>()

type DepartmentWithKpis = typeof props.department & { kpis?: GmDeptKpiMock[] }

const investigatingKpiKind = computed((): GmStrategicKpiKind | null => {
  const name = props.investigatingKpi
  if (!name) return null
  const kpis = (props.department as DepartmentWithKpis).kpis
  if (!kpis?.length) return null
  return kpis.find((k) => k.name === name)?.kpiType ?? null
})

const emit = defineEmits<{
  back: []
  'view-kpi': [member: GmInvestigationMember]
}>()

const memberSearch = ref('')

watch(
  () => [props.department?.id, props.investigatingKpi] as const,
  () => {
    memberSearch.value = ''
  }
)

const filteredMembers = computed(() => {
  const deptId = props.department?.id
  if (!deptId) return []
  const q = memberSearch.value.toLowerCase()
  const kpi = props.investigatingKpi
  return props.members.filter((m) => {
    const matchesDept = m.deptId === deptId
    const matchesSearch = m.name.toLowerCase().includes(q)
    const matchesKpi = kpi ? m.relatedKpi === kpi || !m.relatedKpi : true
    return matchesDept && matchesSearch && matchesKpi
  })
})

const groupedMembers = computed(() => {
  const grouped: Record<string, GmInvestigationMember[]> = {}
  filteredMembers.value.forEach((member) => {
    if (!grouped[member.leader]) grouped[member.leader] = []
    grouped[member.leader].push(member)
  })
  return grouped
})

function getMemberRowClass(member: GmInvestigationMember) {
  const kpi = props.investigatingKpi
  const isHL = kpi && member.relatedKpi === kpi && member.status !== 'Approved'
  if (isHL) return 'bg-rose-50/60 hover:bg-rose-50/80'
  return 'bg-white hover:bg-slate-50/80'
}
</script>

<template>
  <div class="space-y-4 p-3 sm:p-4 lg:p-5">
    <div class="w-full">
      <div
        class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 shadow-sm hover:bg-slate-100"
            @click="emit('back')"
          >
            <i class="fas fa-arrow-left" />
          </button>
          <div>
            <h2 class="text-base font-bold text-slate-800">{{ department.name }}</h2>
            <p class="text-xs font-medium text-slate-500">Manager: {{ department.manager }}</p>
          </div>
        </div>
        <div
          v-if="investigatingKpi"
          class="flex flex-wrap items-center gap-1.5 rounded-md bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700"
        >
          <span class="inline-flex items-center gap-1.5">
            <i class="fas fa-exclamation-circle" />
            Investigating: {{ investigatingKpi }}
          </span>
          <GmStrategicKpiTypeTag v-if="investigatingKpiKind" :type="investigatingKpiKind" size="sm" />
        </div>
      </div>

      <div class="mt-4 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
          <h3 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
            <i class="fas fa-users text-slate-600" />
            Member Performance
          </h3>
          <div class="relative w-full sm:w-64">
            <i
              class="fas fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
            />
            <input
              v-model="memberSearch"
              type="text"
              placeholder="Search member..."
              class="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left" style="min-width: 920px">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr class="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                <th class="px-4 py-2">Member</th>
                <th class="px-4 py-2">Status</th>
                <th class="px-4 py-2">Due In</th>
                <th class="px-4 py-2">Priority</th>
                <th class="px-4 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredMembers.length > 0">
                <template v-for="(members, leader) in groupedMembers" :key="leader">
                  <tr class="border-y border-slate-200 bg-indigo-50/50">
                    <td colspan="5" class="px-4 py-2">
                      <div
                        class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-800"
                      >
                        <i class="fas fa-user-tie" />
                        {{ leader }}
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-for="member in members"
                    :key="member.id"
                    class="border-b border-slate-100 transition-colors"
                    :class="getMemberRowClass(member)"
                  >
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <div
                          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600"
                        >
                          {{ member.name.split(' ').pop()?.charAt(0) }}
                        </div>
                        <div>
                          <p class="text-xs font-bold text-slate-800">{{ member.name }}</p>
                          <p class="text-[10px] text-slate-500">{{ member.rank }}</p>
                          <div class="mt-1 flex flex-wrap items-center gap-1.5">
                            <span class="text-[10px] font-medium text-slate-500">KPI:</span>
                            <span class="text-[10px] font-semibold text-slate-700">{{ member.relatedKpi }}</span>
                            <GmStrategicKpiTypeTag :type="member.relatedKpiType" size="sm" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-2">
                      <span
                        class="rounded px-2 py-1 text-[10px] font-bold uppercase"
                        :class="{
                          'bg-rose-100 text-rose-700': member.status === 'Overdue',
                          'bg-yellow-100 text-yellow-700': member.status === 'Pending',
                          'bg-emerald-100 text-emerald-700': member.status === 'Approved',
                        }"
                      >
                        {{ member.status }}
                      </span>
                    </td>
                    <td class="px-4 py-2">
                      <span v-if="member.dueIn === null" class="text-slate-500">-</span>
                      <span v-else-if="member.dueIn < 0" class="font-bold text-rose-600">
                        {{ Math.abs(member.dueIn) }} days overdue
                      </span>
                      <span v-else class="text-slate-500">{{ member.dueIn }} days</span>
                    </td>
                    <td class="px-4 py-2">
                      <span
                        v-if="member.priority"
                        class="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                        :class="{
                          'bg-rose-200 text-rose-800': member.priority === 'Critical',
                          'bg-yellow-200 text-yellow-800': member.priority === 'Medium',
                        }"
                      >
                        {{ member.priority }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <button
                        type="button"
                        class="rounded border border-slate-200 bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
                        @click="emit('view-kpi', member)"
                      >
                        View KPI
                      </button>
                    </td>
                  </tr>
                </template>
              </template>
              <tr v-else>
                <td colspan="5" class="py-12 text-center text-slate-500">
                  <i class="fas fa-inbox mb-3 block text-4xl text-slate-300" />
                  <p class="font-bold">No members found</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
