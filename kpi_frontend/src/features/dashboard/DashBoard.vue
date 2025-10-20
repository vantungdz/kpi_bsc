<template>
  <div class="dashboard-overview-container">
    <LoadingOverlay :visible="loading" />
    <div class="dashboard-header">
      <bar-chart-outlined class="dashboard-header-icon" />
      <span class="dashboard-header-title">{{ $t("dashboardOverview") }}</span>
    </div>
    <a-row :gutter="[24, 32]" class="dashboard-row">
      <a-col
        v-for="card in dashboardCards"
        :key="card.key"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <router-link :to="card.to">
          <a-card hoverable :class="['dashboard-block-card', card.class]">
            <template #title>
              <component :is="card.icon" /> {{ $t(card.title) }}
            </template>
            <div class="dashboard-card-content">
              <p>{{ $t(card.desc) }}</p>
              <div class="dashboard-card-action">
                <span>{{ $t("viewDetail") }}</span>
                <arrow-right-outlined />
              </div>
            </div>
          </a-card>
        </router-link>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import {
  LineChartOutlined,
  UserSwitchOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons-vue";
import { useStore } from "vuex";
import { computed } from "vue";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
} from "chart.js";
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
);

const store = useStore();
const loading = computed(() => store.getters["loading/isLoading"]);

const dashboardCards = [
  {
    key: "kpi-stats",
    to: "/dashboard/kpi-process-stats",
    icon: LineChartOutlined,
    title: "kpiProcessStats",
    desc: "kpiProcessStatsDescription",
    class: "card-kpi-stats",
  },
  {
    key: "user-activity",
    to: "/dashboard/user-activity-stats",
    icon: UserSwitchOutlined,
    title: "userActivityStats",
    desc: "userActivityStatsDescription",
    class: "card-user-activity-stats",
  },
  {
    key: "kpi-performance",
    to: "/dashboard/kpi-performance-overview",
    icon: BarChartOutlined,
    title: "kpiPerformanceOverview",
    desc: "kpiPerformanceOverviewDescription",
    class: "card-kpi-performance",
  },
  {
    key: "kpi-inventory",
    to: "/dashboard/kpi-inventory-stats",
    icon: AppstoreOutlined,
    title: "kpiInventoryOverview",
    desc: "kpiInventoryOverviewDescription",
    class: "card-kpi-inventory",
  },
  {
    key: "employee-performance-history",
    to: "/dashboard/employee-performance-history",
    icon: BarChartOutlined,
    title: "employeePerformanceHistory.title",
    desc: "employeePerformanceHistoryDescription",
    class: "card-employee-performance-history",
  },
  {
    key: "objective-stats",
    to: "/dashboard/strategic-objectives-stats",
    icon: BarChartOutlined,
    title: "strategicObjectivesStats",
    desc: "strategicObjectivesStatsDescription",
    class: "card-objective-stats",
  },
];
</script>

<style scoped>
.dashboard-overview-container {
  padding: 32px 32px 24px 32px;
  background: #fafdff;
  min-height: auto;
}
.dashboard-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 32px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e3e7ef;
}
.dashboard-header-icon {
  font-size: 2.2em;
  color: #1976d2;
  background: #e3e7ef;
  border-radius: 50%;
  padding: 10px;
  box-shadow: 0 2px 8px #e3eaf322;
}
.dashboard-header-title {
  font-size: 2rem;
  font-weight: 800;
  color: #1a237e;
  letter-spacing: 1px;
}
.dashboard-row {
  margin-top: 8px;
}
.dashboard-block-card {
  min-height: 170px;
  border-radius: 16px;
  box-shadow: 0 4px 18px #e3eaf322;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: none;
}
.dashboard-block-card:hover {
  transform: translateY(-7px) scale(1.03);
  box-shadow: 0 8px 32px #1976d233;
}
.dashboard-block-card .ant-card-head {
  font-size: 1.15em;
  font-weight: bold;
  border-radius: 16px 16px 0 0;
  padding: 16px 20px 10px 20px;
}
.dashboard-block-card :deep(.ant-card-body) {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 20px 12px 20px;
}
.dashboard-card-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}
.dashboard-card-action {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1976d2;
  font-weight: 600;
  font-size: 1.02em;
  margin-top: 18px;
  cursor: pointer;
  transition: color 0.2s;
}
.dashboard-card-action:hover {
  color: #0050b3;
}
.dashboard-block-card .ant-card-head-title,
.dashboard-block-card :deep(.anticon) {
  color: #1976d2;
}
.dashboard-block-card p {
  font-size: 1.01em;
  color: #333;
  margin-top: 8px;
  margin-bottom: 0;
  font-weight: 500;
}

