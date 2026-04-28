<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import EvaluationCommentBlock from '@/components/evaluation/EvaluationCommentBlock.vue'
import EvaluationEvidenceDrawer from '@/components/evaluation/EvaluationEvidenceDrawer.vue'
import { getSubmitButtonState } from '@/utils/common'
import { KPI_STATUS } from '@/config/constants'
import { useToast } from 'vue-toastification'

const toast = useToast()

const emit = defineEmits(['open-assign', 'open-member-detail'])

const KPI_TYPE_UI: Record<string, { label: string, badgeClass: string, icon: string }> = {
  cascading: { label: 'Cascading', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fas fa-code-branch' },
  individual: { label: 'Individual', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'fas fa-crosshairs' },
  promotion: { label: 'Promotion', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fas fa-user-plus' },
}

const personalKpisRaw = ref<any[]>([])
const kpiCycleInfo = ref<any>(null)

async function loadPmPortfolio(cycleId?: string) {
  try {
    const data:any = await pmKpiService.getInitialization(cycleId)
    
    // Map backend Enums sang UI String
    const typeMap: Record<number, string> = { 101: 'individual', 102: 'cascading', 103: 'promotion' }
    const statusMap: Record<number, string> = { 401: 'draft', 402: 'pending_approval', 403: 'pending_approval', 404: 'pending_approval', 405: 'approved' }

    // Map KpiGroupDto -> UI shape
    personalKpisRaw.value = (data.kpis ?? []).map((kpi: any) => ({
      id: String(kpi.id),
      infoId: String(kpi.infoId),
      group: kpi.group || 'Khác', // Dùng luôn tên group BE trả về (vd: "A - Hiệu quả công việc...")
      code: kpi.code,
      kpiType: typeMap[kpi.kpiType] || 'individual',
      isImportant: kpi.isImportant,
      // Lấy tạm status của con đầu tiên làm status cha để phục vụ filter
      status: kpi.children?.length ? (statusMap[kpi.children[0].statusCode] || 'pending_approval') : 'pending_approval',
      name: kpi.name,
      target: kpi.target,
      actualResult: '', // Parent không có actualResult
      weight: kpi.weight,
      statusCode: kpi.statusCode,
      selfScore: null,
      pmScore: null,
      isTree: kpi.isTree,
      expanded: kpi.expanded !== undefined ? kpi.expanded : true,
      children: (kpi.children || []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        role: c.role || 'Member',
        // Tự động generate Avatar từ 2 chữ cái đầu của tên
        avatar: c.name ? c.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U',
        target: c.targetValue != null ? String(c.targetValue) : '',
        actualResult: c.actualResult || '',
        selfScore: c.selfScore != null ? Number(c.selfScore) : null,
        pmScore: c.pmScore != null ? Number(c.pmScore) : null,
        status: statusMap[c.statusCode] || 'pending_approval'
      }))
    }))
    
    kpiCycleInfo.value = data.kpiCycle
  } catch (err) {
    console.error('Failed to load PM portfolio', err)
  }
}

// --- LOGIC FILTER ---
const filterMember = ref('')
const filterImportant = ref<'' | 'yes' | 'no'>('')
const filterStatus = ref('')
const draftMember = ref('')
const draftImportant = ref<'' | 'yes' | 'no'>('')
const draftStatus = ref('')

const filterPopoverOpen = ref(false)
const filterPopoverWrapRef = ref<HTMLElement | null>(null)
const filterPanelFixedStyle = ref<Record<string, string>>({})

const currentStatusCode = computed(() => {
  const firstKpi = personalKpisRaw.value?.[0]?.statusCode;
  return firstKpi ?? KPI_STATUS.INACTIVE; 
});

const buttonState = computed(() => {
  if (!kpiCycleInfo.value) {
    return {
      show: false,
      disabled: true,
      text: null,
      actionType: 'COMPLETED'
    };
  }

  return getSubmitButtonState(kpiCycleInfo.value, currentStatusCode.value);
});
console.log("🚀 ~ buttonState:", buttonState.value)

const diagnosticsMemberOptions = computed(() => {
  const set = new Set<string>()
  personalKpisRaw.value.forEach(kpi => kpi.children?.forEach((c: any) => set.add(c.name)))
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'))
})

function updateFilterPanelPosition() {
  const wrap = filterPopoverWrapRef.value
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  const w = 320
  filterPanelFixedStyle.value = { top: `${r.bottom + 8}px`, left: `${Math.max(8, r.right - w)}px`, width: `${w}px` }
}

async function toggleFilterPopover() {
  if (filterPopoverOpen.value) { filterPopoverOpen.value = false } 
  else {
    draftMember.value = filterMember.value; draftImportant.value = filterImportant.value; draftStatus.value = filterStatus.value;
    filterPopoverOpen.value = true; await nextTick(); updateFilterPanelPosition()
  }
}

