<template>
  <div class="kpi-by-perspective-container" v-if="canViewDashboard">
    <LoadingOverlay :visible="isLoading" />
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t("dashboardOverview") }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t("kpiByPerspective") }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t("kpiByPerspective") }}</h1>

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
                  @change="handlePerspectiveChange"
                >
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
              <a-form-item :label="$t('status')">
                <a-select
                  v-model:value="selectedStatus"
                  :placeholder="$t('selectStatus')"
                  allow-clear
                  size="large"
                  @change="loadKpis"
                >
                  <a-select-option value="">{{ $t("all") }}</a-select-option>
                  <a-select-option value="Active">{{ $t("active") }}</a-select-option>
                  <a-select-option value="Inactive">{{ $t("inactive") }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>

        <!-- Summary Statistics -->
        <a-card
          v-if="selectedPerspectiveId"
          :title="`${$t('summaryStatistics')} - ${selectedPerspectiveName}`"
          class="dashboard-card summary-card"
          style="margin-bottom: 24px"
        >
          <a-row :gutter="[24, 24]">
            <a-col :xs="24" :sm="12" :md="6" :lg="6">
              <a-statistic
                :title="$t('totalKpis')"
                :value="summaryStats.totalKpis"
                :value-style="{ fontSize: '1.8rem' }"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6" :lg="6">
              <a-statistic
                :title="$t('achievedKpis')"
                :value="summaryStats.achievedKpis"
                :value-style="{ color: '#52c41a', fontSize: '1.8rem' }"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6" :lg="6">
              <a-statistic
                :title="$t('notAchievedKpis')"
                :value="summaryStats.notAchievedKpis"
                :value-style="{ color: '#ff4d4f', fontSize: '1.8rem' }"
              />
            </a-col>
            <a-col :xs="24" :sm="12" :md="6" :lg="6">
              <a-statistic
                :title="$t('achievementRate')"
                :value="summaryStats.achievementRate"
                suffix="%"
                :value-style="{
                  color: getScoreColor(summaryStats.achievementRate),
                  fontSize: '1.8rem',
                }"
              />
            </a-col>
          </a-row>
        </a-card>

        <!-- Charts Section -->
        <a-row :gutter="[24, 24]" v-if="selectedPerspectiveId">
          <a-col :xs="24" :lg="12">
            <a-card
              :title="$t('achievementDistribution')"
              class="dashboard-card chart-card"
            >
              <div class="chart-container" v-if="kpis.length > 0">
                <pie-chart
                  :chart-data="achievementChartData"
                  :chart-options="achievementChartOptions"
                  style="height: 250px"
                />
              </div>
              <a-empty v-else :description="$t('noDataAvailable')" />
            </a-card>
          </a-col>
          <a-col :xs="24" :lg="12">
            <a-card
              :title="$t('kpiByDepartment')"
              class="dashboard-card chart-card"
            >
              <div class="chart-container" v-if="departmentChartData.labels.length > 0">
                <bar-chart
                  :chart-data="departmentChartData"
                  :chart-options="departmentChartOptions"
                  style="height: 250px"
                />
              </div>
              <a-empty v-else :description="$t('noDataAvailable')" />
            </a-card>
          </a-col>
        </a-row>

        <!-- KPI Table -->
        <a-card
          v-if="selectedPerspectiveId"
          :title="`${$t('kpiList')} - ${selectedPerspectiveName}`"
          class="dashboard-card table-card"
          style="margin-top: 24px"
        >
          <a-table
            :columns="columns"
            :data-source="tableData"
            :loading="isLoadingKpis"
            row-key="id"
            :pagination="{
              current: currentPage,
              pageSize: pageSize,
              total: totalKpis,
              showSizeChanger: true,
              showTotal: (total) => $t('totalItems', { total }),
            }"
            @change="handleTableChange"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'progress'">
                <a-progress
                  :percent="record.progress"
                  :status="
                    record.progress >= 100
                      ? 'success'
                      : record.progress >= 50
                        ? 'normal'
                        : 'exception'
                  "
                  size="small"
                />
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag
                  :color="record.status === 'Active' ? 'green' : 'red'"
                >
                  {{ $t(`status_chart.${record.status}`) || record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'achievement'">
                <a-tag
                  :color="
                    record.achievement === 'achieved'
                      ? 'success'
                      : record.achievement === 'warning'
                        ? 'warning'
                        : 'error'
                  "
                >
                  {{
                    record.achievement === "achieved"
                      ? $t("achieved")
                      : record.achievement === "warning"
                        ? $t("warning")
                        : $t("notAchieved")
                  }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </a-card>

        <!-- Comparison Section -->
        <a-card
          v-if="!selectedPerspectiveId"
          :title="$t('perspectiveComparison')"
          class="dashboard-card comparison-card"
          style="margin-top: 24px"
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
      </div>

      <a-empty
        v-if="!isLoading && perspectives.length === 0 && !loadingError"
        :description="$t('noPerspectivesAvailable')"
        style="padding: 40px"
      />
    </a-spin>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
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
  Table as ATable,
  Progress as AProgress,
  Tag as ATag,
  FormItem as AFormItem,
  Select as ASelect,
  SelectOption as ASelectOption,
} from "ant-design-vue";
import PieChart from "@/core/components/common/PieChart.vue";
import BarChart from "@/core/components/common/BarChart.vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import apiClient from "@/core/services/api";

const { t: $t } = useI18n();
const store = useStore();

const perspectives = ref([]);
const selectedPerspectiveId = ref(null);
const selectedStatus = ref("");
const kpis = ref([]);
const isLoading = computed(() => store.getters["loading/isLoading"]);
const isLoadingKpis = ref(false);
const loadingError = ref(null);
const currentPage = ref(1);
const pageSize = ref(10);

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

const selectedPerspectiveName = computed(() => {
  const perspective = perspectives.value.find(
    (p) => p.id === selectedPerspectiveId.value
  );
  return perspective ? `${perspective.id}. ${perspective.name}` : "";
});

const summaryStats = computed(() => {
  const totalKpis = kpis.value.length;
  const achievedKpis = kpis.value.filter((kpi) => {
    const assignment = kpi.assignments?.[0];
    if (!assignment) return false;
    const target = parseFloat(assignment.target_value) || 0;
    const actual = parseFloat(assignment.actual_value) || 0;
    return actual >= target;
  }).length;
  const notAchievedKpis = totalKpis - achievedKpis;
  const achievementRate =
    totalKpis > 0 ? Math.round((achievedKpis / totalKpis) * 100) : 0;

  return {
    totalKpis,
    achievedKpis,
    notAchievedKpis,
    achievementRate,
  };
});

const achievementChartData = computed(() => {
  const achieved = summaryStats.value.achievedKpis;
  const notAchieved = summaryStats.value.notAchievedKpis;

  return {
    labels: [$t("achieved"), $t("notAchieved")],
    datasets: [
      {
        label: $t("kpiRate"),
        data: [achieved, notAchieved],
        backgroundColor: ["#52c41a", "#ff4d4f"],
        borderColor: ["#389e0d", "#cf1322"],
        borderWidth: 1,
      },
    ],
  };
});

const achievementChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom",
    },
  },
}));

