<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  nextTick,
} from "vue";
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  RadarController,
  DoughnutController,
  ArcElement,
  PointElement,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration,
} from "chart.js";
import { gmKpiService } from "@/services/modules/kpi-gm.service";
import type {
  GmReportLevelDistributionData,
  GmReportSectionBellCurveData,
  GmReportSectionAnalyticsData,
  GmReportComplianceData,
} from "@/types/gm-report";

/** Option phòng ban cho dropdown / checkbox — không phụ thuộc Bell Curve (tránh bellData null khi vào thẳng tab Levels). */
type ReportSectionOption = { id: string; label: string };

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  RadarController,
  DoughnutController,
  ArcElement,
  PointElement,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);
Chart.defaults.font.family = "'Inter', 'sans-serif'";
Chart.defaults.color = "#64748b";

type ReportKey = "levels" | "bell" | "sections" | "compliance";
const selectedReport = ref<ReportKey>("levels");

const currentYear = new Date().getFullYear();
const compareYears = ref<Record<string, boolean>>({
  [String(currentYear - 2)]: false,
  [String(currentYear - 1)]: false,
  [String(currentYear)]: true,
});
const sectionFilter = ref<string>("all");
/** Danh sách phòng ban từ GET /kpi/gm/departments (dùng cho filter Levels + label Bell Curve). */
const reportDepartmentOptions = ref<ReportSectionOption[]>([]);

// ── Loading + Data states ────────────────────────────────────────────────
const levelData = ref<GmReportLevelDistributionData | null>(null);
const bellData = ref<GmReportSectionBellCurveData | null>(null);
const analyticsData = ref<GmReportSectionAnalyticsData | null>(null);
const complianceData = ref<GmReportComplianceData | null>(null);
const errorMsg = ref<string>("");
const loading = ref(false);

// ── Chart refs ────────────────────────────────────────────────────────────
const scoreCanvas = ref<HTMLCanvasElement | null>(null);
const bellCanvas = ref<HTMLCanvasElement | null>(null);
const radarCanvas = ref<HTMLCanvasElement | null>(null);
const sectionBarCanvas = ref<HTMLCanvasElement | null>(null);
const doughnutCanvas = ref<HTMLCanvasElement | null>(null);

let scoreChart: Chart | null = null;
let bellChart: Chart | null = null;
let radarChart: Chart | null = null;
let sectionBarChart: Chart | null = null;
let doughnutChart: Chart | null = null;

// ── Bell curve checkbox states ────────────────────────────────────────────
const bellSectionEnabled = ref<Record<string, boolean>>({ all: true });

// ── Color palette ─────────────────────────────────────────────────────────
const LEVEL_COLORS = [
  "#f43f5e", // NA — rose-500
  "#fb923c", // D  — orange-400
  "#94a3b8", // C2 — slate-400
  "#64748b", // C1 — slate-500
  "#a78bfa", // B2 — violet-400
  "#818cf8", // B1 — indigo-400
  "#3b82f6", // A2 — blue-500
  "#14b8a6", // A1 — teal-500
  "#059669", // O1 — emerald-600
];

const SECTION_PALETTE = [
  "#4f46e5",
  "#10b981",
  "#f43f5e",
  "#f59e0b",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
  "#0ea5e9",
  "#ec4899",
];

const yearOpacities: Record<string, number> = {
  [String(currentYear - 2)]: 0.25,
  [String(currentYear - 1)]: 0.55,
  [String(currentYear)]: 1.0,
};

// ── Helpers ───────────────────────────────────────────────────────────────
function rgba(hex: string, a: number) {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const levelSectionOptions = computed((): ReportSectionOption[] => {
  if (reportDepartmentOptions.value.length > 0) {
    return reportDepartmentOptions.value;
  }
  const arr = bellData.value?.sections ?? [];
  return arr
    .filter((s) => s.id !== "all")
    .map((s) => ({ id: s.id, label: s.label }));
});

/** Checkbox Bộ Phận ở Bell Curve — chỉ các series backend trả về (tránh id lạ chưa có trong bellSectionEnabled). */
const bellSectionCheckboxOptions = computed((): ReportSectionOption[] => {
  const arr = bellData.value?.sections ?? [];
  return arr
    .filter((s) => s.id !== "all")
    .map((s) => ({ id: s.id, label: s.label }));
});

/** Compliance donut: đếm theo member (khớp danh sách bottleneck), hai lát chờ duyệt / thiếu evidence. */
const complianceBacklogTotal = computed(() => {
  const s = complianceData.value?.status;
  if (!s) return 0;
  return Number(s.pendingApproval ?? 0) + Number(s.missingEvidence ?? 0);
});

async function loadReportDepartmentOptions() {
  try {
    const rows = await gmKpiService.listDepartments(currentYear);
    reportDepartmentOptions.value = (rows ?? []).map((d) => ({
      id: d.id,
      label: d.name,
    }));
  } catch {
    reportDepartmentOptions.value = [];
  }
}

/** Các năm báo cáo Performance Levels được tick checkbox, cố định thứ tự cổ → mới */
const LEVEL_YEAR_SLOTS = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
] as const;

