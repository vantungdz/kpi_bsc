<template>
  <div class="kpi-performance-overview-container" v-if="canViewDashboard">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item
        ><router-link to="/dashboard">{{
          $t("dashboardOverview")
        }}</router-link></a-breadcrumb-item
      >
      <a-breadcrumb-item>{{ $t("kpiPerformanceOverview") }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t("kpiPerformanceOverview") }}</h1>

    <a-spin :spinning="isLoadingOverview" :tip="$t('loadingData')">
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
        <!-- Section 1: Tổng quan các chỉ số chính -->
        <a-card
          :title="$t('kpiInventorySummary')"
          class="dashboard-card performance-summary-card"
        >
          <a-row :gutter="[16, 24]" align="middle">
            <a-col :xs="24" :sm="24" :md="14" :lg="16">
              <a-row :gutter="[16, 16]">
                <!-- Tổng số KPI -->
                <a-col :xs="24" :sm="12" :lg="8">
                  <a-card class="stat-card">
                    <a-skeleton
                      :loading="isLoadingOverview"
                      active
                      :paragraph="{ rows: 2 }"
                    >
                      <a-statistic
                        :title="$t('totalKpiDefinitions')"
                        :value="kpiOverviewStats?.totalKpis ?? 0"
                        class="statistic-value"
                      />
                      <p class="stat-description">
                        {{ $t("totalKpiDefinitionsDescription") }}
                      </p>
                    </a-skeleton>
                  </a-card>
                </a-col>
                <!-- Tổng số Lượt giao KPI có giá trị -->
                <a-col :xs="24" :sm="12" :lg="8">
                  <a-card class="stat-card">
                    <a-skeleton
                      :loading="isLoadingOverview"
                      active
                      :paragraph="{ rows: 1 }"
                    >
                      <a-statistic
                        :title="$t('totalKpiAssignments')"
                        :value="kpiOverviewStats?.totalKpisWithValues ?? 0"
                        class="statistic-value"
                      />
                    </a-skeleton>
                  </a-card>
                </a-col>

                <!-- % KPI đạt mục tiêu -->
                <a-col :xs="24" :sm="12" :lg="8">
                  <a-card class="stat-card">
                    <a-skeleton
                      :loading="isLoadingOverview"
                      active
                      :paragraph="{ rows: 1 }"
                    >
                      <a-statistic
                        :title="$t('kpiAchieved')"
                        :value="kpiOverviewStats?.achievedRate ?? 0"
                        suffix="%"
                        :value-style="{ color: '#3f8600' }"
                        class="statistic-value"
                      />
                    </a-skeleton>
                  </a-card>
                </a-col>

                <!-- % KPI không đạt -->
                <a-col :xs="24" :sm="12" :lg="8">
                  <a-card class="stat-card">
                    <a-skeleton
                      :loading="isLoadingOverview"
                      active
                      :paragraph="{ rows: 1 }"
                    >
                      <a-statistic
                        :title="$t('kpiNotAchieved')"
                        :value="kpiOverviewStats?.notAchievedRate ?? 0"
                        suffix="%"
                        :value-style="{ color: '#cf1322' }"
                        class="statistic-value"
                      />
                    </a-skeleton>
                  </a-card>
                </a-col>

                <!-- % KPI chưa cập nhật gần đây -->
                <a-col :xs="24" :sm="12" :lg="8">
                  <a-card class="stat-card">
                    <a-skeleton
                      :loading="isLoadingOverview"
                      active
                      :paragraph="{ rows: 1 }"
                    >
                      <a-statistic
                        :title="$t('kpiNotUpdatedRecently')"
                        :value="kpiOverviewStats?.notUpdatedRecentlyRate ?? 0"
                        suffix="%"
                        :value-style="{ color: '#faad14' }"
                        class="statistic-value"
                      />
                    </a-skeleton>
                  </a-card>
                </a-col>
              </a-row>
            </a-col>
            <a-col :xs="24" :sm="24" :md="10" :lg="8">
              <div
                class="chart-container main-overview-chart"
                v-if="
                  !isLoadingOverview &&
                  kpiOverviewStats &&
                  (kpiOverviewStats.achievedCount > 0 ||
                    kpiOverviewStats.notAchievedCount > 0)
                "
              >
                <pie-chart
                  :chart-data="kpiAchievementChartData"
                  :chart-options="kpiAchievementChartOptions"
                  style="height: 220px"
                />
              </div>
              <div
                v-else-if="!isLoadingOverview"
                class="empty-chart-message main-overview-chart-empty"
              >
                {{ $t("noKpiInventoryData") }}
              </div>
            </a-col>
          </a-row>
        </a-card>

        <!-- Section 2: Trạng thái KPI theo vai trò (Sẽ thêm bảng/biểu đồ sau) -->
        <a-card
          :title="$t('assignmentsByRole')"
          class="dashboard-card card-style-role-performance"
        >
          <a-skeleton
            :loading="isLoadingOverview"
            active
            :paragraph="{ rows: 5 }"
          />
          <div
            v-if="
              !isLoadingOverview &&
              (!kpiOverviewStats ||
                !kpiOverviewStats.performanceByRole ||
                kpiOverviewStats.performanceByRole.length === 0)
            "
            class="empty-list"
          >
            {{ $t("noRoleData") }}
          </div>
          <a-table
            v-if="
              !isLoadingOverview &&
              kpiOverviewStats &&
              kpiOverviewStats.performanceByRole &&
              kpiOverviewStats.performanceByRole.length > 0
            "
            :columns="performanceByRoleColumns"
            :data-source="kpiOverviewStats.performanceByRole"
            :pagination="false"
            size="small"
            bordered
            row-key="roleId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'achievedRate'">
                <a-progress
                  :percent="record.achievedRate"
                  :status="
                    record.achievedRate >= 75
                      ? 'success'
                      : record.achievedRate >= 50
                        ? 'normal'
                        : 'exception'
                  "
                  size="small"
                />
              </template>
              <template v-else-if="column.key === 'achievedCount'">
                <span style="color: #3f8600">{{ record.achievedCount }}</span>
              </template>
              <template v-else-if="column.key === 'notAchievedCount'">
                <span style="color: #cf1322">{{
                  record.notAchievedCount
                }}</span>
              </template>
            </template>
          </a-table>
        </a-card>
      </div>
      <a-empty
        v-if="!isLoadingOverview && !kpiOverviewStats && !loadingError"
        :description="$t('noKpiPerformanceOverviewData')"
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
  Skeleton as ASkeleton,
  Spin as ASpin,
  Alert as AAlert,
  Empty as AEmpty,
  Table as ATable,
  Progress as AProgress,
} from "ant-design-vue";
import PieChart from "@/core/components/common/PieChart.vue";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const { t: $t } = useI18n();
const store = useStore();

