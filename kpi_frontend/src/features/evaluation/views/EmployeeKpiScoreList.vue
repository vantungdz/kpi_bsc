<template>
  <div class="employee-kpi-score-list">
    <a-row style="margin-bottom: 20px">
      <a-col :span="8">
        <a-form-item :label="$t('selectCycle')">
          <a-select v-model:value="selectedCycle" :placeholder="$t('selectCyclePlaceholder')" @change="fetchScores" :loading="isLoadingCycles">
            <a-select-option v-for="cycle in reviewCycles" :key="cycle.id" :value="cycle.id">
              {{ cycle.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-table :columns="columns" :data-source="employeeScores" row-key="employeeId" :loading="isLoadingScores" @row-click="goToKpiReview">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.fullName }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department || $t('noData') }}
        </template>
        <template v-else-if="column.dataIndex === 'totalWeightedScore'">
          <span style="font-weight: bold; color: #1890ff">{{ record.totalWeightedScore }}</span>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Row as ARow, Col as ACol, FormItem as AFormItem, Select as ASelect, SelectOption as ASelectOption, Table as ATable } from 'ant-design-vue';

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();

const selectedCycle = ref(null);
const reviewCycles = computed(() => store.getters['kpiEvaluations/getReviewCycles']);
const isLoadingCycles = computed(() => store.getters['kpiEvaluations/isLoadingReviewCycles']);

const employeeScores = ref([]);
const isLoadingScores = ref(false);

const columns = computed(() => [
  { title: $t('employeeFullName'), dataIndex: 'fullName', key: 'fullName' },
  { title: $t('departmentLabel'), dataIndex: 'department', key: 'department' },
  { title: $t('totalWeightedScoreSupervisor'), dataIndex: 'totalWeightedScore', key: 'totalWeightedScore' },
]);

const fetchScores = async () => {
  if (!selectedCycle.value) return;
  isLoadingScores.value = true;
  try {
    const result = await store.dispatch('kpiEvaluations/fetchEmployeeKpiScores', { cycleId: selectedCycle.value });
    employeeScores.value = (result || []).map(emp => ({
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      department: emp.department,
      totalWeightedScore: emp.totalWeightedScore,
    }));
  } catch (e) {
    employeeScores.value = [];
  } finally {
    isLoadingScores.value = false;
  }
};

const goToKpiReview = (record) => {
  if (!record || !selectedCycle.value) return;
  router.push({
    name: 'KpiReview',
    query: { targetType: 'employee', targetId: record.employeeId, cycleId: selectedCycle.value },
  });
};

onMounted(async () => {
  await store.dispatch('kpiEvaluations/fetchReviewCycles');
});
</script>

<style scoped>
.employee-kpi-score-list {
  padding: 24px;
}
</style>