/** Năm "chính" cho panel chi tiết / topPerformers (= năm lớn nhất trong các năm đang được chọn) */
const levelDetailYear = computed<number | null>(() => {
  const checked = LEVEL_YEAR_SLOTS.filter((y) => compareYears.value[String(y)]);
  return checked.length ? Math.max(...checked) : null;
});

// ── Data loaders ──────────────────────────────────────────────────────────
async function loadLevelDistribution() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const checkedYears = LEVEL_YEAR_SLOTS.filter(
      (y) => compareYears.value[String(y)],
    );
    if (checkedYears.length === 0) {
      levelData.value = null;
      await nextTick();
      renderScoreChart();
      return;
    }
    const primaryYearApi = Math.max(...checkedYears);
    const compareYearsApi = checkedYears.filter((y) => y !== primaryYearApi);
    levelData.value = await gmKpiService.getReportLevelDistribution({
      year: primaryYearApi,
      compareYears: compareYearsApi.length ? compareYearsApi : undefined,
      sectionId:
        sectionFilter.value === "all" ? undefined : sectionFilter.value,
    });
    await nextTick();
    renderScoreChart();
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? e.message : "Không tải được Performance Levels";
  } finally {
    loading.value = false;
  }
}

async function loadBellCurve() {
  loading.value = true;
  errorMsg.value = "";
  try {
    bellData.value = await gmKpiService.getReportSectionBellCurve(currentYear);
    // Đồng bộ checkbox với section trả về
    const next: Record<string, boolean> = {
      all: bellSectionEnabled.value.all ?? true,
    };
    for (const s of bellData.value.sections) {
      if (s.id === "all") continue;
      next[s.id] = bellSectionEnabled.value[s.id] ?? false;
    }
    bellSectionEnabled.value = next;
    await nextTick();
    renderBellChart();
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? e.message : "Không tải được Bell Curve";
  } finally {
    loading.value = false;
  }
}

async function loadSectionAnalytics() {
  loading.value = true;
  errorMsg.value = "";
  try {
    analyticsData.value =
      await gmKpiService.getReportSectionAnalytics(currentYear);
    await nextTick();
    renderSectionBarChart();
    renderRadarChart();
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? e.message : "Không tải được Section Analytics";
  } finally {
    loading.value = false;
  }
}

async function loadCompliance() {
  loading.value = true;
  errorMsg.value = "";
  try {
    complianceData.value = await gmKpiService.getReportCompliance(currentYear);
    await nextTick();
    renderDoughnutChart();
  } catch (e) {
    errorMsg.value =
      e instanceof Error ? e.message : "Không tải được Compliance";
  } finally {
    loading.value = false;
  }
}

// ── Chart renderers ───────────────────────────────────────────────────────
function destroyChart(chart: Chart | null): null {
  try {
    chart?.destroy();
  } catch (e) {
    void e;
  }
  return null;
}

function renderScoreChart() {
  if (!scoreCanvas.value) return;
  scoreChart = destroyChart(scoreChart);
  const ld = levelData.value;
  if (!ld) return;
  const visibleSeries = ld.years
    .filter((y) => compareYears.value[String(y.year)])
    .sort((a, b) => a.year - b.year);
  if (!visibleSeries.length) return;
  const labels = ld.levels.map((l) => l.label);
  const datasets = visibleSeries.map((y) => {
    const op = yearOpacities[String(y.year)] ?? 1.0;
    return {
      label: `Năm ${y.year}`,
      data: y.counts,
      backgroundColor: ld.levels.map((_, i) =>
        rgba(LEVEL_COLORS[i % LEVEL_COLORS.length]!, op),
      ),
      borderWidth: 0,
      borderRadius: 4,
    };
  });
  const cfg: ChartConfiguration<"bar"> = {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "top",
          labels: { usePointStyle: true, boxWidth: 8 },
        },
        tooltip: { callbacks: { title: (c) => "Mức đánh giá: " + c[0].label } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          title: { display: true, text: "Số lượng NS" },
        },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  };
  scoreChart = new Chart(scoreCanvas.value.getContext("2d")!, cfg);
}

