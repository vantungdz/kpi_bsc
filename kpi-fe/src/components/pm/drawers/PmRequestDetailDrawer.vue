<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  request: { type: Object, default: null }
})
const emit = defineEmits(['close'])

watch(() => props.open, (val) => { document.body.style.overflow = val ? 'hidden' : '' })
onUnmounted(() => { document.body.style.overflow = '' })

const handleApprove = () => { emit('close') }
const handleReject = () => { emit('close') }
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="open && request" class="fixed inset-0 z-[100] flex justify-end">
        <div class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm" @click="emit('close')" />
        
        <div class="drawer-panel relative flex h-full w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:w-[500px] lg:w-[600px]">
          
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800"><span class="rounded-lg bg-orange-100 p-1.5 text-orange-600 shadow-sm"><i class="fas fa-inbox text-sm"></i></span>Request Approval</h2>
            </div>
            <button type="button" @click="emit('close')" class="rounded-full p-2 text-slate-400 hover:bg-slate-100"><i class="fas fa-times text-base"></i></button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div class="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div class="w-12 h-12 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg">{{ request.avatar }}</div>
              <div><p class="font-bold text-slate-800 text-base">{{ request.user }}</p><p class="text-xs font-semibold text-slate-500 uppercase">Submitted a request</p></div>
            </div>

            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Thông tin thay đổi</h4>
              <div class="space-y-4">
                <div><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Loại Request</p><p class="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">{{ request.type }}</p></div>
                <div><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">KPI Name</p><p class="text-sm font-bold text-slate-800">{{ request.kpiName }}</p></div>
                <div class="grid grid-cols-2 gap-4 pt-2">
                  <div class="bg-slate-50 p-3 rounded-lg border border-slate-100"><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Old Target</p><p class="text-sm font-semibold text-slate-600 line-through">{{ request.oldValue || 'None' }}</p></div>
                  <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100"><p class="text-[10px] font-bold text-emerald-600 uppercase mb-1">New Target</p><p class="text-sm font-bold text-emerald-700">{{ request.newValue }}</p></div>
                </div>
              </div>
            </div>

            <div class="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm">
              <h4 class="text-xs font-bold text-orange-800 uppercase mb-2 flex items-center gap-2"><i class="fas fa-comment-alt"></i> Reason / Justification</h4>
              <p class="text-sm text-orange-900 leading-relaxed font-medium">{{ request.reason }}</p>
            </div>
          </div>

          <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-4 shadow-sm">
            <button @click="handleReject" class="rounded-lg border border-rose-200 bg-rose-50 px-6 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">Reject</button>
            <button @click="handleApprove" class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-700"><i class="fas fa-check text-sm"></i> Approve</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: opacity 0.3s ease; }
.drawer-slide-enter-active .drawer-panel, .drawer-slide-leave-active .drawer-panel { transition: transform 0.3s ease-in-out; }
.drawer-slide-enter-from, .drawer-slide-leave-to { opacity: 0; }
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel { transform: translateX(100%); }
</style>