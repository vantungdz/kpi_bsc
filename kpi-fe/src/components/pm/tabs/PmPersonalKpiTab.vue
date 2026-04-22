<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import EvaluationCommentBlock from '@/components/evaluation/EvaluationCommentBlock.vue'
import EvaluationEvidenceDrawer from '@/components/evaluation/EvaluationEvidenceDrawer.vue'

const emit = defineEmits(['open-assign', 'open-member-detail'])

const groupLabels: Record<string, string> = {
  A: '(A) Core Operations & Technical Excellence',
  B: '(B) People Development & Knowledge Sharing',
  C: '(C) Strategic Management & Governance'
}

const KPI_TYPE_UI: Record<string, { label: string, badgeClass: string, icon: string }> = {
  cascading: { label: 'Cascading', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fas fa-code-branch' },
  individual: { label: 'Individual', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'fas fa-crosshairs' },
  promotion: { label: 'Promotion', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fas fa-user-plus' },
}

const personalKpisRaw = ref([
    {
      id: 'kpi-1', group: 'A', code: 'A.1', kpiType: 'cascading', isImportant: true, status: 'approved',
      name: 'System Performance Optimization', target: '99.9% Uptime', actualResult: '99.5% Uptime', weight: 35, selfScore: 4, pmScore: null, isTree: true, expanded: true,
      children: [{ id: 'c1', name: 'Peter Park', role: 'DevOps', avatar: 'PP', target: 'Zero P0 Bugs', actualResult: 'Fixed 5/5', selfScore: 4.5, pmScore: null, status: 'approved' }]
    },
    {
      id: 'kpi-2', group: 'B', code: 'B.1', kpiType: 'individual', isImportant: false, status: 'approved',
      name: 'Internal Talent Upskilling', target: '4 Workshop Sessions', actualResult: '4 Sessions', weight: 25, selfScore: 5, pmScore: 5, isTree: false, expanded: false,
      children: []
    },
    {
      id: 'kpi-3', group: 'C', code: 'C.1', kpiType: 'cascading', isImportant: false, status: 'pending_approval',
      name: 'Project Delivery Excellence', target: 'Delivery Rate >= 95%', actualResult: '1 minor delay', weight: 40, selfScore: 3.5, pmScore: null, isTree: true, expanded: true,
      children: [
          { id: 'c2', name: 'John Doe', role: 'Senior Dev', avatar: 'JD', target: 'API Docs', actualResult: '100% done', selfScore: 5.0, pmScore: null, status: 'approved' },
          { id: 'c3', name: 'Anna Smith', role: 'Backend', avatar: 'AS', target: 'Refactor Payment', actualResult: 'Coverage 65%', selfScore: 3.5, pmScore: null, status: 'pending_approval' }
      ]
    }
]);

// --- LOGIC FILTER ---
const filterMember = ref('')
const filterImportant = ref<'' | 'yes' | 'no'>('')
const filterStatus = ref('')
const draftMember = ref('')
const draftImportant = ref<'' | 'yes' | 'no'>('')
const draftStatus = ref('')

const filterPopoverOpen = ref(false)
const filterPopoverWrapRef = ref<HTMLElement | null>(null)
const filterPopoverPanelRef = ref<HTMLElement | null>(null)
const filterPanelFixedStyle = ref<Record<string, string>>({})

const diagnosticsMemberOptions = computed(() => {
  const set = new Set<string>()
  personalKpisRaw.value.forEach(kpi => kpi.children?.forEach(c => set.add(c.name)))
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
  if (filterStatus.value) chips.push({ key: 'status', label: `Trạng thái: ${filterStatus.value}` })
  return chips
})

function removeAppliedFilterChip(key: string) {
  if (key === 'member') filterMember.value = ''
  else if (key === 'important') filterImportant.value = ''
  else filterStatus.value = ''
}

onMounted(() => { window.addEventListener('resize', updateFilterPanelPosition); window.addEventListener('scroll', updateFilterPanelPosition, true) })
onUnmounted(() => { window.removeEventListener('resize', updateFilterPanelPosition); window.removeEventListener('scroll', updateFilterPanelPosition, true) })

const groupedPersonalKpis = computed(() => {
  const filtered = personalKpisRaw.value.filter(kpi => {
    if (filterImportant.value === 'yes' && !kpi.isImportant) return false
    if (filterImportant.value === 'no' && kpi.isImportant) return false
    if (filterStatus.value && kpi.status !== filterStatus.value) return false
    if (filterMember.value && !kpi.children?.some(c => c.name === filterMember.value)) return false
    return true
  })
  const groups = filtered.reduce((acc: any, item: any) => { (acc[item.group] ??= []).push(item); return acc; }, {});
  return ['A', 'B', 'C'].map(key => ({ key, label: groupLabels[key], items: groups[key] || [] })).filter(g => g.items.length > 0);
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
</script>

<template>
  <div class="animate-fade-in bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
    
    <div class="flex flex-col gap-3 border-b border-slate-200 bg-white p-5 shrink-0">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2"><i class="fas fa-list-alt text-slate-400"></i> My KPI Portfolio</h3>

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

    <div class="overflow-x-auto flex-1">
      <table class="w-full text-left">
        <thead class="bg-white border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
          <tr>
            <th class="py-4 px-5 w-12 text-center">STT</th>
            <th class="py-4 px-5 min-w-[280px]">Hạng Mục (Objectives)</th>
            <th class="py-4 px-5 min-w-[150px]">Chỉ Tiêu (Target)</th>
            <th class="py-4 px-5 min-w-[150px]">Thực tế (Actual Result)</th>
            <th class="py-4 px-5 text-center w-24">Trọng số</th>
            <th class="py-4 px-5 text-center w-28 bg-blue-50/50">Self Score</th>
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
                      <div v-if="item.kpiType === 'cascading'" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 shadow-sm bg-blue-50 text-blue-700 border-blue-200"><i class="fas fa-code-branch text-[10px]"></i><span class="text-[10px] font-bold tracking-wide">Cascading</span></div>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-5 align-top pt-4"><p class="text-sm font-medium text-slate-700">{{ item.target }}</p></td>
                <td class="py-4 px-5 align-top pt-4"><p class="text-sm font-bold text-blue-700">{{ item.actualResult || 'Chưa cập nhật' }}</p></td>
                <td class="py-4 px-5 text-center align-top pt-4"><span class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md">{{ item.weight }}</span></td>
                <td class="py-4 px-5 text-center bg-blue-50/20 align-top pt-4"><span class="text-sm font-bold text-slate-800">{{ item.selfScore ?? '-' }}</span></td>
                <td class="py-4 px-5 text-center align-top pt-4"><span class="text-slate-400 font-medium text-sm">{{ item.pmScore ?? '-' }}</span></td>
                <td class="py-4 px-5 text-right align-top pt-4">
                    <div class="flex items-center justify-end gap-2">
                      <button @click.stop="openEvidenceDrawer(item)" class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600"><i class="fas fa-pen text-xs"></i> Edit</button>
                      <button v-if="item.isTree" @click.stop="$emit('open-assign', item)" class="flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-[10px] font-bold text-purple-700 hover:bg-purple-100"><i class="fas fa-user-plus text-xs"></i> Assign</button>
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
                  <td class="py-3 px-5"><p class="text-xs font-semibold text-slate-700">{{ child.actualResult || '-' }}</p></td>
                  <td class="py-3 px-5 text-center text-slate-400 font-bold">-</td>
                  <td class="py-3 px-5 text-center bg-blue-50/10"><span class="text-xs font-bold text-slate-600">{{ child.selfScore ?? '-' }}</span></td>
                  <td class="py-3 px-5 text-center"><span class="text-xs font-bold text-purple-700">{{ child.pmScore ?? '-' }}</span></td>
                  <td class="py-3 px-5 text-right"><button @click.stop="$emit('open-member-detail', { child, parent: item })" class="inline-flex h-7 items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-bold text-blue-600"><i class="far fa-eye text-[10px]"></i> Detail</button></td>
                </tr>
              </template>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <EvaluationCommentBlock v-model:selfComment="pmComments.selfComment" :supervisorComment="pmComments.supervisorComment" selfTitle="My Comment (To GM)" supervisorTitle="Supervisor (GM) Comment" @submit="() => {}" />
    <EvaluationEvidenceDrawer :open="evidencePanelOpen" :item="selectedKpiItem" @close="evidencePanelOpen = false" @save="saveEvidenceData" />
  </div>
</template>

<style scoped>
.gm-diag-filter-pop-enter-active, .gm-diag-filter-pop-leave-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.gm-diag-filter-pop-enter-from, .gm-diag-filter-pop-leave-to { opacity: 0; transform: scale(0.95); }
.gm-diag-filter-pop-enter-to, .gm-diag-filter-pop-leave-from { opacity: 1; transform: scale(1); }
</style>