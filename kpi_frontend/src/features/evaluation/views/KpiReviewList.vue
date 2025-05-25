<template>
  <div class="kpi-review-list">
    <h2>Danh sách KPI cần review</h2>
    <div class="filters">
      <a-select
        v-model="selectedCycle"
        :options="cycleOptions"
        placeholder="Chọn chu kỳ"
        style="width: 200px; margin-right: 16px"
      />
      <a-select
        v-model="selectedStatus"
        :options="statusOptions"
        placeholder="Trạng thái review"
        style="width: 200px; margin-right: 16px"
      />
      <a-input
        v-model="searchText"
        placeholder="Tìm kiếm tên KPI, nhân viên..."
        style="width: 250px"
      />
      <a-button type="primary" @click="fetchReviews" style="margin-left: 16px"
        >Tìm kiếm</a-button
      >
    </div>
    <a-table
      :columns="columns"
      :data-source="filteredReviews"
      row-key="id"
      :loading="loading"
      bordered
      style="margin-top: 24px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-button type="link" @click="openReviewForm(record)"
            >Đánh giá</a-button
          >
          <a-button type="link" @click="viewHistory(record)">Lịch sử</a-button>
        </template>
      </template>
    </a-table>
    <ReviewFormModal
      v-if="showReviewForm"
      :review="selectedReview"
      :visible="showReviewForm"
      @close="closeReviewForm"
      @saved="onReviewSaved"
    />
    <ReviewHistoryModal
      v-if="showHistory"
      :review="selectedReview"
      :visible="showHistory"
      @close="closeHistory"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  getKpiReviewList,
  getReviewCycles,
} from "@/core/services/kpiReviewApi";
import ReviewFormModal from "./ReviewFormModal.vue";
import ReviewHistoryModal from "./ReviewHistoryModal.vue";

const reviews = ref([]);
const loading = ref(false);
const selectedCycle = ref();
const selectedStatus = ref();
const searchText = ref("");
const showReviewForm = ref(false);
const showHistory = ref(false);
const selectedReview = ref(null);
const cycleOptions = ref([]);
const statusOptions = [
  { label: "Tất cả", value: "" },
  { label: "Chờ review", value: "PENDING" },
  { label: "Đã review", value: "MANAGER_REVIEWED" },
  { label: "Chờ phản hồi", value: "EMPLOYEE_FEEDBACK" },
  { label: "Hoàn thành", value: "COMPLETED" },
];

const columns = [
  { title: "Tên KPI", dataIndex: ["kpi", "name"], key: "kpiName" },
  { title: "Nhân viên", dataIndex: ["employee", "fullName"], key: "employee" },
  { title: "Chu kỳ", dataIndex: "cycle", key: "cycle" },
  { title: "Mục tiêu", dataIndex: "targetValue", key: "targetValue" },
  { title: "Kết quả", dataIndex: "actualValue", key: "actualValue" },
  { title: "Trạng thái", dataIndex: "status", key: "status" },
  { title: "Điểm", dataIndex: "score", key: "score" },
  { title: "Hành động", key: "actions" },
];

const filteredReviews = computed(() => {
  let data = reviews.value;
  if (selectedCycle.value)
    data = data.filter((r) => r.cycle === selectedCycle.value);
  if (selectedStatus.value)
    data = data.filter((r) => r.status === selectedStatus.value);
  if (searchText.value) {
    const s = searchText.value.toLowerCase();
    data = data.filter(
      (r) =>
        r.kpi?.name?.toLowerCase().includes(s) ||
        r.employee?.fullName?.toLowerCase().includes(s)
    );
  }
  return data;
});

const fetchReviews = async () => {
  loading.value = true;
  try {
    const res = await getKpiReviewList({
      cycle: selectedCycle.value,
      status: selectedStatus.value,
    });
    reviews.value = res;
  } finally {
    loading.value = false;
  }
};

const fetchCycles = async () => {
  const res = await getReviewCycles();
  cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
};

const openReviewForm = (review) => {
  selectedReview.value = review;
  showReviewForm.value = true;
};
const closeReviewForm = () => {
  showReviewForm.value = false;
  selectedReview.value = null;
};
const onReviewSaved = () => {
  closeReviewForm();
  fetchReviews();
};
const viewHistory = (review) => {
  selectedReview.value = review;
  showHistory.value = true;
};
const closeHistory = () => {
  showHistory.value = false;
  selectedReview.value = null;
};

onMounted(() => {
  fetchCycles();
  fetchReviews();
});
</script>

<style scoped>
.kpi-review-list {
  padding: 24px;
}
.filters {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
</style>
