<template>
  <a-card title="KPI Detail">
    <a-descriptions :column="1" bordered>
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>KPI Information</span>
          <div v-if="!isEditing">
            <a-button type="primary" @click="toggleEditMode">Edit</a-button>
          </div>
          <div v-if="isEditing" style="display: flex; gap: 10px;">
            <a-button type="primary" @click="saveKpi">Save</a-button>
            <a-button type="default" @click="cancelEdit">Cancel</a-button>
          </div>
        </div>
      </template>

      <!-- KPI Hierarchy -->
      <a-descriptions-item label="Hierarchy">
        <template v-if="isEditing">
          <a-input v-model:value="editedKpi.hierarchy" />
        </template>
        <template v-else>{{ kpiDetail.hierarchy }}</template>
      </a-descriptions-item>

      <!-- KPI Description -->
      <a-descriptions-item label="Description">
        <template v-if="isEditing">
          <a-input v-model:value="editedKpi.description" />
        </template>
        <template v-else>{{ kpiDetail.description }}</template>
      </a-descriptions-item>

      <!-- KPI Unit -->
      <a-descriptions-item label="Unit">
        <template v-if="isEditing">
          <a-input v-model:value="editedKpi.unit" />
        </template>
        <template v-else>{{ kpiDetail.unit }}</template>
      </a-descriptions-item>

      <!-- KPI Target -->
      <a-descriptions-item label="Target">
        <template v-if="isEditing">
          <a-input v-model:value="editedKpi.target" />
        </template>
        <template v-else>{{ kpiDetail.target }}</template>
      </a-descriptions-item>

      <!-- KPI Weight -->
      <a-descriptions-item label="Weight">
        <template v-if="isEditing">
          <a-input v-model:value="editedKpi.weight" />
        </template>
        <template v-else>{{ kpiDetail.weight }}</template>
      </a-descriptions-item>

      <!-- KPI Frequency -->
      <a-descriptions-item label="Frequency">
        <template v-if="isEditing">
          <a-select v-model:value="editedKpi.frequency" placeholder="Frequency">
            <a-select-option value="daily">Daily</a-select-option>
            <a-select-option value="weekly">Weekly</a-select-option>
            <a-select-option value="monthly">Monthly</a-select-option>
            <a-select-option value="quarterly">Quarterly</a-select-option>
            <a-select-option value="yearly">Yearly</a-select-option>
          </a-select>
        </template>
        <template v-else>{{ kpiDetail.frequency }}</template>
      </a-descriptions-item>
    </a-descriptions>

    <!-- Progress Chart -->
    <a-card title="Progress Chart (vs Target)" style="margin-top: 20px;">
      <a-skeleton :loading="loading" active>
        <div v-for="(item, index) in progressData" :key="index">
          <Progress :stroke-color="{ '0%': '#108ee9', '100%': '#87d068' }" :percent="formatPercent(item.percent)" :title="item.title" />
        </div>
      </a-skeleton>
    </a-card>

    <!-- Update Progress Form -->
    <a-card title="Update Progress" style="margin-top: 20px;">
      <a-form layout="vertical">
        <a-form-item label="Value Achieved">
          <a-input v-model:value="updateData.value" placeholder="Enter achieved value" />
        </a-form-item>
        <a-form-item label="Date">
          <a-date-picker v-model:value="updateData.timestamp" style="width: 100%" />
        </a-form-item>
        <a-form-item label="Note (Optional)">
          <a-textarea v-model:value="updateData.notes" rows="2" />
        </a-form-item>
        <a-button type="primary" @click="submitUpdate">Update Progress</a-button>
      </a-form>
    </a-card>

    <!-- Update History Table -->
    <a-card title="Update History" style="margin-top: 20px;">
      <a-table :data-source="kpiDetail.history" :columns="historyColumns" row-key="date" />
    </a-card>

    <!-- KPI Evaluations -->
    <a-card title="KPI Evaluations" style="margin-top: 20px;">
      <a-button type="primary" style="margin-bottom: 10px;">Evaluate this KPI</a-button>
      <a-table :data-source="kpiEvaluations" :columns="evaluationColumns" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'evaluator'">
            <a-avatar :src="record.evaluator.avatar_url" style="margin-right: 8px" />
            {{ record.evaluator.first_name }} {{ record.evaluator.last_name }}
          </template>
          <template v-else-if="column.dataIndex === 'evaluatee'">
            <a-avatar :src="record.evaluatee.avatar_url" style="margin-right: 8px" />
            {{ record.evaluatee.first_name }} {{ record.evaluatee.last_name }}
          </template>
          <template v-else-if="column.dataIndex === 'evaluation_date'">
            {{ new Date(record.evaluation_date).toLocaleDateString() }}
          </template>
          <template v-else-if="column.dataIndex === 'period'">
            {{ record.period_start_date }} - {{ record.period_end_date }}
          </template>
          <template v-if="column.dataIndex === 'status'">
            <a-tag :bordered="false" :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'actions'">
            <a-button type="link" @click="viewEvaluation(record)">Xem</a-button>
          </template>
        </template>
      </a-table>

      <!-- Modal for KPI Evaluation Details -->
      <a-modal 
        v-model:visible="isModalVisible" 
        title="KPI Evaluation Details" 
        :width="1000"
        @ok="closeModal" 
        @cancel="closeModal"
      >
        <a-descriptions bordered :column="2">
          <a-descriptions-item label="Evaluator">
            <a-avatar :src="selectedEvaluation.evaluator?.avatar_url" style="margin-right: 8px" />
            {{ selectedEvaluation.evaluator?.first_name }} {{ selectedEvaluation.evaluator?.last_name }}
          </a-descriptions-item>
          <a-descriptions-item label="Evaluatee">
            <a-avatar :src="selectedEvaluation.evaluatee?.avatar_url" style="margin-right: 8px" />
            {{ selectedEvaluation.evaluatee?.first_name }} {{ selectedEvaluation.evaluatee?.last_name }}
          </a-descriptions-item>
          <a-descriptions-item label="Period">
            {{ selectedEvaluation.period_start_date }} - {{ selectedEvaluation.period_end_date }}
          </a-descriptions-item>
          <a-descriptions-item label="Date">
            {{ new Date(selectedEvaluation.evaluation_date).toLocaleDateString() }}
          </a-descriptions-item>
          <a-descriptions-item label="Rating">
            {{ selectedEvaluation.rating }}
          </a-descriptions-item>
          <a-descriptions-item label="Status">
            <a-tag :bordered="false" :color="getStatusColor(selectedEvaluation.status)">
              {{ getStatusText(selectedEvaluation.status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="Comment" :span="2">
            {{ selectedEvaluation.comments }}
          </a-descriptions-item>
        </a-descriptions>
      </a-modal>
    </a-card>
  </a-card>
</template>

<script setup>
import { ref, onMounted,computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import axios from 'axios';
import { notification, Progress } from 'ant-design-vue';

const store = useStore();
const route = useRoute();
const kpiDetail = ref({});
const updateData = ref({ value: '', timestamp: null, notes: '' });
const isEditing = ref(false);
const editedKpi = ref({});
const isModalVisible = ref(false);
const loading = ref(true);
const selectedEvaluation = ref({});
const progressData = ref([]);

const historyColumns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Value', dataIndex: 'value', key: 'value' },
  { title: 'User', dataIndex: 'user', key: 'user' },
  { title: 'Note', dataIndex: 'note', key: 'note' }
];

const evaluationColumns = [
  { title: 'Evaluator', dataIndex: 'evaluator', key: 'evaluator' },
  { title: 'Evaluatee', dataIndex: 'evaluatee', key: 'evaluatee' },
  { title: 'Period', dataIndex: 'period', key: 'period' },
  { title: 'Rating', dataIndex: 'rating', key: 'rating' },
  { title: 'Date', dataIndex: 'evaluation_date', key: 'evaluation_date' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Actions', dataIndex: 'actions', key: 'actions' }
];

const kpiEvaluations = computed(() => store.getters.allEvaluations);

const getStatusColor = (status) => {
  return status === 'Met' ? 'success' : 'red';
};

const getStatusText = (status) => {
  return status === 'Met' ? 'Met' : 'Nháp';
};

const formatPercent = (value) => {
  return parseFloat(value.toFixed(2));
};

// Toggle between edit and view mode
const toggleEditMode = () => {
  isEditing.value = !isEditing.value;
  if (isEditing.value) {
    editedKpi.value = { ...kpiDetail.value }
  }
};

// Save the edited KPI data
const saveKpi = async () => {
  try {
    const updatedFields = {};

    for (const key in editedKpi.value) {
      if (editedKpi.value[key] !== kpiDetail.value[key]) {
        updatedFields[key] = editedKpi.value[key];
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      await axios.patch(`http://localhost:3000/kpis/${route.params.id}`, updatedFields);
      notification.success({ message: 'KPI updated successfully!' });
      loadKpiDetail(); 
      isEditing.value = false; 
    } else {
      notification.info({ message: 'No changes detected!' });
    }
  } catch (error) {
    notification.error({ message: 'Error updating KPI' });
  }
};

// Cancel the edit and reset to original KPI data
const cancelEdit = () => {
  editedKpi.value = { ...kpiDetail.value }; // Reset editedKpi to original data
  isEditing.value = false; // Exit edit mode without saving
};

const loadKpiDetail = async () => {
  try {
    const response = await axios.get(`http://localhost:3000/kpis/${route.params.id}`);
    kpiDetail.value = response.data;
    loading.value = false;
    processProgressData();
  } catch (error) {
    notification.error({ message: 'Error loading KPI data.' });
    loading.value = false;
  }
};

const processProgressData = () => {
  const data = kpiDetail.value;
  const achievedProgress = isNaN(parseFloat(data.values[0]?.value)) ? 0 : parseFloat(data.values[0]?.value);
  const targetProgress = isNaN(parseFloat(data.target)) ? 0 : parseFloat(data.target);

  progressData.value = [{
    title: 'Company Revenue Progress',
    percent: Math.min((achievedProgress / targetProgress) * 100, 100)
  }];

  if (data.children) {
    data.children.forEach(child => {
      const childAchieved = isNaN(parseFloat(child.values[0]?.value)) ? 0 : parseFloat(child.values[0]?.value);
      const childTarget = isNaN(parseFloat(child.target)) ? 0 : parseFloat(child.target);

      progressData.value.push({
        title: child.name,
        percent: Math.min((childAchieved / childTarget) * 100, 100)
      });
    });
  }
};

const viewEvaluation = (record) => {
  selectedEvaluation.value = record;
  isModalVisible.value = true;
};

const closeModal = () => {
  isModalVisible.value = false;
};

const submitUpdate = async () => {
  try {
    await axios.patch(`http://localhost:3000/kpi-values/${route.params.id}`, updateData.value);
    notification.success({ message: 'Progress update successful!' });
    loadKpiDetail();
  } catch (error) {
    notification.error({ message: 'Update failed!' });
  }
};

onMounted(() => {
  store.dispatch('fetchEvaluations');
  loadKpiDetail();
});
</script>
