<script setup lang="ts">
import {computed, onMounted, ref, watch} from "vue";
import {useToast} from "vue-toastification";
import {leaderKpiService} from "@/services/modules/kpi-leader.service";
import {pmKpiService} from "@/services/modules/kpi-pm.service";
import type {LeaderKpiInformationResponse} from "@/types/kpi";
import {KPI_TYPE_INDIVIDUAL} from "@/types/constant";
import {KPI_STATUS} from "@/config/constants";
import {getSubmitButtonState} from "@/utils/common";
import EvidenceDrawer from '@/components/leader/drawer/EvidenceDrawer.vue';

const toast = useToast();

const props = defineProps<{
  year: number;
  isReadonly: boolean;
}>();

// ==========================================
// 1. CORE DATA STATE
// ==========================================
const loading = ref(true);
const apiData = ref<LeaderKpiInformationResponse | null>(null);

const employeeComment = ref("");
const supervisorComment = ref("");

// ==========================================
// 2. DRAWER STATE
// ==========================================
const isDrawerOpen = ref(false);
const selectedKpi = ref<any>(null);

function openEvidence(assign: any) {
  selectedKpi.value = assign;
  isDrawerOpen.value = true;
}

function onEvidenceSaved(payload: any) {
  // Cập nhật giá trị hiển thị tức thời trên table trước khi reload (nếu cần)
  if (selectedKpi.value) {
    selectedKpi.value.endSelfScore = payload.selfScore;
    // Dữ liệu chứng chỉ có thể được gán lại vào đây tùy cấu trúc model
  }
  isDrawerOpen.value = false;
}

// ==========================================
// 3. COMPUTED (TOTALS & BUTTON STATE)
// ==========================================
const totals = computed(() => {
  let totalWeight = 0;
  let weighted = 0;
  let pmWeighted = 0;
  let pmWeightSum = 0;

  // Chỉ tính toán trên data thật từ API
  if (apiData.value?.categories) {
    apiData.value.categories.forEach((category) => {
      category.assignments.forEach((assign) => {
        const w = assign.weight || 0;
        totalWeight += w;

        const s = assign.endSelfScore ?? 0;
        weighted += s * w;

        const pm = assign.endPmScore ?? 0;
        pmWeighted += pm * w;
        pmWeightSum += w;
      });
    });
  }

  const averageScore = totalWeight > 0 ? weighted / totalWeight : 0;
  const averagePmScore = pmWeightSum > 0 ? pmWeighted / pmWeightSum : 0;

  return {
    totalWeight,
    weightedSelfPoints: Math.round(weighted * 10) / 10,
    weightedPmPoints: Math.round(pmWeighted * 10) / 10,
    averageScore,
    averagePmScore: Math.round(averagePmScore * 100) / 100,
  };
});

const currentStatusCode = computed(() => {
  const firstAssignment = apiData.value?.categories?.[0]?.assignments?.[0];
  return firstAssignment?.statusCode ?? KPI_STATUS.INACTIVE;
});

const buttonState = computed(() => {
  if (!apiData.value?.kpiCycle) {
    return {show: false, disabled: true, text: null, actionType: 'COMPLETED'};
  }
  return getSubmitButtonState(apiData.value.kpiCycle, currentStatusCode.value);
});

// ==========================================
// 4. API FETCHING & ACTIONS
// ==========================================
async function fetchData() {
  loading.value = true;
  try {
    apiData.value = await leaderKpiService.getKpiInfo(props.year, KPI_TYPE_INDIVIDUAL);
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu Personal KPI:", error);
  } finally {
    loading.value = false;
  }
}

async function submitEvaluation() {
  if (props.isReadonly) return;

  // Xác định trạng thái tiếp theo dựa trên phase
  let nextStatusCode: number = KPI_STATUS.PENDING_ACCEPTANCE;
  if (buttonState.value.actionType === 'GOAL_SETTING') {
    nextStatusCode = KPI_STATUS.ACCEPTED;
  } else if (buttonState.value.actionType === 'MID_YEAR') {
    nextStatusCode = KPI_STATUS.FIRST_WAITING_GM_APPROVAL;
  } else if (buttonState.value.actionType === 'END_YEAR') {
    nextStatusCode = KPI_STATUS.SECOND_WAITING_GM_APPROVAL;
  }

  try {
    await pmKpiService.bulkUpdateKpiStatus({
      cycleId: apiData.value?.kpiCycle?.id,
      statusCode: nextStatusCode
    });

    toast.success('Update KPI statuses successfully!');
    fetchData(); // Reload table
  } catch (error) {
    console.error('Failed to update KPI statuses', error);
    toast.error('Có lỗi xảy ra khi cập nhật trạng thái KPI.');
  }
}

