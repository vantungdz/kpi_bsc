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

// Control refresh of PM Portfolio tab after actions in drawers
const personalKpiKey = ref(0)

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
const closePanel = () => { rightPanelVisible.value = false; setTimeout(() => { activeItem.value = null; rightPanelMode.value = 'none' }, 300); personalKpiKey.value += 1 }

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

const handleRefresh = () => {
  // This can be expanded to handle more complex refresh logic if needed
  personalKpiKey.value += 1
}
</script>

<template>
  <div class="flex flex-col w-full text-slate-800 font-sans relative pb-10">
    
    <div class="space-y-4 p-3 sm:p-4 lg:p-6">
      <GmProcessTimeline :midYearIssues="midYearIssuesMock" />
    </div>

    <div class="mx-6 mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
      
      <div class="flex bg-slate-50 border-b border-slate-200 px-4 pt-3 gap-2 overflow-x-auto hide-scrollbar">
        <button 
          @click="activeTab = 'personal'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'personal' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-list-alt text-base"></i> KPI Portfolio
        </button>
        
        <button 
          @click="activeTab = 'team'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'team' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-sitemap text-base"></i> Team Review
        </button>
        
        <button 
          @click="activeTab = 'requests'" 
          class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 relative -bottom-[1px]" 
          :class="activeTab === 'requests' ? 'bg-white text-blue-700 border border-slate-200 border-b-white z-10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 border border-transparent'"
        >
          <i class="fas fa-inbox text-base"></i> Request Approval
          <span v-if="pendingRequestsCount > 0" class="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow-sm ml-1">{{ pendingRequestsCount }}</span>
        </button>
      </div>

      <div class="bg-white">
        <PmPersonalKpiTab v-if="activeTab === 'personal'" :key="personalKpiKey" @open-assign="openAssignDrawer" @open-member-detail="openKpiChildDetail" />
        <PmTeamMembersTab v-if="activeTab === 'team'" @open-member="openMemberDrawer" />
        <PmRequestsTab v-if="activeTab === 'requests'" :requests="requests" @open-request="openRequestDrawer" />
      </div>
    </div>

    <PmAssignKpiDrawer v-if="rightPanelVisible && rightPanelMode === 'assign'" :open="rightPanelVisible && rightPanelMode === 'assign'" :kpi="activeItem" @close="closePanel" @refresh="handleRefresh" />
    <PmMemberDetailDrawer v-if="rightPanelVisible && rightPanelMode === 'member_detail'" :open="rightPanelVisible && rightPanelMode === 'member_detail'" :member="activeItem" @close="closePanel" />
    <PmRequestDetailDrawer v-if="rightPanelVisible && rightPanelMode === 'request_detail'" :open="rightPanelVisible && rightPanelMode === 'request_detail'" :request="activeItem" @close="closePanel" />
    <GmMemberKpiDrawer v-if="isGmDrawerOpen" :open="isGmDrawerOpen" :member="gmDrawerMember" :items="gmDrawerItems" @close="isGmDrawerOpen = false" />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Ẩn scrollbar ngang cho thanh Tab */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.slide-panel-enter-active, .slide-panel-leave-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
.slide-panel-enter-from, .slide-panel-leave-to { transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.28s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>