<template>
  <div class="employee-performance-history-container">
    <h1>{{ $t("employeePerformanceHistory.title") }}</h1>
    <a-form layout="inline" @submit.prevent>
      <a-form-item :label="$t('employeePerformanceHistory.employee')">
        <a-select
          v-model:value="selectedEmployeeId"
          :options="employeeOptions"
          show-search
          :placeholder="$t('employeePerformanceHistory.employee')"
          style="min-width: 220px"
          @change="fetchPerformanceHistory"
        />
      </a-form-item>
      <a-form-item :label="$t('employeePerformanceHistory.fromYear')">
        <a-input-number v-model:value="fromYear" :min="2015" :max="toYear" @change="fetchPerformanceHistory" />
      </a-form-item>
      <a-form-item :label="$t('employeePerformanceHistory.toYear')">
        <a-input-number v-model:value="toYear" :min="fromYear" :max="new Date().getFullYear()" @change="fetchPerformanceHistory" />
      </a-form-item>
    </a-form>

    <div v-if="loading" class="loading"><a-spin /> {{ $t("employeePerformanceHistory.loading") }}</div>
    <div v-else-if="performanceHistory && performanceHistory.length">
      <div class="chart-section" v-if="performanceHistory.length > 1">
        <h3>{{ $t("employeePerformanceHistory.chartTitle") }}</h3>
        <line-chart :chart-data="chartData" :chart-options="chartOptions" />
      </div>
      <div v-else class="chart-section" style="text-align:center; color:#888;">
        <h3>{{ $t("employeePerformanceHistory.chartTitle") }}</h3>
        <div>{{ $t("employeePerformanceHistory.onlyOneYear") }}</div>
      </div>
      <div class="table-section">
        <h3>{{ $t("employeePerformanceHistory.tableTitle") }}</h3>
        <a-table :columns="columns" :data-source="performanceHistory" row-key="year" bordered size="small" />
      </div>
      <div class="highlight-section" v-if="highlightComments.length">
        <h3>{{ $t("employeePerformanceHistory.highlightTitle") }}</h3>
        <ul>
          <li v-for="(c, idx) in highlightComments" :key="idx">{{ c }}</li>
        </ul>
      </div>
    </div>
    <div v-else-if="selectedEmployeeId && !loading">
      <a-empty :description="$t('employeePerformanceHistory.noData')" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useStore } from 'vuex';
import LineChart from '@/core/components/common/LineChart.vue';
import { useI18n } from "vue-i18n";

const store = useStore();
const selectedEmployeeId = ref();
const fromYear = ref(new Date().getFullYear() - 3);
const toYear = ref(new Date().getFullYear());
const employeeOptions = ref([]);
const performanceHistory = ref([]);
const loading = ref(false);
const highlightComments = ref([]);
const { t: $t } = useI18n();

const columns = computed(() => [
  { title: $t("employeePerformanceHistory.colYear"), dataIndex: 'year', key: 'year' },
  { title: $t("employeePerformanceHistory.colAvgScore"), dataIndex: 'averageKpiScore', key: 'averageKpiScore', customRender: ({ text }) => text != null ? Number(text).toFixed(2) : '' },
  { title: $t("employeePerformanceHistory.colAchievedRate"), dataIndex: 'achievedRate', key: 'achievedRate', customRender: ({ text }) => text != null ? Number(text).toFixed(2) : '' },
  { title: $t("employeePerformanceHistory.colAchievedCount"), dataIndex: 'achievedCount', key: 'achievedCount' },
  { title: $t("employeePerformanceHistory.colNotAchievedCount"), dataIndex: 'notAchievedCount', key: 'notAchievedCount' }
]);

const chartData = computed(() => {
  if (!performanceHistory.value.length) return null;
  return {
    labels: performanceHistory.value.map((item) => item.year),
    datasets: [
      {
        label: $t("employeePerformanceHistory.colAvgScore"),
        data: performanceHistory.value.map((item) => item.averageKpiScore != null ? Number(item.averageKpiScore.toFixed(2)) : 0),
        borderColor: '#1890ff',
        backgroundColor: 'rgba(24,144,255,0.1)',
        yAxisID: 'y'
      },
      {
        label: $t("employeePerformanceHistory.colAchievedRate"),
        data: performanceHistory.value.map((item) => item.achievedRate != null ? Number(item.achievedRate.toFixed(2)) : 0),
        borderColor: '#52c41a',
        backgroundColor: 'rgba(82,196,26,0.1)',
        yAxisID: 'y1'
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
        callback: function(value) {
          return value + '%';
        }
      }
    },
    y1: {
      beginAtZero: true,
      position: 'right',
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        precision: 0,
        callback: function(value) {
          return value + '%';
        }
      }
    }
  },
  plugins: {
    legend: { display: true }
  }
};

async function fetchEmployees() {
  try {
    await store.dispatch('employees/fetchUsers', { force: true });
    employeeOptions.value = store.getters['employees/userList'].map((e) => ({
      label: `${e.first_name} ${e.last_name}`,
      value: e.id,
    }));
  } catch (err) {
    message.error('Không thể tải danh sách nhân viên');
  }
}

async function fetchPerformanceHistory() {
  if (!selectedEmployeeId.value) return;
  loading.value = true;
  try {
    const data = await store.dispatch('employees/fetchEmployeePerformanceHistory', {
      employeeId: selectedEmployeeId.value,
      fromYear: fromYear.value,
      toYear: toYear.value,
    });
    performanceHistory.value = (data.years && Array.isArray(data.years)) ? data.years : [];
    highlightComments.value = data.years
      ? data.years.flatMap((item) => item.highlightComments || [])
      : [];
  } catch (err) {
    message.error('Không thể tải dữ liệu hiệu suất');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchEmployees();
});
</script>

<style scoped>
.employee-performance-history-container {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
}
.chart-section {
  margin: 24px 0 16px 0;
  min-height: 320px;
  max-height: 400px;
  height: 400px;
  position: relative;
}
.line-chart {
  height: 100% !important;
  min-height: 320px;
  max-height: 400px;
}
.table-section {
  margin-top: 40px;
  margin-bottom: 24px;
}
.highlight-section {
  margin-bottom: 24px;
}
.loading {
  margin: 32px 0;
  text-align: center;
}
</style>
