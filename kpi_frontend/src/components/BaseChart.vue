<template>
  <div class="chart-wrapper">
    <Line v-if="type === 'line'" :id="chartId" :options="computedOptions" :data="chartData" :style="styles" :plugins="plugins" />
    <!-- Add other chart types similarly -->
    <div v-else class="chart-error">Unsupported chart type: {{ type }}</div>
  </div>
</template>

<script setup>
import { Line} from 'vue-chartjs'; 
// other imports and code
</script>

<style scoped>
.chart-wrapper {
  position: relative;
}
.chart-error {
  color: red;
  text-align: center;
}
</style>
