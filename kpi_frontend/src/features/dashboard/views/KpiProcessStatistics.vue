<template>
    <div class="kpi-process-statistics-container">
        <h1>Thống kê Chi tiết: Quy trình Duyệt KPI</h1>

        <!-- 1. Số lượng KPI đang chờ duyệt -->
        <a-card title="Số lượng KPI đang chờ duyệt" class="dashboard-card">
            <a-row :gutter="[16, 16]">
                <a-col v-if="kpiAwaitingStatsError" :span="24">
                    <a-alert message="Lỗi" :description="kpiAwaitingStatsError" type="error" show-icon />
                </a-col>
                <template v-if="!kpiAwaitingStatsError">
                    <!-- Tổng số KPI chờ duyệt -->
                    <a-col :xs="24" :sm="12" :md="8" :lg="6">
                        <a-card>
                            <a-skeleton :loading="isLoadingKpiAwaitingStats" active :paragraph="{ rows: 1 }">
                                <a-statistic title="Tổng số KPI chờ duyệt"
                                    :value="kpiAwaitingApprovalStats?.total ?? 0" class="statistic-value" />
                            </a-skeleton>
                        </a-card>
                    </a-col>

                    <!-- Phân loại theo từng cấp duyệt -->
                    <template v-if="isLoadingKpiAwaitingStats || (kpiAwaitingApprovalStats && kpiAwaitingApprovalStats.byLevel && kpiAwaitingApprovalStats.byLevel.length > 0)">
                        <template v-if="isLoadingKpiAwaitingStats">
                            <!-- Hiển thị 3 skeleton cho các cấp duyệt khi đang loading -->
                            <a-col v-for="i in 3" :key="`skeleton-level-${i}`" :xs="24" :sm="12" :md="8" :lg="6">
                                <a-card>
                                    <a-skeleton active :paragraph="{ rows: 1 }" />
                                </a-card>
                            </a-col>
                        </template>
                        <template v-else-if="kpiAwaitingApprovalStats && kpiAwaitingApprovalStats.byLevel">
                            <a-col v-for="level in kpiAwaitingApprovalStats.byLevel" :key="level.name" :xs="24" :sm="12"
                                :md="8" :lg="6">
                                <a-card>
                                    <a-statistic :title="`${level.name}`" :value="level.count" class="statistic-value" />
                                </a-card>
                            </a-col>
                        </template>
                    </template>
                    <template v-else-if="!isLoadingKpiAwaitingStats && kpiAwaitingApprovalStats && (!kpiAwaitingApprovalStats.byLevel || kpiAwaitingApprovalStats.byLevel.length === 0)">
                        <a-col :span="24" style="text-align: center; color: #888; padding: 10px 0;">
                            <a-card>
                                <p>Không có dữ liệu chờ duyệt theo cấp.</p>
                            </a-card>
                        </a-col>
                    </template>
                </template>
            </a-row>
            <div class="chart-placeholder">
                <!-- Biểu đồ cột hoặc tròn thể hiện tỷ lệ ở mỗi bước sẽ được đặt ở đây -->
                <p style="text-align: center; padding: 20px; border: 1px dashed #ccc;">
                    [Placeholder cho Biểu đồ Phân loại KPI Chờ Duyệt]
                </p>
            </div>
        </a-card>

        <!-- 2. Số lượng KPI đã được duyệt/từ chối -->
        <a-card title="Số lượng KPI đã được duyệt/từ chối" class="dashboard-card">
            <!-- Thêm (7 ngày qua) hoặc ({{ selectedDays }} ngày qua) nếu bạn có bộ lọc -->
            <a-row :gutter="[16, 16]">
                <a-col v-if="kpiStatusOverTimeError" :span="24">
                    <a-alert message="Lỗi" :description="kpiStatusOverTimeError" type="error" show-icon />
                </a-col>
                <template v-if="!kpiStatusOverTimeError">
                    <a-col :xs="24" :sm="12">
                        <a-card>
                            <a-skeleton :loading="isLoadingKpiStatusOverTime" active :paragraph="{ rows: 1 }">
                                <a-statistic title="KPI Được Duyệt"
                                    :value="kpiStatusOverTimeStats?.approvedLastXDays ?? 0"
                                    class="statistic-value statistic-approved" />
                            </a-skeleton>
                        </a-card>
                    </a-col>
                    <a-col :xs="24" :sm="12">
                        <a-card>
                            <a-skeleton :loading="isLoadingKpiStatusOverTime" active :paragraph="{ rows: 1 }">
                                <a-statistic title="KPI Bị Từ Chối" :value="kpiStatusOverTimeStats?.rejectedLastXDays ?? 0"
                                    class="statistic-value statistic-rejected" />
                            </a-skeleton>
                        </a-card>
                    </a-col>
                </template>
            </a-row>
            <div class="chart-placeholder">
                <!-- Biểu đồ đường thể hiện xu hướng duyệt/từ chối theo thời gian -->
                <p style="text-align: center; padding: 20px; border: 1px dashed #ccc;">
                    [Placeholder cho Biểu đồ Xu hướng Duyệt/Từ chối KPI]
                </p>
            </div>
        </a-card>

        <!-- 3. Thời gian duyệt trung bình -->
        <a-card title="Thời gian duyệt trung bình" class="dashboard-card">
            <a-row :gutter="[16, 16]">
                <a-col v-if="averageApprovalTimeError" :span="24">
                    <a-alert message="Lỗi" :description="averageApprovalTimeError" type="error" show-icon />
                </a-col>
                <template v-if="!averageApprovalTimeError">
                    <a-col :xs="24" :sm="12" :md="8">
                        <a-card>
                            <a-skeleton :loading="isLoadingAverageApprovalTime" active :paragraph="{ rows: 1 }">
                                <a-statistic title="Tổng thời gian duyệt trung bình"
                                    :value="averageApprovalTimeStats?.totalAverageTime ?? 'N/A'" suffix="giờ"
                                    class="statistic-value" />
                            </a-skeleton>
                        </a-card>
                    </a-col>
                    <!-- Hiện tại backend trả về byLevel rỗng, khi nào có dữ liệu sẽ hiển thị -->
                    <a-col v-for="level in averageApprovalTimeStats?.byLevel" :key="level.name" :xs="24" :sm="12" :md="8">
                        <a-card>
                             <a-skeleton :loading="isLoadingAverageApprovalTime" active :paragraph="{ rows: 1 }">
                                <a-statistic :title="`TB duyệt tại ${level.name}`" :value="level.averageTime ?? 'N/A'" suffix="giờ"
                                    class="statistic-value" />
                            </a-skeleton>
                        </a-card>
                    </a-col>
                </template>
            </a-row>
        </a-card>

        <!-- 4. Top KPI được submit/cập nhật nhiều nhất -->
        <a-card title="Top KPI được submit/cập nhật nhiều nhất" class="dashboard-card">
            <!-- Thêm (30 ngày qua, top 5) hoặc động nếu có filter -->
            <a-row :gutter="[16, 16]">
                <a-col v-if="topKpiActivityError" :span="24">
                    <a-alert message="Lỗi" :description="topKpiActivityError" type="error" show-icon />
                </a-col>
                <template v-if="!topKpiActivityError">
                    <a-col :xs="24" :sm="12">
                        <h4>Top KPI được submit nhiều nhất</h4>
                        <a-skeleton :loading="isLoadingTopKpiActivity" active avatar :paragraph="{ rows: 3 }">
                            <a-list bordered :dataSource="topKpiActivityStats?.submitted">
                                <template #renderItem="{ item }">
                                    <a-list-item>
                                        {{ item.name }} ({{ item.count }} lượt)
                                    </a-list-item>
                                </template>
                                <div v-if="!isLoadingTopKpiActivity && (!topKpiActivityStats?.submitted || topKpiActivityStats.submitted.length === 0)"
                                    class="empty-list">
                                    Chưa có dữ liệu
                                </div>
                            </a-list>
                        </a-skeleton>
                    </a-col>
                    <a-col :xs="24" :sm="12">
                        <h4>Top KPI được cập nhật nhiều nhất</h4>
                         <a-skeleton :loading="isLoadingTopKpiActivity" active avatar :paragraph="{ rows: 3 }">
                            <a-list bordered :dataSource="topKpiActivityStats?.updated">
                                <template #renderItem="{ item }">
                                    <a-list-item>
                                        {{ item.name }} ({{ item.count }} lượt)
                                    </a-list-item>
                                </template>
                                <div v-if="!isLoadingTopKpiActivity && (!topKpiActivityStats?.updated || topKpiActivityStats.updated.length === 0)"
                                    class="empty-list">
                                    Chưa có dữ liệu
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
import {  onMounted, computed } from 'vue';
import { useStore } from 'vuex';
// import { Card, Row, Col, Statistic, List } from 'ant-design-vue'; // These are likely globally registered or will be resolved by Vue
import { Skeleton as ASkeleton, Alert as AAlert } from 'ant-design-vue';

