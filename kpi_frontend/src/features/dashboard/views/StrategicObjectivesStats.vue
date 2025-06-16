<template>
  <div class="strategic-objectives-stats-container">
    <h2 class="stats-title">
      <bar-chart-outlined style="font-size: 1.5em; margin-right: 8px; color: #1890ff;" />
      {{ $t('strategicObjectivesStats') }}
    </h2>
    <a-row :gutter="[24, 24]" justify="center" align="middle">
      <a-col :xs="24" :md="12" :lg="10">
        <a-card class="stats-card card-objective-status">
          <template #title>
            <bar-chart-outlined style="color:#52c41a; margin-right:6px;" />
            <span class="card-title">{{ $t('objectiveStatusByPerspective') }}</span>
          </template>
          <div class="chart-wrapper">
            <Bar v-if="statusPerspectiveChartData && statusPerspectiveChartData.labels && statusPerspectiveChartData.labels.length > 0" :data="statusPerspectiveChartData" :options="barOptions" />
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :md="12" :lg="10">
        <a-card class="stats-card card-objective-progress">
          <template #title>
            <bar-chart-outlined style="color:#1890ff; margin-right:6px;" />
            <span class="card-title">{{ $t('objectiveProgressDistribution') }}</span>
          </template>
          <div class="chart-wrapper">
            <Doughnut v-if="progressDistributionChartData && progressDistributionChartData.labels && progressDistributionChartData.labels.length > 0" :data="progressDistributionChartData"
              :options="doughnutOptions" />
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { Bar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js';
import { useStore } from "vuex";
import { ref, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BarChartOutlined } from "@ant-design/icons-vue";
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement);

const store = useStore();
const statusPerspectiveChartData = ref(null);
const progressDistributionChartData = ref(null);
const { t: $t, locale } = useI18n();

const barOptions = {
  responsive: true,
  plugins: { legend: { position: 'top' }, title: { display: false } },
  indexAxis: 'y',
  scales: { x: { beginAtZero: true } }
};
const doughnutOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' } }
};

async function updateCharts() {
  const res1 = await store.dispatch('dashboard/fetchObjectiveStatusPerspectiveStats');
  if (res1) {
    const labels = res1.map(i => i.perspective);
    statusPerspectiveChartData.value = null;
    statusPerspectiveChartData.value = {
      labels,
      datasets: [
        {
          label: $t('active'),
          backgroundColor: '#52c41a',
          data: res1.map(i => i.active)
        },
        {
          label: $t('inactive'),
          backgroundColor: '#bfbfbf',
          data: res1.map(i => i.inactive)
        }
      ]
    };
  }
  const res2 = await store.dispatch('dashboard/fetchObjectiveProgressDistributionStats');
  if (res2) {
    progressDistributionChartData.value = null;
    progressDistributionChartData.value = {
      labels: res2.map(i => i.label),
      datasets: [
        {
          label: $t('objectiveCount'),
          backgroundColor: ['#f5222d','#faad14','#1890ff','#52c41a','#13c2c2'],
          data: res2.map(i => i.count)
        }
      ]
    };
  }
}

onMounted(updateCharts);
watch(locale, updateCharts);
</script>

<style scoped>
.strategic-objectives-stats-container {
  padding: 32px 12px 24px 12px;
  min-height: 100vh;
  background: #f7fafd;
}
.stats-title {
  font-size: 1.6em;
  font-weight: 600;
  margin-bottom: 28px;
  color: #222;
  display: flex;
  align-items: center;
}
.stats-card {
  border-radius: 18px;
  box-shadow: 0 2px 16px 0 rgba(24, 144, 255, 0.08);
  background: #fff;
  padding: 18px 12px 12px 12px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.card-title {
  font-size: 1.15em;
  font-weight: 500;
  color: #222;
}
.chart-wrapper {
  width: 100%;
  height: 340px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 0 0;
}
.card-objective-status {
  border-left: 5px solid #52c41a;
}
.card-objective-progress {
  border-left: 5px solid #1890ff;
}
/* Responsive */
@media (max-width: 900px) {
  .stats-card {
    min-height: 320px;
  }
  .chart-wrapper {
    height: 220px;
  }
}
@media (max-width: 600px) {
  .stats-title {
    font-size: 1.1em;
  }
  .stats-card {
    min-height: 220px;
    padding: 10px 2px 2px 2px;
  }
  .chart-wrapper {
    height: 160px;
  }
}
</style>
