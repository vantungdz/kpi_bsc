<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  gmKpiService,
  type GmMemberKpiAssignment,
  type GmCopyKpiItemPayload,
  apiGetGmKpiCyclesForEvaluation,
} from '@/services/modules/kpi-gm.service'
import type { GmMemberDetailMock } from '@/types/gm-workspace'
import { pushGmNotification } from '@/composables/useGmNotifications'

const props = defineProps<{
  open: boolean
  targetMember: (GmMemberDetailMock & { deptName: string }) | null
  allMembers: (GmMemberDetailMock & { deptName: string })[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'copied'): void
}>()

// --- State ---
const activeCycleId = ref<string>('')
const step = ref<1 | 2>(1)
const sourceSearch = ref('')
const selectedSourceMember = ref<(GmMemberDetailMock & { deptName: string }) | null>(null)

const loadingKpis = ref(false)
const sourceKpis = ref<GmMemberKpiAssignment[]>([])
const selectedKpiIds = ref<Set<string>>(new Set())

// Lưu target do GM tự nhập lại
const customTargets = ref<Map<string, number>>(new Map())

const submitting = ref(false)

// --- Modal Edit Target ---
const editModalOpen = ref(false)
const editTargetKpi = ref<GmMemberKpiAssignment | null>(null)
const editTargetInput = ref<number | ''>('')

// --- Computed ---
const filteredSourceMembers = computed(() => {
  if (!props.allMembers) return []
  let list = props.allMembers.filter((m) => m.id !== props.targetMember?.id)
  const q = sourceSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter((m) => {
      const hay = `${m.name} ${m.rank ?? ''} ${m.deptName}`.toLowerCase()
      return hay.includes(q)
    })
  }
  return list
})

// --- Watchers ---
watch(
  () => props.open,
  async (val) => {
    if (val) {
      step.value = 1
      sourceSearch.value = ''
      selectedSourceMember.value = null
      sourceKpis.value = []
      selectedKpiIds.value.clear()
      customTargets.value.clear()
      
      if (!activeCycleId.value) {
        try {
          const cycles = await apiGetGmKpiCyclesForEvaluation()
          const currentYear = new Date().getFullYear()
          const matched = cycles.find(c => c.year === currentYear) || cycles[0]
          if (matched) {
            activeCycleId.value = matched.id
          }
        } catch (e) {
          pushGmNotification('Không thể tải chu kỳ đánh giá', { variant: 'error' })
        }
      }
    }
  },
)

// --- Methods ---
function closeDrawer() {
  emit('update:open', false)
}

async function selectSourceMember(member: GmMemberDetailMock & { deptName: string }) {
  selectedSourceMember.value = member
  step.value = 2
  loadingKpis.value = true
  sourceKpis.value = []
  selectedKpiIds.value.clear()
  customTargets.value.clear()

  try {
    if (!activeCycleId.value) {
      throw new Error('Chưa có chu kỳ đánh giá hợp lệ.')
    }
    const kpis = await gmKpiService.getMemberKpiAssignments(member.id, activeCycleId.value)
    sourceKpis.value = kpis
    kpis.forEach((k) => selectedKpiIds.value.add(k.kpiInformationId))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Không tải được KPI của nhân viên này'
    pushGmNotification(msg, { variant: 'error' })
    step.value = 1
    selectedSourceMember.value = null
  } finally {
    loadingKpis.value = false
  }
}

function toggleKpiSelection(kpiId: string) {
  if (selectedKpiIds.value.has(kpiId)) {
    selectedKpiIds.value.delete(kpiId)
  } else {
    selectedKpiIds.value.add(kpiId)
  }
}

function openEditTargetModal(kpi: GmMemberKpiAssignment) {
  editTargetKpi.value = kpi
  const currentTarget =
    customTargets.value.get(kpi.kpiInformationId) ??
    kpi.assignmentTargetValue ??
    kpi.kpiInfoTargetValue
  editTargetInput.value = currentTarget ?? ''
  editModalOpen.value = true
}

function closeEditModal() {
  editModalOpen.value = false
  editTargetKpi.value = null
}

function saveCustomTarget() {
  if (!editTargetKpi.value) return
  const val = Number(editTargetInput.value)
  if (!isNaN(val) && editTargetInput.value !== '') {
    customTargets.value.set(editTargetKpi.value.kpiInformationId, val)
  } else {
    customTargets.value.delete(editTargetKpi.value.kpiInformationId)
  }
  closeEditModal()
}

function getDisplayTarget(kpi: GmMemberKpiAssignment) {
  const custom = customTargets.value.get(kpi.kpiInformationId)
  if (custom !== undefined) return custom
  return kpi.assignmentTargetValue ?? kpi.kpiInfoTargetValue ?? '—'
}

