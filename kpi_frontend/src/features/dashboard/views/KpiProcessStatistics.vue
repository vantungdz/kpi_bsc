<template>
  <div class="kpi-process-statistics-container">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item><router-link to="/dashboard">{{ $t('dashboardOverview') }}</router-link></a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t('kpiProcessStatistics') }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t('kpiProcessStatisticsDetail') }}</h1>

    <!-- 1. Số lượng KPI đang chờ duyệt -->
    <a-card :title="$t('kpiAwaitingApproval')" class="dashboard-card">
      <a-row :gutter="[16, 16]">
        <a-col v-if="kpiAwaitingStatsError" :span="24">
          <a-alert :message="$t('error')" :description="kpiAwaitingStatsError" type="error" show-icon />
        </a-col>
        <template v-if="!kpiAwaitingStatsError">
          <!-- Tổng số KPI chờ duyệt -->
          <a-col :xs="24" :sm="12" :md="8" :lg="6">
            <a-card>
              <a-skeleton :loading="isLoadingKpiAwaitingStats" active :paragraph="{ rows: 1 }">
                <a-statistic :title="$t('totalKpiAwaitingApproval')" :value="kpiAwaitingApprovalStats?.total ?? 0"
                  class="statistic-value" />
              </a-skeleton>
            </a-card>
          </a-col>

          <!-- Phân loại theo từng cấp duyệt -->
          <template v-if="isLoadingKpiAwaitingStats">
            <!-- Hiển thị 3 skeleton cho các cấp duyệt khi đang loading -->
            <a-col v-for="i in 3" :key="`skeleton-level-${i}`" :xs="24" :sm="12" :md="8" :lg="6">
              <a-card><a-skeleton active :paragraph="{ rows: 1 }" /></a-card>
            </a-col>
          </template>
          <template v-else-if="kpiAwaitingApprovalStats?.byLevel?.length > 0">
            <a-col v-for="level in kpiAwaitingApprovalStats.byLevel" :key="level.name" :xs="24" :sm="12" :md="8"
              :lg="6">
              <a-card>
                <a-statistic :title="$t(`approvalLevels.${level.status}`)" :value="level.count" class="statistic-value" />
              </a-card>
            </a-col>
          </template>
          <template v-else>
            <!-- Áp dụng khi không loading và byLevel rỗng hoặc không tồn tại -->
            <a-col :span="24" style="text-align: center; color: #888; padding: 10px 0">
              <a-card>
                <p>{{ $t('noAwaitingApprovalData') }}</p>
              </a-card>
            </a-col>
          </template>
        </template>
      </a-row>
      <div class="chart-container" v-if="
          !isLoadingKpiAwaitingStats &&
          !kpiAwaitingStatsError &&
          kpiAwaitingApprovalStats?.byLevel?.length > 0
        ">
        <line-chart v-if="kpiAwaitingChartData.datasets[0].data.some((d) => d > 0)" :chart-data="kpiAwaitingChartData"
          :chart-options="kpiAwaitingChartOptions" style="height: 300px" />
        <p v-else class="empty-chart-message">
          {{ $t('noChartData') }}
        </p>
      </div>
    </a-card>

    <!-- 2. Số lượng KPI đã được duyệt/từ chối (7 ngày qua) -->
    <a-card :title="$t('kpiApprovedRejected')" class="dashboard-card">
      <a-row :gutter="[16, 16]">
        <a-col v-if="kpiStatusOverTimeError" :span="24">
          <a-alert :message="$t('error')" :description="kpiStatusOverTimeError" type="error" show-icon />
        </a-col>
        <template v-if="!kpiStatusOverTimeError">
          <a-col :xs="24" :sm="12">
            <a-card>
              <a-skeleton :loading="isLoadingKpiStatusOverTime" active :paragraph="{ rows: 1 }">
                <a-statistic :title="$t('kpiApproved')" :value="kpiStatusOverTimeStats?.approvedLastXDays ?? 0"
                  class="statistic-value statistic-approved" />
              </a-skeleton>
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-card>
              <a-skeleton :loading="isLoadingKpiStatusOverTime" active :paragraph="{ rows: 1 }">
                <a-statistic :title="$t('kpiRejected')" :value="kpiStatusOverTimeStats?.rejectedLastXDays ?? 0"
                  class="statistic-value statistic-rejected" />
              </a-skeleton>
            </a-card>
          </a-col>
        </template>
      </a-row>
      <div class="chart-container" v-if="
          !isLoadingKpiStatusOverTime &&
          !kpiStatusOverTimeError &&
          (kpiStatusOverTimeStats?.approvedLastXDays > 0 ||
            kpiStatusOverTimeStats?.rejectedLastXDays > 0)
        ">
        <bar-chart :chart-data="kpiStatusOverTimeChartData" :chart-options="kpiStatusOverTimeChartOptions"
          style="height: 300px" />
      </div>
    </a-card>

    <!-- 3. Thời gian duyệt trung bình -->
    <a-card :title="$t('averageApprovalTime')" class="dashboard-card card-avg-time">
      <a-row :gutter="[16, 16]">
        <a-col v-if="averageApprovalTimeError" :span="24">
          <a-alert :message="$t('error')" :description="averageApprovalTimeError" type="error" show-icon />
        </a-col>
        <template v-if="!averageApprovalTimeError">
          <a-col :xs="24" :sm="12" :md="8">
            <a-card>
              <a-skeleton :loading="isLoadingAverageApprovalTime" active :paragraph="{ rows: 1 }">
                <a-statistic :title="$t('totalAverageApprovalTime')"
                  :value="averageApprovalTimeStats?.totalAverageTime ?? ''" :suffix="$t('hours')"
                  class="statistic-value" />
              </a-skeleton>
            </a-card>
          </a-col>
          <a-col v-for="level in averageApprovalTimeStats?.byLevel" :key="level.name" :xs="24" :sm="12" :md="8">
            <a-card>
              <a-skeleton :loading="isLoadingAverageApprovalTime" active :paragraph="{ rows: 1 }">
                <a-statistic :title="$t('averageApprovalTimeAt', { level: level.name })"
                  :value="level.averageTime ?? ''" suffix="$t('hours')" class="statistic-value" />
              </a-skeleton>
            </a-card>
          </a-col>
        </template>
      </a-row>
    </a-card>

    <!-- 4. Top KPI được submit/cập nhật nhiều nhất -->
    <a-card :title="$t('topKpiActivity')" class="dashboard-card card-top-activity">
      <a-row :gutter="[16, 16]">
        <a-col v-if="topKpiActivityError" :span="24">
          <a-alert :message="$t('error')" :description="topKpiActivityError" type="error" show-icon />
        </a-col>
        <template v-if="!topKpiActivityError">
          <a-col :xs="24" :sm="12">
            <h4>{{ $t('topKpiSubmitted') }}</h4>
            <a-skeleton :loading="isLoadingTopKpiActivity" active avatar :paragraph="{ rows: 3 }">
              <a-list bordered :dataSource="topKpiActivityStats?.submitted">
                <template #renderItem="{ item }">
                  <a-list-item>
                    {{ item.name }} ({{ item.count }} {{ $t('times') }})
                  </a-list-item>
                </template>
                <div v-if="
                    !isLoadingTopKpiActivity &&
                    (!topKpiActivityStats?.submitted ||
                      topKpiActivityStats.submitted.length === 0)
                  " class="empty-list">
                  {{ $t('noData') }}
                </div>
              </a-list>
            </a-skeleton>
          </a-col>
          <a-col :xs="24" :sm="12">
            <h4>{{ $t('topKpiUpdated') }}</h4>
            <a-skeleton :loading="isLoadingTopKpiActivity" active avatar :paragraph="{ rows: 3 }">
              <a-list bordered :dataSource="topKpiActivityStats?.updated">
                <template #renderItem="{ item }">
                  <a-list-item>
                    {{ item.name }} ({{ item.count }} {{ $t('times') }})
                  </a-list-item>
                </template>
                <div v-if="
                    !isLoadingTopKpiActivity &&
                    (!topKpiActivityStats?.updated ||
                      topKpiActivityStats.updated.length === 0)
                  " class="empty-list">
                  {{ $t('noData') }}
                </div>
              </a-list>
            </a-skeleton>
          </a-col>
        </template>
      </a-row>
    </a-card>
  </div>
