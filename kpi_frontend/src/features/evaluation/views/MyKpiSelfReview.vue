<template>
  <div class="my-kpi-self-review">
    <h2>Đánh giá KPI cá nhân</h2>
    <a-alert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      show-icon
      closable
      @close="successMessage = ''"
    />
    <a-alert
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      show-icon
      closable
      @close="errorMessage = ''"
    />
    <div class="filters">
      <a-select
        v-model="selectedCycle"
        :options="cycleOptions"
        placeholder="Chọn chu kỳ"
        style="width: 200px; margin-right: 16px"
        @change="onCycleChange"
      />
    </div>
    <a-table
      :columns="columns"
      :data-source="kpis"
      row-key="id"
      bordered
      style="margin-top: 24px"
      :loading="loading"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'selfScore'">
          <a-rate
            v-model:value="record.selfScore"
            :count="5"
            allow-half
            :disabled="loading || successMessage"
          />
        </template>
        <template v-else-if="column.key === 'selfComment'">
          <a-textarea
            v-model:value="record.selfComment"
            rows="2"
            placeholder="Nhận xét cá nhân"
            :disabled="loading || successMessage"
          />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status, record)">{{
            getStatusText(record.status, record)
          }}</a-tag>
        </template>
      </template>
    </a-table>
    <a-button
      type="primary"
      @click="submitSelfReview"
      :loading="loading"
      style="margin-top: 24px"
      :disabled="!canSubmit || loading || successMessage"
      >Gửi đánh giá</a-button
    >
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useStore } from "vuex";
import {
  submitMyKpiSelfReview,
  getReviewCycles,
} from "@/core/services/kpiReviewApi";

const store = useStore();
const selectedCycle = ref();
const cycleOptions = ref([]);
const successMessage = ref("");
const errorMessage = ref("");

const kpis = ref([]); // Sử dụng ref thay vì computed để có thể gán dữ liệu sau khi fetch
const loading = ref(false);

const columns = [
  { title: "Tên KPI", dataIndex: ["kpi", "name"], key: "kpiName" },
  { title: "Mục tiêu", dataIndex: "targetValue", key: "targetValue" },
  { title: "Kết quả", dataIndex: "actualValue", key: "actualValue" },
  { title: "Tự chấm điểm", key: "selfScore" },
  { title: "Tự nhận xét", key: "selfComment" },
  { title: "Trạng thái", key: "status" },
];

const getStatusText = (status, record) => {
  // Nếu đã có selfScore và selfComment, nhưng status vẫn là PENDING, hiển thị "Đã gửi tự đánh giá"
  if (
    (!status || status === "PENDING") &&
    record.selfScore &&
    record.selfComment &&
    record.selfComment.trim().length > 0
  ) {
    return "Đã gửi tự đánh giá";
  }
  if (status === "MANAGER_REVIEWED") return "Đã gửi cấp trên";
  if (status === "COMPLETED") return "Hoàn thành";
  return "Chưa gửi";
};

const getStatusColor = (status, record) => {
  if (
    (!status || status === "PENDING") &&
    record.selfScore &&
    record.selfComment &&
    record.selfComment.trim().length > 0
  ) {
    return "blue";
  }
  if (status === "MANAGER_REVIEWED") return "blue";
  if (status === "COMPLETED") return "green";
  return "default";
};

const canSubmit = computed(() => {
  if (!kpis.value.length) return false;
  return kpis.value.every(
    (item) =>
      item.selfScore && item.selfComment && item.selfComment.trim().length > 0
  );
});

const fetchMyKpis = async () => {
  if (!selectedCycle.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    await store.dispatch("myKpiReviews/fetchMyKpiReviews", selectedCycle.value);
    kpis.value = store.getters["myKpiReviews/myKpiReviews"] || [];
    if (kpis.value.length === 0) {
      errorMessage.value =
        "Không có KPI nào đã được duyệt và có kết quả thực tế để tự đánh giá.";
    }
  } catch (e) {
    errorMessage.value = "Không tải được danh sách KPI.";
  } finally {
    loading.value = false;
  }
};

const fetchCycles = async () => {
  const res = await getReviewCycles();
  cycleOptions.value = res.map((c) => ({ label: c.name, value: c.id }));
};

const submitSelfReview = async () => {
  loading.value = true;
  try {
    await submitMyKpiSelfReview({
      cycle: selectedCycle.value,
      kpis: kpis.value.map((item) => ({
        id: item.id,
        selfScore: item.selfScore,
        selfComment: item.selfComment,
      })),
    });
    successMessage.value = "Gửi đánh giá thành công!";
    fetchMyKpis();
  } catch (e) {
    errorMessage.value = "Gửi đánh giá thất bại.";
  } finally {
    loading.value = false;
  }
};

const onCycleChange = (val) => {
  selectedCycle.value = val;
  fetchMyKpis();
};

onMounted(() => {
  fetchCycles();
});
</script>

<style scoped>
.my-kpi-self-review {
  padding: 24px;
}
.filters {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
</style>
