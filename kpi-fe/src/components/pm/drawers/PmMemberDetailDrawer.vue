<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null }
})

const emit = defineEmits(['close', 'save'])

watch(() => props.open, (val) => { document.body.style.overflow = val ? 'hidden' : '' })
onUnmounted(() => { document.body.style.overflow = '' })

const groupLabels: Record<string, string> = {
  A: '(A) Core Operations & Technical Excellence',
  B: '(B) People Development & Knowledge Sharing',
  C: '(C) Strategic Management & Governance'
}

// STATE & DATA DUMMY CHO MEMBER'S KPIS
const memberKpis = ref([
  {
    id: 'kpi-1', group: 'A', code: 'A.1', kpiType: 'cascading',
    name: 'Phát triển & Tích hợp Payment Gateway', 
    target: 'Hoàn thành 100% tích hợp VNPAY & Momo', 
    actualResult: 'Đã hoàn thành và deploy môi trường Staging',
    weight: 40, selfScore: 5, pmScore: null as number | null, 
    calcMode: 'average',
    evidenceData: [
       { content: 'Nghiên cứu tài liệu API và luồng xử lý của VNPAY/Momo', plan: '2 days', actual: '1.5 days' },
       { content: 'Code chức năng tạo giao dịch & xử lý Webhook/IPN', plan: '4 days', actual: '4 days' },
       { content: 'Viết Unit Test (Coverage > 80%) & Fix bug nội bộ', plan: '2 days', actual: '1.5 days' }
    ]
  },
  {
    id: 'kpi-2', group: 'A', code: 'A.2', kpiType: 'individual',
    name: 'Tối ưu hóa query Database', 
    target: 'Giảm thời gian phản hồi API trung bình < 200ms', 
    actualResult: 'API response time ~150ms',
    weight: 30, selfScore: 4, pmScore: null, 
    calcMode: 'sum',
    evidenceData: [
       { content: 'Đánh index cho các bảng dữ liệu Transactions lớn', actual: 'Đã hoàn thành' },
       { content: 'Refactor N+1 queries trong module Report Export', actual: 'Đã refactor xong' }
    ]
  },
  {
    id: 'kpi-3', group: 'B', code: 'B.1', kpiType: 'individual',
    name: 'Đào tạo nội bộ (Knowledge Sharing)', 
    target: 'Trình bày 2 buổi seminar', 
    actualResult: 'Đã trình bày 2 buổi về Docker cơ bản',
    weight: 30, selfScore: 5, pmScore: null, 
    calcMode: 'sum',
    evidenceData: [
       { content: 'Slide thuyết trình Seminar Docker 1', actual: 'Link Drive đính kèm' },
       { content: 'Slide thuyết trình Seminar Docker 2', actual: 'Link Drive đính kèm' }
    ]
  }
])