function isTargetCustomized(kpiId: string) {
  return customTargets.value.has(kpiId)
}

async function confirmCopy() {
  if (!props.targetMember || !activeCycleId.value) return
  const items: GmCopyKpiItemPayload[] = []
  
  for (const kpi of sourceKpis.value) {
    if (selectedKpiIds.value.has(kpi.kpiInformationId)) {
      const target =
        customTargets.value.get(kpi.kpiInformationId) ??
        kpi.assignmentTargetValue ??
        kpi.kpiInfoTargetValue
      items.push({
        kpiInfoId: kpi.kpiInformationId,
        targetValue: target ?? null,
      })
    }
  }

  if (items.length === 0) {
    pushGmNotification('Vui lòng chọn ít nhất 1 KPI để copy.', { variant: 'error' })
    return
  }

  submitting.value = true
  try {
    await gmKpiService.copyKpisToMember(props.targetMember.id, activeCycleId.value, items)
    pushGmNotification('Đã copy KPI thành công.', { variant: 'success' })
    emit('copied')
    closeDrawer()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Lỗi khi copy KPI'
    pushGmNotification(msg, { variant: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Transition name="gm-copy-kpi-drawer">
    <div v-if="open" class="fixed inset-0 z-[150] flex justify-end">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        @click="closeDrawer"
      />

      <!-- Panel -->
      <div
        class="relative flex h-full w-full max-w-[500px] flex-col bg-white shadow-2xl transition-transform"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 class="text-base font-bold text-slate-800">
              Sao chép KPI
            </h2>
            <p class="mt-0.5 text-xs text-slate-500" v-if="targetMember">
              Đang chọn KPI để gán cho <span class="font-bold text-indigo-600">{{ targetMember.name }}</span>
            </p>
          </div>
          <button
            class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            @click="closeDrawer"
          >
            <i class="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto bg-slate-50 p-5">
          <!-- Step 1: Chọn Member -->
          <div v-if="step === 1" class="space-y-4">
            <h3 class="text-sm font-bold text-slate-700">1. Chọn nhân viên mẫu để sao chép</h3>
            
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                v-model="sourceSearch"
                type="text"
                class="w-full rounded-lg border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Tìm tên, chức danh, phòng ban..."
              />
            </div>

            <div class="space-y-2">
              <div
                v-for="emp in filteredSourceMembers"
                :key="emp.id"
                class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                @click="selectSourceMember(emp)"
              >
                <div>
                  <p class="text-sm font-bold text-slate-800">{{ emp.name }}</p>
                  <div class="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <span class="rounded bg-slate-100 px-1.5 py-0.5">{{ emp.rank ?? 'NV' }}</span>
                    <span>&bull;</span>
                    <span>{{ emp.deptName }}</span>
                  </div>
                </div>
                <i class="fas fa-chevron-right text-slate-300" />
              </div>
              
              <div v-if="filteredSourceMembers.length === 0" class="py-8 text-center text-sm text-slate-500">
                Không tìm thấy nhân viên phù hợp
              </div>
            </div>
          </div>

          <!-- Step 2: Chọn & Sửa KPI -->
          <div v-else-if="step === 2" class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-700">2. Tùy chỉnh KPI sao chép</h3>
              <button 
                class="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                @click="step = 1"
              >
                <i class="fas fa-arrow-left mr-1" /> Chọn lại
              </button>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <p class="text-xs font-medium text-slate-500">Nguồn sao chép:</p>
              <div class="mt-1 flex items-center gap-2">
                <p class="text-sm font-bold text-slate-800">{{ selectedSourceMember?.name }}</p>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                  {{ selectedSourceMember?.rank ?? 'NV' }}
                </span>
                <span class="text-xs text-slate-400">&bull;</span>
                <span class="text-xs font-medium text-slate-600">{{ selectedSourceMember?.deptName }}</span>
              </div>
            </div>

            <div v-if="loadingKpis" class="flex flex-col items-center justify-center py-12">
              <i class="fas fa-spinner fa-spin text-2xl text-indigo-600" />
              <p class="mt-2 text-sm font-medium text-slate-500">Đang tải KPI...</p>
            </div>

            <div v-else-if="sourceKpis.length === 0" class="rounded-lg border border-dashed border-slate-300 py-8 text-center">
              <i class="fas fa-folder-open mb-2 text-2xl text-slate-300" />
              <p class="text-sm font-medium text-slate-500">Nhân viên này chưa có KPI nào trong chu kỳ.</p>
            </div>

            <div v-else class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <span class="text-xs font-bold text-slate-500">
                  Đã chọn {{ selectedKpiIds.size }}/{{ sourceKpis.length }} KPI
                </span>
                <button 
                  class="text-xs font-semibold text-indigo-600"
                  @click="selectedKpiIds.size === sourceKpis.length ? selectedKpiIds.clear() : sourceKpis.forEach(k => selectedKpiIds.add(k.kpiInformationId))"
                >
                  {{ selectedKpiIds.size === sourceKpis.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
                </button>
              </div>

              <!-- Danh sách KPI -->
              <div
                v-for="kpi in sourceKpis"
                :key="kpi.kpiInformationId"
                class="relative overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-md"
                :class="{ 'ring-1 ring-indigo-500 border-indigo-500': selectedKpiIds.has(kpi.kpiInformationId) }"
              >
                <!-- Checkbox Overlay (Click anywhere to toggle if not clicking target) -->
                <div class="absolute inset-y-0 left-0 flex w-10 cursor-pointer items-center justify-center border-r border-slate-100 bg-slate-50/50"
                     @click="toggleKpiSelection(kpi.kpiInformationId)">
                  <div class="flex h-5 w-5 items-center justify-center rounded border transition-colors"
                       :class="selectedKpiIds.has(kpi.kpiInformationId) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'">
                    <i v-if="selectedKpiIds.has(kpi.kpiInformationId)" class="fas fa-check text-[10px]" />
                  </div>
                </div>

                <div class="ml-10 p-3 pl-4">
                  <div class="pr-16">
                    <h4 class="text-sm font-bold leading-tight text-slate-800 line-clamp-2">
                      {{ kpi.masterName }}
                    </h4>
                    <div class="mt-1.5 flex items-center gap-3 text-xs font-medium text-slate-500">
                      <span class="flex items-center gap-1">
                        <i class="fas fa-weight-hanging text-slate-400" />
                        {{ kpi.weight ?? 0 }}%
                      </span>
                      <span class="flex items-center gap-1" v-if="kpi.unitName">
                        <i class="fas fa-ruler text-slate-400" />
                        {{ kpi.unitName }}
                      </span>
                    </div>
                  </div>

                  <!-- Target Box (Click to edit) -->
                  <div 
                    class="absolute right-3 top-3 flex cursor-pointer flex-col items-end rounded-lg border p-1.5 transition-colors hover:bg-slate-50"
                    :class="isTargetCustomized(kpi.kpiInformationId) ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100 bg-slate-50'"
                    @click="openEditTargetModal(kpi)"
                    title="Click để sửa chỉ tiêu"
                  >
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Target <i class="fas fa-pencil ml-0.5 text-[8px]" />
                    </span>
                    <span class="text-sm font-black" :class="isTargetCustomized(kpi.kpiInformationId) ? 'text-rose-600' : 'text-slate-700'">
                      {{ getDisplayTarget(kpi) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-100 bg-white p-4">
          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              @click="closeDrawer"
            >
              Hủy
            </button>
            <button
              v-if="step === 2"
              type="button"
              class="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
              :disabled="submitting || selectedKpiIds.size === 0"
              @click="confirmCopy"
            >
              <i v-if="submitting" class="fas fa-spinner fa-spin mr-1.5" />
              Xác nhận Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Modal Edit Target -->
  <Teleport to="body">
    <div v-if="editModalOpen && editTargetKpi" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeEditModal" />
      <div class="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div class="border-b border-slate-100 px-5 py-4">
          <h3 class="text-sm font-bold text-slate-800">Chỉnh sửa Target</h3>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <p class="text-xs font-medium text-slate-500 mb-1">KPI:</p>
            <p class="text-sm font-bold text-slate-800">{{ editTargetKpi.masterName }}</p>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-700 mb-1 block">Chỉ tiêu (Target) mới</label>
            <input 
              v-model="editTargetInput"
              type="number"
              class="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Nhập số..."
              @keyup.enter="saveCustomTarget"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 p-4 bg-slate-50 rounded-b-2xl">
          <button 
            class="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            @click="closeEditModal"
          >
            Hủy
          </button>
          <button 
            class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            @click="saveCustomTarget"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gm-copy-kpi-drawer-enter-active,
.gm-copy-kpi-drawer-leave-active {
  transition-duration: 0.3s;
}

.gm-copy-kpi-drawer-enter-active .absolute,
.gm-copy-kpi-drawer-leave-active .absolute {
  transition: opacity 0.3s ease;
}

.gm-copy-kpi-drawer-enter-active .relative,
.gm-copy-kpi-drawer-leave-active .relative {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.gm-copy-kpi-drawer-enter-from .absolute,
.gm-copy-kpi-drawer-leave-to .absolute {
  opacity: 0;
}

.gm-copy-kpi-drawer-enter-from .relative,
.gm-copy-kpi-drawer-leave-to .relative {
  transform: translateX(100%);
}
</style>
