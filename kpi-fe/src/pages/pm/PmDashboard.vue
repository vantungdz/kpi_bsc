<script setup lang="ts">
import { ref, computed } from 'vue'
import PmPersonalKpiTab from '@/components/pm/tabs/PmPersonalKpiTab.vue'
import PmTeamMembersTab from '@/components/pm/tabs/PmTeamMembersTab.vue'
import PmRequestsTab from '@/components/pm/tabs/PmRequestsTab.vue'
import PmAssignKpiDrawer from '@/components/pm/drawers/PmAssignKpiDrawer.vue'
import PmMemberDetailDrawer from '@/components/pm/drawers/PmMemberDetailDrawer.vue'
import PmRequestDetailDrawer from '@/components/pm/drawers/PmRequestDetailDrawer.vue'
import GmProcessTimeline from '@/components/gm/GmProcessTimeline.vue'
import GmMemberKpiDrawer from '@/components/gm/GmMemberKpiDrawer.vue'

const activeTab = ref('personal')

const midYearIssuesMock = ref({
  pendingKpisLine: 'Pending: 15 KPIs',
  popoverTitle: '15 KPI Process Issues',
  issueTypes: [
    { id: 'pending_approval', text: '6 pending approval', dotClass: 'text-orange-500' },
    { id: 'not_submitted', text: '5 chưa submit', dotClass: 'text-orange-500' },
    { id: 'missing_evidence', text: '4 thiếu evidence', dotClass: 'text-rose-600' }
  ],
})

const requests = ref([
  { id: 'req-1', user: 'Tran Thi B', avatar: 'TB', type: 'UPDATE_TARGET', kpiName: 'Zero Critical Bugs on UAT', oldValue: '< 2 Bugs', newValue: '< 5 Bugs', reason: 'Scope of UAT increased by client, standard bug rate needs adjustment.', status: 'PENDING', date: 'Apr 20' },
  { id: 'req-2', user: 'Nguyen Van A', avatar: 'NA', type: 'CREATE_KPI', kpiName: 'Mentor Junior Devs', oldValue: null, newValue: '2 Sessions/month', reason: 'Assigned as mentor for the new batch of freshers.', status: 'PENDING', date: 'Apr 18' }
])
const pendingRequestsCount = computed(() => requests.value.filter(r => r.status === 'PENDING').length)

const rightPanelVisible = ref(false)
const rightPanelMode = ref<'assign' | 'member_detail' | 'request_detail' | 'none'>('none')
const activeItem = ref<any>(null)

const openAssignDrawer = (kpi: any) => { activeItem.value = kpi; rightPanelMode.value = 'assign'; rightPanelVisible.value = true }
const openMemberDrawer = (member: any) => { activeItem.value = member; rightPanelMode.value = 'member_detail'; rightPanelVisible.value = true }
const openRequestDrawer = (req: any) => { activeItem.value = req; rightPanelMode.value = 'request_detail'; rightPanelVisible.value = true }

const closePanel = () => { 
  rightPanelVisible.value = false; 
  // Đợi animation trượt xong (300ms) mới clear data
  setTimeout(() => { activeItem.value = null; rightPanelMode.value = 'none' }, 300) 
}

// --- Tái sử dụng Drawer của GM ---
const isGmDrawerOpen = ref(false)
const gmDrawerMember = ref<any>(null)
const gmDrawerItems = ref<any[]>([])

const openKpiChildDetail = (payload: { child: any, parent: any }) => {
  const { child, parent } = payload
  gmDrawerMember.value = { name: child.name, rank: child.role, leader: 'PM', departmentLabel: 'Phân rã từ mục tiêu chung' }
  gmDrawerItems.value = [{
    code: parent.code,
    obj: parent.name,
    target: child.target,
    targetSummary: `Thực tế: ${child.actualResult || 'Chưa cập nhật'} (Trọng số: ${child.weight}%)`,
    weight: child.weight,
    kpiType: 'cascading',
    submissionStatus: child.status === 'approved' ? 'submitted' : 'missing_data',
    isFail: false,
    calcMode: child.id === 'c1' ? 'sum' : 'average', 
    evidenceData: [
      { content: 'Fix bug P0 Payment', plan: '1 day', actual: 'Done in 4 hrs' },
      { content: 'Fix bug Login', plan: '2 days', actual: 'Done in 1.5 days' }
    ]
  }]
  isGmDrawerOpen.value = true
}
</script>

<template>
  <div class="flex flex-col w-full h-full text-slate-800 font-sans bg-slate-50 relative">
    <div class="shrink-0 px-6 pt-6 z-20">
      <GmProcessTimeline :midYearIssues="midYearIssuesMock" />
    </div>

    <div class="shrink-0 flex px-6 border-b border-slate-200 bg-white gap-2 z-10 shadow-sm relative mt-4">
      <button @click="activeTab = 'personal'" class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2" :class="activeTab === 'personal' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'"><i class="fas fa-bullseye text-base"></i> Personal KPI</button>
      <button @click="activeTab = 'team'" class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2" :class="activeTab === 'team' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'"><i class="fas fa-sitemap text-base"></i> Team Members</button>
      <button @click="activeTab = 'requests'" class="px-5 py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 relative" :class="activeTab === 'requests' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'"><i class="fas fa-inbox text-base"></i> Request Approval<span v-if="pendingRequestsCount > 0" class="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow-sm ml-1">{{ pendingRequestsCount }}</span></button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
      <PmPersonalKpiTab v-show="activeTab === 'personal'" @open-assign="openAssignDrawer" @open-member-detail="openKpiChildDetail" />
      <PmTeamMembersTab v-show="activeTab === 'team'" @open-member="openMemberDrawer" />
      <PmRequestsTab v-show="activeTab === 'requests'" :requests="requests" @open-request="openRequestDrawer" />
    </div>

    <PmAssignKpiDrawer :open="rightPanelVisible && rightPanelMode === 'assign'" :kpi="activeItem" @close="closePanel" />
    <PmMemberDetailDrawer :open="rightPanelVisible && rightPanelMode === 'member_detail'" :member="activeItem" @close="closePanel" />
    <PmRequestDetailDrawer :open="rightPanelVisible && rightPanelMode === 'request_detail'" :request="activeItem" @close="closePanel" />

    <GmMemberKpiDrawer :open="isGmDrawerOpen" :member="gmDrawerMember" :items="gmDrawerItems" @close="isGmDrawerOpen = false" />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>