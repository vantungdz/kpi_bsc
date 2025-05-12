<template>
  <div class="kpi-inventory-statistics-container">
    <a-breadcrumb style="margin-bottom: 16px">
      <a-breadcrumb-item>
        <router-link to="/dashboard">{{ $t('dashboardOverview') }}</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>{{ $t('kpiInventoryOverview') }}</a-breadcrumb-item>
    </a-breadcrumb>
    <h1>{{ $t('kpiInventoryOverview') }}</h1>

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
        <!-- Section 1: Summary Metrics -->
        <a-card :title="$t('kpiInventorySummary')" class="dashboard-card summary-metrics-card card-style-summary">
          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <div class="metric-item">
                <database-outlined class="metric-icon" />
                <a-skeleton :loading="isLoading" active :paragraph="{ rows: 1 }">
                  <a-statistic :title="$t('totalKpiDefinitions')" :value="inventoryStats?.totalKpiDefinitions ?? 0" class="statistic-value" />
                </a-skeleton>
              </div>
            </a-col>
            <a-col :xs="24" :sm="12" :md="8" :lg="6">
              <div class="metric-item">
                <branches-outlined class="metric-icon" />
                <a-skeleton :loading="isLoading" active :paragraph="{ rows: 1 }">
                  <a-statistic :title="$t('totalKpiAssignments')" :value="inventoryStats?.totalKpiAssignments ?? 0" class="statistic-value" />
                </a-skeleton>
              </div>
            </a-col>
          </a-row>
        </a-card>

        <!-- Section 2: Assignments by Department -->
        <a-card :title="$t('assignmentsByDepartment')" class="dashboard-card card-style-department">
          <a-skeleton :loading="isLoading" active :paragraph="{ rows: 5 }" />
          <div v-if="!isLoading && !inventoryStats?.assignmentsByDepartment?.length" class="empty-list">
            {{ $t('noDepartmentData') }}
          </div>
          <div class="chart-container" v-if="!isLoading && inventoryStats?.assignmentsByDepartment?.length">
            <bar-chart :chart-data="assignmentsByDepartmentChartData" :chart-options="assignmentsByDepartmentChartOptions" style="height: 350px;" />
          </div>
        </a-card>

        <!-- Section 3: Assignments by Status -->
        <a-card :title="$t('assignmentsByStatus')" class="dashboard-card card-style-status">
          <a-skeleton :loading="isLoading" active :paragraph="{ rows: 5 }" />
          <div v-if="!isLoading && !inventoryStats?.assignmentsByStatus?.length" class="empty-list">
            {{ $t('noStatusData') }}
          </div>
          <div class="chart-container" v-if="!isLoading && inventoryStats?.assignmentsByStatus?.length">
            <pie-chart :chart-data="assignmentsByStatusChartData" :chart-options="assignmentsByStatusChartOptions" style="height: 300px;" />
          </div>
        </a-card>
      </div>

      <a-empty v-if="!isLoading && !inventoryStats && !loadingError" :description="$t('noKpiInventoryData')" />
    </a-spin>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
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
  Empty as AEmpty
} from 'ant-design-vue';
import { DatabaseOutlined, BranchesOutlined } from '@ant-design/icons-vue';
import BarChart from "@/core/components/common/BarChart.vue";
import PieChart from "@/core/components/common/PieChart.vue"; 

const store = useStore();
const { t: $t } = useI18n();

const isLoading = computed(() => store.getters["dashboard/isLoadingKpiInventory"]);
const loadingError = computed(() => store.getters["dashboard/getKpiInventoryError"]); 
const inventoryStats = computed(() => store.getters["dashboard/getKpiInventoryStats"]);


const assignmentsByDepartmentChartData = computed(() => {
  const data = inventoryStats.value?.assignmentsByDepartment || [];
  const labels = data.map(item => item.departmentName);
  const counts = data.map(item => item.count);

  return {
    labels: labels,
    datasets: [
      {
        label: $t('kpiAssignments'), // Dynamic translation
        backgroundColor: 'rgba(24, 144, 255, 0.7)', 
        borderColor: 'rgba(24, 144, 255, 1)',
        borderWidth: 1,
        data: counts,
        barThickness: 'flex',
        maxBarThickness: 50,
      },
    ],
  };
});

const assignmentsByDepartmentChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', 
  plugins: {
    legend: { display: false },
    title: { display: true, text: $t('kpiAssignmentsByDepartment') } // Dynamic translation
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: $t('kpiAssignmentsCount') } }, // Dynamic translation
    y: { ticks: { autoSkip: false } }
  },
}));


const assignmentsByStatusChartData = computed(() => {
  const data = inventoryStats.value?.assignmentsByStatus || [];

  const labels = data.map(item => $t(`status_chart.${item.status}`)); // Ensure dynamic translation
  const counts = data.map(item => item.count);

  const backgroundColors = [
    'rgba(255, 159, 64, 0.7)',  
    'rgba(54, 162, 235, 0.7)',   
    'rgba(201, 203, 207, 0.7)', 
  ];
  const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

  return {
    labels: labels,
    datasets: [
      {
        label: $t('kpiAssignments'), // Dynamic translation
        data: counts,
        backgroundColor: backgroundColors.slice(0, data.length),
        borderColor: borderColors.slice(0, data.length),
        borderWidth: 1,
      },
    ],
  };
});

const assignmentsByStatusChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    title: { display: true, text: $t('kpiAssignmentsByStatus') } // Dynamic translation
  }
}));

onMounted(() => {
  store.dispatch("dashboard/fetchKpiInventoryStats");
});
</script>

<style scoped>
.kpi-inventory-statistics-container {
  padding: 24px;
}
.dashboard-card {
  margin-bottom: 24px;
}


.card-style-summary {
  border-left: 5px solid #1890ff; 
}
.card-style-summary :deep(.ant-card-head) {
  background-color: #e6f7ff;
}
.card-style-summary .metric-icon {
  color: #0050b3; 
}


.card-style-department {
  border-left: 5px solid #52c41a; 
}
.card-style-department :deep(.ant-card-head) {
  background-color: #f6ffed;
}


.card-style-status {
  border-left: 5px solid #faad14; 
}
.card-style-status :deep(.ant-card-head) {
  background-color: #fffbe6;
}


.dashboard-card :deep(.ant-card-head-title) {
  font-weight: 600;
}

.summary-metrics-card .metric-item {
  padding: 16px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  display: flex;
  align-items: center;
  height: 100%;
  
}

.metric-icon {
  font-size: 28px;
  margin-right: 16px;
  
}

.stat-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  border-radius: 4px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.stat-card :deep(.ant-card-body) {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.statistic-value :deep(.ant-statistic-content-value) {
  font-size: 24px;
  font-weight: bold;
}
.empty-list {
  padding: 20px;
  text-align: center;
  color: #888;
}
.chart-container {
  position: relative;
}
</style>