const store = useStore();

// Computed properties to get data from the dashboard store module
const kpiAwaitingApprovalStats = computed(() => store.getters['dashboard/getKpiAwaitingApprovalStats']);
const isLoadingKpiAwaitingStats = computed(() => store.getters['dashboard/isLoadingKpiAwaitingStats']);
const kpiAwaitingStatsError = computed(() => store.getters['dashboard/getKpiAwaitingStatsError']);

// Computed properties for KPI Status Over Time
const kpiStatusOverTimeStats = computed(() => store.getters['dashboard/getKpiStatusOverTimeStats']);
const isLoadingKpiStatusOverTime = computed(() => store.getters['dashboard/isLoadingKpiStatusOverTime']);
const kpiStatusOverTimeError = computed(() => store.getters['dashboard/getKpiStatusOverTimeError']);

// Computed properties for Average Approval Time
const averageApprovalTimeStats = computed(() => store.getters['dashboard/getAverageApprovalTimeStats']);
const isLoadingAverageApprovalTime = computed(() => store.getters['dashboard/isLoadingAverageApprovalTime']);
const averageApprovalTimeError = computed(() => store.getters['dashboard/getAverageApprovalTimeError']);

// Computed properties for Top KPI Activity
const topKpiActivityStats = computed(() => store.getters['dashboard/getTopKpiActivityStats']);
const isLoadingTopKpiActivity = computed(() => store.getters['dashboard/isLoadingTopKpiActivity']);
const topKpiActivityError = computed(() => store.getters['dashboard/getTopKpiActivityError']);

