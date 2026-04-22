<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  kpi: { type: Object, default: null }
})
const emit = defineEmits(['close', 'save'])

const BSC_OPTIONS = [{ value: 'financial', label: '💰 Financial' }, { value: 'customer', label: '👥 Customer' }, { value: 'internal', label: '⚙️ Internal Process' }, { value: 'learning', label: '🎓 Learning & Growth' }]
const UNIT_OPTIONS = [{ value: 'MM', label: 'MM' }, { value: 'POINT', label: 'POINT' }, { value: 'PRODUCT', label: 'PRODUCT' }, { value: 'PROJECT', label: 'PROJECT' }, { value: 'CERTIFICATION', label: 'CERTIFICATION' }, { value: 'ARTICLE', label: 'ARTICLE' }, { value: 'PERSON', label: 'PERSON' }, { value: 'PERCENT', label: 'PERCENT (%)' }]
const evaluationYearOptions = [{ id: '2025', label: '2025' }, { id: '2026', label: '2026' }]
const KPI_CALCULATION_FORMULAS = [{ value: 'mean_by_ratio', label: 'Trung bình — theo tỉ lệ' }, { value: 'mean_by_aggregate', label: 'Trung bình — gộp (AVG / SUM)' }, { value: 'manual_member_input', label: 'Tự nhập — theo số member nhập' }]

const MEMBER_OPTIONS = [
  { val: 'E1', short: 'Tran Van Phuoc', label: 'Tran Van Phuoc (QA - R3)', dept: 'Quality Assurance', rank: 'R3', avatar: 'TP' },
  { val: 'E2', short: 'Le Thi D', label: 'Le Thi D (SD2 - R2)', dept: 'Software Dev 2', rank: 'R2', avatar: 'LD' },
  { val: 'E3', short: 'Nguyen Hoang E', label: 'Nguyen Hoang E (SD1 - R4)', dept: 'Software Dev 1', rank: 'R4', avatar: 'NE' },
  { val: 'E4', short: 'Vu Thi H', label: 'Vu Thi H (QA - R3)', dept: 'Quality Assurance', rank: 'R3', avatar: 'VH' },
  { val: 'E6', short: 'Ngo Quoc K', label: 'Ngo Quoc K (QA - R5)', dept: 'Quality Assurance', rank: 'R5', avatar: 'NK' }
]

const perspective = ref('internal'); const kpiName = ref(''); const kpiType = ref('cascading'); const isImportantKpi = ref(false)
const targetValue = ref(''); const weightPct = ref(''); const unit = ref('PERCENT'); const formCycleId = ref('2026')
const calculationMethod = ref('mean_by_ratio'); const meanRatioKind = ref('actual_plan'); const meanAggregateKind = ref('average'); const description = ref('')

const selectedMembers = ref<string[]>([]); const memberTargets = ref<Record<string, string>>({}); const memberAssignSearch = ref('')
const assignDropdown = ref<'member' | null>(null); const assignMemberSurfaceRef = ref<HTMLElement | null>(null)
const saving = ref(false); const formErrors = ref<Record<string, string>>({}); const errorBannerRef = ref<HTMLElement | null>(null)

const filteredMemberOptions = computed(() => {
  const q = memberAssignSearch.value.trim().toLowerCase()
  if (!q) return MEMBER_OPTIONS
  return MEMBER_OPTIONS.filter((m) => `${m.short} ${m.dept} ${m.rank} ${m.val} ${m.label}`.toLowerCase().includes(q))
})

function memberByVal(id: string) { return MEMBER_OPTIONS.find((m) => m.val === id) }
function typeCardClass(t: string) {
  const base = 'relative rounded-lg border p-3 text-left transition-all opacity-80 cursor-not-allowed'
  return kpiType.value === t ? (t === 'promotion' ? `${base} border-purple-500 bg-purple-50` : `${base} border-blue-500 bg-blue-50`) : `${base} border-slate-200 bg-slate-50`
}

function toggleMember(val: string) {
  const i = selectedMembers.value.indexOf(val)
  if (i === -1) { selectedMembers.value.push(val); memberTargets.value[val] = '' } 
  else { selectedMembers.value = selectedMembers.value.filter((v) => v !== val); delete memberTargets.value[val] }
}

function onDocClick(e: MouseEvent) {
  const t = e.target
  if (assignDropdown.value === 'member' && assignMemberSurfaceRef.value && !assignMemberSurfaceRef.value.contains(t as Node)) assignDropdown.value = null
}

watch(assignDropdown, (v) => { if (v !== 'member') memberAssignSearch.value = '' })
onUnmounted(() => { window.removeEventListener('click', onDocClick); document.body.style.overflow = '' })

watch(() => props.open, (isOpen) => {
  if (isOpen && props.kpi) {
    kpiName.value = `${props.kpi.code || ''} ${props.kpi.name || ''}`.trim()
    targetValue.value = props.kpi.target || ''; weightPct.value = props.kpi.weight?.toString() || ''; description.value = props.kpi.description || ''
    kpiType.value = props.kpi.isTree ? 'cascading' : 'individual'
    perspective.value = props.kpi.group === 'A' ? 'internal' : (props.kpi.group === 'B' ? 'learning' : 'customer')
    window.addEventListener('click', onDocClick)
  } else {
    window.removeEventListener('click', onDocClick)
  }
  document.body.style.overflow = isOpen ? 'hidden' : ''
}, { immediate: true })