watch(() => props.year, () => {
  fetchData();
});

onMounted(fetchData);

// ==========================================
// 5. UI HELPERS
// ==========================================
const getStatusStyle = (code: string) => {
  const styles: Record<string, string> = {
    INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
    WAITING_PM_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    WAITING_GM_APPROVAL: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_ACCEPTANCE: "bg-sky-50 text-sky-700 border-sky-200",
    ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    COMPLETED: "bg-indigo-50 text-indigo-700 border-indigo-200"
  };
  return styles[code] || "bg-slate-50 text-slate-500 border-slate-100";
};

const getStatusIcon = (code: string) => {
  if (code.includes('WAITING')) return 'fa-clock';
  if (code === 'ACCEPTED') return 'fa-play-circle';
  if (code === 'COMPLETED') return 'fa-check-double';
  if (code === 'REJECTED') return 'fa-times-circle';
  return 'fa-info-circle';
};
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative"
         :class="isReadonly ? 'opacity-95' : ''">

      <div v-if="loading" class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
        <i class="fas fa-spinner fa-spin text-blue-500 text-3xl"></i>
      </div>

      <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
          <i class="fas fa-list-alt text-slate-400"/>
          Chi Tiết Bảng KPI Cá Nhân
        </h3>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="border-b border-slate-200 bg-white">
          <tr class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th class="w-12 px-5 py-4 text-center">STT</th>
            <th class="min-w-[200px] px-5 py-4">Hạng Mục (Objectives)</th>
            <th class="min-w-[10rem] px-5 py-4 text-center">Trạng thái KPI</th>
            <th class="px-5 py-4">Chỉ Tiêu (Target)</th>
            <th class="w-24 px-5 py-4 text-center">Trọng số (W)</th>
            <th class="min-w-[8rem] px-5 py-4 text-center">Actual Result</th>
            <th class="w-28 px-5 py-4 text-center text-slate-600">Self Score</th>
            <th class="w-28 px-5 py-4 text-center">PM Score</th>
            <th class="w-28 px-5 py-4 text-right">Thao tác</th>
          </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
          <tr v-if="!apiData?.categories?.length && !loading">
            <td colspan="8" class="p-8 text-center text-slate-500">Chưa có dữ liệu KPI cho năm {{ year }}</td>
          </tr>

          <template v-for="(category, catIndex) in apiData?.categories" :key="'cat-' + catIndex">
            <tr class="bg-amber-50/80 border-y border-amber-100">
              <td colspan="8" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                {{ category.name }}
              </td>
            </tr>

            <tr v-for="(assign, assignIndex) in category.assignments" :key="assign.assignmentId"
                class="group transition-colors hover:bg-slate-50">

              <td class="py-4 px-5 text-center text-sm font-semibold text-slate-400">
                {{ assignIndex + 1 }}
              </td>

              <td class="py-4 px-5">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="text-sm font-bold text-slate-900">{{ assign.kpiCode }} {{ assign.kpiName }}</p>
                </div>
              </td>

              <td class="px-4 py-4 text-center">
                <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold text-[10px] whitespace-nowrap"
                    :class="getStatusStyle(assign.statusName)"
                >
                  <i class="fas" :class="getStatusIcon(assign.statusName)"></i> {{ assign.statusDesc }}
                </span>
              </td>

              <td class="max-w-xs py-4 px-5 align-top">
                <p class="text-sm font-medium text-slate-700">{{ assign.targetDescription || '' }}</p>
              </td>

              <td class="py-4 px-5 text-center">
                  <span
                      class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md border border-slate-200">
                    {{ assign.weight || 0 }}
                  </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                  <span class="text-sm font-semibold leading-snug text-slate-700 inline-block">
                    -
                  </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                <span class="text-sm font-semibold leading-snug text-slate-700 inline-block">
                    {{ assign.endSelfScore ?? 0 }}
                </span>
              </td>

              <td class="py-4 px-5 text-center align-middle">
                  <span class="text-slate-500 font-medium text-sm">
                    {{ assign.endPmScore ?? 0 }}
                  </span>
              </td>

              <td class="py-4 px-5 text-right align-middle">
                <div class="flex items-center justify-end gap-2">
                  <button v-if="isReadonly" type="button"
                          class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 shadow-sm"
                          @click.stop="openEvidence(assign)">
                    <i class="fas fa-eye text-xs"></i> Detail
                  </button>
                  <button v-else type="button"
                          class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm"
                          @click.stop="openEvidence(assign)">
                    <i class="fas fa-pen text-xs"></i> Edit
                  </button>
                </div>
              </td>
            </tr>
          </template>
          </tbody>

          <tfoot class="bg-slate-100/80 border-t-2 border-slate-200 font-bold">
          <tr>
            <td colspan="3" class="py-4 px-5 text-right text-slate-700 uppercase text-xs tracking-wider">
              Tổng cộng (Total score):
            </td>
            <td class="py-4 px-5 text-center">
                <span class="text-sm text-slate-800">
                  {{ totals.totalWeight % 1 === 0 ? totals.totalWeight.toFixed(0) : totals.totalWeight.toFixed(1) }}
                </span>
              <span class="text-xs text-slate-500 font-medium ml-1">pts</span>
            </td>
            <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">—</td>
            <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-700">
              {{ totals.weightedSelfPoints }}
            </td>
            <td class="py-4 px-5 text-center">
              <span class="text-sm text-slate-800">{{ totals.weightedPmPoints }}</span>
            </td>
            <td class="py-4 px-5"></td>
          </tr>
          <tr class="bg-violet-50/50 border-t border-slate-200">
            <td colspan="3" class="py-4 px-5 text-right text-violet-800 uppercase text-xs tracking-wider">
              Điểm trung bình (Average score):
            </td>
            <td class="py-4 px-5"></td>
            <td class="py-4 px-5 text-center text-xs font-medium text-slate-400">—</td>
            <td class="bg-sky-50/50 py-4 px-5 text-center text-sm text-slate-700">
              {{ totals.averageScore.toFixed(2) }}
            </td>
            <td class="py-4 px-5 text-center bg-violet-100/80">
                <span class="text-lg text-violet-700 font-extrabold">
                  {{ totals.averagePmScore.toFixed(2) }}
                </span>
            </td>
            <td class="py-4 px-5"></td>
          </tr>
          </tfoot>
        </table>
      </div>

      <div class="p-6 border-t border-slate-200 bg-slate-50/30">
        <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="fas fa-comments text-blue-600"/>
          Comment of employee and supervisor
        </h4>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Employee's comment
              </label>
              <textarea v-model="employeeComment" rows="4" placeholder="Nhập ý kiến của bạn..."
                        class="w-full resize-none p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
                        :class="{ 'bg-slate-100 text-slate-500': isReadonly }"
                        :readonly="isReadonly"/>
            </div>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Supervisor Comment
              </label>
              <textarea v-model="supervisorComment" rows="4"
                        placeholder="Supervisor sẽ nhập ý kiến tại đây..."
                        class="w-full resize-none p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none"
                        readonly/>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-50 p-4 border-t border-slate-200 flex justify-center gap-3">
        <button v-if="!isReadonly && buttonState.show" type="button"
                :disabled="buttonState.disabled"
                class="px-6 py-2.5 bg-slate-800 border border-transparent rounded-lg text-sm font-bold text-white shadow-md hover:bg-slate-900 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="submitEvaluation">
          <i class="fas fa-paper-plane text-sm"/> {{ buttonState.text }}
        </button>

        <div v-else-if="isReadonly" class="text-sm text-slate-500 font-medium">
          Dữ liệu năm {{ year }} chỉ để xem
        </div>
      </div>
    </div>

    <EvidenceDrawer
        :open="isDrawerOpen"
        :item="selectedKpi"
        @close="isDrawerOpen = false"
        @save="onEvidenceSaved"
    />
  </div>
</template>