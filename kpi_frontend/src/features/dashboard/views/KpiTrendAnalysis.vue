<template>
  <div class="kpi-trend-analysis-container" v-if="canViewDashboard">
    <LoadingOverlay :visible="isLoading" />
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboardOverview") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("kpiTrendAnalysis") }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t("kpiTrendAnalysis") }}</h1>

    <a-spin :spinning="isLoading" :tip="$t('loadingData')">
      <a-alert
        v-if="loadingError"
        type="error"
        show-icon
        closable
        style="margin-bottom: 16px"
        :message="loadingError"
        @close="loadingError = null"
      />

      <div v-if="!loadingError">
        <!-- Filter Section -->
        <a-card class="dashboard-card filter-card" style="margin-bottom: 24px">
          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('selectPerspective')">
                <a-select
                  v-model:value="selectedPerspectiveId"
                  :placeholder="$t('selectBscPerspective')"
                  allow-clear
                  size="large"
                  @change="loadKpis"
                >
                  <a-select-option value="">{{ $t("all") }}</a-select-option>
                  <a-select-option
                    v-for="perspective in perspectives"
                    :key="perspective.id"
                    :value="perspective.id"
                  >
                    {{ `${perspective.id}. ${perspective.name}` }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('selectKpi')">
                <a-select
                  v-model:value="selectedKpiIds"
                  :placeholder="$t('selectKpis')"
                  mode="multiple"
                  size="large"
                  :max-tag-count="3"
                  @change="loadTrendData"
                >
                  <a-select-option
                    v-for="kpi in availableKpis"
                    :key="kpi.id"
                    :value="kpi.id"
                  >
                    {{ kpi.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('period')">
                <a-select v-model:value="period" size="large" @change="loadTrendData">
                  <a-select-option value="monthly">{{ $t("monthly") }}</a-select-option>
                  <a-select-option value="quarterly">{{ $t("quarterly") }}</a-select-option>
                  <a-select-option value="yearly">{{ $t("yearly") }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <a-form-item :label="$t('dateRange')">
                <a-range-picker
                  v-model:value="dateRange"
                  size="large"
                  style="width: 100%"
                  @change="loadTrendData"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <!-- Trend Chart -->
        <a-card
          :title="$t('kpiTrendChart')"
          class="dashboard-card chart-card"
          v-if="selectedKpiIds.length > 0"
        >
          <div class="chart-container" v-if="trendChartData.labels.length > 0">
            <line-chart
              :chart-data="trendChartData"
              :chart-options="trendChartOptions"
              style="height: 400px"
            />
          </div>
          <a-empty v-else :description="$t('noDataAvailable')" />
        </a-card>

        <!-- Comparison Chart -->
        <a-card
          :title="$t('kpiComparison')"
          class="dashboard-card chart-card"
          style="margin-top: 24px"
          v-if="selectedKpiIds.length > 1"
        >
          <div class="chart-container" v-if="comparisonChartData.labels.length > 0">
            <bar-chart
              :chart-data="comparisonChartData"
              :chart-options="comparisonChartOptions"
              style="height: 350px"
            />
          </div>
          <a-empty v-else :description="$t('noDataAvailable')" />
        </a-card>

        <!-- Summary Statistics -->
        <a-row :gutter="[24, 24]" style="margin-top: 24px" v-if="selectedKpiIds.length > 0">
          <a-col
            v-for="kpi in selectedKpis"
            :key="kpi.id"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
          >
            <a-card class="dashboard-card kpi-summary-card">
              <div class="kpi-summary-header">
                <h3>{{ kpi.name }}</h3>
                <a-tag :color="getKpiStatusColor(kpi)">
                  {{ getKpiStatus(kpi) }}
                </a-tag>
              </div>
              <a-row :gutter="[16, 16]" style="margin-top: 16px">
                <a-col :span="12">
                  <a-statistic
                    :title="$t('currentValue')"
                    :value="kpi.currentValue"
                    :suffix="kpi.unit"
                    :value-style="{ fontSize: '1.2rem' }"
                  />
                </a-col>
                <a-col :span="12">
                  <a-statistic
                    :title="$t('target')"
                    :value="kpi.target"
                    :suffix="kpi.unit"
                    :value-style="{ fontSize: '1.2rem' }"
                  />
                </a-col>
                <a-col :span="24">
                  <a-progress
                    :percent="kpi.progress"
                    :status="
                      kpi.progress >= 100
                        ? 'success'
                        : kpi.progress >= 50
                          ? 'normal'
                          : 'exception'
                    "
                  />
                </a-col>
              </a-row>
            </a-card>
          </a-col>
        </a-row>

        <a-empty
          v-if="!isLoading && selectedKpiIds.length === 0 && !loadingError"
          :description="$t('pleaseSelectKpisToViewTrend')"
          style="padding: 40px"
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import {
  Breadcrumb as ABreadcrumb,
  BreadcrumbItem as ABreadcrumbItem,
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Statistic as AStatistic,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  FormItem as AFormItem,
  Select as ASelect,
  SelectOption as ASelectOption,
  RangePicker as ARangePicker,
  Progress as AProgress,
  Tag as ATag,
} from "ant-design-vue";
import LineChart from "@/core/components/common/LineChart.vue";
import BarChart from "@/core/components/common/BarChart.vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";

const { t: $t } = useI18n();
const store = useStore();

const perspectives = ref([]);
const selectedPerspectiveId = ref(null);
const selectedKpiIds = ref([]);
const period = ref("monthly");
const dateRange = ref(null);
const kpis = ref([]);
const trendData = ref({});
const isLoading = computed(() => store.getters["loading/isLoading"]);
const loadingError = ref(null);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);

function hasPermission(action, resource, scope) {
  return userPermissions.value?.some(
    (p) =>
      p.action?.trim() === action &&
      p.resource?.trim() === resource &&
      (scope ? p.scope?.trim() === scope : true)
  );
}

const canViewDashboard = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD)
);

const availableKpis = computed(() => {
  return kpis.value.filter((kpi) => {
    if (selectedPerspectiveId.value) {
      return kpi.perspective?.id === selectedPerspectiveId.value;
    }
    return true;
  });
});

const selectedKpis = computed(() => {
  return kpis.value
    .filter((kpi) => selectedKpiIds.value.includes(kpi.id))
    .map((kpi) => {
      const assignment = kpi.assignments?.[0];
      const target = parseFloat(assignment?.target_value) || 0;
      const actual = parseFloat(assignment?.actual_value) || 0;
      const progress = target > 0 ? Math.round((actual / target) * 100) : 0;

      return {
        ...kpi,
        currentValue: actual,
        target,
        progress: Math.min(progress, 100),
        unit: kpi.unit || "",
      };
    });
});

const trendChartData = computed(() => {
  if (selectedKpiIds.value.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = generatePeriodLabels();
  const datasets = selectedKpiIds.value.map((kpiId, index) => {
    const kpi = kpis.value.find((k) => k.id === kpiId);
    if (!kpi) return null;

    const data = labels.map((label) => {
      const trendPoint = trendData.value[kpiId]?.find(
        (point) => point.period === label
      );
      return trendPoint ? trendPoint.value : null;
    });

    const colors = [
      "rgba(24, 144, 255, 1)",
      "rgba(82, 196, 26, 1)",
      "rgba(250, 173, 20, 1)",
      "rgba(245, 34, 45, 1)",
      "rgba(114, 46, 209, 1)",
    ];

    return {
      label: kpi.name,
      data,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length].replace("1)", "0.2)"),
      borderWidth: 2,
      fill: false,
      tension: 0.4,
    };
  }).filter(Boolean);

  return {
    labels,
    datasets,
  };
});

const trendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top",
    },
    title: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: $t("value"),
      },
    },
    x: {
      title: {
        display: true,
        text: $t("period"),
      },
    },
  },
}));