</template>

<script setup>
import { onMounted, computed } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { Breadcrumb as ABreadcrumb, BreadcrumbItem as ABreadcrumbItem } from 'ant-design-vue'; 
import { Skeleton as ASkeleton, Alert as AAlert } from "ant-design-vue";
import BarChart from "@/core/components/common/BarChart.vue";
import LineChart from "@/core/components/common/LineChart.vue";

const { t: $t } = useI18n();
const store = useStore();

const kpiAwaitingApprovalStats = computed(
  () => store.getters["dashboard/getKpiAwaitingApprovalStats"]
);
const isLoadingKpiAwaitingStats = computed(
  () => store.getters["dashboard/isLoadingKpiAwaitingStats"]
);
const kpiAwaitingStatsError = computed(
  () => store.getters["dashboard/getKpiAwaitingStatsError"]
);

const kpiStatusOverTimeStats = computed(
  () => store.getters["dashboard/getKpiStatusOverTimeStats"]
);
const isLoadingKpiStatusOverTime = computed(
  () => store.getters["dashboard/isLoadingKpiStatusOverTime"]
);
const kpiStatusOverTimeError = computed(
  () => store.getters["dashboard/getKpiStatusOverTimeError"]
);

const averageApprovalTimeStats = computed(
  () => store.getters["dashboard/getAverageApprovalTimeStats"]
);
const isLoadingAverageApprovalTime = computed(
  () => store.getters["dashboard/isLoadingAverageApprovalTime"]
);
const averageApprovalTimeError = computed(
  () => store.getters["dashboard/getAverageApprovalTimeError"]
);

