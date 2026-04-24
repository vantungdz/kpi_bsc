<script setup lang="ts">
import {computed, onMounted, reactive, ref, watch} from "vue";
import {leaderKpiService} from "@/services/modules/kpi-leader.service";
import type {LeaderKpiInformationResponse} from "@/types/kpi";
import {KPI_TYPE_INDIVIDUAL} from "@/types/constant";

const props = defineProps<{
  year: number;
  isReadonly: boolean;
}>();

const emit = defineEmits<{
  (e: "open-drawer", row: any): void;
}>();

// ==========================================
// STATE QUẢN LÝ DỮ LIỆU CỦA BẢNG
// ==========================================
const loading = ref(true);
const apiData = ref<LeaderKpiInformationResponse | null>(null);

// Form comments
const employeeComment = ref("");
const supervisorComment = ref("");

// Điểm đánh giá (lưu theo kpiCode) và các dòng KPI tự tạo
const selfScores = reactive<Record<string, number>>({});
const leaderExtraKpiRows = ref<any[]>([]);

// ==========================================
// FETCH API
// ==========================================
async function fetchData() {
  loading.value = true;
  try {
    const data = await leaderKpiService.getKpiInfo(props.year, KPI_TYPE_INDIVIDUAL);
    apiData.value = data;
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu Personal KPI:", error);
  } finally {
    loading.value = false;
  }
}

// ==========================================
// TÍNH TOÁN TỔNG ĐIỂM TRỰC TIẾP TỪ API DATA
// ==========================================
const totals = computed(() => {
  let totalWeight = 0;
  let weighted = 0;
  let pmWeighted = 0;
  let pmWeightSum = 0;

  // Tính điểm các KPI gốc từ API
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

  // Tính điểm các KPI được tạo thêm (Extra rows)
  leaderExtraKpiRows.value.forEach((extra) => {
    const w = extra.weight || 0;
    totalWeight += w;

    const s = selfScores[extra.kpiCode] ?? 0;
    weighted += s * w;

    // Tính điểm PM cho Extra rows
    const pm = extra.endPmScore ?? 0;
    pmWeighted += pm * w;
    pmWeightSum += w;
  });

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

// ==========================================
// HÀM XỬ LÝ (ACTIONS)
// ==========================================
function submitEvaluation() {
  if (props.isReadonly) return;
  console.log("Submit Đánh Giá lên PM", {
    year: props.year,
    totals: totals.value,
    scores: {...selfScores},
    employeeComment: employeeComment.value,
  });
}

// Hàm format dữ liệu để quăng ra component cha cho Drawer
function handleOpenDrawer(assign: any) {
  emit("open-drawer", {
    ...assign,
    // Bổ sung vài trường mock nếu Drawer cha đang cần map theo structure cũ
    code: assign.kpiCode,
    evidenceDrawerName: assign.kpiName,
    evidenceTargetDesc: assign.targetDescription,
    caseType: 'general', // Mock
    evidenceNote: assign.evidences || "Mock evidence note",
  });
}

// Watch để fetch lại data khi năm thay đổi
watch(() => props.year, () => {
  leaderExtraKpiRows.value = [];
  fetchData();
});

onMounted(fetchData);

// Helpers giao diện Mock
const MOCK_EVALUATION_STATUS = {
  dot: "bg-amber-400 ring-2 ring-amber-100",
  chip: "border-amber-200 bg-amber-50 text-amber-950",
  labelVi: "Mock Status" // Mock Label
};

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
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold text-[10px] whitespace-nowrap"
                  :class="getStatusStyle(assign.statusCode)"
                >
                  <i class="fas" :class="getStatusIcon(assign.statusCode)"></i> {{ assign.statusDesc }}
              </span>
              </td>

              <td class="max-w-xs py-4 px-5 align-top">
                <p class="text-sm font-medium text-slate-700">{{ assign.targetDescription || 'Mock Target' }}</p>
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
                          @click.stop="handleOpenDrawer(assign)">
                    <i class="fas fa-eye text-xs"></i> Detail
                  </button>
                  <button v-else type="button"
                          class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm"
                          @click.stop="handleOpenDrawer(assign)">
                    <i class="fas fa-pen text-xs"></i> Edit
                  </button>
                </div>
              </td>
            </tr>
          </template>

          <template v-if="leaderExtraKpiRows.length > 0">
            <tr class="bg-amber-50/80 border-y border-amber-100">
              <td colspan="8" class="py-2 px-5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                (I) Individual KPI (tự tạo)
              </td>
            </tr>
            <tr v-for="(extra, extraIndex) in leaderExtraKpiRows" :key="extra.assignmentId"
                class="group transition-colors hover:bg-slate-50">
              <td class="py-4 px-5 text-center text-sm font-semibold text-slate-400">{{ extraIndex + 1 }}</td>
              <td class="py-4 px-5">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p class="text-sm font-bold text-slate-900">{{ extra.kpiName }}</p>
                  <span
                      class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none"
                      :class="MOCK_EVALUATION_STATUS.chip">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="MOCK_EVALUATION_STATUS.dot"/>
                      {{ MOCK_EVALUATION_STATUS.labelVi }}
                    </span>
                </div>
              </td>
              <td class="max-w-xs py-4 px-5 align-top">
                <p class="text-sm font-medium text-slate-700">{{ extra.targetDescription }}</p>
              </td>
              <td class="py-4 px-5 text-center">
                  <span
                      class="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-sm rounded-md border border-slate-200">
                    {{ extra.weight || 0 }}
                  </span>
              </td>
              <td class="py-4 px-5 text-center align-middle">
                <span class="text-sm font-semibold leading-snug text-slate-700 inline-block">Mock Actual</span>
              </td>
              <td class="bg-sky-50/50 py-4 px-5 text-center align-middle">
                <select v-model.number="selfScores[extra.kpiCode]"
                        class="max-w-[4rem] w-full cursor-pointer rounded-lg border px-2 py-1.5 text-sm font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                        :class="isReadonly ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-sky-200 bg-white text-slate-900 hover:border-sky-300'"
                        :disabled="isReadonly">
                  <option value="0">0</option>
                  <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                </select>
              </td>
              <td class="py-4 px-5 text-center align-middle">
                <span class="text-slate-500 font-medium text-sm">0</span>
              </td>
              <td class="py-4 px-5 text-center align-middle">
                <button type="button"
                        class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        @click="handleOpenDrawer(extra)">
                  <i class="fas fa-pen text-sm"/>
                </button>
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
        <button v-if="!isReadonly" type="button"
                class="px-4 py-2 bg-slate-900 border border-transparent rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="submitEvaluation">
          <i class="fas fa-paper-plane text-xs"/> Submit Đánh Giá
        </button>
        <div v-else class="text-sm text-slate-500 font-medium">
          Dữ liệu năm {{ year }} chỉ để xem
        </div>
      </div>
    </div>
  </div>
</template>