function applyPopoverFilters() { filterMember.value = draftMember.value; filterImportant.value = draftImportant.value; filterStatus.value = draftStatus.value; filterPopoverOpen.value = false; }
function cancelFilterPopover() { filterPopoverOpen.value = false }
function resetAllDiagnosticFilters() { filterMember.value = ''; filterImportant.value = ''; filterStatus.value = ''; filterPopoverOpen.value = false }

const activeFilterChips = computed(() => {
  const chips = []
  if (filterMember.value) chips.push({ key: 'member', label: `Thành viên: ${filterMember.value}` })
  if (filterImportant.value === 'yes') chips.push({ key: 'important', label: 'KPI quan trọng' })
  if (filterImportant.value === 'no') chips.push({ key: 'important', label: 'Không gắn sao' })
  if (filterStatus.value) chips.push({ key: 'status', label: `Trạng thái: ${filterStatus.value === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}` })
  return chips
})

function removeAppliedFilterChip(key: string) {
  if (key === 'member') filterMember.value = ''
  else if (key === 'important') filterImportant.value = ''
  else filterStatus.value = ''
}

onMounted(() => { window.addEventListener('resize', updateFilterPanelPosition); window.addEventListener('scroll', updateFilterPanelPosition, true) })
onUnmounted(() => { window.removeEventListener('resize', updateFilterPanelPosition); window.removeEventListener('scroll', updateFilterPanelPosition, true) })

onMounted(() => { loadPmPortfolio(String(new Date().getFullYear())) })

const groupedPersonalKpis = computed(() => {
  const filtered = personalKpisRaw.value.filter(kpi => {
    if (filterImportant.value === 'yes' && !kpi.isImportant) return false
    if (filterImportant.value === 'no' && kpi.isImportant) return false
    if (filterStatus.value && kpi.status !== filterStatus.value) return false
    if (filterMember.value && !kpi.children?.some((c: any) => c.name === filterMember.value)) return false
    return true
  })
  
  // Tự động gom nhóm dựa trên key "group" (vd: "A - Hiệu quả công việc...")
  const groups = filtered.reduce((acc: any, item: any) => { 
    (acc[item.group] ??= []).push(item); 
    return acc; 
  }, {});
  
  // Sắp xếp tự động để A nằm trước B, B nằm trước C
  return Object.keys(groups).sort().map(key => ({ 
    key, 
    label: key, // Dùng luôn tên làm label
    items: groups[key] || [] 
  }));
})

const pmComments = ref({ selfComment: '', supervisorComment: '' })
const evidencePanelOpen = ref(false)
const selectedKpiItem = ref<any>(null)

const openEvidenceDrawer = (item: any) => { selectedKpiItem.value = item; evidencePanelOpen.value = true; }
const saveEvidenceData = (data: any) => { 
  const itemToUpdate = personalKpisRaw.value.find(k => k.id === data.id)
  if (itemToUpdate) { itemToUpdate.actualResult = data.actualResult; itemToUpdate.selfScore = data.selfScore }
  evidencePanelOpen.value = false; 
}
  
const handleSubmitClick = async () => {
  let nextStatusCode: number = KPI_STATUS.PENDING_ACCEPTANCE;
  if (buttonState.value.actionType === 'GOAL_SETTING') {
    nextStatusCode = KPI_STATUS.ACCEPTED;
  } else if (buttonState.value.actionType === 'MID_YEAR') {
    nextStatusCode = KPI_STATUS.FIRST_WAITING_GM_APPROVAL;
  } else if (buttonState.value.actionType === 'END_YEAR') {
    nextStatusCode = KPI_STATUS.SECOND_WAITING_GM_APPROVAL;
  }

  pmKpiService.bulkUpdateKpiStatus({
    cycleId: kpiCycleInfo.value?.id,
    statusCode: nextStatusCode
  }).then(() => {
    toast.success('Update KPI statuses successfully!');
    loadPmPortfolio(String(new Date().getFullYear()))
  }).catch(err => {
    console.error('Failed to update KPI statuses', err)
  })
}
</script>

