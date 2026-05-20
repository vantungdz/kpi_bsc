<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  MOCK_PM_EMPLOYEES,
  PM_MANAGER_TOTAL_WEIGHT,
  flattenKpiItems,
  statusLabelVi,
  type PmManagerEmployee,
  type PmManagerKpiItem,
} from '@/data/pmManager.mock'
import { isReadonlyKpiYear } from '@/utils/kpi-year'

const route = useRoute()
const employees = MOCK_PM_EMPLOYEES

const selectedYear = ref(2026)
const nameFilter = ref('')
const listFilter = ref<'all' | 'pending'>('all')
const expandedId = ref<string | null>(null)
const openEvidence = reactive<Record<string, boolean>>({})
const pmScores = reactive<Record<string, Record<string, number | null>>>({})
const supervisorComments = reactive<Record<string, string>>({})
const banner = ref<{ type: 'ok' | 'info'; text: string } | null>(null)
const pageLoading = ref(true)

const isReadonly = computed(() => isReadonlyKpiYear(selectedYear.value))

function readRouteIntoUi() {
  const q = route.query.q
  if (typeof q === 'string' && q.trim()) nameFilter.value = q.trim()
  const y = route.query.year
  if (typeof y === 'string') {
    const n = parseInt(y, 10)
    if (!Number.isNaN(n)) selectedYear.value = n
  }
}

watch(
  () => route.query,
  () => readRouteIntoUi(),
  { deep: true },
)

readRouteIntoUi()

function hasKpis(emp: PmManagerEmployee) {
  return flattenKpiItems(emp).length > 0
}

function evidenceKey(empId: string, kpiId: string) {
  return `${empId}:${kpiId}`
}

function ensurePmScoreKeys() {
  for (const emp of employees) {
    if (!pmScores[emp.id]) pmScores[emp.id] = {}
    for (const item of flattenKpiItems(emp)) {
      if (pmScores[emp.id][item.id] === undefined) pmScores[emp.id][item.id] = null
    }
  }
}

function resetPmScores() {
  for (const emp of employees) {
    if (!pmScores[emp.id]) pmScores[emp.id] = {}
    for (const item of flattenKpiItems(emp)) {
      pmScores[emp.id][item.id] = null
    }
  }
}

function prefillLockedPmScores() {
  ensurePmScoreKeys()
  for (const emp of employees) {
    for (const item of flattenKpiItems(emp)) {
      pmScores[emp.id][item.id] = item.selfScore
    }
  }
}

watch(
  selectedYear,
  (y) => {
    if (isReadonlyKpiYear(y)) prefillLockedPmScores()
    else resetPmScores()
  },
  { immediate: true },
)

onMounted(async () => {
  await new Promise((r) => setTimeout(r, 380))
  pageLoading.value = false
})

function scaledWeightedAvg(
  emp: PmManagerEmployee,
  mode: 'pm' | 'self',
): { value: number; filledPmSlots: number; totalPmSlots: number } {
  const items = flattenKpiItems(emp)
  const totalSlots = items.length
  let weighted = 0
  let filledPm = 0
  for (const item of items) {
    if (mode === 'self') {
      weighted += item.selfScore * (item.weight / 100)
    } else {
      const v = pmScores[emp.id]?.[item.id]
      if (v != null && v > 0) {
        weighted += v * (item.weight / 100)
        filledPm++
      }
    }
  }
  const denom = PM_MANAGER_TOTAL_WEIGHT / 100
  return {
    value: denom > 0 ? weighted / denom : 0,
    filledPmSlots: filledPm,
    totalPmSlots: totalSlots,
  }
}

function formatAvg(n: number) {
  return n.toFixed(2)
}

function pmPreviewText(emp: PmManagerEmployee) {
  if (!hasKpis(emp)) return '—'
  const { value, filledPmSlots } = scaledWeightedAvg(emp, 'pm')
  if (filledPmSlots === 0) return '—'
  return formatAvg(value)
}

function pmPreviewClass(emp: PmManagerEmployee) {
  const { filledPmSlots } = scaledWeightedAvg(emp, 'pm')
  if (!hasKpis(emp) || filledPmSlots === 0) return 'text-slate-300 font-medium'
  return 'text-indigo-700 font-bold'
}

function selfAvgInPanel(emp: PmManagerEmployee) {
  return formatAvg(scaledWeightedAvg(emp, 'self').value)
}

function pmAvgInPanel(emp: PmManagerEmployee) {
  return formatAvg(scaledWeightedAvg(emp, 'pm').value)
}

