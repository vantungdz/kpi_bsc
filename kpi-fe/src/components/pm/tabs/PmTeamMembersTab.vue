<script setup lang="ts">
import { ref, computed } from 'vue'
import { pmKpiService } from '@/services/modules/kpi-pm.service'

import { generateInitials } from '@/utils/common'
import { KPI_STATUS } from '@/config/constants'


const emit = defineEmits(['open-member'])


const teamTreeRaw = ref<any[]>([])
const isLoading = ref(false)

const EVALUATION_STATUS_UI: Record<number, any> = {
  [KPI_STATUS.INACTIVE]: { dot: 'bg-slate-300 ring-2 ring-slate-100', chip: 'border-slate-200 bg-slate-50 text-slate-800', label: 'Inactive' },
  [KPI_STATUS.WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve' },
  [KPI_STATUS.WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve' },
  [KPI_STATUS.PENDING_ACCEPTANCE]: { dot: 'bg-blue-400 ring-2 ring-blue-100', chip: 'border-blue-200 bg-blue-50 text-blue-950', label: 'Pending acceptance' },
  [KPI_STATUS.ACCEPTED]: { dot: 'bg-emerald-500 ring-2 ring-emerald-100', chip: 'border-emerald-200 bg-emerald-50 text-emerald-950', label: 'Accepted' },
  [KPI_STATUS.REJECTED]: { dot: 'bg-rose-500 ring-2 ring-rose-100', chip: 'border-rose-200 bg-rose-50 text-rose-950', label: 'Rejected' },
  
  [KPI_STATUS.FIRST_WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve 1st Half' },
  [KPI_STATUS.FIRST_WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve 1st Half' },
  [KPI_STATUS.FIRST_COMPLETED]: { dot: 'bg-emerald-500 ring-2 ring-emerald-100', chip: 'border-emerald-200 bg-emerald-50 text-emerald-950', label: 'Completed 1st Half' },
  
  [KPI_STATUS.SECOND_WAITING_PM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting PM approve Final' },
  [KPI_STATUS.SECOND_WAITING_GM_APPROVAL]: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', label: 'Waiting GM approve Final' },
  [KPI_STATUS.COMPLETED]: { dot: 'bg-purple-500 ring-2 ring-purple-100', chip: 'border-purple-200 bg-purple-50 text-purple-950', label: 'Completed' },
}

const defaultStatusUi = { dot: 'bg-slate-300 ring-2 ring-slate-100', chip: 'border-slate-200 bg-slate-50 text-slate-800', label: 'Unknown' }

// Gọi API lấy danh sách Team
const fetchTeamHierarchy = async () => {
  isLoading.value = true
  try {
    const response = await pmKpiService.getTeamHierarchy(String(new Date().getFullYear()))
    teamTreeRaw.value = response
  } catch (error) {
    console.error('Failed to fetch team hierarchy:', error)
  } finally {
    isLoading.value = false
  }
}

// Call API to get team hierarchy when component mounts
fetchTeamHierarchy()

// Convert tree structure to a flat list for table rendering, while keeping track of depth for indentation
const visibleTeamMembers = computed(() => {
  let result: any[] = [];
  const traverse = (node: any) => {
    result.push(node);
    if (node.expanded && node.children && node.children.length > 0) {
      node.children.forEach((child: any) => traverse(child));
    }
  };

  teamTreeRaw.value.forEach(root => traverse(root));
  return result;
})

const getEvalStatusUi = (statusCode: number | null) => {
  if (!statusCode) return defaultStatusUi
  return EVALUATION_STATUS_UI[statusCode] || defaultStatusUi
}

// Calculate progress % based on raw statusCode milestones
const labelcalculateProgress = (statusCode: number | null): number => {
  if (!statusCode) return 0;
  if (statusCode >= KPI_STATUS.COMPLETED) return 100;
  if (statusCode >= KPI_STATUS.SECOND_WAITING_GM_APPROVAL) return 50;
  if (statusCode >= KPI_STATUS.FIRST_WAITING_GM_APPROVAL) return 20;
  return 0;
}

const getProgressColor = (progress: number) => {
  return progress >= 80 ? 'bg-emerald-500' : progress >= 50 ? 'bg-orange-400' : 'bg-rose-500'
}

// ACTIONS
const toggleMember = (member: any) => { 
  member.expanded = !member.expanded 
}

const openMemberDetail = (member: any) => { 
  emit('open-member', { 
    memberId: member.id, 
    year: String(new Date().getFullYear()), 
    ...member 
  }) 
}
</script>

<template>
  <div class="animate-fade-in bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div class="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
      <div>
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
          <i class="fas fa-users text-slate-400"></i> Team Hierarchy & Performance
        </h3>
        <p class="text-xs text-slate-500 mt-1">Click on a member to view detailed KPI assessment.</p>
      </div>
    </div>

    <div v-if="isLoading" class="p-10 text-center text-slate-500">
      <i class="fas fa-circle-notch fa-spin text-2xl text-purple-600 mb-3 block"></i> 
      Loading...
    </div>

    <table v-else class="w-full text-left">
      <thead class="bg-white border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th class="py-4 px-5 w-1/2">Employee Name & Role</th>
          <th class="py-4 px-5">Overall Progress</th>
          <th class="py-4 px-5 text-center">Total Score</th>
          <th class="py-4 px-5 text-right">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="member in visibleTeamMembers" :key="member.id" 
            class="hover:bg-slate-50 transition-colors cursor-pointer group"
            @click="openMemberDetail(member)">
          
          <td class="py-4 px-5 flex items-center gap-3 relative" :style="{ paddingLeft: (member.depth * 2.5 + 1.25) + 'rem' }">
            <div v-if="member.depth > 0" class="absolute top-0 bottom-0 w-px bg-slate-200" :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem' }"></div>
            <div v-if="member.depth > 0" class="absolute top-1/2 h-px bg-slate-200" :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem', width: '1.25rem' }"></div>

            <button @click.stop="toggleMember(member)" class="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-purple-100 hover:text-purple-600 transition-colors z-10" :class="{'invisible': !member.children || member.children.length === 0}">
              <i class="fas text-[10px]" :class="member.expanded ? 'fa-minus' : 'fa-plus'"></i>
            </button>

            <div class="w-9 h-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-10 group-hover:border-purple-100 transition-all">
              {{ generateInitials(member.name) }}
            </div>
            
            <div class="z-10">
              <p class="text-sm font-bold text-slate-800">{{ member.name }}</p>
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{{ member.role }}</p>
            </div>
          </td>
          
          <td class="py-4 px-5 align-middle">
            <div class="flex items-center gap-3">
              <div class="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" 
                     :class="getProgressColor(labelcalculateProgress(member.statusCode))" 
                     :style="{ width: labelcalculateProgress(member.statusCode) + '%' }"></div>
              </div>
              <span class="text-xs font-bold text-slate-600">{{ labelcalculateProgress(member.statusCode) }}%</span>
            </div>
          </td>
          
          <td class="py-4 px-5 text-center align-middle">
            <span class="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg">
              {{ member.score ? member.score.toFixed(1) : '-' }}
            </span>
          </td>
          
          <td class="py-4 px-5 text-right align-middle">
            <div class="mx-auto inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-center shadow-sm" 
                 :class="getEvalStatusUi(member.statusCode).chip">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="getEvalStatusUi(member.statusCode).dot"></span>
              <span class="text-[10px] font-bold">{{ getEvalStatusUi(member.statusCode).label }}</span>
            </div>
          </td>
          
        </tr>
        
        <tr v-if="visibleTeamMembers.length === 0 && !isLoading">
          <td colspan="4" class="py-8 text-center text-slate-500 text-sm">
             Don't have any team members in the list.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>