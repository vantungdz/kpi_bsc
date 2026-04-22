<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gmKpiService } from '@/services/modules/kpi-gm.service'
import type { GmKpiDashboard, KpiSection, KpiSectionMember } from '@/types/kpi'

// ── State ──────────────────────────────────────────────────────────────────────
const loading = ref(true)
const loadingMembers = ref(false)
const dashboardData = ref<GmKpiDashboard | null>(null)
const selectedYear = ref(new Date().getFullYear())
const selectedSection = ref<KpiSection | null>(null)
const sectionMembers = ref<KpiSectionMember[]>([])
const memberSearch = ref('')

const PHASE_STEPS = [
  { key: 'target_setup', label: 'Target Setup' },
  { key: 'mid_year',     label: 'Mid-Year Review' },
  { key: 'year_end',     label: 'Year-End Evaluation' },
]

// ── Data loading ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  loading.value = true
  try {
    dashboardData.value = await gmKpiService.getDashboard(selectedYear.value)
  } finally {
    loading.value = false
  }
}

async function loadSectionMembers(sectionId: string) {
  loadingMembers.value = true
  try {
    sectionMembers.value = await gmKpiService.getSectionMembers(sectionId, selectedYear.value)
  } finally {
    loadingMembers.value = false
  }
}

onMounted(loadDashboard)

// ── Navigation ─────────────────────────────────────────────────────────────────
async function handleViewDetail(section: KpiSection) {
  selectedSection.value = section
  await loadSectionMembers(section.id)
  window.scrollTo(0, 0)
}

function handleBack() {
  selectedSection.value = null
  sectionMembers.value = []
  memberSearch.value = ''
}

// ── Computed ───────────────────────────────────────────────────────────────────
const currentPhaseIndex = computed(() => {
  if (!dashboardData.value) return 0
  return PHASE_STEPS.findIndex(s => s.key === dashboardData.value!.currentPhase)
})