function pmSelectClass(emp: PmManagerEmployee, item: PmManagerKpiItem) {
  const v = pmScores[emp.id]?.[item.id]
  const ok = v != null && v > 0
  return ok
    ? 'border-indigo-200 text-indigo-700'
    : 'border-rose-400 bg-rose-50 text-rose-700'
}

function setPmScore(empId: string, kpiId: string, raw: string) {
  if (isReadonly.value) return
  if (!pmScores[empId]) pmScores[empId] = {}
  const n = parseInt(raw, 10)
  pmScores[empId][kpiId] = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
}

const filteredEmployees = computed(() => {
  const q = nameFilter.value.trim().toLowerCase()
  return employees.filter((emp) => {
    if (listFilter.value === 'pending' && emp.status !== 'pending_pm') return false
    if (q && !emp.name.toLowerCase().includes(q)) return false
    return true
  })
})

const totalCount = computed(() => employees.length)

const pendingCount = computed(() => employees.filter((e) => e.status === 'pending_pm').length)

function statusBadgeClass(emp: PmManagerEmployee) {
  if (emp.status === 'pending_pm') {
    return 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-full'
  }
  if (emp.status === 'self_scoring') {
    return 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-full'
  }
  return 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full'
}

function toggleExpand(emp: PmManagerEmployee) {
  if (!hasKpis(emp)) return
  expandedId.value = expandedId.value === emp.id ? null : emp.id
}

watch([nameFilter, listFilter], () => {
  const ex = expandedId.value
  if (ex && !filteredEmployees.value.some((e) => e.id === ex)) expandedId.value = null
})

function toggleEvidence(empId: string, kpiId: string) {
  const k = evidenceKey(empId, kpiId)
  openEvidence[k] = !openEvidence[k]
}

function evidenceOpen(empId: string, kpiId: string) {
  return !!openEvidence[evidenceKey(empId, kpiId)]
}

function evidenceAccentBorder(accent: 'indigo' | 'emerald') {
  return accent === 'emerald' ? 'border-emerald-500' : 'border-indigo-500'
}

function evidencePanelBorder(accent: 'indigo' | 'emerald') {
  return accent === 'emerald' ? 'border-b-2 border-emerald-200' : 'border-b-2 border-indigo-200'
}

function saveDraft(emp: PmManagerEmployee) {
  if (isReadonly.value) return
  banner.value = {
    type: 'info',
    text: `Draft saved (mock) for ${emp.name} - year ${selectedYear.value}.`,
  }
  setTimeout(() => {
    banner.value = null
  }, 3200)
}

function confirmDone(emp: PmManagerEmployee) {
  if (isReadonly.value) return
  const c = (supervisorComments[emp.id] ?? '').trim()
  if (!c) {
    banner.value = { type: 'info', text: 'Enter a Supervisor Comment before completing.' }
    setTimeout(() => {
      banner.value = null
    }, 3200)
    return
  }
  banner.value = {
    type: 'ok',
    text: `Completion confirmed (mock) for ${emp.name}. PM average score: ${pmAvgInPanel(emp)}.`,
  }
  setTimeout(() => {
    banner.value = null
  }, 3600)
}
</script>