const departmentChartData = computed(() => {
  const departmentMap = {};
  kpis.value.forEach((kpi) => {
    kpi.assignments?.forEach((assignment) => {
      if (assignment.department) {
        const deptName = assignment.department.name;
        if (!departmentMap[deptName]) {
          departmentMap[deptName] = 0;
        }
        departmentMap[deptName]++;
      }
    });
  });

  const labels = Object.keys(departmentMap);
  const data = Object.values(departmentMap);

  return {
    labels,
    datasets: [
      {
        label: $t("kpiCount"),
        backgroundColor: "rgba(24, 144, 255, 0.7)",
        borderColor: "rgba(24, 144, 255, 1)",
        borderWidth: 1,
        data,
      },
    ],
  };
});

const departmentChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
    },
  },
}));

const tableData = computed(() => {
  return kpis.value.map((kpi) => {
    const assignment = kpi.assignments?.[0];
    const target = parseFloat(assignment?.target_value) || 0;
    const actual = parseFloat(assignment?.actual_value) || 0;
    const progress = target > 0 ? Math.round((actual / target) * 100) : 0;
    const achievement =
      progress >= 100 ? "achieved" : progress >= 50 ? "warning" : "notAchieved";

    return {
      id: kpi.id,
      name: kpi.name,
      department: assignment?.department?.name || "-",
      section: assignment?.section?.name || "-",
      target: target.toLocaleString() + " " + (kpi.unit || ""),
      actual: actual.toLocaleString() + " " + (kpi.unit || ""),
      progress: Math.min(progress, 100),
      achievement,
      status: kpi.status,
    };
  });
});