function renderBellChart() {
  if (!bellCanvas.value || !bellData.value) return;
  bellChart = destroyChart(bellChart);
  const labels = bellData.value.levelLabels;
  const datasets = bellData.value.sections
    .filter((s) => bellSectionEnabled.value[s.id])
    .map((s, idx) => {
      const color =
        s.id === "all"
          ? "#4f46e5"
          : SECTION_PALETTE[(idx + 1) % SECTION_PALETTE.length];
      return {
        label: s.label,
        data: s.counts,
        borderColor: color,
        backgroundColor: rgba(color, 0.1),
        borderWidth: 3,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });
  if (datasets.length === 1) datasets[0].fill = true;

  const cfg: ChartConfiguration<"line"> = {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "right",
          labels: { usePointStyle: true, boxWidth: 8, padding: 15 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Số lượng Nhân sự" },
        },
      },
    },
  };
  bellChart = new Chart(bellCanvas.value.getContext("2d")!, cfg);
}

function renderSectionBarChart() {
  if (!sectionBarCanvas.value || !analyticsData.value) return;
  sectionBarChart = destroyChart(sectionBarChart);
  const labels = analyticsData.value.sectionAverages.map((s) => s.sectionName);
  const data = analyticsData.value.sectionAverages.map(
    (s) => Number(s.averageScore) || 0,
  );
  const cfg: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Điểm Trung Bình Bộ Phận",
          data,
          backgroundColor: "#3b82f6",
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 30 } },
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 5.0, grid: { color: "#f1f5f9" } },
        y: { grid: { display: false } },
      },
    },
  };
  sectionBarChart = new Chart(sectionBarCanvas.value.getContext("2d")!, cfg);
}