<template>
  <div class="p-4 md:p-8 max-w-375 mx-auto space-y-6 pb-12 animate-fade-in">
    <div
      v-if="pageLoading"
      class="flex flex-col items-center justify-center py-28 text-slate-500 gap-3"
    >
      <i class="fas fa-spinner fa-spin text-indigo-500 text-3xl" />
      <span class="text-sm font-semibold">Loading data...</span>
    </div>

    <template v-else>
    <Transition name="fade">
      <div
        v-if="banner"
        class="fixed bottom-6 right-6 z-50 max-w-md rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg"
        :class="banner.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'"
      >
        {{ banner.text }}
      </div>
    </Transition>

    <div
      v-if="isReadonly"
      class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex gap-3 items-start mb-4"
    >
      <i class="fas fa-lock text-slate-500 mt-0.5 shrink-0" />
      <p>
        <span class="font-bold">Read-only mode:</span> year {{ selectedYear }} is locked. PM scores and supervisor comments cannot be edited.
      </p>
    </div>

    <!-- Top bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 tracking-tight">
          KPI Management &amp; Evaluation (PM Manager)
        </h2>
        <p class="text-slate-500 text-sm mt-1">
          Click an employee to expand the detailed evaluation table.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <select
          v-model.number="selectedYear"
          class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100"
        >
          <option :value="2024">
            Year: 2024
          </option>
          <option :value="2025">
            Year: 2025
          </option>
          <option :value="2026">
            Year: 2026
          </option>
        </select>
      </div>
    </div>

    <!-- Card table -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div class="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
        <div class="relative w-full md:w-80 shrink-0">
          <i class="fas fa-search w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            v-model="nameFilter"
            type="text"
            placeholder="Filter by employee name (e.g. Huy, Phuoc)..."
            class="pl-9 pr-4 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none w-full text-slate-700"
          >
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap border shadow-sm"
            :class="listFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'"
            @click="listFilter = 'all'"
          >
            All ({{ totalCount }})
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap border shadow-sm"
            :class="listFilter === 'pending' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'"
            @click="listFilter = 'pending'"
          >
            <span class="w-2 h-2 rounded-full bg-current opacity-80" />
            Pending scoring ({{ pendingCount }})
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left whitespace-nowrap">
          <thead>
            <tr class="bg-white border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <th class="py-4 px-6 w-16">
                Employee ID
              </th>
              <th class="py-4 px-6 min-w-[250px]">
                Employee Name
              </th>
              <th class="py-4 px-6 text-center">
                Rank
              </th>
              <th class="py-4 px-6 text-center">
                Progress (Status)
              </th>
              <th class="py-4 px-6 text-center bg-slate-50">
                Self Score
              </th>
              <th class="py-4 px-6 text-center bg-indigo-50/50 text-indigo-800">
                PM Score
              </th>
              <th class="py-4 px-6 text-right w-44">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 text-sm">
            <template v-for="emp in filteredEmployees" :key="emp.id">
              <tr
                class="hover:bg-slate-50/80 transition-colors group"
                :class="[
                  hasKpis(emp) ? 'cursor-pointer' : '',
                  expandedId === emp.id ? 'bg-slate-100/80 border-l-4 border-indigo-500' : '',
                ]"
                @click="hasKpis(emp) && toggleExpand(emp)"
              >
                <td class="py-4 px-6 text-slate-400 font-bold">
                  {{ emp.code }}
                </td>
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0"
                      :class="emp.initialsClass"
                    >
                      {{ emp.initials }}
                    </div>
                    <div>
                      <p class="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {{ emp.name }}
                      </p>
                      <p class="text-xs text-slate-500">
                        {{ emp.role }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-6 text-center">
                  <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">{{ emp.rank }}</span>
                </td>
                <td class="py-4 px-6 text-center">
                  <span :class="statusBadgeClass(emp)">
                    <span
                      v-if="emp.status === 'pending_pm'"
                      class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"
                    />
                    <i
                      v-else-if="emp.status === 'self_scoring'"
                      class="fas fa-pen text-[10px]"
                    />
                    <i
                      v-else
                      class="fas fa-check text-[10px]"
                    />
                    {{ statusLabelVi(emp.status) }}
                  </span>
                </td>
                <td class="py-4 px-6 text-center bg-slate-50">
                  <span v-if="emp.selfScoreDisplay" class="font-bold text-slate-700">{{ emp.selfScoreDisplay }}</span>
                  <span v-else class="text-slate-400 font-medium italic">-</span>
                </td>
                <td class="py-4 px-6 text-center bg-indigo-50/50">
                  <span :class="pmPreviewClass(emp)">{{ pmPreviewText(emp) }}</span>
                </td>
                <td class="py-4 px-6 text-right" @click.stop>
                  <button
                    v-if="hasKpis(emp) && isReadonly"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-colors w-full justify-between border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    :class="expandedId === emp.id ? 'ring-2 ring-slate-300' : ''"
                    @click="toggleExpand(emp)"
                  >
                    <span>Details</span>
                    <i
                      class="fas fa-chevron-down text-xs transition-transform duration-200"
                      :class="expandedId === emp.id ? 'rotate-180' : ''"
                    />
                  </button>
                  <button
                    v-else-if="hasKpis(emp) && emp.canScore"
                    type="button"
                    class="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-colors w-full justify-between border"
                    :class="expandedId === emp.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'"
                    @click="toggleExpand(emp)"
                  >
                    <span>View &amp; Score</span>
                    <i
                      class="fas fa-chevron-down text-xs transition-transform duration-200"
                      :class="expandedId === emp.id ? 'rotate-180' : ''"
                    />
                  </button>
                  <button
                    v-else
                    type="button"
                    disabled
                    class="inline-flex items-center justify-center px-4 py-1.5 bg-white border border-slate-300 text-slate-400 text-xs font-bold rounded-lg shadow-sm cursor-not-allowed w-full"
                  >
                    Cannot score yet
                  </button>
                </td>
              </tr>

              <!-- Expanded panel -->
              <tr v-if="expandedId === emp.id && hasKpis(emp)">
                <td colspan="7" class="p-0 border-b-4 border-indigo-600">
                  <div class="bg-slate-100 p-4 md:p-6 lg:p-8 shadow-inner border-l-4 border-indigo-500">
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
                      <div class="p-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                        <h3 class="font-bold text-slate-800 flex items-center gap-2 text-base">
                          <i class="fas fa-list text-indigo-600" />
                          Detailed Evaluation Table ({{ flattenKpiItems(emp).length }} items) - {{ selectedYear }}
                        </h3>
                      </div>

                      <div class="overflow-x-auto">
                        <table class="w-full text-left">
                          <thead>
                            <tr class="bg-slate-100/50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                              <th class="py-3 px-4 w-10 text-center">
                                #
                              </th>
                              <th class="py-3 px-4 min-w-[220px]">
                                Objectives
                              </th>
                              <th class="py-3 px-4 text-center w-20">
                                Weight
                              </th>
                              <th class="py-3 px-4 text-center w-36">
                                Evidence
                              </th>
                              <th class="py-3 px-4 text-center w-24">
                                Self Score
                              </th>
                              <th class="py-3 px-4 text-center w-32 bg-indigo-50/50 text-indigo-800 border-l border-indigo-100 shadow-inner">
                                PM Score <span class="text-rose-500">*</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-200 text-sm">
                            <template v-for="group in emp.groups" :key="group.groupTitle">
                              <tr class="bg-slate-50 border-y border-slate-200">
                                <td colspan="6" class="py-2.5 px-5 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                                  {{ group.groupTitle }}
                                </td>
                              </tr>
                              <template v-for="item in group.items" :key="item.id">
                                <tr class="hover:bg-slate-50/50 transition-colors">
                                  <td class="py-4 px-4 text-center font-bold text-slate-400">
                                    {{ item.index }}
                                  </td>
                                  <td class="py-4 px-4">
                                    <p class="font-bold text-slate-900">
                                      {{ item.title }}
                                    </p>
                                    <p class="text-[11px] text-slate-500 mt-0.5">
                                      {{ item.target }}
                                    </p>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <span class="bg-slate-100 px-2 py-1 rounded font-bold text-slate-700">{{ item.weight }}</span>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <button
                                      type="button"
                                      class="inline-flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors shadow-sm border"
                                      :class="[
                                        item.evidenceTone === 'emerald'
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                                        evidenceOpen(emp.id, item.id) ? 'ring-2 ring-blue-300' : '',
                                      ]"
                                      @click.stop="toggleEvidence(emp.id, item.id)"
                                    >
                                      <span class="flex items-center gap-1.5">
                                        <i :class="[item.evidenceButtonIcon, 'text-[11px]']" />
                                        {{ item.evidenceButtonLabel }}
                                      </span>
                                      <i
                                        class="fas fa-chevron-down text-[10px] transition-transform duration-200"
                                        :class="evidenceOpen(emp.id, item.id) ? 'rotate-180' : ''"
                                      />
                                    </button>
                                  </td>
                                  <td class="py-4 px-4 text-center">
                                    <div class="font-bold text-slate-600 bg-slate-100 px-2 py-1.5 rounded text-base inline-block min-w-[2rem]">
                                      {{ item.selfScore }}
                                    </div>
                                  </td>
                                  <td class="py-4 px-4 text-center bg-indigo-50/30 border-l border-indigo-50">
                                    <select
                                      class="w-full bg-white border-2 rounded-lg text-base font-bold p-1.5 outline-none focus:border-indigo-500 text-center shadow-sm cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                      :class="pmSelectClass(emp, item)"
                                      :disabled="isReadonly"
                                      :value="pmScores[emp.id]?.[item.id] ?? ''"
                                      @change="setPmScore(emp.id, item.id, ($event.target as HTMLSelectElement).value)"
                                    >
                                      <option value="">
                                        -
                                      </option>
                                      <option v-for="n in 5" :key="n" :value="6 - n">
                                        {{ 6 - n }}
                                      </option>
                                    </select>
                                  </td>
                                </tr>
                                <tr
                                  v-show="evidenceOpen(emp.id, item.id)"
                                  class="bg-slate-100/40"
                                >
                                  <td colspan="6" class="p-0" :class="evidencePanelBorder(item.evidence.accent)">
                                    <div class="p-4 md:p-6 border-l-4" :class="evidenceAccentBorder(item.evidence.accent)">
                                      <h4 class="font-bold text-sm mb-3 flex items-center text-slate-800">
                                        <i :class="[item.evidence.icon, 'w-4 mr-2 text-indigo-600']" />
                                        {{ item.evidence.title }}
                                      </h4>
                                      <table class="w-full text-left text-sm bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                        <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                                          <tr>
                                            <th
                                              v-for="(h, hi) in item.evidence.headers"
                                              :key="hi"
                                              class="p-3 border-b border-slate-200"
                                              :class="hi > 0 ? 'text-center' : ''"
                                            >
                                              {{ h }}
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-100">
                                          <tr v-for="(row, ri) in item.evidence.rows" :key="ri">
                                            <td
                                              v-for="(cell, ci) in row"
                                              :key="ci"
                                              class="p-3 font-medium"
                                              :class="ci > 0 ? 'text-center text-slate-800' : 'text-slate-700'"
                                            >
                                              {{ cell }}
                                            </td>
                                          </tr>
                                        </tbody>
                                        <tfoot v-if="item.evidence.footer" class="bg-slate-50 font-bold">
                                          <tr>
                                            <td
                                              v-for="(cell, fi) in item.evidence.footer"
                                              :key="fi"
                                              class="p-3"
                                              :class="fi > 0 ? 'text-center' : 'text-right'"
                                            >
                                              {{ cell }}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              </template>
                            </template>
                          </tbody>
                          <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold text-sm">
                            <tr>
                              <td colspan="2" class="py-4 px-4 text-right text-slate-500 uppercase tracking-wider text-[11px]">
                                Total Weight:
                              </td>
                              <td class="py-4 px-4 text-center text-slate-800">
                                {{ PM_MANAGER_TOTAL_WEIGHT }} <span class="text-[10px] text-slate-500 font-medium">pts</span>
                              </td>
                              <td colspan="3" />
                            </tr>
                            <tr class="bg-white border-t border-slate-200">
                              <td colspan="4" class="py-4 px-4 text-right text-slate-600 uppercase tracking-wider">
                                Self Average Score:
                              </td>
                              <td class="py-4 px-4 text-center border-x border-slate-200">
                                <span class="text-xl text-slate-700 font-black">{{ selfAvgInPanel(emp) }}</span>
                              </td>
                              <td />
                            </tr>
                            <tr class="bg-indigo-50 border-t border-slate-200">
                              <td colspan="4" class="py-5 px-4 text-right text-indigo-900 uppercase tracking-wider">
                                PM Average Score:
                              </td>
                               <td class="py-5 px-4 text-right text-indigo-900 uppercase tracking-wider">
                              </td>
                              <td class="py-5 px-4 text-center bg-indigo-100 shadow-inner">
                                <span class="text-2xl text-indigo-700 font-black">{{ pmAvgInPanel(emp) }}</span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div class="p-6 border-t border-slate-200 bg-white">
                        <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <i class="fas fa-comment-dots text-indigo-600" />
                          Evaluation Summary &amp; Confirmation (Final Review)
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                          <div class="space-y-2 opacity-80 pointer-events-none">
                            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Employee's Comment (Read-only)</label>
                            <div class="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 overflow-y-auto break-words whitespace-pre-wrap">
                              {{ emp.employeeComment ?? '—' }}
                            </div>
                          </div>
                          <div class="space-y-2">
                            <label class="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Supervisor Comment (Required)</label>
                            <textarea
                              v-model="supervisorComments[emp.id]"
                              class="w-full h-24 p-3 bg-white border-2 border-indigo-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none resize-none shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                              :disabled="isReadonly"
                              placeholder="Enter an overall comment to explain the score you just gave..."
                            />
                          </div>
                        </div>
                        <div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            class="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="isReadonly"
                            @click="saveDraft(emp)"
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            class="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="isReadonly"
                            @click="confirmDone(emp)"
                          >
                            <i class="fas fa-check-circle text-sm" /> Confirm Completion
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredEmployees.length === 0"
        class="p-12 text-center text-slate-500 text-sm font-medium"
      >
        No employees match the filter.
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
