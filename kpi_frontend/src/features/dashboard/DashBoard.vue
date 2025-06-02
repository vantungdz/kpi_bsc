<template>
  <div class="dashboard-overview-container">
    <LoadingOverlay :visible="loading" />
    <h1>{{ $t("dashboardOverview") }}</h1>
    <a-row :gutter="[16, 24]">
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/kpi-process-stats">
          <a-card hoverable class="dashboard-block-card card-kpi-stats">
            <template #title>
              <line-chart-outlined /> {{ $t("kpiProcessStats") }}
            </template>
            <p>
              {{ $t("kpiProcessStatsDescription") }}
            </p>
          </a-card>
        </router-link>
      </a-col>
      <!-- Thêm Card mới cho User Activity Stats -->
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/user-activity-stats">
          <a-card hoverable class="dashboard-block-card card-user-activity-stats">
            <template #title>
              <user-switch-outlined /> {{ $t("userActivityStats") }}
            </template>
            <p>
              {{ $t("userActivityStatsDescription") }}
            </p>
          </a-card>
        </router-link>
      </a-col>
      <!-- Thêm Card mới cho KPI Performance Overview -->
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/kpi-performance-overview">
          <a-card hoverable class="dashboard-block-card card-kpi-performance">
            <template #title>
              <bar-chart-outlined /> {{ $t("kpiPerformanceOverview") }}
            </template>
            <p>
              {{ $t("kpiPerformanceOverviewDescription") }}
            </p>
          </a-card>
        </router-link>
      </a-col>
      <!-- Thêm Card mới cho Tổng quan Kho KPI -->
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/kpi-inventory-stats">
          <a-card hoverable class="dashboard-block-card card-kpi-inventory">
            <template #title>
              <appstore-outlined /> {{ $t("kpiInventoryOverview") }}
            </template>
            <p>
              {{ $t("kpiInventoryOverviewDescription") }}
            </p>
          </a-card>
        </router-link>
      </a-col>
      <!-- Thêm Card mới cho Lịch sử hiệu suất nhân viên -->
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/employee-performance-history">
          <a-card hoverable class="dashboard-block-card card-employee-performance-history">
            <template #title>
              <bar-chart-outlined /> {{ $t("employeePerformanceHistory.title") }}
            </template>
            <p>
              {{ $t("employeePerformanceHistoryDescription") }}
            </p>
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
} from "@ant-design/icons-vue";
import { useStore } from "vuex";
import { computed } from "vue";

const store = useStore();
const loading = computed(() => store.getters["loading/isLoading"]);
</script>

<style scoped>
.dashboard-overview-container {
  padding: 24px;
}

.dashboard-overview-container :deep(.ant-col > a) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-block-card {
  min-height: 150px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s ease;
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

.dashboard-block-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dashboard-block-card .ant-card-head {
  flex-shrink: 0;
  font-size: 1.1em;
  font-weight: bold;
}

.dashboard-block-card :deep(.ant-card-body) {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.dashboard-block-card p {
  font-size: 0.9em;
  color: #555;
  margin-top: 8px;
}

a {
  text-decoration: none;
  color: inherit;
}
</style>