const filteredMembers = computed(() => {
  if (!memberSearch.value.trim()) return sectionMembers.value
  const q = memberSearch.value.toLowerCase()
  return sectionMembers.value.filter(m =>
    m.name.toLowerCase().includes(q) || m.rank.toLowerCase().includes(q)
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function getProgressBarClass(pct: number) {
  return pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
}

function getPctTextClass(pct: number) {
  return pct === 100 ? 'text-emerald-600' : 'text-blue-600'
}

function getFinalStatusClass(status: string) {
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Evaluating') return 'bg-blue-100 text-blue-700'
  return 'bg-orange-100 text-orange-700'
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <i class="fas fa-spinner fa-spin text-blue-500 text-2xl mr-3" />
      <span class="text-slate-500 font-medium">Đang tải dữ liệu KPI...</span>
    </div>

    <template v-else-if="dashboardData">

      <!-- ====================== VIEW 1: OVERVIEW ====================== -->
      <div v-if="!selectedSection" class="space-y-6 animate-view-overview">

        <!-- Header bar -->
        <div class="flex justify-between items-end mb-6">
          <div>
            <h2 class="text-2xl font-bold text-slate-800">KPI Overview</h2>
            <p class="text-slate-500 text-sm mt-1">Theo dõi tiến độ triển khai KPI toàn bộ department.</p>
          </div>
          <select
            v-model="selectedYear"
            class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            @change="loadDashboard"
          >
            <option :value="2024">Kỳ Đánh Giá 2024</option>
            <option :value="2025">Kỳ Đánh Giá 2025</option>
          </select>
        </div>

        <!-- 1. KPI ROADMAP STEPPER -->
        <div class="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div class="flex justify-between items-center mb-8">
            <h3 class="text-lg font-bold text-slate-800">
              KPI Implementation Roadmap ({{ selectedYear }})
            </h3>
            <span class="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
              Phase {{ currentPhaseIndex + 1 }}
            </span>
          </div>

          <div class="relative flex w-full">
            <!-- Base line -->
            <div class="absolute top-5 left-[16.66%] right-[16.66%] h-[2px] bg-slate-100 z-0 rounded-full" />
            <!-- Progress line -->
            <div
              class="absolute top-5 left-[16.66%] h-[2px] bg-blue-500 z-0 rounded-full transition-all duration-1000"
              :style="{ width: `${(currentPhaseIndex / 2) * 66.66}%` }"
            />

            <!-- Steps -->
            <div
              v-for="(step, idx) in PHASE_STEPS"
              :key="step.key"
              class="relative z-10 flex-1 flex flex-col items-center"
            >
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center font-bold ring-8 ring-white shadow-sm"
                :class="idx < currentPhaseIndex
                  ? 'bg-blue-600 text-white'
                  : idx === currentPhaseIndex
                    ? 'bg-white border-2 border-blue-600'
                    : 'bg-white border-2 border-slate-200'"
              >
                <i v-if="idx < currentPhaseIndex" class="fas fa-check-circle text-sm" />
                <span v-else-if="idx === currentPhaseIndex" class="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />
                <span v-else class="w-2 h-2 bg-slate-300 rounded-full" />
              </div>
              <div class="text-center mt-4">
                <p
                  class="font-bold text-sm"
                  :class="idx === currentPhaseIndex ? 'text-blue-600' : 'text-slate-800'"
                >
                  {{ step.label }}
                </p>
                <p class="text-xs mt-1" :class="idx <= currentPhaseIndex ? 'text-blue-500 font-medium' : 'text-slate-400'">
                  <template v-if="idx < currentPhaseIndex">Completed (100%)</template>
                  <template v-else-if="idx === currentPhaseIndex">
                    In Progress ({{ dashboardData.phaseProgressPct }}%)
                  </template>
                  <template v-else>Chưa bắt đầu</template>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. GM'S CORE TARGETS BREAKDOWN -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div class="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl opacity-50 pointer-events-none" />

          <div class="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i class="fas fa-chart-bar text-indigo-600" />
                GM's Core Targets Breakdown
              </h3>
              <p class="text-xs text-slate-500 mt-1">Đóng góp chi tiết từng section vào mục tiêu C-Level.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
            <div
              v-for="target in dashboardData.coreTargets"
              :key="target.id"
              class="bg-slate-50/50 rounded-xl border border-slate-200 p-5 flex flex-col"
            >
              <div class="flex justify-between items-start mb-4">
                <div>
                  <p class="text-sm font-bold text-slate-800">{{ target.code }} {{ target.name }}</p>
                  <p class="text-xs text-slate-500 mt-0.5">Target: {{ target.target }}</p>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold" :class="target.overallMet ? 'text-emerald-600' : 'text-rose-500'">
                    {{ target.overallValue }}
                  </p>
                  <p class="text-xs text-slate-500">Overall</p>
                </div>
              </div>

              <div class="w-full bg-slate-200 rounded-full h-1.5 mb-5">
                <div
                  class="h-1.5 rounded-full"
                  :class="target.overallMet ? 'bg-emerald-500' : 'bg-blue-500'"
                  :style="{ width: `${target.progressPct}%` }"
                />
              </div>

              <div class="mt-auto">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Breakdown by Section</p>
                <div class="space-y-2 pr-2 max-h-36 overflow-y-auto">
                  <div
                    v-for="row in target.breakdown"
                    :key="row.sectionId"
                    class="flex justify-between items-center text-sm border-b border-slate-100 pb-1 last:border-0"
                  >
                    <span class="text-slate-600">{{ row.sectionName }}</span>
                    <span
                      class="font-bold flex items-center gap-1"
                      :class="row.met ? 'text-emerald-600' : 'text-rose-500'"
                    >
                      {{ row.value }}
                      <i v-if="row.warning" class="fas fa-exclamation-triangle text-xs" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. SECTIONS TABLE -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-building text-blue-600" />
              Statistics by Section
            </h3>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-slate-100 text-sm text-slate-500">
                  <th class="py-4 px-6 font-medium">Department / Section</th>
                  <th class="py-4 px-6 font-medium">Manager (PM)</th>
                  <th class="py-4 px-6 font-medium w-[15%]">Target Setup</th>
                  <th class="py-4 px-6 font-medium w-[15%]">Mid-Year</th>
                  <th class="py-4 px-6 font-medium w-[15%]">Year-End</th>
                  <th class="py-4 px-6 font-medium text-right w-[10%]">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="section in dashboardData.sections"
                  :key="section.id"
                  class="border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                >
                  <td class="py-4 px-6">
                    <div class="font-bold text-slate-800">{{ section.name }}</div>
                    <div class="text-xs text-slate-500 mt-0.5">{{ section.memberCount }} members</div>
                  </td>
                  <td class="py-4 px-6 text-sm font-medium text-slate-700">{{ section.managerName }}</td>

                  <!-- Target Setup -->
                  <td class="py-4 px-6 align-middle">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-slate-600 font-medium">{{ section.targetSetupPct }}%</span>
                      <i v-if="section.targetSetupPct === 100" class="fas fa-check-circle text-emerald-500" />
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2.5">
                      <div class="bg-emerald-500 h-2.5 rounded-full transition-all" :style="{ width: `${section.targetSetupPct}%` }" />
                    </div>
                  </td>

                  <!-- Mid-Year -->
                  <td class="py-4 px-6 align-middle">
                    <div class="flex justify-between text-xs mb-1">
                      <span :class="getPctTextClass(section.midYearPct)" class="font-medium">{{ section.midYearPct }}%</span>
                      <i v-if="section.midYearPct === 100" class="fas fa-check-circle text-emerald-500" />
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2.5">
                      <div :class="getProgressBarClass(section.midYearPct)" class="h-2.5 rounded-full transition-all" :style="{ width: `${section.midYearPct}%` }" />
                    </div>
                  </td>

                  <!-- Year-End -->
                  <td class="py-4 px-6 align-middle">
                    <div class="flex justify-between text-xs mb-1">
                      <span :class="getPctTextClass(section.yearEndPct)" class="font-medium">{{ section.yearEndPct }}%</span>
                      <span v-if="section.pendingCount > 0" class="text-orange-500 font-bold">{{ section.pendingCount }} pending</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2.5">
                      <div :class="getProgressBarClass(section.yearEndPct)" class="h-2.5 rounded-full transition-all" :style="{ width: `${section.yearEndPct}%` }" />
                    </div>
                  </td>

                  <td class="py-4 px-6 text-right align-middle">
                    <button
                      class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100"
                      @click="handleViewDetail(section)"
                    >
                      Detail <i class="fas fa-chevron-right text-xs" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. DEEP DIVE SUMMARY -->
        <h3 class="text-lg font-bold text-slate-800 mb-4 mt-8 flex items-center gap-2">
          <i class="fas fa-chart-pie text-blue-600" />
          Evaluation Deep Dive Summary
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

          <!-- Card 1: Headcount -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-center gap-4 mb-4">
              <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><i class="fas fa-users text-xl" /></div>
              <div>
                <p class="text-sm text-slate-500 font-medium">Total Evaluated Headcount</p>
                <p class="text-2xl font-bold text-slate-800">
                  {{ dashboardData.summary.totalMembers }}
                  <span class="text-sm font-normal text-slate-400">members</span>
                </p>
              </div>
            </div>
            <div class="space-y-2 pt-4 border-t border-slate-100">
              <div
                v-for="rank in dashboardData.summary.byRank"
                :key="rank.label"
                class="flex justify-between text-xs font-medium text-slate-600"
              >
                <span class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-slate-400" />
                  {{ rank.label }}
                </span>
                <span>{{ rank.count }}</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Performance Distribution -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-center gap-4 mb-4">
              <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><i class="fas fa-check-circle text-xl" /></div>
              <div>
                <p class="text-sm text-slate-500 font-medium">Year-End Completed</p>
                <p class="text-2xl font-bold text-slate-800">
                  {{ dashboardData.summary.yearEndCompleted }}
                  <span class="text-sm font-normal text-slate-400">members</span>
                </p>
              </div>
            </div>
            <div class="space-y-2 pt-4 border-t border-slate-100">
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500" /> High Performers (&ge; 4.0)</span>
                <span>{{ dashboardData.summary.highPerformers }}</span>
              </div>
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500" /> Meets Target (3.0 - 3.9)</span>
                <span>{{ dashboardData.summary.meetsTarget }}</span>
              </div>
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-rose-500" /> Underperforming (&lt; 3.0)</span>
                <span class="text-rose-600 font-bold">{{ dashboardData.summary.underperforming }}</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Pending -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div class="flex items-center gap-4 mb-4">
              <div class="p-3 bg-orange-50 text-orange-600 rounded-xl"><i class="fas fa-clock text-xl" /></div>
              <div>
                <p class="text-sm text-slate-500 font-medium">Pending Evaluation</p>
                <p class="text-2xl font-bold text-slate-800">
                  {{ dashboardData.summary.pendingEvaluation }}
                  <span class="text-sm font-normal text-slate-400">members</span>
                </p>
              </div>
            </div>
            <div class="space-y-2 pt-4 border-t border-slate-100">
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-orange-300" /> Missing Evidence</span>
                <span>{{ dashboardData.summary.missingEvidence }}</span>
              </div>
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-orange-500" /> Pending PM/Leader Approval</span>
                <span>{{ dashboardData.summary.pendingApproval }}</span>
              </div>
              <div class="flex justify-between text-xs font-medium text-slate-600">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-rose-500" /> Overdue / Escalated</span>
                <span class="text-rose-600 font-bold">{{ dashboardData.summary.overdue }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ====================== VIEW 2: SECTION DETAIL ====================== -->
      <div v-else class="space-y-6 animate-view-detail">

        <!-- Detail Header -->
        <div class="flex items-center gap-4">
          <button
            class="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            @click="handleBack"
          >
            <i class="fas fa-arrow-left" />
          </button>
          <div>
            <h2 class="text-2xl font-bold text-slate-800">{{ selectedSection!.name }}</h2>
            <p class="text-sm text-slate-500">
              Managed by: <span class="font-medium text-slate-700">{{ selectedSection!.managerName }}</span>
              &nbsp;&bull;&nbsp; {{ selectedSection!.memberCount }} members
            </p>
          </div>
        </div>

        <!-- Section stats -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex gap-8">
            <div>
              <p class="text-sm text-slate-500 mb-1">Target Setup</p>
              <p class="text-xl font-bold text-emerald-600">{{ selectedSection!.targetSetupPct }}%</p>
            </div>
            <div class="w-px bg-slate-200" />
            <div>
              <p class="text-sm text-slate-500 mb-1">Mid-Year Update</p>
              <p class="text-xl font-bold text-emerald-600">{{ selectedSection!.midYearPct }}%</p>
            </div>
            <div class="w-px bg-slate-200" />
            <div>
              <p class="text-sm text-slate-500 mb-1">Year-End</p>
              <p class="text-xl font-bold text-blue-600">{{ selectedSection!.yearEndPct }}%</p>
            </div>
          </div>
          <button
            v-if="selectedSection!.pendingCount > 0"
            class="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 font-bold text-sm rounded-lg hover:bg-orange-200"
          >
            <i class="fas fa-exclamation-circle" />
            Approve {{ selectedSection!.pendingCount }} tasks
          </button>
        </div>

        <!-- Member list -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 class="text-lg font-bold text-slate-800">Member List</h3>
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                v-model="memberSearch"
                type="text"
                placeholder="Search name, rank..."
                class="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div v-if="loadingMembers" class="flex items-center justify-center py-12">
            <i class="fas fa-spinner fa-spin text-blue-500 mr-2" />
            <span class="text-slate-500 text-sm">Loading...</span>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="bg-white border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th class="py-3 px-6 font-medium">Employee</th>
                  <th class="py-3 px-6 font-medium w-20">Rank</th>
                  <th class="py-3 px-6 font-medium text-center w-[15%]">Target</th>
                  <th class="py-3 px-6 font-medium text-center w-[15%]">Mid-Year</th>
                  <th class="py-3 px-6 font-medium text-center w-[15%]">Final Eval</th>
                  <th class="py-3 px-6 font-medium text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="member in filteredMembers"
                  :key="member.id"
                  class="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td class="py-3 px-6 font-medium text-slate-800">{{ member.name }}</td>
                  <td class="py-3 px-6 text-sm text-slate-500">{{ member.rank }}</td>
                  <td class="py-3 px-6 text-center">
                    <span class="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                      {{ member.targetStatus }}
                    </span>
                  </td>
                  <td class="py-3 px-6 text-center">
                    <span class="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                      {{ member.midYearStatus }}
                    </span>
                  </td>
                  <td class="py-3 px-6 text-center">
                    <span :class="getFinalStatusClass(member.finalStatus)" class="inline-block px-2 py-1 text-xs font-bold rounded">
                      {{ member.finalStatus }} {{ member.score !== null ? `(${member.score})` : '' }}
                    </span>
                  </td>
                  <td class="py-3 px-6 text-center">
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View KPI Sheet">
                      <i class="fas fa-file-alt text-sm" />
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredMembers.length === 0">
                  <td colspan="6" class="py-8 text-center text-slate-400 text-sm">Không tìm thấy thành viên phù hợp.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>