<template>
  <div class="animate-fade-in flex flex-col relative">
    
    <div class="flex flex-col gap-3 border-b border-slate-200 p-5 shrink-0">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2"><i class="fas fa-list-alt text-slate-400"></i> KPI Portfolio</h3>

        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button @click.stop="resetAllDiagnosticFilters" class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
            <i class="fas fa-rotate-left text-[11px]" /> Reset Filter
          </button>

          <div ref="filterPopoverWrapRef" class="relative">
            <button @click.stop="toggleFilterPopover" class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
              <i class="fas fa-sliders-h text-sm text-slate-500" /> Bộ lọc
              <span v-if="activeFilterChips.length > 0" class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">{{ activeFilterChips.length }}</span>
            </button>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <Transition name="gm-diag-filter-pop">
          <div v-if="filterPopoverOpen" ref="filterPopoverPanelRef" class="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" :style="filterPanelFixedStyle">
            <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5">
              <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Tùy chỉnh hiển thị</h4>
            </div>
            <div class="custom-scrollbar space-y-4 overflow-y-auto p-4">
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Thành viên</label>
                <select v-model="draftMember" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"><option value="">Tất cả</option><option v-for="n in diagnosticsMemberOptions" :key="n" :value="n">{{ n }}</option></select>
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Mức độ quan trọng</label>
                <select v-model="draftImportant" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-500"><option value="">Tất cả</option><option value="yes">Chỉ KPI quan trọng</option><option value="no">KPI thường</option></select>
              </div>
              <div>
                <label class="mb-1.5 block text-[10px] font-bold text-slate-500">Trạng thái KPI</label>
                <select v-model="draftStatus" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"><option value="">Tất cả</option><option value="approved">Đã duyệt</option><option value="pending_approval">Chờ duyệt</option></select>
              </div>
            </div>
            <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <button @click="cancelFilterPopover" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60">Huỷ</button>
              <button @click="applyPopoverFilters" class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700">Áp dụng</button>
            </div>
          </div>
        </Transition>
      </Teleport>
      
      <div v-if="activeFilterChips.length > 0" class="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
        <span class="mt-1.5 text-[10px] font-bold uppercase text-slate-400">Đang lọc:</span>
        <div class="flex flex-wrap gap-2">
          <span v-for="chip in activeFilterChips" :key="chip.key" class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">{{ chip.label }} <button @click="removeAppliedFilterChip(chip.key)" class="ml-0.5 text-blue-400 hover:text-blue-900"><i class="fas fa-times text-[10px]" /></button></span>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="w-full text-left">
        <thead class="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
          <tr>
            <th class="py-4 px-5 w-12 text-center">STT</th>
            <th class="py-4 px-5 min-w-[280px]">Hạng Mục (Objectives)</th>
            <th class="py-4 px-5 min-w-[150px]">Chỉ Tiêu (Target)</th>
            <th class="py-4 px-5 min-w-[150px]">Thực tế (Actual)</th>
            <th class="py-4 px-5 text-center w-24">W(%)</th>
            <th class="py-4 px-5 text-center w-28 border-x border-slate-100">Self Score</th>
            <th class="py-4 px-5 text-center w-28">Supervisor Score</th>
            <th class="py-4 px-5 text-right min-w-[140px]">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <template v-for="groupData in groupedPersonalKpis" :key="groupData.key">
            <tr class="bg-amber-50/80 border-y border-amber-100"><td colspan="8" class="py-2.5 px-5 text-xs font-bold text-amber-800 uppercase">{{ groupData.label }}</td></tr>
            <template v-for="(item, idx) in groupData.items" :key="item.id">
              <tr class="hover:bg-slate-50 cursor-pointer group" @click="item.isTree ? item.expanded = !item.expanded : null">
                <td class="py-4 px-5 text-center align-top pt-5"><span class="text-sm font-semibold text-slate-400">{{ idx + 1 }}</span></td>
                <td class="py-4 px-5 align-top pt-4">
                  <div class="flex items-start gap-2.5">
                    <button v-if="item.isTree" class="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 border border-slate-200"><i class="fas text-[10px]" :class="item.expanded ? 'fa-chevron-down' : 'fa-chevron-right'"></i></button>
                    <div v-else class="w-5 h-5 shrink-0"></div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-bold text-slate-900 text-sm">{{ item.code }} {{ item.name }}</p>
                      <div v-if="KPI_TYPE_UI[item.kpiType]" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 shadow-sm" :class="KPI_TYPE_UI[item.kpiType].badgeClass"><i :class="KPI_TYPE_UI[item.kpiType].icon" class="text-[10px]"></i></div>
                      <i v-if="item.isImportant" class="fas fa-star text-amber-400 text-xs" title="KPI Quan trọng"></i>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-5 align-top pt-4"><p class="text-sm font-medium text-slate-700">{{ item.target }}</p></td>
                
                <td class="py-4 px-5 align-top pt-4"><p class="text-sm font-bold text-emerald-600">{{ item.actualResult || 'Chưa cập nhật' }}</p></td>
                
                <td class="py-4 px-5 text-center align-top pt-4"><span class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md">{{ item.weight }}</span></td>
                <td class="py-4 px-5 text-center bg-blue-50/20 align-top pt-4 border-x border-slate-100"><span class="text-sm font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span></td>
                <td class="py-4 px-5 text-center align-top pt-4"><span class="text-slate-400 font-medium text-sm">{{ item.pmScore ?? '-' }}</span></td>
                <td class="py-4 px-5 text-right align-top pt-4">
                    <div class="flex items-center justify-end gap-2">
                      <button @click.stop="openEvidenceDrawer(item)" class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm"><i class="fas fa-pen text-xs"></i> Edit</button>
                      <button v-if="item.isTree" @click.stop="$emit('open-assign', item)" class="flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-[10px] font-bold text-purple-700 hover:bg-purple-100 shadow-sm"><i class="fas fa-user-plus text-xs"></i> Assign</button>
                    </div>
                </td>
              </tr>
              <template v-if="item.isTree && item.expanded && item.children">
                <tr v-for="child in item.children" :key="child.id" class="bg-slate-50/70 hover:bg-slate-100 transition-colors">
                  <td class="py-3 px-5"></td>
                  <td class="py-3 px-5 relative">
                    <div class="absolute left-[30px] top-0 bottom-0 w-px bg-purple-200"></div><div class="absolute left-[30px] top-1/2 w-4 h-px bg-purple-200"></div>
                    <div class="flex items-center gap-2 pl-[46px]">
                      <div class="w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center text-[9px] font-bold text-slate-600">{{ child.avatar }}</div>
                      <div><p class="text-xs font-bold text-slate-800">{{ child.name }}</p><p class="text-[9px] text-slate-500 uppercase">{{ child.role }}</p></div>
                    </div>
                  </td>
                  <td class="py-3 px-5"><p class="text-xs font-medium text-slate-700">{{ child.target }}</p></td>
                  <td class="py-3 px-5"><p class="text-xs font-semibold text-emerald-600">{{ child.actualResult || '-' }}</p></td>
                  <td class="py-3 px-5 text-center text-slate-400 font-bold">-</td>
                  <td class="py-3 px-5 text-center bg-blue-50/10 border-x border-slate-100"><span class="text-xs font-bold text-slate-600">{{ child.selfScore ?? '-' }}</span></td>
                  <td class="py-3 px-5 text-center"><span class="text-xs font-bold text-purple-700">{{ child.pmScore ?? '-' }}</span></td>
                  <td class="py-3 px-5 text-right"><button @click.stop="$emit('open-member-detail', { child, parent: item })" class="inline-flex h-7 items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-bold text-blue-600 shadow-sm"><i class="far fa-eye text-[10px]"></i> Detail</button></td>
                </tr>
              </template>
            </template>
          </template>
        </tbody>
        
        <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
          <tr>
            <td colspan="4" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">Tổng cộng (Total score):</td>
            <td class="py-4 px-5 text-center"><span class="text-sm text-slate-800">100</span><span class="text-[10px] text-slate-500 font-medium ml-1">pts</span></td>
            <td class="py-4 px-5 text-center text-slate-500 text-sm border-x border-slate-100">12.5</td>
            <td class="py-4 px-5 text-center text-slate-500 text-sm">-</td>
            <td class="py-4 px-5"></td>
          </tr>
          <tr class="bg-violet-50/50 border-t border-slate-200">
            <td colspan="4" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">Điểm trung bình (Average score):</td>
            <td class="py-4 px-5"></td>
            <td class="py-4 px-5 text-center bg-violet-100/80 border-x border-violet-200"><span class="text-lg text-violet-700 font-extrabold">4.2</span></td>
            <td class="py-4 px-5 text-center text-slate-500 text-sm">-</td>
            <td class="py-4 px-5"></td>
          </tr>
        </tfoot>

      </table>
    </div>

    <EvaluationCommentBlock 
      v-model:employeeComment="pmComments.selfComment"
      v-model:managerComment="pmComments.supervisorComment"
      employeeTitle="My Comment"
      managerTitle="Supervisor Comment"
      :employeeReadonly="false"
      :managerReadonly="true"
    />
    <div class="mt-6 mb-8 flex justify-center">
      <button type="button"
        v-if="buttonState.show"
        :disabled="buttonState.disabled"
        @click="handleSubmitClick"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900">
        <i class="fas fa-paper-plane text-sm" /> {{ buttonState.text }}
      </button>
    </div>
    <EvaluationEvidenceDrawer :open="evidencePanelOpen" :item="selectedKpiItem" @close="evidencePanelOpen = false" @save="saveEvidenceData" />
  </div>
</template>

<style scoped>
.gm-diag-filter-pop-enter-active, .gm-diag-filter-pop-leave-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.gm-diag-filter-pop-enter-from, .gm-diag-filter-pop-leave-to { opacity: 0; transform: scale(0.95); }
.gm-diag-filter-pop-enter-to, .gm-diag-filter-pop-leave-from { opacity: 1; transform: scale(1); }
</style>