.card-kpi-stats {
  border-left: 5px solid #1890ff;
}
.card-kpi-stats :deep(.ant-card-head) {
  background-color: #e6f7ff;
}
.card-kpi-stats :deep(.ant-card-body) {
  background-color: #f0faff;
}

.card-kpi-stats .ant-card-head-title,
.card-kpi-stats :deep(.anticon) {
  color: #0050b3;
}
.card-kpi-stats p {
  color: #003a75;
}

.card-notification-stats {
  border-left: 5px solid #faad14;
}
.card-notification-stats :deep(.ant-card-head) {
  background-color: #fffbe6;
}
.card-notification-stats :deep(.ant-card-body) {
  background-color: #fffefa;
}
/* Màu chữ cho card Notification stats */
.card-notification-stats .ant-card-head-title,
.card-notification-stats :deep(.anticon) {
  color: #ad6800;
}
.card-notification-stats p {
  color: #874d00;
}

.card-user-activity-stats {
  border-left: 5px solid #722ed1; /* Màu tím cho user activity */
}
.card-user-activity-stats :deep(.ant-card-head) {
  background-color: #f9f0ff; /* Màu nền nhạt hơn của tím */
}
.card-user-activity-stats :deep(.ant-card-body) {
  background-color: #fef6ff; /* Màu nền rất nhạt của tím */
}
.card-user-activity-stats .ant-card-head-title,
.card-user-activity-stats :deep(.anticon) {
  color: #391085; /* Màu chữ đậm của tím */
}
.card-user-activity-stats p {
  color: #531dab; /* Màu chữ vừa của tím */
}

.card-kpi-performance {
  border-left: 5px solid #52c41a; /* Màu xanh lá cho performance */
}
.card-kpi-performance :deep(.ant-card-head) {
  background-color: #f6ffed; /* Màu nền nhạt hơn của xanh lá */
}
.card-kpi-performance :deep(.ant-card-body) {
  background-color: #fcfff6; /* Màu nền rất nhạt của xanh lá */
}
.card-kpi-performance .ant-card-head-title,
.card-kpi-performance :deep(.anticon) {
  color: #237804; /* Màu chữ đậm của xanh lá */
}
.card-kpi-performance p {
  color: #389e0d; /* Màu chữ vừa của xanh lá */
}

.card-kpi-inventory {
  border-left: 5px solid #13c2c2; /* Màu teal/cyan */
}
.card-kpi-inventory :deep(.ant-card-head) {
  background-color: #e6fffb; /* Màu nền nhạt của teal/cyan */
}
.card-kpi-inventory :deep(.ant-card-body) {
  background-color: #f0fffb; /* Màu nền rất nhạt của teal/cyan */
}
.card-kpi-inventory .ant-card-head-title,
.card-kpi-inventory :deep(.anticon) {
  color: #006d75; /* Màu chữ đậm của teal/cyan */
}
.card-kpi-inventory p {
  color: #08979c; /* Màu chữ vừa của teal/cyan */
}

.card-employee-performance-history {
  border-left: 5px solid #fa541c; /* Màu cam đậm */
}
.card-employee-performance-history :deep(.ant-card-head) {
  background-color: #fff2e8;
}
.card-employee-performance-history :deep(.ant-card-body) {
  background-color: #fff7f0;
}
.card-employee-performance-history .ant-card-head-title,
.card-employee-performance-history :deep(.anticon) {
  color: #ad2102;
}
.card-employee-performance-history p {
  color: #d4380d;
}

.card-objective-stats {
  border-left: 5px solid #eb2f96; /* Màu hồng đậm */
}
.card-objective-stats :deep(.ant-card-head) {
  background-color: #fff0f6; /* Màu nền nhạt của hồng đậm */
}
.card-objective-stats :deep(.ant-card-body) {
  background-color: #fff5f0; /* Màu nền rất nhạt của hồng đậm */
}
.card-objective-stats .ant-card-head-title,
.card-objective-stats :deep(.anticon) {
  color: #a50034; /* Màu chữ đậm của hồng đậm */
}
.card-objective-stats p {
  color: #c41d3b; /* Màu chữ vừa của hồng đậm */
}
</style>