function renderRadarChart() {
  if (!radarCanvas.value || !analyticsData.value) return;
  radarChart = destroyChart(radarChart);
  const dim = analyticsData.value.radar.dimensions;
  const series = analyticsData.value.radar.series;
  const colors = ["#10b981", "#f43f5e"];
  const cfg: ChartConfiguration<"radar"> = {
    type: "radar",
    data: {
      labels: dim,
      datasets: series.map((s, idx) => ({
        label: s.sectionName + `${idx === 0 ? " (Best)" : " (Worst)"}`,
        data: s.data.map((v) => Number(v) || 0),
        fill: true,
        backgroundColor: rgba(colors[idx % colors.length], 0.2),
        borderColor: colors[idx % colors.length],
        pointBackgroundColor: colors[idx % colors.length],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      elements: { line: { borderWidth: 2 } },
    },
  };
  radarChart = new Chart(radarCanvas.value.getContext("2d")!, cfg);
}

function renderDoughnutChart() {
  if (!doughnutCanvas.value || !complianceData.value) return;
  doughnutChart = destroyChart(doughnutChart);
  const s = complianceData.value.status;
  const cfg: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: ["Đang chờ Quản lý duyệt", "NS chưa nộp Evidence"],
      datasets: [
        {
          data: [s.pendingApproval, s.missingEvidence],
          backgroundColor: ["#f59e0b", "#f43f5e"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      // Legend nằm trong canvas làm lệch tâm doughnut vs lớp % absolute — tắt legend, hiển thị HTML bên dưới.
      plugins: { legend: { display: false } },
    },
  };
  doughnutChart = new Chart(doughnutCanvas.value.getContext("2d")!, cfg);
}

// ── Reactivity ────────────────────────────────────────────────────────────
async function switchReport(rk: ReportKey) {
  selectedReport.value = rk;
  await nextTick();
  if (rk === "levels" && !levelData.value) await loadLevelDistribution();
  else if (rk === "levels") renderScoreChart();
  if (rk === "bell" && !bellData.value) await loadBellCurve();
  else if (rk === "bell") renderBellChart();
  if (rk === "sections" && !analyticsData.value) await loadSectionAnalytics();
  else if (rk === "sections") {
    renderSectionBarChart();
    renderRadarChart();
  }
  if (rk === "compliance" && !complianceData.value) await loadCompliance();
  else if (rk === "compliance") renderDoughnutChart();
}

watch(
  compareYears,
  () => {
    if (selectedReport.value === "levels") void loadLevelDistribution();
  },
  { deep: true },
);
watch(sectionFilter, () => {
  if (selectedReport.value === "levels") void loadLevelDistribution();
});
watch(
  bellSectionEnabled,
  () => {
    if (selectedReport.value === "bell") renderBellChart();
  },
  { deep: true },
);

onMounted(() => {
  void (async () => {
    await loadReportDepartmentOptions();
    await switchReport("levels");
  })();
});
onBeforeUnmount(() => {
  scoreChart = destroyChart(scoreChart);
  bellChart = destroyChart(bellChart);
  radarChart = destroyChart(radarChart);
  sectionBarChart = destroyChart(sectionBarChart);
  doughnutChart = destroyChart(doughnutChart);
});

const reportLabel: Record<ReportKey, string> = {
  levels: "1. Phân Bổ Khung Điểm Đánh Giá (Performance Levels)",
  bell: "2. Phân Bổ Xếp Loại Theo Bộ Phận (Section Bell Curve)",
  sections: "3. So Sánh Hiệu Suất Các Bộ Phận (Section Analytics)",
  compliance: "4. Tình Trạng Chốt Điểm & Nút Thắt (Compliance)",
};

const levelTagClass = (code: string) => {
  switch (code) {
    case "O1":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "A1":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "A2":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "B1":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "B2":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "C1":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "C2":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "D":
      return "bg-orange-100 text-orange-700 border-orange-200";
    default:
      return "bg-rose-100 text-rose-700 border-rose-200";
  }
};

const levelBadgeClass = (code: string) => {
  switch (code) {
    case "O1":
      return "bg-emerald-50 border-emerald-100";
    case "A1":
      return "bg-teal-50 border-teal-100";
    case "A2":
      return "bg-blue-50 border-blue-100";
    case "B1":
      return "bg-indigo-50 border-indigo-100";
    case "B2":
      return "bg-violet-50 border-violet-100";
    case "C1":
      return "bg-slate-50 border-slate-200";
    case "C2":
      return "bg-slate-100 border-slate-200";
    case "D":
      return "bg-orange-50 border-orange-100";
    default:
      return "bg-rose-50 border-rose-100";
  }
};

const levelChipClass = (code: string) => {
  switch (code) {
    case "O1":
      return "bg-emerald-600 text-white";
    case "A1":
      return "bg-teal-500 text-white";
    case "A2":
      return "bg-blue-500 text-white";
    case "B1":
      return "bg-indigo-400 text-white";
    case "B2":
      return "bg-violet-400 text-white";
    case "C1":
      return "bg-slate-500 text-white";
    case "C2":
      return "bg-slate-400 text-white";
    case "D":
      return "bg-orange-400 text-white";
    default:
      return "bg-rose-500 text-white";
  }
};

function levelCountForDetailYear(idx: number): number {
  if (!levelData.value || levelDetailYear.value == null) return 0;
  const yObj = levelData.value.years.find(
    (y) => y.year === levelDetailYear.value,
  );
  return yObj?.counts[idx] ?? 0;
}
</script>

<template>
  <div class="px-3 py-4 sm:px-6 sm:py-6 max-w-[1400px] mx-auto w-full">
    <!-- Top selector -->
    <div
      class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
    >
      <div class="flex items-center gap-3">
        <div class="bg-indigo-600 text-white p-2 rounded-lg shadow-md">
          <i class="fas fa-chart-pie" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 leading-tight">
            Trung Tâm Báo Cáo Chuyên Sâu
          </h1>
          <p class="text-xs text-slate-500 font-medium">
            Dành cho C-Level &amp; General Manager
          </p>
        </div>
      </div>
      <div
        class="flex items-center gap-3 w-full sm:w-auto bg-slate-50 p-2 rounded-xl border border-slate-200"
      >
        <span
          class="text-sm font-bold text-slate-700 whitespace-nowrap hidden md:block pl-2"
        >
          <i class="fas fa-filter mr-1" /> Chọn loại Báo cáo:
        </span>
        <select
          v-model="selectedReport"
          @change="switchReport(selectedReport)"
          class="w-full sm:w-80 px-4 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm"
        >
          <option v-for="(label, key) in reportLabel" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </div>
    </div>

    <p
      v-if="errorMsg"
      class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
    >
      {{ errorMsg }}
    </p>

    <!-- ============================================================ -->
    <!-- REPORT 1 — LEVELS -->
    <!-- ============================================================ -->
    <div v-if="selectedReport === 'levels'" class="space-y-6">
      <h2 class="text-xl font-bold text-slate-900">
        Phân Bổ Khung Điểm Đánh Giá (Performance Distribution)
      </h2>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          class="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
        >
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
          >
            <h3 class="text-sm font-bold text-slate-700">
              Biểu đồ phân bổ điểm số nhân sự theo tiêu chuẩn
            </h3>
            <div class="flex flex-wrap items-center gap-3">
              <div
                class="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
              >
                <i class="fas fa-layer-group text-slate-400 text-xs" />
                <select
                  v-model="sectionFilter"
                  class="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer pr-2"
                >
                  <option value="all">Toàn Công Ty</option>
                  <option
                    v-for="s in levelSectionOptions"
                    :key="s.id"
                    :value="s.id"
                  >
                    {{ s.label }}
                  </option>
                </select>
              </div>
              <div
                class="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
              >
                <span
                  class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >Năm:</span
                >
                <label
                  v-for="y in LEVEL_YEAR_SLOTS.map(String)"
                  :key="y"
                  class="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    v-model="compareYears[y]"
                    class="w-4 h-4 rounded border-slate-300"
                  />
                  <span class="text-sm font-semibold text-slate-700">{{
                    y
                  }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="relative h-80 w-full flex-1">
            <canvas ref="scoreCanvas"></canvas>
          </div>
        </div>

        <div
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-bold text-slate-700">
              Chi Tiết Mức Đánh Giá (Levels)
            </h3>
            <span class="text-xs font-medium text-slate-500">
              <template v-if="levelDetailYear != null">
                Khung {{ levelData?.scaleYear ?? levelDetailYear }} · Kỳ
                {{ levelDetailYear }}: {{ levelData?.totalCount ?? 0 }} NS
              </template>
              <template v-else>Chọn ít nhất một năm để xem báo cáo</template>
            </span>
          </div>
          <div class="space-y-2 overflow-y-auto flex-1 pr-2 min-h-[300px]">
            <div
              v-for="(lv, idx) in levelData?.levels ?? []"
              :key="lv.code"
              class="flex justify-between items-center p-2.5 border rounded-lg"
              :class="levelBadgeClass(lv.code)"
            >
              <div class="flex items-center gap-3">
                <span
                  class="w-8 h-8 rounded flex items-center justify-center font-bold text-sm shadow-sm"
                  :class="levelChipClass(lv.code)"
                  >{{ lv.code }}</span
                >
                <div>
                  <p class="font-bold text-slate-800 text-[13px]">
                    {{ lv.label.split("(")[0].trim() }}
                  </p>
                  <p
                    class="text-[10px] text-slate-700 font-semibold uppercase tracking-wider"
                  >
                    Bậc (Pitch): {{ lv.pitch }}
                  </p>
                </div>
              </div>
              <span class="font-bold text-slate-800 text-sm">
                {{ levelCountForDetailYear(idx) }}
                <span class="text-[10px] text-slate-500 font-normal ml-1"
                  >NS</span
                >
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div class="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 class="text-sm font-bold text-slate-800">
            Danh sách Cán bộ Cốt cán đạt mức Đánh giá Cao (O1, A1, A2)
          </h3>
        </div>
        <table class="w-full text-left">
          <thead
            class="bg-white text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200"
          >
            <tr>
              <th class="py-3 px-5">Nhân sự</th>
              <th class="py-3 px-5">Bộ Phận</th>
              <th class="py-3 px-5 text-center">Xếp Loại (Level)</th>
              <th class="py-3 px-5 text-right">
                Điểm KPI {{ levelDetailYear ?? "—" }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="!levelData?.topPerformers?.length">
              <td
                colspan="4"
                class="py-6 px-5 text-center text-sm text-slate-400"
              >
                Chưa có nhân sự đạt mức cao trong kỳ này
              </td>
            </tr>
            <tr
              v-for="t in levelData?.topPerformers ?? []"
              :key="t.userId"
              class="hover:bg-slate-50"
            >
              <td class="py-3 px-5 font-bold text-slate-900">
                {{ t.fullName }}
                <span
                  v-if="t.roleCode"
                  class="text-xs font-medium text-slate-400"
                  >({{ t.roleCode }})</span
                >
              </td>
              <td class="py-3 px-5 text-sm text-slate-600">
                {{ t.sectionName || "—" }}
              </td>
              <td class="py-3 px-5 text-center">
                <span
                  class="px-2 py-0.5 border font-bold rounded text-xs"
                  :class="levelTagClass(t.levelCode)"
                  >{{ t.levelCode }}</span
                >
              </td>
              <td class="py-3 px-5 text-right font-bold text-slate-700">
                {{ Number(t.score).toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- REPORT 2 — BELL CURVE -->
    <!-- ============================================================ -->
    <div v-if="selectedReport === 'bell'" class="space-y-6">
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-slate-900">
            Phân Bổ Xếp Loại Theo Bộ Phận (Section Bell Curve)
          </h2>
          <span
            class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded"
            >Kỳ đánh giá: {{ currentYear }}</span
          >
        </div>
      </div>

      <div
        class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
      >
        <div
          class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6"
        >
          <div>
            <h3 class="text-sm font-bold text-slate-700">
              Biểu Đồ Đường Chuông (Phân Khúc Chất Lượng)
            </h3>
            <p class="text-xs text-slate-500 mt-1">
              Mỗi đường đại diện cho một Bộ Phận (Section), trục ngang là các
              mức đánh giá từ Kém đến Xuất Sắc.
            </p>
          </div>
          <div
            class="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200"
          >
            <span
              class="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2 hidden sm:block"
              >Hiển thị Bộ Phận:</span
            >
            <label
              class="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                v-model="bellSectionEnabled.all"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span class="text-sm font-bold text-slate-800">Toàn C.Ty</span>
            </label>
            <div class="w-px h-4 bg-slate-300 mx-1 hidden sm:block"></div>
            <label
              v-for="s in bellSectionCheckboxOptions"
              :key="s.id"
              class="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                v-model="bellSectionEnabled[s.id]"
                class="w-4 h-4 rounded border-slate-300"
              />
              <span class="text-sm font-medium text-slate-600">{{
                s.label
              }}</span>
            </label>
          </div>
        </div>
        <div class="relative h-[400px] w-full">
          <canvas ref="bellCanvas"></canvas>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500"
        >
          <p
            class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1"
          >
            Điểm TB Hệ Thống
          </p>
          <p class="text-3xl font-bold text-slate-800">
            {{
              bellData?.summary.avgCompany
                ? Number(bellData.summary.avgCompany).toFixed(2)
                : "—"
            }}
          </p>
          <p class="text-xs text-slate-400 mt-2">
            Tổng {{ bellData?.summary.totalCount ?? 0 }} NS có điểm
          </p>
        </div>
        <div
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500"
        >
          <p
            class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1"
          >
            Bộ Phận Hiệu Suất Cao Nhất
          </p>
          <p class="text-2xl font-bold text-slate-800">
            {{ bellData?.summary.bestSectionName || "—" }}
          </p>
          <p class="text-xs text-emerald-600 font-semibold mt-2">
            Điểm tập trung phía Xuất Sắc
          </p>
        </div>
        <div
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500"
        >
          <p
            class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1"
          >
            Nhóm Xuất Sắc (≥ A2)
          </p>
          <p class="text-3xl font-bold text-slate-800">
            {{ bellData?.summary.topGroupCount ?? 0 }} NS
          </p>
          <p class="text-xs text-slate-400 mt-2">
            {{ Number(bellData?.summary.topGroupPercent ?? 0).toFixed(1) }}%
            tổng
          </p>
        </div>
        <div
          class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500"
        >
          <p
            class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1"
          >
            Bộ Phận Cần Cải Thiện
          </p>
          <p class="text-2xl font-bold text-slate-800">
            {{ bellData?.summary.worstSectionName || "—" }}
          </p>
          <p class="text-xs text-rose-500 font-semibold mt-2">
            Điểm tập trung phía thấp
          </p>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- REPORT 3 — SECTION ANALYTICS -->
    <!-- ============================================================ -->
    <div v-if="selectedReport === 'sections'" class="space-y-6">
      <h2 class="text-xl font-bold text-slate-900">
        Đánh Giá &amp; So Sánh Hiệu Suất Các Bộ Phận (Sections)
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center"
        >
          <h3 class="text-sm font-bold text-slate-700 mb-4 w-full text-left">
            Độ bao phủ Kỹ năng/Nghiệp vụ giữa các Bộ Phận
          </h3>
          <div class="relative w-full max-w-[400px] aspect-square">
            <canvas ref="radarCanvas"></canvas>
          </div>
        </div>
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 class="text-sm font-bold text-slate-700 mb-4">
            Điểm Trung Bình Cuối Năm Của Các Bộ Phận
          </h3>
          <div class="relative h-80 w-full">
            <canvas ref="sectionBarCanvas"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- REPORT 4 — COMPLIANCE -->
    <!-- ============================================================ -->
    <div v-if="selectedReport === 'compliance'" class="space-y-6">
      <h2 class="text-xl font-bold text-slate-900">
        Tình Trạng Chốt Điểm &amp; Nghẽn Cổ Chai (Bottlenecks)
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center"
        >
          <h3 class="text-sm font-bold text-slate-700 mb-4 w-full text-left">
            Tiến Độ Chấm Điểm Cuối Năm
          </h3>
          <div class="flex w-full flex-col items-center">
            <div class="relative h-64 w-64 shrink-0">
              <canvas ref="doughnutCanvas"></canvas>
              <div
                class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-tight"
              >
                <span class="text-3xl font-bold text-slate-800">{{
                  complianceBacklogTotal
                }}</span>
                <span class="text-xs font-medium text-slate-500"
                  >Employees</span
                >
              </div>
            </div>
            <ul
              class="mt-3 flex max-w-xs flex-wrap justify-center gap-x-4 gap-y-1.5 text-left text-[11px] font-medium text-slate-600"
              aria-label="Chú thích biểu đồ tiến độ"
            >
              <li class="flex items-center gap-1.5">
                <span
                  class="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                Đang chờ Quản lý duyệt
              </li>
              <li class="flex items-center gap-1.5">
                <span
                  class="h-2 w-2 shrink-0 rounded-full bg-rose-500"
                  aria-hidden="true"
                />
                NS chưa nộp Evidence
              </li>
            </ul>
          </div>
        </div>
        <div
          class="md:col-span-2 flex min-h-0 max-h-[min(36rem,72vh)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-rose-50/50 p-5"
          >
            <i class="fas fa-triangle-exclamation text-rose-500" />
            <h3 class="text-sm font-bold text-slate-900">
              Danh Sách Vi Phạm Quy Trình / Quá Hạn Chấm Điểm
            </h3>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <table class="w-full text-left text-sm">
              <thead
                class="sticky top-0 z-10 border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow-sm"
              >
                <tr>
                  <th class="py-3 px-5">Nhân sự / Quản lý</th>
                  <th class="py-3 px-5">Bộ Phận</th>
                  <th class="py-3 px-5">Trạng thái tắc nghẽn</th>
                  <th class="py-3 px-5 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-if="!complianceData?.bottlenecks?.length">
                  <td
                    colspan="4"
                    class="py-6 px-5 text-center text-sm text-slate-400"
                  >
                    Không có nút thắt nào trong kỳ này
                  </td>
                </tr>
                <tr
                  v-for="(b, idx) in complianceData?.bottlenecks ?? []"
                  :key="`${b.userId ?? 'row'}-${idx}`"
                  class="hover:bg-slate-50"
                >
                  <td class="py-4 px-5 font-bold text-slate-800">
                    {{ b.fullName }}
                    <span
                      v-if="b.roleCode"
                      class="text-xs font-medium text-slate-400"
                      >({{ b.roleCode }})</span
                    >
                  </td>
                  <td class="py-4 px-5 text-slate-600">
                    {{ b.sectionName || "—" }}
                  </td>
                  <td class="py-4 px-5">
                    <span
                      class="rounded px-2 py-1 text-xs font-bold"
                      :class="
                        b.severity === 'critical'
                          ? 'bg-rose-100 text-rose-700'
                          : b.severity === 'warning'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                      "
                    >
                      {{ b.reason }}
                    </span>
                  </td>
                  <td
                    class="py-4 px-5 text-right font-bold"
                    :class="
                      b.severity === 'critical'
                        ? 'text-rose-600'
                        : 'text-orange-600'
                    "
                  >
                    {{ b.delayLabel }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
