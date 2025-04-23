<template>
  <a-card title="Performance Objectives" class="rounded-xl shadow-md">
    <!-- Thông tin người dùng -->
    <a-row class="mb-4" gutter="16" style="margin-bottom: 10px;">
      <a-col :span="8"><strong>Division:</strong> Production</a-col>
      <a-col :span="8"><strong>Full Name:</strong> Do Van Tung</a-col>
      <a-col :span="8"><strong>Rank:</strong> 1</a-col>
    </a-row>

    <!-- Bảng đánh giá -->
    <a-table
      :columns="columns"
      :data-source="data"
      :pagination="false"
      bordered
      rowKey="key"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <!-- Group Header -->
        <template v-if="record.isGroup && column.key === 'item'">
          <strong>{{ record.item }}</strong>
        </template>

        <!-- Điểm đánh giá -->
        <template v-else-if="['self', 'supervisor'].includes(column.key)">
          <a-select
            v-model:value="record[column.key]"
            :disabled="record.isGroup"
            size="small"
            style="width: 100%"
            @change="updateScore"
          >
            <a-select-option v-for="n in 5" :key="n" :value="n">{{ n }}</a-select-option>
          </a-select>
        </template>

        <!-- Weight Score cho Self -->
        <template v-else-if="column.key === 'scoreSelf'">
          <span>{{ calcScore(record.self, record.weight) }}</span>
        </template>

        <!-- Weight Score cho Supervisor -->
        <template v-else-if="column.key === 'scoreSupervisor'">
          <span>{{ calcScore(record.supervisor, record.weight) }}</span>
        </template>

        <!-- Mặc định -->
        <template v-else>
          {{ record[column.key] }}
        </template>
      </template>
    </a-table>

    <!-- Tổng kết -->
    <div class="mt-4 text-right">
      <p><strong>Total (Self):</strong> {{ totalSelf }}</p>
      <p><strong>Average (Self):</strong> {{ averageSelf.toFixed(2) }}</p>
      <p><strong>Total (Supervisor):</strong> {{ totalSupervisor }}</p>
      <p><strong>Average (Supervisor):</strong> {{ averageSupervisor.toFixed(2) }}</p>
    </div>
  </a-card>
</template>

<script setup>
import { reactive, computed } from 'vue';

const columns = [
  { title: 'Objectives Items', dataIndex: 'item', key: 'item' },
  { title: 'Target', dataIndex: 'target', key: 'target', width: 100 },
  { title: 'How to achieve', dataIndex: 'method', key: 'method' },
  { title: 'Actual Result', dataIndex: 'result', key: 'result', width: 120 },
  { title: 'Weight', dataIndex: 'weight', key: 'weight', width: 80 },
  { title: 'Self Eval', dataIndex: 'self', key: 'self', width: 100 },
  { title: 'Weight Score', dataIndex: 'scoreSelf', key: 'scoreSelf', width: 100 },
  { title: 'Supervisor Eval', dataIndex: 'supervisor', key: 'supervisor', width: 120 },
  { title: 'Weight Score', dataIndex: 'scoreSupervisor', key: 'scoreSupervisor', width: 100 },
];

const data = reactive([
  { key: 'group-a', isGroup: true, item: 'A. Performance Objectives' },
  { key: 'a1', item: 'A.1a Individual Efficiency (IE)', target: 'IE >= 3.0', method: 'IE = Ʃ (IEi x Wi) / Ʃ (Wi)', result: '', weight: 30, self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a2', item: 'A.2a Work Amount (WA)', target: 'WA >= 90%', method: 'WA = AVG (WAi)', result: '', weight: 20,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a3', item: 'A.3a Individual Quality (IQ)', target: 'IQ >= 3.0', method: 'IQ = AVG (IQi)', result: '', weight: 20,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a4', item: 'A.4 Customer Satisfaction (CS)', target: 'CS >= 3.0', method: 'CS= AVG (CSi)', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a5', item: 'A.5a Task Delivery (TD)', target: 'TD > 3.0', method: 'TD = AVG (TDi)', result: '', weight: 15,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a6', item: 'A.6 Process Compliance (PC)', target: 'PC >= 3', method: '', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a7', item: 'A.7 Security Compliance (SC)', target: 'SC >= 3', method: '', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'a8', item: 'A.8a Onsite Work (OW)', target: 'OW >= 3', method: '', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'group-b', isGroup: true, item: 'B. Training Objectives' },
  { key: 'b1', item: 'B.1 Improvement (IM)', target: 'IM > 3', method: 'AWS Training', result: '', weight: 15,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'b2', item: 'B.2 Contribution (CO)', target: 'CO > 3', method: 'AWS Training', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
  { key: 'b3', item: 'B.3 Language Capability (LC)', target: 'LC > 3', method: 'AWS Training', result: '', weight: 10,  self: null,scoreSelf: 0, supervisor: null, scoreSupervisor: 0 },
]);

// Tính điểm theo weight
const calcScore = (score, weight) => {
  return score ? score * weight : '';
};

// Tổng và trung bình self
const totalSelf = computed(() =>
  data.reduce((sum, item) => sum + (item.weight && item.self ? item.self * item.weight : 0), 0)
);

const averageSelf = computed(() => {
  const scored = data.filter(i => !i.isGroup && i.self);
  return scored.length ? totalSelf.value / scored.length : 0;
});

// Tổng và trung bình supervisor
const totalSupervisor = computed(() =>
  data.reduce((sum, item) => sum + (item.weight && item.supervisor ? item.supervisor * item.weight : 0), 0)
);

const averageSupervisor = computed(() => {
  const scored = data.filter(i => !i.isGroup && i.supervisor);
  return scored.length ? totalSupervisor.value / scored.length : 0;
});

const updateScore = () => {
  // Có thể trigger update tại đây nếu cần
};
</script>

<style scoped>
.mt-4 {
  margin-top: 1rem;
}
</style>