const fetchData = async () => {
    await fetchKpiAwaitingApprovalStats();
    await fetchKpiStatusOverTimeData(); 
    await fetchAverageApprovalTimeData();
    await fetchTopKpisData();
};

const fetchKpiAwaitingApprovalStats = async () => {
    try {
        await store.dispatch('dashboard/fetchKpiAwaitingApprovalStats');
    } catch (err) {
        console.error("Error dispatching fetchKpiAwaitingApprovalStats:", err);
        // Lỗi đã được xử lý và lưu trong store (kpiAwaitingStatsError)
    }
};

// Placeholder functions for other stats - you'll implement these similarly
const fetchKpiStatusOverTimeData = async (days = 7) => {
    try {
        await store.dispatch('dashboard/fetchKpiStatusOverTimeStats', { days });
    } catch (err) {
        console.error("Error dispatching fetchKpiStatusOverTimeStats:", err);
        // Lỗi đã được xử lý và lưu trong store
    }
};

const fetchAverageApprovalTimeData = async () => {
    try {
        await store.dispatch('dashboard/fetchAverageApprovalTimeStats');
    } catch (err) {
        console.error("Error dispatching fetchAverageApprovalTimeStats:", err);
        // Lỗi đã được xử lý và lưu trong store
    }
};

const fetchTopKpisData = async (days = 30, limit = 5) => {
    try {
        await store.dispatch('dashboard/fetchTopKpiActivityStats', { days, limit });
    } catch (err) {
        console.error("Error dispatching fetchTopKpiActivityStats:", err);
        // Lỗi đã được xử lý và lưu trong store
    }
};


onMounted(() => {
    fetchData();
});

</script>

<style scoped>
.kpi-process-statistics-container {
    padding: 24px;
}

.dashboard-card {
    margin-bottom: 24px;
}

.statistic-value {
    font-size: 20px;
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

.chart-placeholder {
    margin-top: 20px;
}

.empty-list {
    padding: 20px;
    text-align: center;
    color: #888;
}
</style>
