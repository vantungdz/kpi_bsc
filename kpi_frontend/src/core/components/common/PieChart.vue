<!-- e:\project\kpi-frontend\src\core\components\common\PieChart.vue -->
<template>
    <canvas ref="chartCanvas"></canvas>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import Chart from 'chart.js/auto';

const props = defineProps({
    chartData: {
        type: Object,
        required: true,
    },
    chartOptions: {
        type: Object,
        default: () => ({}),
    },
});

const chartCanvas = ref(null);
let chartInstance = null;

const renderChart = () => {
    if (chartInstance) {
        chartInstance.destroy();
    }
    if (chartCanvas.value) {
        chartInstance = new Chart(chartCanvas.value.getContext('2d'), {
      type: 'doughnut', // Or 'pie'
      data: props.chartData,
      options: props.chartOptions,
        });
    }
};

onMounted(() => {
    renderChart();
});

watch(() => props.chartData, () => {
    renderChart();
}, { deep: true });

watch(() => props.chartOptions, () => {
    renderChart();
}, { deep: true });

onBeforeUnmount(() => {
    if (chartInstance) {
        chartInstance.destroy();
    }
});
</script>