const totalKpis = computed(() => kpis.value.length);

const columns = computed(() => [
  {
    title: $t("kpiName"),
    dataIndex: "name",
    key: "name",
    width: "25%",
  },
  {
    title: $t("department"),
    dataIndex: "department",
    key: "department",
    width: "15%",
  },
  {
    title: $t("section"),
    dataIndex: "section",
    key: "section",
    width: "15%",
  },
  {
    title: $t("target"),
    dataIndex: "target",
    key: "target",
    width: "12%",
  },
  {
    title: $t("actual"),
    dataIndex: "actual",
    key: "actual",
    width: "12%",
  },
  {
    title: $t("progress"),
    key: "progress",
    width: "12%",
  },
  {
    title: $t("achievement"),
    key: "achievement",
    width: "9%",
  },
]);

const comparisonChartData = computed(() => {
  const perspectiveStats = perspectives.value.map((perspective) => {
    // This would need to be loaded separately or from a summary API
    // For now, return placeholder data
    return {
      name: perspective.name,
      score: 0,
    };
  });

  const labels = perspectiveStats.map((p) => p.name);
  const scores = perspectiveStats.map((p) => p.score);

  return {
    labels,
    datasets: [
      {
        label: $t("score"),
        backgroundColor: "rgba(24, 144, 255, 0.7)",
        borderColor: "rgba(24, 144, 255, 1)",
        borderWidth: 1,
        data: scores,
      },
    ],
  };
});

const comparisonChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: function (value) {
          return value + "%";
        },
      },
    },
  },
}));

const getScoreColor = (score) => {
  if (score >= 75) return "#52c41a";
  if (score >= 50) return "#faad14";
  return "#ff4d4f";
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
  if (!selectedPerspectiveId.value) {
    kpis.value = [];
    return;
  }

  isLoadingKpis.value = true;
  try {
    loadingError.value = null;
    const params = {
      perspectiveId: selectedPerspectiveId.value,
      limit: 1000,
    };
    if (selectedStatus.value) {
      params.status = selectedStatus.value;
    }

    const response = await apiClient.get("/kpis", { params });
    kpis.value = response.data?.data || [];
  } catch (error) {
    loadingError.value =
      error.response?.data?.message ||
      error.message ||
      $t("failedToLoadKpis");
    kpis.value = [];
  } finally {
    isLoadingKpis.value = false;
  }
};

const handlePerspectiveChange = () => {
  currentPage.value = 1;
  loadKpis();
};

const handleTableChange = (pagination) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
};

const loadData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    await fetchPerspectives();
  } finally {
    await store.dispatch("loading/stopLoading");
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.kpi-by-perspective-container {
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

.filter-card {
  background: #fff;
}

.summary-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.chart-card {
  height: 100%;
}

.chart-container {
  padding: 16px 0;
}

.table-card {
  margin-top: 24px;
}

.comparison-card {
  margin-top: 24px;
}

@media (max-width: 768px) {
  .kpi-by-perspective-container {
    padding: 16px;
  }
}
</style>