const comparisonChartData = computed(() => {
  if (selectedKpiIds.value.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = selectedKpis.value.map((kpi) => kpi.name);
  const currentValues = selectedKpis.value.map((kpi) => kpi.currentValue);
  const targets = selectedKpis.value.map((kpi) => kpi.target);

  return {
    labels,
    datasets: [
      {
        label: $t("currentValue"),
        backgroundColor: "rgba(24, 144, 255, 0.7)",
        borderColor: "rgba(24, 144, 255, 1)",
        borderWidth: 1,
        data: currentValues,
      },
      {
        label: $t("target"),
        backgroundColor: "rgba(82, 196, 26, 0.7)",
        borderColor: "rgba(82, 196, 26, 1)",
        borderWidth: 1,
        data: targets,
      },
    ],
  };
});

const comparisonChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "top",
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
}));

const generatePeriodLabels = () => {
  const labels = [];
  const startDate = dateRange.value
    ? dayjs(dateRange.value[0])
    : dayjs().subtract(12, "month");
  const endDate = dateRange.value
    ? dayjs(dateRange.value[1])
    : dayjs();

  let current = startDate.startOf(period.value === "monthly" ? "month" : period.value === "quarterly" ? "quarter" : "year");

  while (current.isBefore(endDate) || current.isSame(endDate)) {
    if (period.value === "monthly") {
      labels.push(current.format("MM/YYYY"));
      current = current.add(1, "month");
    } else if (period.value === "quarterly") {
      labels.push(`Q${current.quarter()}/${current.year()}`);
      current = current.add(1, "quarter");
    } else {
      labels.push(current.format("YYYY"));
      current = current.add(1, "year");
    }
  }

  return labels;
};