const kpiOverviewStats = computed(
  () => store.getters["dashboard/getKpiPerformanceOverviewStats"]
);
const isLoadingOverview = computed(() => store.getters["loading/isLoading"]);
const loadingError = computed(
  () => store.getters["dashboard/getKpiPerformanceOverviewError"]
);

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

const canViewDashboard = computed(
  () =>
    hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD) 
);

const performanceByRoleColumns = ref([
  {
    title: $t("department"),
    dataIndex: "roleName",
    key: "roleName",
    sorter: (a, b) => a.roleName.localeCompare(b.roleName),
    defaultSortOrder: "ascend",
  },
  {
    title: $t("totalKpiAssignments"),
    dataIndex: "totalAssignedKpis",
    key: "totalAssignedKpis",
    align: "right",
    sorter: (a, b) => a.totalAssignedKpis - b.totalAssignedKpis,
  },
  {
    title: $t("kpiAchieved"),
    dataIndex: "achievedCount",
    key: "achievedCount",
    align: "right",
    sorter: (a, b) => a.achievedCount - b.achievedCount,
  },
  {
    title: $t("kpiNotAchieved"),
    dataIndex: "notAchievedCount",
    key: "notAchievedCount",
    align: "right",
    sorter: (a, b) => a.notAchievedCount - b.notAchievedCount,
  },
  {
    title: $t("achievedRatePercentage"),
    dataIndex: "achievedRate",
    key: "achievedRate",
    align: "center",
    width: 150,
    sorter: (a, b) => a.achievedRate - b.achievedRate,
  },
]);

const kpiAchievementChartData = computed(() => {
  if (!kpiOverviewStats.value) {
    return { labels: [], datasets: [] };
  }
  return {
    labels: [$t("kpiAchieved"), $t("kpiNotAchieved")],
    datasets: [
      {
        label: $t("kpiRate"),
        data: [
          kpiOverviewStats.value.achievedCount ?? 0,
          kpiOverviewStats.value.notAchievedCount ?? 0,
        ],
        backgroundColor: ["rgba(75, 192, 192, 0.7)", "rgba(255, 99, 132, 0.7)"],
        borderColor: ["rgba(75, 192, 192, 1)", "rgba(255, 99, 132, 1)"],
        borderWidth: 1,
      },
    ],
  };
});

const kpiAchievementChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" },
    title: { display: true, text: $t("kpiAchievementChartTitle") },
  },
}));

onMounted(() => {
  store.dispatch("dashboard/fetchKpiPerformanceOverviewStats", {
    daysForNotUpdated: 7,
  });
});
</script>

<style scoped>
.kpi-performance-overview-container {
  padding: 24px;
}

.dashboard-card {
  margin-bottom: 24px;
}

.performance-summary-card {
  border-left: 5px solid #1890ff;
}

.performance-summary-card :deep(.ant-card-head) {
  background-color: #e6f7ff;
}

.performance-summary-card .stat-card {
  height: 100%;

  display: flex;

  flex-direction: column;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  border-radius: 4px;
}

.performance-summary-card .stat-card :deep(.ant-card-body) {
  flex-grow: 1;

  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-style-role-performance {
  border-left: 5px solid #faad14;
}

.card-style-role-performance :deep(.ant-card-head) {
  background-color: #fffbe6;
}

.statistic-value :deep(.ant-statistic-content-value) {
  font-size: 24px;
  font-weight: bold;
}

.stat-description {
  font-size: 0.8em;
  color: #888;
  margin-top: 4px;
}

.empty-list {
  padding: 20px;
  text-align: center;
  color: #888;
}

.chart-container {
  position: relative;
}

.main-overview-chart {
  padding: 10px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.main-overview-chart-empty {
  text-align: center;
  color: #888;
  padding: 20px 0;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
