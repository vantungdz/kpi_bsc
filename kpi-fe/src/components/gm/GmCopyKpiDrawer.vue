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

// GM-overridden targets for copy
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
      selectedKpiIds.value = new Set()
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
          pushGmNotification('Could not load evaluation cycles', { variant: 'error' })
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
  selectedKpiIds.value = new Set()
  customTargets.value.clear()

  try {
    if (!activeCycleId.value) {
      throw new Error('No valid evaluation cycle.')
    }
    const kpis = await gmKpiService.getMemberKpiAssignments(member.id, activeCycleId.value)
    sourceKpis.value = kpis
    selectedKpiIds.value = new Set(kpis.map((k) => k.kpiInformationId))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not load this member’s KPIs'
    pushGmNotification(msg, { variant: 'error' })
    step.value = 1
    selectedSourceMember.value = null
  } finally {
    loadingKpis.value = false
  }
}

function toggleKpiSelection(kpiId: string) {
  const next = new Set(selectedKpiIds.value)
  if (next.has(kpiId)) next.delete(kpiId)
  else next.add(kpiId)
  selectedKpiIds.value = next
}

function toggleSelectAllKpis() {
  if (selectedKpiIds.value.size === sourceKpis.value.length) {
    selectedKpiIds.value = new Set()
  } else {
    selectedKpiIds.value = new Set(sourceKpis.value.map((k) => k.kpiInformationId))
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
  const id = editTargetKpi.value.kpiInformationId
  const val = Number(editTargetInput.value)
  if (!isNaN(val) && editTargetInput.value !== '') {
    customTargets.value.set(id, val)
    if (!selectedKpiIds.value.has(id)) {
      const next = new Set(selectedKpiIds.value)
      next.add(id)
      selectedKpiIds.value = next
    }
  } else {
    customTargets.value.delete(id)
  }
  closeEditModal()
}

function originalTargetForKpi(kpi: GmMemberKpiAssignment) {
  return kpi.assignmentTargetValue ?? kpi.kpiInfoTargetValue ?? '—'
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
    pushGmNotification('Select at least one KPI to copy.', { variant: 'error' })
    return
  }

  submitting.value = true
  try {
    const sourceId = String(selectedSourceMember.value?.id ?? '').trim()
    if (!sourceId) {
      pushGmNotification('Select a source member to copy from.', { variant: 'error' })
      return
    }
    await gmKpiService.copyKpisToMember(
      props.targetMember.id,
      activeCycleId.value,
      sourceId,
      items,
    )
    pushGmNotification('KPIs copied successfully.', { variant: 'success' })
    emit('copied')
    closeDrawer()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error copying KPIs'
    pushGmNotification(msg, { variant: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Transition name="gm-copy-kpi-drawer">
    <div v-if="open" class="fixed inset-0 z-[150] flex justify-end">
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        @click="closeDrawer"
      />

      <div
        class="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform"
      >
        <div class="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              Copy KPIs
            </h2>
            <p v-if="targetMember" class="mt-1 text-sm text-slate-500">
              Choose KPIs to assign to
              <span class="font-semibold text-indigo-600">{{ targetMember.name }}</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            @click="closeDrawer"
          >
            <i class="fas fa-xmark text-lg" aria-hidden="true" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto bg-slate-50">
          <div v-if="step === 1" class="p-6">
            <h3 class="mb-4 text-sm font-bold text-slate-800">
              1. Pick a source member to copy from
            </h3>

            <div class="relative mb-6">
              <i
                class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
              />
              <input
                v-model="sourceSearch"
                type="text"
                class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search by name, title, department..."
              />
            </div>

            <div class="space-y-3">
              <button
                v-for="emp in filteredSourceMembers"
                :key="emp.id"
                type="button"
                class="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:shadow-md"
                @click="selectSourceMember(emp)"
              >
                <div class="min-w-0 flex-1 pr-2">
                  <p class="font-semibold text-slate-800 transition-colors group-hover:text-indigo-600">
                    {{ emp.name }}
                  </p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span class="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      {{ emp.rank ?? 'NV' }}
                    </span>
                    <span class="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                    <span>{{ emp.deptName }}</span>
                  </div>
                </div>
                <i
                  class="fas fa-chevron-right shrink-0 text-slate-300 transition-colors group-hover:text-indigo-500"
                />
              </button>

              <p
                v-if="filteredSourceMembers.length === 0"
                class="py-8 text-center text-sm text-slate-500"
              >
                No matching members found.
              </p>
            </div>
          </div>

          <div v-else-if="step === 2" class="p-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-800">
                2. Customize KPIs to copy
              </h3>
              <button
                type="button"
                class="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                @click="step = 1"
              >
                <i class="fas fa-arrow-left text-sm" />
                Back
              </button>
            </div>

            <div class="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="mb-1 text-xs text-slate-500">
                Copy from:
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-bold text-slate-800">
                  {{ selectedSourceMember?.name }}
                </p>
                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {{ selectedSourceMember?.rank ?? 'NV' }}
                </span>
                <span class="text-xs text-slate-500">• {{ selectedSourceMember?.deptName }}</span>
              </div>
            </div>

            <div v-if="loadingKpis" class="flex flex-col items-center justify-center py-12">
              <i class="fas fa-spinner fa-spin text-2xl text-indigo-600" />
              <p class="mt-2 text-sm font-medium text-slate-500">
                Loading KPIs...
              </p>
            </div>

            <div
              v-else-if="sourceKpis.length === 0"
              class="rounded-lg border border-dashed border-slate-300 py-8 text-center"
            >
              <i class="fas fa-folder-open mb-2 text-2xl text-slate-300" />
              <p class="text-sm font-medium text-slate-500">
                This member has no KPIs in the selected cycle.
              </p>
            </div>

            <template v-else>
              <div class="mb-3 flex items-center justify-between px-1">
                <span class="text-sm font-medium text-slate-600">
                  Selected {{ selectedKpiIds.size }}/{{ sourceKpis.length }} KPI(s)
                </span>
                <button
                  type="button"
                  class="text-sm font-medium text-indigo-600 hover:underline"
                  @click="toggleSelectAllKpis"
                >
                  {{ selectedKpiIds.size === sourceKpis.length ? 'Deselect all' : 'Select all' }}
                </button>
              </div>

              <div class="space-y-3">
                <div
                  v-for="kpi in sourceKpis"
                  :key="kpi.kpiInformationId"
                  class="group flex cursor-pointer items-center gap-4 rounded-xl border-2 bg-white p-4 transition-all"
                  :class="
                    selectedKpiIds.has(kpi.kpiInformationId)
                      ? 'border-indigo-500 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  "
                  @click="openEditTargetModal(kpi)"
                >
                  <div class="shrink-0" @click.stop="toggleKpiSelection(kpi.kpiInformationId)">
                    <div
                      class="flex h-5 w-5 items-center justify-center rounded border transition-colors"
                      :class="
                        selectedKpiIds.has(kpi.kpiInformationId)
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      "
                    >
                      <i
                        v-if="selectedKpiIds.has(kpi.kpiInformationId)"
                        class="fas fa-check text-[10px]"
                      />
                    </div>
                  </div>

                  <div class="min-w-0 flex-1">
                    <h4 class="truncate text-sm font-semibold text-slate-800">
                      {{ kpi.masterName }}
                    </h4>
                    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span class="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        <i class="fas fa-briefcase text-[10px] text-slate-400" />
                        Weight:
                        <strong class="text-slate-800">{{ kpi.weight ?? 0 }}%</strong>
                      </span>
                      <span
                        v-if="kpi.unitName"
                        class="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1"
                      >
                        <i class="fas fa-shield-alt text-[10px] text-slate-400" />
                        Unit:
                        <strong class="text-slate-800">{{ kpi.unitName }}</strong>
                      </span>
                    </div>
                  </div>

                  <div
                    class="flex shrink-0 flex-col items-end rounded-lg border px-3 py-1.5 transition-colors"
                    :class="
                      isTargetCustomized(kpi.kpiInformationId)
                        ? 'border-red-200 bg-red-50'
                        : 'border-slate-100 bg-slate-50'
                    "
                  >
                    <div
                      class="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                    >
                      Target
                      <i
                        class="fas fa-pen text-[9px] text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </div>
                    <span
                      class="text-base font-bold leading-none"
                      :class="
                        isTargetCustomized(kpi.kpiInformationId) ? 'text-red-600' : 'text-slate-800'
                      "
                    >
                      {{ getDisplayTarget(kpi) }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            class="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            @click="closeDrawer"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            :class="
              step === 2 && selectedKpiIds.size > 0 && !submitting && !loadingKpis
                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
            "
            :disabled="step === 1 || selectedKpiIds.size === 0 || submitting || loadingKpis"
            @click="confirmCopy"
          >
            <i v-if="submitting" class="fas fa-spinner fa-spin mr-1.5" />
            Confirm copy
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Teleport to="body">
    <Transition name="gm-edit-target-modal">
      <div
        v-if="editModalOpen && editTargetKpi"
        class="gm-edit-target-modal-root fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        <div
          class="gm-edit-target-modal-backdrop absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          @click="closeEditModal"
        />
        <div
          class="gm-edit-target-modal-panel relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          @click.stop
        >
        <div class="border-b border-slate-200 px-8 py-6">
          <h3 class="text-lg font-bold text-slate-800">
            Edit Target
          </h3>
        </div>

        <div class="px-8 py-7">
          <div
            class="mb-8 grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700"
          >
            <p class="flex min-w-0 items-start gap-3">
              <i
                class="fas fa-chart-line mt-0.5 shrink-0 text-base text-slate-400"
                aria-hidden="true"
              />
              <span class="min-w-0 leading-relaxed">
                <span class="font-semibold text-slate-600">Name KPI:</span>
                <span class="font-medium text-slate-800">{{ editTargetKpi.masterName }}</span>
              </span>
            </p>
            <p class="flex items-start gap-3">
              <i
                class="fas fa-sort-amount-up mt-0.5 shrink-0 text-base text-slate-400"
                aria-hidden="true"
              />
              <span class="leading-relaxed">
                <span class="font-semibold text-slate-600">Unit:</span>
                {{ editTargetKpi.unitName ?? '—' }}
              </span>
            </p>
            <p class="flex items-start gap-3">
              <i
                class="fas fa-weight-hanging mt-0.5 shrink-0 text-base text-slate-400"
                aria-hidden="true"
              />
              <span class="leading-relaxed">
                <span class="font-semibold text-slate-600">Weight:</span>
                {{ editTargetKpi.weight ?? 0 }}%
              </span>
            </p>
            <p class="flex items-start gap-3">
              <i
                class="fas fa-bullseye mt-0.5 shrink-0 text-base text-slate-400"
                aria-hidden="true"
              />
              <span class="leading-relaxed">
                <span class="font-semibold text-slate-600">Original Target:</span>
                {{ originalTargetForKpi(editTargetKpi) }}
              </span>
            </p>
          </div>

          <div>
            <label class="mb-3 block text-sm font-semibold text-slate-700">
              New target
            </label>
            <input
              v-model="editTargetInput"
              type="number"
              placeholder="Enter new target value..."
              class="w-full rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-base text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @keyup.enter="saveCustomTarget"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-8 py-5">
          <button
            type="button"
            class="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            @click="closeEditModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            @click="saveCustomTarget"
          >
            Save changes
          </button>
        </div>
        </div>
      </div>
    </Transition>
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

.gm-edit-target-modal-enter-active,
.gm-edit-target-modal-leave-active {
  transition-duration: 0.26s;
}

.gm-edit-target-modal-enter-active .gm-edit-target-modal-backdrop,
.gm-edit-target-modal-leave-active .gm-edit-target-modal-backdrop {
  transition: opacity 0.26s ease;
}

.gm-edit-target-modal-enter-active .gm-edit-target-modal-panel,
.gm-edit-target-modal-leave-active .gm-edit-target-modal-panel {
  transition:
    opacity 0.26s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.gm-edit-target-modal-enter-from .gm-edit-target-modal-backdrop,
.gm-edit-target-modal-leave-to .gm-edit-target-modal-backdrop {
  opacity: 0;
}

.gm-edit-target-modal-enter-to .gm-edit-target-modal-backdrop,
.gm-edit-target-modal-leave-from .gm-edit-target-modal-backdrop {
  opacity: 1;
}

.gm-edit-target-modal-enter-from .gm-edit-target-modal-panel,
.gm-edit-target-modal-leave-to .gm-edit-target-modal-panel {
  opacity: 0;
  transform: scale(0.94) translateY(14px);
}

.gm-edit-target-modal-enter-to .gm-edit-target-modal-panel,
.gm-edit-target-modal-leave-from .gm-edit-target-modal-panel {
  opacity: 1;
  transform: scale(1) translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .gm-edit-target-modal-enter-active,
  .gm-edit-target-modal-leave-active,
  .gm-edit-target-modal-enter-active .gm-edit-target-modal-backdrop,
  .gm-edit-target-modal-leave-active .gm-edit-target-modal-backdrop,
  .gm-edit-target-modal-enter-active .gm-edit-target-modal-panel,
  .gm-edit-target-modal-leave-active .gm-edit-target-modal-panel {
    transition-duration: 0.01ms !important;
  }
}
</style>