const topKpiActivityStats = computed(
  () => store.getters["dashboard/getTopKpiActivityStats"]
);
const isLoadingTopKpiActivity = computed(
  () => store.getters["dashboard/isLoadingTopKpiActivity"]
);
const topKpiActivityError = computed(
  () => store.getters["dashboard/getTopKpiActivityError"]
);

const kpiAwaitingChartData = computed(() => {
  const labels =
    kpiAwaitingApprovalStats.value?.byLevel?.map((level) => level.name) || [];
  const data =
    kpiAwaitingApprovalStats.value?.byLevel?.map((level) => level.count) || [];
  return {
    labels: labels,
    datasets: [
      {
        label: $t("kpiAwaitingApproval"),
        borderColor: "#36A2EB", 
        backgroundColor: "rgba(54, 162, 235, 0.2)", 
        borderWidth: 2, 
        fill: true, 
        data: data,
        pointBackgroundColor: "#36A2EB", 
        pointBorderColor: "#fff", 
        pointHoverBackgroundColor: "#fff", 
        pointHoverBorderColor: "#36A2EB", 
        pointRadius: 4, 
        pointHoverRadius: 6, 
        tension: 0.1, 
      },
    ],
  };
});

const kpiAwaitingChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true, 
      position: "top", 
    },
    title: {
      display: true,
      text: $t("kpiAwaitingApprovalByLevel"),
    },
    tooltip: {
      enabled: true,
      backgroundColor: "rgba(0,0,0,0.8)",
      titleFont: {
        size: 14,
      },
      bodyFont: {
        size: 12,
      },
      callbacks: {
        title: function (tooltipItems) {
          return `${$t("approvalLevel")}: ${tooltipItems[0].label}`;
        },
        label: function (context) {
          let label = context.dataset.label || "";
          if (label) {
            label += ": ";
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y + " " + $t("kpi");
          }
          return label;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 },
      title: { display: true, text: $t("kpiCount") },
    },
    x: { title: { display: true, text: $t("approvalLevel") } },
  },
}));

const kpiStatusOverTimeChartData = computed(() => {
  return {
    labels: [$t("approved"), $t("rejected")],
    datasets: [
      {
        data: [
          kpiStatusOverTimeStats.value?.approvedLastXDays ?? 0,
          kpiStatusOverTimeStats.value?.rejectedLastXDays ?? 0,
        ],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)", 
          "rgba(255, 99, 132, 0.6)", 
        ],
        borderColor: ["rgba(75, 192, 192, 1)", "rgba(255, 99, 132, 1)"],
        borderWidth: 1,
      },
    ],
  };
});
const kpiStatusOverTimeChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, 
    },
    title: {
      display: true,
      text: $t("kpiApprovedRejectedOverTime"),
    },
  },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 } }, 
  },
}));

const fetchData = async () => {
  await store.dispatch("dashboard/fetchKpiAwaitingApprovalStats");
  await store.dispatch("dashboard/fetchKpiStatusOverTimeStats", { days: 7 }); 
  await store.dispatch("dashboard/fetchAverageApprovalTimeStats");
  await store.dispatch("dashboard/fetchTopKpiActivityStats", {
    days: 30,
    limit: 5,
  }); 
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>

.kpi-process-statistics-container .ant-breadcrumb {
  margin-bottom: 16px;
}
.kpi-process-statistics-container {
  padding: 24px;
}

.kpi-process-statistics-container h1 {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
  
}

.dashboard-card {
  margin-bottom: 20px; 
  border: 1px solid #e8e8e8; 
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03); 
}


.dashboard-card:first-of-type { 
  border-left: 5px solid #1890ff; 
}
.dashboard-card:first-of-type :deep(.ant-card-head) {
  background-color: #e6f7ff;
}


.dashboard-card:nth-of-type(2) { 
  border-left: 5px solid #52c41a; 
}
.dashboard-card:nth-of-type(2) :deep(.ant-card-head) {
  background-color: #f6ffed;
}


.card-avg-time { 
  border-left: 5px solid #722ed1; 
}
.card-avg-time :deep(.ant-card-head) {
  background-color: #f9f0ff;
}


.statistic-value :deep(.ant-statistic-content-value) {
  font-size: 24px;
  font-weight: bold;
}

.statistic-approved :deep(.ant-statistic-content-value) {
  color: #52c41a;
}

.statistic-rejected :deep(.ant-statistic-content-value) {
  color: #f5222d;
}


.card-top-activity { 
  border-left: 5px solid #d9d9d9; 
}
.card-top-activity :deep(.ant-card-head) {
  background-color: #fafafa;
}

.chart-container {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #f0f0f0;
}
.empty-chart-message {
  text-align: center;
  color: #888;
  padding: 20px 0;
}

.empty-list {
  padding: 20px;
  text-align: center;
  color: #888;
}
</style>
