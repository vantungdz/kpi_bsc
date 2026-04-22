<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits(['open-member'])

// MOCK DATA: Team Members
const teamTreeRaw = ref([
  {
    id: 'm2', name: 'Nguyen Van Leader', avatar: 'NL', role: 'Team Leader', progress: 90, score: 4.5, status: 'approved', expanded: true, depth: 0,
    employeeComment: 'Kỳ này team hoàn thành xuất sắc các chỉ tiêu về UAT.', supervisorComment: '',
    fullKpis: [
      { id: 'mk1', group: 'A', code: 'A.1', name: 'Lead Frontend Chapter', target: 'Zero critical bugs on UAT', description: 'Đảm bảo chất lượng code FE', weight: 50, progress: 90, selfScore: 4, pmScore: 4, status: 'approved', actualResult: 'Hoàn thành, có 1 bug minor' },
      { id: 'mk2', group: 'B', code: 'B.1', name: 'Tech Sharing', target: '2 sessions', description: 'Sharing về Vue 3', weight: 50, progress: 100, selfScore: 5, pmScore: null, status: 'pending_approval', actualResult: 'Đã hoàn thành 2 buổi' }
    ],
    children: [
      { id: 'm3', name: 'John Doe', avatar: 'JD', role: 'Senior Developer', progress: 100, score: 5.0, status: 'approved', expanded: false, depth: 1, employeeComment: 'Mọi pipeline CI/CD đều chạy trơn tru.', supervisorComment: 'Rất tốt!', fullKpis: [{ id: 'k4', group: 'A', code: 'A.1', name: 'Frontend deployment pipeline', target: 'Complete setup', description: 'Setup CI/CD trên Gitlab', weight: 100, progress: 100, selfScore: 5, pmScore: 5, status: 'approved', actualResult: 'Pipeline chạy ổn định' }] },
      { id: 'm4', name: 'Anna Smith', avatar: 'AS', role: 'Backend Developer', progress: 60, score: 3.2, status: 'pending_approval', expanded: false, depth: 1, employeeComment: '', supervisorComment: '', fullKpis: [{ id: 'k5', group: 'A', code: 'A.1', name: 'Microservices stability', target: '99.9% uptime', description: 'Monitor hệ thống backend', weight: 100, progress: 60, selfScore: 3, pmScore: null, status: 'pending_approval', actualResult: 'Đạt 99.5%, còn đôi lúc lag' }] }
    ]
  },
  {
    id: 'm5', name: 'Peter Park', avatar: 'PP', role: 'QC Engineer', progress: 75, score: 3.8, status: 'pending_approval', expanded: false, depth: 0,
    employeeComment: 'Đang triển khai viết automation nhưng bị chậm do framework.', supervisorComment: '',
    fullKpis: [{ id: 'k6', group: 'A', code: 'A.1', name: 'Automate Regression', target: '80% coverage', description: 'Viết auto test cho Regression', weight: 100, progress: 75, selfScore: 4, pmScore: null, status: 'pending_approval', actualResult: 'Hiện tại coverage đạt 75%' }]
  }
])

const visibleTeamMembers = computed(() => {
  let result: any[] = [];
  const traverse = (node: any) => {
    result.push(node);
    if (node.expanded && node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  };
  teamTreeRaw.value.forEach(root => traverse(root));
  return result;
})

// HELPERS
const EVALUATION_STATUS_UI: Record<string, any> = {
  not_started: { dot: 'bg-slate-300 ring-2 ring-slate-100', chip: 'border-slate-200 bg-slate-50 text-slate-800', labelVi: 'Chưa đánh giá' },
  pending_approval: { dot: 'bg-amber-400 ring-2 ring-amber-100', chip: 'border-amber-200 bg-amber-50 text-amber-950', labelVi: 'Chờ duyệt' },
  approved: { dot: 'bg-emerald-500 ring-2 ring-emerald-100', chip: 'border-emerald-200 bg-emerald-50 text-emerald-950', labelVi: 'Đã duyệt' },
}

const getEvalStatusUi = (status: string) => EVALUATION_STATUS_UI[status] || EVALUATION_STATUS_UI.not_started
const getProgressColor = (progress: number) => progress >= 80 ? 'bg-emerald-500' : progress >= 50 ? 'bg-orange-400' : 'bg-rose-500'

const toggleMember = (member: any) => { member.expanded = !member.expanded }
const openMemberDetail = (member: any) => { emit('open-member', member) }
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

    <table class="w-full text-left">
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
            class="hover:bg-slate-50 transition-colors cursor-pointer"
            @click="openMemberDetail(member)">
          
          <td class="py-4 px-5 flex items-center gap-3 relative" :style="{ paddingLeft: (member.depth * 2.5 + 1.25) + 'rem' }">
            <div v-if="member.depth > 0" class="absolute top-0 bottom-0 w-px bg-slate-200" :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem' }"></div>
            <div v-if="member.depth > 0" class="absolute top-1/2 h-px bg-slate-200" :style="{ left: ((member.depth - 1) * 2.5 + 2) + 'rem', width: '1.25rem' }"></div>

            <button @click.stop="toggleMember(member)" class="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-purple-100 hover:text-purple-600 transition-colors z-10" :class="{'invisible': !member.children || member.children.length === 0}">
              <i class="fas text-[10px]" :class="member.expanded ? 'fa-minus' : 'fa-plus'"></i>
            </button>

            <div class="w-9 h-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-10">{{ member.avatar }}</div>
            <div class="z-10">
              <p class="text-sm font-bold text-slate-800">{{ member.name }}</p>
              <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{{ member.role }}</p>
            </div>
          </td>
          <td class="py-4 px-5 align-middle">
            <div class="flex items-center gap-3">
              <div class="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" :class="getProgressColor(member.progress)" :style="{ width: member.progress + '%' }"></div>
              </div>
              <span class="text-xs font-bold text-slate-600">{{ member.progress }}%</span>
            </div>
          </td>
          <td class="py-4 px-5 text-center align-middle">
            <span class="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg">{{ member.score }}</span>
          </td>
          <td class="py-4 px-5 text-right align-middle">
            <div class="mx-auto inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-center shadow-sm" :class="getEvalStatusUi(member.status).chip">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="getEvalStatusUi(member.status).dot"></span>
              <span class="text-[10px] font-bold">{{ getEvalStatusUi(member.status).labelVi }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>