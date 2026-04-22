<script setup lang="ts">
const props = defineProps({
  requests: { type: Array as () => any[], required: true }
})
const emit = defineEmits(['open-request'])

// HELPERS UI
const getRequestTypeColor = (type: string) => {
  if(type === 'CREATE_KPI') return 'bg-blue-50 text-blue-700 border-blue-200';
  if(type === 'UPDATE_WEIGHT') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-orange-50 text-orange-700 border-orange-200';
}
const getRequestStatusColor = (status: string) => {
  if(status === 'PENDING') return 'bg-amber-50 text-amber-700 border-amber-200';
  if(status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

const openRequestDetail = (req: any) => emit('open-request', req)
const approveRequest = (req: any) => { req.status = 'APPROVED' }
const rejectRequest = (req: any) => { req.status = 'REJECTED' }
</script>

<template>
  <div class="animate-fade-in bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
    <div class="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
      <div>
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
          <i class="fas fa-clipboard-check text-slate-400"></i> Request Approvals
        </h3>
        <p class="text-xs text-slate-500 mt-1">Review and approve KPI changes requested by your team.</p>
      </div>
    </div>

    <table class="w-full text-left">
      <thead class="bg-white border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <tr>
          <th class="py-4 px-5 w-1/4">User</th>
          <th class="py-4 px-5">Request Detail</th>
          <th class="py-4 px-5 w-1/4">Reason</th>
          <th class="py-4 px-5 text-center">Status</th>
          <th class="py-4 px-5 text-right">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="req in props.requests" :key="req.id" class="hover:bg-slate-50 transition-colors cursor-pointer" @click="openRequestDetail(req)">
          <td class="py-4 px-5 align-top">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm">{{ req.avatar }}</div>
              <div>
                <p class="text-sm font-bold text-slate-800">{{ req.user }}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">{{ req.date }}</p>
              </div>
            </div>
          </td>
          <td class="py-4 px-5 align-top">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase border" :class="getRequestTypeColor(req.type)">
                {{ req.type.replace('_', ' ') }}
              </span>
            </div>
            <p class="text-xs font-bold text-slate-700 mb-1 line-clamp-1">{{ req.kpiName }}</p>
            <div class="flex items-center gap-2 text-xs">
              <span v-if="req.oldValue" class="text-slate-400 line-through">{{ req.oldValue }}</span>
              <i v-if="req.oldValue" class="fas fa-arrow-right text-[10px] text-slate-300"></i>
              <span class="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{{ req.newValue }}</span>
            </div>
          </td>
          <td class="py-4 px-5 align-top">
            <p class="text-xs text-slate-600 italic line-clamp-2" :title="req.reason">"{{ req.reason }}"</p>
          </td>
          <td class="py-4 px-5 text-center align-top">
             <span class="px-2.5 py-1 rounded text-[9px] font-bold uppercase border" :class="getRequestStatusColor(req.status)">{{ req.status }}</span>
          </td>
          <td class="py-4 px-5 text-right align-top">
            <div v-if="req.status === 'PENDING'" class="flex items-center justify-end gap-2">
              <button @click.stop="approveRequest(req)" class="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded shadow-sm transition-colors" title="Approve">
                <i class="fas fa-check text-xs"></i>
              </button>
              <button @click.stop="rejectRequest(req)" class="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded shadow-sm transition-colors" title="Reject">
                <i class="fas fa-times text-xs"></i>
              </button>
            </div>
            <button v-else @click.stop="openRequestDetail(req)" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors">
              View
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>