async function save() {
  formErrors.value = {}
  if (selectedMembers.value.length === 0) formErrors.value.members = 'Vui lòng chọn ít nhất 1 thành viên.'
  else for (const mem of selectedMembers.value) if (!memberTargets.value[mem]) formErrors.value.targets = 'Vui lòng nhập target cho các thành viên.'
  
  if (Object.keys(formErrors.value).length > 0) { await nextTick(); errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return }
  
  saving.value = true
  await new Promise((r) => setTimeout(r, 500))
  saving.value = false
  emit('save', { sourceKpiId: props.kpi?.id, assignedMembers: selectedMembers.value, memberTargets: memberTargets.value })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="open && kpi" class="fixed inset-0 z-[100]" role="dialog">
        <div class="absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')" />

        <div class="drawer-panel absolute bottom-0 right-0 top-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:max-w-[700px] lg:max-w-[800px]">
          
          <div class="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-bold text-slate-800">
                <span class="rounded-lg bg-blue-100 p-1.5 text-blue-700 shadow-sm"><i class="fas fa-bullseye text-sm" /></span>
                Assign KPI Target
              </h2>
            </div>
            <button type="button" class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800" @click="$emit('close')">
              <i class="fas fa-times text-base" />
            </button>
          </div>

          <div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            <div v-if="Object.keys(formErrors).length > 0" ref="errorBannerRef" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-sm">
              <p class="mb-2 flex items-center gap-2 font-bold"><i class="fas fa-circle-exclamation text-rose-600" /> Lỗi:</p>
              <ul class="list-inside list-disc space-y-0.5 text-[11px] font-semibold text-rose-800"><li v-for="(msg, key) in formErrors" :key="key">{{ msg }}</li></ul>
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm opacity-90">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><span class="rounded-lg bg-slate-200 p-1.5 text-slate-500"><i class="fas fa-file-lines text-sm" /></span>Thông tin cơ bản</label>
              <div class="space-y-4 opacity-80 pointer-events-none">
                <div class="flex flex-col gap-3 sm:flex-row">
                  <div class="min-w-0 sm:flex-1"><label class="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">KPI Name</label><input disabled v-model="kpiName" type="text" class="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 outline-none" /></div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <label class="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-800"><span class="rounded-lg bg-indigo-100 p-1.5 text-indigo-600"><i class="fas fa-diagram-project text-sm" /></span>Phân bổ / Giao việc</label>
              <div>
                <label class="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Assign To Team Members <span class="text-rose-500">*</span></label>
                <div ref="assignMemberSurfaceRef" class="relative">
                  <button type="button" class="relative flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-left text-xs font-bold text-slate-700 transition-all hover:bg-white" @click.stop="assignDropdown = assignDropdown === 'member' ? null : 'member'">
                    <span v-if="selectedMembers.length === 0" class="w-full font-medium text-slate-400">Chọn thành viên...</span>
                    <span v-for="id in selectedMembers" :key="id" class="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 shadow-sm">
                      {{ memberByVal(id)?.short ?? id }}
                      <button type="button" class="rounded p-0.5 text-blue-600 hover:bg-blue-200/60" @click.stop="toggleMember(id)"><i class="fas fa-times text-[9px]" /></button>
                    </span>
                  </button>
                  <i class="fas fa-users absolute left-2.5 top-2.5 text-[10px] text-slate-400" />
                  <i class="fas fa-chevron-down absolute right-2.5 top-2.5 text-[10px] text-slate-400" />

                  <div v-show="assignDropdown === 'member'" class="absolute left-0 z-50 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" @click.stop>
                    <div class="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-slate-50 p-2" @click.stop>
                      <div class="relative">
                        <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400" />
                        <input v-model="memberAssignSearch" type="text" placeholder="Search..." class="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" @click.stop />
                      </div>
                    </div>
                    <div class="custom-scrollbar flex-1 overflow-y-auto p-1">
                      <label v-for="m in filteredMemberOptions" :key="m.val" class="group flex cursor-pointer items-center rounded-md border-b border-slate-50 px-3 py-2 hover:bg-slate-50">
                        <input type="checkbox" class="mr-3 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" :checked="selectedMembers.includes(m.val)" @change="toggleMember(m.val)" />
                        <div class="flex min-w-0 flex-1 items-center gap-3">
                          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{{ m.avatar }}</div>
                          <div class="flex-col"><span class="block text-sm font-bold text-slate-700 group-hover:text-blue-600">{{ m.short }}</span></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div v-if="selectedMembers.length > 0" class="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-inner">
                  <p class="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-800"><i class="fas fa-crosshairs text-[10px]" /> Set Targets</p>
                  <div v-for="mem in selectedMembers" :key="mem" class="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                    <span class="flex items-center gap-1.5 truncate text-[11px] font-bold text-slate-700 sm:w-1/2"><i class="fas fa-user text-[10px] text-slate-400" />{{ memberByVal(mem)?.label ?? mem }}</span>
                    <div class="flex items-center gap-2 sm:w-1/2">
                      <input v-model="memberTargets[mem]" type="text" placeholder="Target..." class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                      <span class="text-[10px] font-bold text-slate-400">{{ unit }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-5 shadow-sm">
            <button type="button" class="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-100" @click="$emit('close')">Cancel</button>
            <button type="button" class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60" :disabled="saving" @click="save"><i v-if="saving" class="fas fa-spinner fa-spin text-sm" /><i v-else class="fas fa-save text-sm" />{{ saving ? 'Saving...' : 'Assign Members' }}</button>
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
.custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { border-radius: 4px; background-color: #e2e8f0; }
</style>