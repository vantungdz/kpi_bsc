<template>
  <div class="dashboard-overview-container">
    <h1>Dashboard Tổng Quan</h1>
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/kpi-process-stats">
          <a-card hoverable class="dashboard-block-card card-kpi-stats">
            <template #title>
              <line-chart-outlined /> Thống kê Quy trình KPI
            </template>
            <p>
              Xem chi tiết số lượng KPI chờ duyệt, đã duyệt/từ chối, thời gian
              duyệt trung bình và các KPI nổi bật.
            </p>
          </a-card>
        </router-link>
      </a-col>
      <a-col :xs="24" :sm="12" :md="8" :lg="6">
        <router-link to="/dashboard/notification-stats">
          <a-card
            hoverable
            class="dashboard-block-card card-notification-stats"
          >
            <template #title> <bell-outlined /> Thống kê Thông báo </template>
            <p>Phân tích số lượng và loại thông báo trong hệ thống.</p>
          </a-card>
        </router-link>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { LineChartOutlined, BellOutlined } from "@ant-design/icons-vue";
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