const groupedMemberKpis = computed(() => {
  const groups = memberKpis.value.reduce((acc: any, item: any) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return ['A', 'B', 'C'].map(key => ({
    key, label: groupLabels[key], items: groups[key] || []
  })).filter(g => g.items.length > 0);
})

const reviewComments = ref({
  memberComment: 'Kỳ này em đã nỗ lực hoàn thành tốt các task tích hợp khó, tuy nhiên việc optimize DB vẫn cần học hỏi thêm.',
  pmComment: ''
})

const expandedEvidenceRows = ref(new Set<string>())
function toggleEvidence(id: string) {
  const s = new Set(expandedEvidenceRows.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedEvidenceRows.value = s
}

const saving = ref(false)
const saveEvaluation = async () => {
  saving.value = true
  await new Promise((r) => setTimeout(r, 600))
  saving.value = false
  emit('save', { kpis: memberKpis.value, comments: reviewComments.value })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="open && member" class="fixed inset-0 z-[100] flex justify-end">
        <div class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm" @click="emit('close')" />
        
        <div class="drawer-panel relative flex h-full w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl lg:w-[900px] xl:w-[1000px]">
          
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-lg shadow-inner">
                {{ member.avatar || member.name.charAt(0) }}
              </div>
              <div>
                <h2 class="text-base font-bold text-slate-800 tracking-tight leading-tight">Đánh giá KPI: {{ member.name }}</h2>
                <p class="text-xs font-semibold text-slate-500 uppercase mt-0.5">{{ member.role || member.rank }}</p>
              </div>
            </div>
            <button @click="emit('close')" class="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition-colors"><i class="fas fa-times text-base" /></button>
          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto">
            <div class="bg-white border-b border-slate-200">
              <table class="w-full text-left">
                <thead class="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 z-10">
                  <tr>
                    <th class="py-3 px-4 w-10 text-center">#</th>
                    <th class="py-3 px-4 min-w-[200px]">Hạng Mục</th>
                    <th class="py-3 px-4 w-48">Chỉ Tiêu (Target)</th>
                    <th class="py-3 px-4 w-48">Thực tế (Actual)</th>
                    <th class="py-3 px-4 text-center w-16">W(%)</th>
                    <th class="py-3 px-4 text-center w-24">Self Score</th>
                    <th class="py-3 px-4 text-center w-24 bg-blue-50/50">PM Score</th>
                    <th class="py-3 px-4 text-right w-24">Evidences</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="groupData in groupedMemberKpis" :key="groupData.key">
                    
                    <tr class="bg-amber-50/80 border-y border-amber-100">
                      <td colspan="8" class="py-2 px-4 text-[11px] font-bold text-amber-800 uppercase tracking-wider">{{ groupData.label }}</td>
                    </tr>

                    <template v-for="(item, idx) in groupData.items" :key="item.id">
                      <tr class="hover:bg-slate-50 transition-colors cursor-pointer group" @click="toggleEvidence(item.id)">
                        <td class="py-3 px-4 text-center align-top pt-4"><span class="text-xs font-semibold text-slate-400">{{ idx + 1 }}</span></td>
                        
                        <td class="py-3 px-4 align-top pt-3">
                          <p class="font-bold text-slate-800 text-xs leading-snug group-hover:text-indigo-600 transition-colors">{{ item.code }} {{ item.name }}</p>
                          <span class="mt-1 inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">{{ item.kpiType }}</span>
                        </td>
                        
                        <td class="py-3 px-4 align-top pt-3"><p class="text-xs font-medium text-slate-600 line-clamp-3">{{ item.target }}</p></td>
                        
                        <td class="py-3 px-4 align-top pt-3"><p class="text-xs font-bold text-emerald-600 line-clamp-3">{{ item.actualResult }}</p></td>
                        
                        <td class="py-3 px-4 text-center align-top pt-3"><span class="px-2 py-0.5 bg-slate-100 font-bold text-xs rounded border border-slate-200">{{ item.weight }}</span></td>
                        <td class="py-3 px-4 text-center align-top pt-3"><span class="text-xs font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span></td>
                        
                        <td class="py-3 px-4 text-center align-top bg-blue-50/20 pt-2.5">
                          <select v-model="item.pmScore" @click.stop class="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center">
                            <option :value="null">-</option><option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                          </select>
                        </td>
                        
                        <td class="py-3 px-4 text-right align-top pt-3">
                          <div class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                            Evidences <i class="fas transition-transform" :class="expandedEvidenceRows.has(item.id) ? 'fa-chevron-up text-indigo-600' : 'fa-chevron-down'" />
                          </div>
                        </td>
                      </tr>

                      <tr v-if="expandedEvidenceRows.has(item.id)" class="bg-slate-50/50">
                        <td colspan="8" class="p-0 border-b border-slate-200">
                          <div class="px-8 py-4 bg-gradient-to-r from-indigo-50/30 to-transparent border-l-2 border-indigo-300">
                            <div class="overflow-x-auto rounded-lg border border-indigo-100 shadow-sm bg-white">
                              <table class="w-full text-left text-xs">
                                <thead class="bg-indigo-50 text-indigo-800 uppercase tracking-wider text-[10px] font-bold">
                                  <tr>
                                    <th class="px-3 py-2 text-center" :class="item.calcMode !== 'sum' ? 'w-3/5' : 'w-2/3'">Content</th>
                                    <th v-if="item.calcMode !== 'sum'" class="px-3 py-2 text-center w-1/5 border-l border-indigo-100/60">Plan</th>
                                    <th class="px-3 py-2 text-center border-l border-indigo-100/60" :class="item.calcMode !== 'sum' ? 'w-1/5' : 'w-1/3'">Actual</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                  <tr v-for="(ev, eIdx) in item.evidenceData" :key="eIdx" class="hover:bg-slate-50 transition-colors">
                                    <td class="px-3 py-2.5 font-medium text-slate-800 leading-snug">{{ ev.content }}</td>
                                    <td v-if="item.calcMode !== 'sum'" class="px-3 py-2.5 text-center text-slate-600 border-l border-slate-100">{{ ev.plan }}</td>
                                    <td class="px-3 py-2.5 text-center font-bold text-emerald-600 border-l border-slate-100">{{ ev.actual }}</td>
                                  </tr>
                                  <tr v-if="!item.evidenceData || item.evidenceData.length === 0">
                                    <td :colspan="item.calcMode === 'sum' ? 2 : 3" class="px-3 py-3 text-center text-slate-400 font-medium italic">Không có dữ liệu khai báo chi tiết.</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>

                    </template>
                  </template>
                </tbody>
              </table>
            </div>

            <div class="p-6 bg-slate-50/50">
              <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><i class="fas fa-comments text-blue-600"></i> General Comments</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nhân viên tự đánh giá</label>
                  <textarea readonly :value="reviewComments.memberComment" class="w-full h-24 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none resize-none cursor-not-allowed shadow-inner"></textarea>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PM Nhận xét (Tới GM) <span class="text-rose-500">*</span></label>
                  <textarea v-model="reviewComments.pmComment" placeholder="Nhập đánh giá và nhận xét của bạn về nhân viên này..." class="w-full h-24 p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-100 outline-none resize-none shadow-sm focus:border-blue-400"></textarea>
                </div>
              </div>
            </div>

          </div>

          <div class="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-4 shadow-sm z-10">
            <button @click="emit('close')" class="rounded-lg border border-slate-200 bg-white px-6 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">Hủy</button>
            <button @click="saveEvaluation" :disabled="saving" class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-900 transition-colors disabled:opacity-60">
              <i v-if="saving" class="fas fa-spinner fa-spin text-sm" />
              <i v-else class="fas fa-save text-sm" />
              {{ saving ? 'Đang lưu...' : 'Lưu đánh giá' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: opacity 0.3s ease; }
.drawer-slide-enter-active .drawer-panel, .drawer-slide-leave-active .drawer-panel { transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
.drawer-slide-enter-from, .drawer-slide-leave-to { opacity: 0; }
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel { transform: translateX(100%); }
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>