const getKpiStatus = (kpi) => {
  if (kpi.progress >= 100) return $t("achieved");
  if (kpi.progress >= 50) return $t("inProgress");
  return $t("needsImprovement");
};

const getKpiStatusColor = (kpi) => {
  if (kpi.progress >= 100) return "success";
  if (kpi.progress >= 50) return "warning";
  return "error";
};

const fetchPerspectives = async () => {
  try {
    loadingError.value = null;
    await store.dispatch("perspectives/fetchPerspectives");
    perspectives.value = store.getters["perspectives/list"] || [];
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadPerspectives");
  }
};

const loadKpis = async () => {
  try {
    loadingError.value = null;
    const params = {
      status: "Active",
      limit: 1000,
    };
    if (selectedPerspectiveId.value) {
      params.perspectiveId = selectedPerspectiveId.value;
    }

    const response = await apiClient.get("/kpis", { params });
    kpis.value = response.data?.data || [];
    selectedKpiIds.value = [];
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadKpis");
    kpis.value = [];
  }
};

const loadTrendData = async () => {
  if (selectedKpiIds.value.length === 0) {
    trendData.value = {};
    return;
  }

  await store.dispatch("loading/startLoading");
  try {
    const newTrendData = {};
    const labels = generatePeriodLabels();

    for (const kpiId of selectedKpiIds.value) {
      const kpi = kpis.value.find((k) => k.id === kpiId);
      if (!kpi) continue;

      const assignment = kpi.assignments?.[0];
      if (!assignment) continue;

      const target = parseFloat(assignment.target_value) || 0;
      const actual = parseFloat(assignment.actual_value) || 0;

      // For now, simulate trend data based on current value
      // In a real implementation, you would fetch historical data
      const trendPoints = labels.map((label, index) => {
        const progress = (actual / target) * 100;
        const variation = (Math.random() - 0.5) * 20;
        return {
          period: label,
          value: Math.max(0, Math.round(progress + variation)),
        };
      });

      newTrendData[kpiId] = trendPoints;
    }

    trendData.value = newTrendData;
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadTrendData");
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

watch(
  [selectedKpiIds, period, dateRange],
  () => {
    loadTrendData();
  },
  { deep: true }
);

const loadData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    await fetchPerspectives();
    await loadKpis();
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.kpi-trend-analysis-container {
  padding: 32px;
  background: #fafdff;
  min-height: calc(100vh - 64px);
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1a237e;
  margin-bottom: 24px;
}

.dashboard-card {
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.07);
  border: none;
}

.chart-container {
  padding: 16px 0;
}

.kpi-summary-card {
  height: 100%;
}

.kpi-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.kpi-summary-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .kpi-trend-analysis-container {
    padding: 16px;
  }
}
</style>

